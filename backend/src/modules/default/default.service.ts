import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MarginService } from '../margin/margin.service';
import { BizException } from '../../common/biz-exception';

@Injectable()
export class DefaultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly margin: MarginService,
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
   * 系统记违约（由超时/仲裁触发；当前供内部调用，自动判定需调度器+业务策略）。
   * 扣罚保证金 + 降级 + 受限。
   */
  async recordDefault(opts: { userId: string; orderId?: string; type: string; role: string; weight?: number; deductFen: number; penalty: string }) {
    await this.margin.deduct(opts.userId, opts.deductFen, opts.orderId);
    const rec = await this.prisma.defaultRecord.create({
      data: {
        userId: opts.userId,
        orderId: opts.orderId,
        type: opts.type,
        role: opts.role,
        weight: opts.weight,
        deductAmount: BigInt(opts.deductFen),
        penalty: opts.penalty,
        recordStatus: 'active',
        appealDeadline: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    const u = await this.prisma.user.findUnique({ where: { id: opts.userId } });
    await this.prisma.user.update({
      where: { id: opts.userId },
      data: { level: Math.max(0, (u?.level ?? 0) - 1), functionStatus: 'limited' },
    });
    return rec;
  }
}
