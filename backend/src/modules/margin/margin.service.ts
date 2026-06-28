import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BizException } from '../../common/biz-exception';

/** 保证金账户。金额一律「分」(BigInt) 存储；对外输出转 number(分)。 */
@Injectable()
export class MarginService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensure(userId: string) {
    return this.prisma.marginAccount.upsert({ where: { userId }, update: {}, create: { userId } });
  }

  async account(userId: string) {
    const a = await this.ensure(userId);
    return {
      totalBalance: Number(a.totalBalance),
      available: Number(a.available),
      frozen: Number(a.frozen),
      refundable: Number(a.available),
      quota: { gold: 300, silver: 6000, platinum: 600 },
    };
  }

  /** 充值（dev：直接到账；正式走微信支付回调后入账）。amountFen 分。 */
  async recharge(userId: string, amountFen: number) {
    if (!amountFen || amountFen <= 0) throw new BizException('充值金额非法', 'AMOUNT_INVALID', 2000);
    const a = await this.ensure(userId);
    const total = a.totalBalance + BigInt(amountFen);
    const avail = a.available + BigInt(amountFen);
    await this.prisma.$transaction([
      this.prisma.marginAccount.update({ where: { userId }, data: { totalBalance: total, available: avail } }),
      this.prisma.marginTxn.create({ data: { accountId: a.id, type: 'recharge', amount: BigInt(amountFen), balanceAfter: total } }),
    ]);
    return { rechargeId: 'R_' + Date.now(), credited: amountFen, available: Number(avail) };
  }

  async refund(userId: string, amountFen: number) {
    if (!amountFen || amountFen <= 0) throw new BizException('退款金额非法', 'AMOUNT_INVALID', 2000);
    const a = await this.ensure(userId);
    if (BigInt(amountFen) > a.available) throw new BizException('可退金额不足', 'REFUND_EXCEED', 3002);
    const total = a.totalBalance - BigInt(amountFen);
    const avail = a.available - BigInt(amountFen);
    await this.prisma.$transaction([
      this.prisma.marginAccount.update({ where: { userId }, data: { totalBalance: total, available: avail } }),
      this.prisma.marginTxn.create({ data: { accountId: a.id, type: 'refund', amount: -BigInt(amountFen), balanceAfter: total } }),
    ]);
    return { refundId: 'RF_' + Date.now(), eta: 'T+1' };
  }

  /** 冻结（锁价 C5）。可用→冻结。 */
  async freeze(userId: string, amountFen: number, refOrderNo?: string) {
    const a = await this.ensure(userId);
    if (BigInt(amountFen) > a.available) throw new BizException('保证金不足', 'MARGIN_NOT_ENOUGH', 3001);
    await this.prisma.$transaction([
      this.prisma.marginAccount.update({ where: { userId }, data: { available: a.available - BigInt(amountFen), frozen: a.frozen + BigInt(amountFen) } }),
      this.prisma.marginTxn.create({ data: { accountId: a.id, type: 'freeze', amount: BigInt(amountFen), balanceAfter: a.totalBalance, refOrderNo } }),
    ]);
  }

  /** 解冻（交割完成/取消）。冻结→可用。 */
  async unfreeze(userId: string, amountFen: number, refOrderNo?: string) {
    const a = await this.ensure(userId);
    const amt = a.frozen < BigInt(amountFen) ? a.frozen : BigInt(amountFen);
    await this.prisma.$transaction([
      this.prisma.marginAccount.update({ where: { userId }, data: { available: a.available + amt, frozen: a.frozen - amt } }),
      this.prisma.marginTxn.create({ data: { accountId: a.id, type: 'unfreeze', amount: amt, balanceAfter: a.totalBalance, refOrderNo } }),
    ]);
  }

  /** 扣罚（违约）。从冻结中扣除并减总额。 */
  async deduct(userId: string, amountFen: number, refOrderNo?: string) {
    const a = await this.ensure(userId);
    const amt = a.frozen < BigInt(amountFen) ? a.frozen : BigInt(amountFen);
    const total = a.totalBalance - amt;
    await this.prisma.$transaction([
      this.prisma.marginAccount.update({ where: { userId }, data: { frozen: a.frozen - amt, totalBalance: total } }),
      this.prisma.marginTxn.create({ data: { accountId: a.id, type: 'deduct', amount: -amt, balanceAfter: total, refOrderNo } }),
    ]);
  }
}
