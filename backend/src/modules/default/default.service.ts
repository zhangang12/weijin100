import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MarginService } from '../margin/margin.service';
import { ConfigService } from '../../config/config.service';
import { BizException } from '../../common/biz-exception';

/** E1 处罚阶梯：第 n 次违约 → 限制天数 + 降级级数（第 4 次起清零至 L1）。 */
const PENALTY_LADDER = [
  { days: 3, drop: 1 },
  { days: 7, drop: 2 },
  { days: 15, drop: 3 },
];

@Injectable()
export class DefaultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly margin: MarginService,
    private readonly config: ConfigService,
  ) {}

  async summary(userId: string) {
    const since = new Date(Date.now() - 365 * 24 * 3600 * 1000);
    const defaultCount12m = await this.prisma.defaultRecord.count({ where: { userId, createdAt: { gte: since } } });
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    return { defaultCount12m, functionStatus: u?.functionStatus ?? 'normal', tradesToRepair: 30 };
  }

  async records(userId: string) {
    const rows = await this.prisma.defaultRecord.findMany({ where: { userId }, include: { order: true }, orderBy: { createdAt: 'desc' } });
    const list = rows.map((r) => ({
      id: r.id,
      type: r.type,
      role: r.role,
      weight: r.weight != null ? Number(r.weight) : null,
      deductAmount: Number(r.deductAmount),
      penalty: r.penalty,
      relatedOrderNo: r.order?.orderNo ?? null,
      recordStatus: r.recordStatus,
      appealDeadline: r.appealDeadline?.toISOString() ?? null,
      createTime: r.createdAt.toISOString(),
    }));
    return { list, page: 1, pageSize: list.length, total: list.length, hasMore: false };
  }

  async appeal(userId: string, defaultId: string, dto: { reason: string; evidence?: string[] }) {
    const rec = await this.prisma.defaultRecord.findFirst({ where: { id: defaultId, userId } });
    if (!rec) throw new BizException('违约记录不存在', 'NOT_FOUND', 2004);
    if (rec.appealDeadline && rec.appealDeadline < new Date()) throw new BizException('已过申诉期', 'APPEAL_EXPIRED', 3008);
    if (!dto?.reason) throw new BizException('请填写申诉理由', 'PARAM', 2000);
    const existing = await this.prisma.appeal.findUnique({ where: { defaultId } });
    if (existing) throw new BizException('已提交申诉', 'APPEAL_EXISTS', 3009);
    await this.prisma.$transaction([
      this.prisma.appeal.create({ data: { defaultId, userId, reason: dto.reason, evidence: dto.evidence ?? [] } }),
      this.prisma.defaultRecord.update({ where: { id: defaultId }, data: { recordStatus: 'appealing' } }),
    ]);
    return { ok: true, status: 'appealing' };
  }

  async recordTimeout(userId: string, orderId: string, role: string, weight: number) {
    // 扣罚金额：暂定 100 分（¥1），后续按规则调整
    const deductFen = 100n;
    try {
      await this.margin.deduct(userId, Number(deductFen));
    } catch {
      // 保证金不足时记录仍创建，不抛出
    }
    return this.prisma.defaultRecord.create({
      data: {
        userId,
        orderId,
        type: '超时未交割',
        role,
        weight,
        deductAmount: deductFen,
        penalty: '记录违约一次',
        recordStatus: 'active',
        appealDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  /**
   * 平台判定违约（E1/E2）：按累计次数走处罚阶梯 + 扣罚保证金赔付对手方 + 降级 + 受限。
   * 由平台人工仲裁判定后调用（自动判违约已按 A2/B3 撤除）。
   * @param opts.metal/weight 用于 E2 扣款 = 克重 × 保证金单价；opts.counterpartyId 为赔付对象。
   */
  async recordDefault(opts: {
    userId: string; counterpartyId?: string; orderId?: string;
    type: string; role: string; metal?: string; weight?: number; deductFen?: number;
  }) {
    // 近 12 个月未修复违约数（E3 累计口径）→ 本次为第 n 次。
    const since = new Date(Date.now() - 365 * 24 * 3600 * 1000);
    const prior = await this.prisma.defaultRecord.count({
      where: { userId: opts.userId, createdAt: { gte: since }, recordStatus: { in: ['active', 'appealing'] } },
    });
    const n = prior + 1;
    const tier = n <= 3 ? PENALTY_LADDER[n - 1] : { days: 30, drop: -1 }; // -1 = 清零至 L1
    const penalty = tier.drop === -1 ? `限制30天 + 清零至L1` : `限制${tier.days}天 + 降${tier.drop}级`;

    // E2：扣款 = 违约克重 × 保证金单价（金 ¥10/g 等），赔付对手方。
    const deductFen = opts.metal && opts.weight != null
      ? this.config.freezeFenFor(opts.metal, opts.weight)
      : (opts.deductFen ?? 0);
    if (deductFen > 0) {
      await this.margin.deduct(opts.userId, deductFen, opts.orderId);
      if (opts.counterpartyId) await this.margin.compensate(opts.counterpartyId, deductFen, opts.orderId);
    }

    const rec = await this.prisma.defaultRecord.create({
      data: {
        userId: opts.userId,
        orderId: opts.orderId,
        type: opts.type,
        role: opts.role,
        weight: opts.weight,
        deductAmount: BigInt(deductFen),
        penalty,
        recordStatus: 'active',
        appealDeadline: new Date(Date.now() + 24 * 3600 * 1000), // E4：24h 申诉窗口
      },
    });

    const u = await this.prisma.user.findUnique({ where: { id: opts.userId } });
    const newLevel = tier.drop === -1 ? 1 : Math.max(1, (u?.level ?? 1) - tier.drop);
    await this.prisma.user.update({
      where: { id: opts.userId },
      // E5：功能限制期内可看行情/管理订单，不能发布/锁价（由 eligibility/守卫拦截）。
      // 限制到期恢复 functionStatus=normal 需调度器（外部依赖，见待办）。
      data: { level: newLevel, functionStatus: 'limited' },
    });
    return rec;
  }
}
