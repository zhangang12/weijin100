import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BizException } from '../../common/biz-exception';

/** 费率表（运营期免佣；正式费率业务待给，此为占位可配置）。 */
const FEE_TABLE = [
  { level: 'L1', gold: '0.30', silver: '0.020', platinum: '0.15' },
  { level: 'L3', gold: '0.26', silver: '0.018', platinum: '0.13' },
  { level: 'L5', gold: '0.22', silver: '0.015', platinum: '0.11' },
  { level: 'L7', gold: '0.18', silver: '0.012', platinum: '0.09' },
  { level: 'L9', gold: '0.15', silver: '0.010', platinum: '0.08' },
];

@Injectable()
export class LevelService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new BizException('用户不存在', 'USER_NOT_FOUND', 2004);
    const lv = u.level;
    const trades = u.completedTrades;
    const nextThreshold = (lv + 1) * 10; // 占位升级规则
    const tradesToNext = Math.max(0, nextThreshold - trades);
    const progressPercent = Math.min(100, Math.round((trades / nextThreshold) * 100));
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
