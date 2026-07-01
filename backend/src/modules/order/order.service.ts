import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MarginService } from '../margin/margin.service';
import { ConfigService } from '../../config/config.service';
import { PaymentService } from '../../infra/payment/payment.service';
import { BizException } from '../../common/biz-exception';
import { maskUser } from '../../common/mask';

type OrderFull = Prisma.OrderGetPayload<{ include: { buyer: true; seller: true } }>;

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly margin: MarginService,
    private readonly config: ConfigService,
    private readonly payment: PaymentService,
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
    const sellerAddr = await this.prisma.address.findFirst({
      where: { userId: o.sellerId, isDefault: true },
    });
    const isBuyer = o.buyerId === userId;
    const cp = isBuyer ? o.seller : o.buyer;
    return {
      ...this.mapOrder(o, userId),
      counterparty: { role: isBuyer ? '卖家' : '买家', userMasked: maskUser(cp.weijinNo), level: 'L' + cp.level, phone: cp.phone, wechat: cp.wechat },
      deliveryMethod: o.deliveryMethod,
      myConfirmed: isBuyer ? o.buyerConfirmed : o.sellerConfirmed,
      peerConfirmed: isBuyer ? o.sellerConfirmed : o.buyerConfirmed,
      deliveryAddress: sellerAddr ? {
        contact: sellerAddr.contact,
        phone: sellerAddr.phone,
        region: sellerAddr.region,
        detail: sellerAddr.detail,
        latitude: sellerAddr.latitude ? Number(sellerAddr.latitude) : null,
        longitude: sellerAddr.longitude ? Number(sellerAddr.longitude) : null,
      } : null,
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

  async arbitration(userId: string, no: string, evidence?: { chatScreenshots?: string[]; description?: string }) {
    const o = await this.find(userId, no);
    if (o.status !== 'locked_pending') throw new BizException('当前状态不可申请仲裁', 'BAD_STATUS', 3007);
    const arbId = 'ARB_' + o.id;
    await this.prisma.order.update({ where: { id: o.id }, data: { status: 'arbitrating', arbitratingStartAt: new Date() } });
    // evidence (chatScreenshots, description) stored in Sprint 6b when arbitration table is added
    return { arbId, status: 'arbitrating' };
  }

  async updateRelayStep(userId: string, no: string, body: { stepIndex: number; state: 'done' | 'cur' | 'todo'; desc?: string }) {
    const o = await this.find(userId, no);
    const rp = await this.prisma.relayProgress.findUnique({ where: { orderId: o.id } });
    if (!rp) throw new BizException('代交接记录不存在', 'NOT_FOUND', 2004);
    const steps = rp.steps as Array<{ title: string; desc: string; state: string }>;
    if (body.stepIndex < 0 || body.stepIndex >= steps.length) throw new BizException('步骤索引越界', 'PARAM', 2000);
    steps[body.stepIndex] = { ...steps[body.stepIndex], state: body.state, desc: body.desc ?? steps[body.stepIndex].desc };
    const newStatus = body.state === 'done' && body.stepIndex === steps.length - 1 ? '已完成' : rp.relayStatus;
    await this.prisma.relayProgress.update({ where: { orderId: o.id }, data: { steps, relayStatus: newStatus } });
    return { steps, relayStatus: newStatus };
  }

  /** 平台代交接进度。 */
  async relay(userId: string, no: string) {
    const o = await this.find(userId, no);
    const rp = await this.prisma.relayProgress.findUnique({ where: { orderId: o.id } });
    if (!rp) {
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
    return { relayStatus: rp.relayStatus, feePaid: rp.feePaid, steps: rp.steps };
  }

  /** 申请平台代交接：买家支付 ¥100 服务费 → 进入核验流程。 */
  async applyRelay(userId: string, no: string) {
    const o = await this.find(userId, no);
    if (o.buyerId !== userId) throw new BizException('仅买家可申请代交接', 'ONLY_BUYER', 3011);
    if (o.status !== 'locked_pending') throw new BizException('当前状态不可申请代交接', 'BAD_STATUS', 3007);
    const existing = await this.prisma.relayProgress.findUnique({ where: { orderId: o.id } });
    if (existing?.feePaid) return this.relay(userId, no);

    const pay = await this.payment.pay(userId, 'relay_fee', this.config.relayFeeFen, o.orderNo);
    const steps = [
      { title: '卖家送货到服务点', desc: '等待卖家送货核验', state: 'cur' },
      { title: '平台专员看货核验', desc: '核验成色 / 克重 / 品牌', state: 'todo' },
      { title: '买家打款 · 交易完成', desc: '核验通过后通知买家打款', state: 'todo' },
      { title: '平台发货给买家', desc: '物流配送', state: 'todo' },
    ];
    await this.prisma.relayProgress.upsert({
      where: { orderId: o.id },
      update: { feePaid: true, relayStatus: '核验中', steps },
      create: { orderId: o.id, feePaid: true, relayStatus: '核验中', steps },
    });
    await this.prisma.order.update({ where: { id: o.id }, data: { deliveryMethod: 'relay', status: 'relay_inspecting' } });
    return { feePaid: true, relayStatus: '核验中', steps, payment: pay };
  }
}
