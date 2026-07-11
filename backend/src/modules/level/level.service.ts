import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BizException } from '../../common/biz-exception';

/** 费率表 L1–L9（运营期免佣；正式费率业务待给，此为占位可配置）。 */
const FEE_TABLE = [
  { level: 'L1', gold: '0.30', silver: '0.020', platinum: '0.15' },
  { level: 'L2', gold: '0.28', silver: '0.019', platinum: '0.14' },
  { level: 'L3', gold: '0.26', silver: '0.018', platinum: '0.13' },
  { level: 'L4', gold: '0.24', silver: '0.016', platinum: '0.12' },
  { level: 'L5', gold: '0.22', silver: '0.015', platinum: '0.11' },
  { level: 'L6', gold: '0.20', silver: '0.013', platinum: '0.10' },
  { level: 'L7', gold: '0.18', silver: '0.012', platinum: '0.09' },
  { level: 'L8', gold: '0.16', silver: '0.011', platinum: '0.085' },
  { level: 'L9', gold: '0.15', silver: '0.010', platinum: '0.08' },
];

const MAX_LEVEL = 9;

@Injectable()
export class LevelService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new BizException('用户不存在', 'USER_NOT_FOUND', 2004);
    // D1：每 10 笔升 1 级，L1–L9（买卖各计 1 笔，completedTrades 已累计）。
    const lv = Math.min(MAX_LEVEL, Math.max(1, u.level));
    const trades = u.completedTrades;
    const base = (lv - 1) * 10;          // 本级起点累计笔数
    const next = lv * 10;                // 升级门槛
    const inLevel = Math.max(0, trades - base);
    const atMax = lv >= MAX_LEVEL;
    const tradesToNext = atMax ? 0 : Math.max(0, next - trades);
    const progressPercent = atMax ? 100 : Math.min(100, Math.round((inLevel / 10) * 100));
    return {
      currentLevel: 'L' + lv,
      completedTrades: trades,
      tradesToNext,
      progressPercent,
      feeWaived: true, // 运营期免佣
      feeTable: FEE_TABLE,
    };
  }
}
