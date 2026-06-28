import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MarginService } from '../margin/margin.service';
import { ConfigService } from '../../config/config.service';
import { BizException } from '../../common/biz-exception';
import { maskUser } from '../../common/mask';

type OrderFull = Prisma.OrderGetPayload<{ include: { buyer: true; seller: true } }>;

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly margin: MarginService,
    private readonly config: ConfigService,
  ) {}

  private mapOrder(o: OrderFull, meId: string) {
    const isBuyer = o.buyerId === meId;
    const cp = isBuyer ? o.seller : o.buyer;
    return {
      orderNo: o.orderNo,
      side: isBuyer ? 'buy' : 'sell',
      status: o.status,
      metal: o.metal,
      productName: o.productName,
      weight: Number(o.weight),
      priceCash: Number(o.priceCash).toFixed(2),
      totalCash: Number(o.totalCash),
      supportsTransfer: o.supportsTransfer,
      counterpartyMasked: maskUser(cp.weijinNo),
      counterpartyLevel: 'L' + cp.level,
      countdownRemaining: o.countdownExpireAt ? Math.floor((o.countdownExpireAt.getTime() - Date.now()) / 1000) : null,
      createTime: o.createdAt.toISOString(),
      completeTime: o.completedAt?.toISOString() ?? null,
    };
  }

  async list(userId: string, tab?: string) {
    const where: Prisma.OrderWhereInput = { OR: [{ buyerId: userId }, { sellerId: userId }] };
    if (tab) where.status = tab as Prisma.OrderWhereInput['status'];
    const rows = await this.prisma.order.findMany({ where, include: { buyer: true, seller: true }, orderBy: { createdAt: 'desc' } });
    const list = rows.map((o) => this.mapOrder(o, userId));
    return { list, page: 1, pageSize: list.length, total: list.length, hasMore: false };
  }

  async badge(userId: string) {
    const pendingCount = await this.prisma.order.count({ where: { status: 'locked_pending', OR: [{ buyerId: userId }, { sellerId: userId }] } });
    return { pendingCount };
  }

  private async find(userId: string, no: string): Promise<OrderFull> {
    const o = await this.prisma.order.findUnique({ where: { orderNo: no }, include: { buyer: true, seller: true } });
    if (!o || (o.buyerId !== userId && o.sellerId !== userId)) throw new BizException('订单不存在', 'NOT_FOUND', 2004);
    return o;
  }

  async detail(userId: string, no: string) {
    const o = await this.find(userId, no);
    const isBuyer = o.buyerId === userId;
    const cp = isBuyer ? o.seller : o.buyer;
    return {
      ...this.mapOrder(o, userId),
      counterparty: { role: isBuyer ? '卖家' : '买家', userMasked: maskUser(cp.weijinNo), level: 'L' + cp.level, phone: cp.phone, wechat: cp.wechat },
      deliveryMethod: o.deliveryMethod,
      myConfirmed: isBuyer ? o.buyerConfirmed : o.sellerConfirmed,
      peerConfirmed: isBuyer ? o.sellerConfirmed : o.buyerConfirmed,
    };
  }

  /** 双方确认完成 → 解冻保证金 + 双方成交数 +1。 */
  async confirmComplete(userId: string, no: string) {
    const o = await this.find(userId, no);
    if (o.status !== 'locked_pending') throw new BizException('订单状态不可确认', 'BAD_STATUS', 3007);
    const isBuyer = o.buyerId === userId;
    const updated = await this.prisma.order.update({ where: { id: o.id }, data: isBuyer ? { buyerConfirmed: true } : { sellerConfirmed: true } });
    if (updated.buyerConfirmed && updated.sellerConfirmed) {
      const freezeFen = Math.round(Number(o.priceCash) * Number(o.weight) * this.config.marginRatio * 100);
      await this.margin.unfreeze(o.buyerId, freezeFen, o.orderNo);
      await this.prisma.$transaction([
        this.prisma.order.update({ where: { id: o.id }, data: { status: 'completed', completedAt: new Date() } }),
        this.prisma.user.update({ where: { id: o.buyerId }, data: { completedTrades: { increment: 1 } } }),
        this.prisma.user.update({ where: { id: o.sellerId }, data: { completedTrades: { increment: 1 } } }),
      ]);
      return { myConfirmed: true, peerConfirmed: true, status: 'completed' };
    }
    return { myConfirmed: true, peerConfirmed: isBuyer ? updated.sellerConfirmed : updated.buyerConfirmed, status: 'locked_pending' };
  }

  async arbitration(userId: string, no: string) {
    const o = await this.find(userId, no);
    if (o.status !== 'locked_pending') throw new BizException('当前状态不可申请仲裁', 'BAD_STATUS', 3007);
    await this.prisma.order.update({ where: { id: o.id }, data: { status: 'arbitrating' } });
    return { arbId: 'ARB_' + Date.now(), status: 'arbitrating' };
  }

  /** 平台代交接进度（Sprint 4 真实化；当前占位）。 */
  async relay(userId: string, no: string) {
    await this.find(userId, no);
    return {
      relayStatus: '待发起',
      feePaid: false,
      steps: [
        { title: '卖家送货到服务点', desc: '', state: 'todo' },
        { title: '平台专员看货核验', desc: '', state: 'todo' },
        { title: '买家打款 · 交易完成', desc: '', state: 'todo' },
        { title: '平台发货给买家', desc: '', state: 'todo' },
      ],
    };
  }
}
