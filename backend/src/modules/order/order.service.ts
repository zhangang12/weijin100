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
      priceTransfer: o.priceTransfer != null ? Number(o.priceTransfer).toFixed(2) : undefined,
      totalCash: Number(o.totalCash),
      totalTransfer: o.totalTransfer != null ? Number(o.totalTransfer) : undefined,
      supportsTransfer: o.supportsTransfer,
      counterpartyMasked: maskUser(cp.weijinNo),
      counterpartyLevel: 'L' + cp.level,
      countdownRemaining: o.countdownExpireAt ? Math.floor((o.countdownExpireAt.getTime() - Date.now()) / 1000) : null,
      createTime: o.createdAt.toISOString(),
      completeTime: o.completedAt?.toISOString() ?? null,
    };
  }

  /** 我的挂单（销售中 tab）→ 映射成订单卡形状，status='selling'。 */
  private async listSelling(userId: string) {
    const rows = await this.prisma.listing.findMany({
      where: { sellerId: userId, status: 'selling' },
      orderBy: { createdAt: 'desc' },
    });
    const list = rows.map((l) => ({
      orderNo: l.id, // 挂单无订单号，用挂单 id 承载（详情按 selling 分支处理）
      side: 'sell' as const,
      status: 'selling' as const,
      metal: l.metal,
      productName: l.goodsName || `${l.category} ${l.metal}`,
      weight: Number(l.totalWeight),
      remainingWeight: Number(l.remainingWeight),
      priceCash: Number(l.refPriceCash).toFixed(2),
      priceTransfer: l.refPriceTransfer != null ? Number(l.refPriceTransfer).toFixed(2) : undefined,
      totalCash: Math.round(Number(l.refPriceCash) * Number(l.totalWeight) * 100),
      supportsTransfer: l.supportTransfer,
      shipMode: l.shipMode,
      createTime: l.createdAt.toISOString(),
    }));
    return { list, page: 1, pageSize: list.length, total: list.length, hasMore: false };
  }

  async list(userId: string, tab?: string) {
    if (tab === 'selling') return this.listSelling(userId);
    const where: Prisma.OrderWhereInput = { OR: [{ buyerId: userId }, { sellerId: userId }] };
    // B5：仲裁中/代交接中并入「锁价待处理」；已完成 tab 含终态。
    if (tab === 'locked_pending') where.status = { in: ['locked_pending', 'arbitrating', 'relay_inspecting'] };
    else if (tab === 'completed') where.status = { in: ['completed', 'cancelled', 'defaulted'] };
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
    // 销售中详情：no 可能是挂单 id（列表 selling 卡用挂单 id 承载）。
    const asListing = await this.prisma.listing.findUnique({ where: { id: no } });
    if (asListing && asListing.sellerId === userId) {
      return {
        orderNo: asListing.id,
        side: 'sell' as const,
        status: 'selling' as const,
        metal: asListing.metal,
        productName: asListing.goodsName || `${asListing.category} ${asListing.metal}`,
        weight: Number(asListing.totalWeight),
        remainingWeight: Number(asListing.remainingWeight),
        shipMode: asListing.shipMode,
        priceCash: Number(asListing.refPriceCash).toFixed(2),
        priceTransfer: asListing.refPriceTransfer != null ? Number(asListing.refPriceTransfer).toFixed(2) : undefined,
        totalCash: Math.round(Number(asListing.refPriceCash) * Number(asListing.totalWeight) * 100),
        supportsTransfer: asListing.supportTransfer,
        priceMode: asListing.priceMode,
        floorPrice: asListing.floorPrice != null ? Number(asListing.floorPrice).toFixed(2) : null,
        createTime: asListing.createdAt.toISOString(),
        counterparty: null,
        deliveryMethod: 'face_to_face' as const,
        myConfirmed: false,
        peerConfirmed: false,
        deliveryAddress: null,
      };
    }
    const o = await this.find(userId, no);
    const isBuyer = o.buyerId === userId;
    const cp = isBuyer ? o.seller : o.buyer;
    // H1：对手方地址锁价后可见。买家看卖家取货地址；卖家看买家收货地址。
    const cpAddr = await this.prisma.address.findFirst({
      where: { userId: cp.id, isDefault: true },
    }) ?? await this.prisma.address.findFirst({ where: { userId: cp.id } });
    const addrText = cpAddr ? `${cpAddr.region} ${cpAddr.detail}` : '';
    return {
      ...this.mapOrder(o, userId),
      counterparty: {
        role: isBuyer ? '卖家' : '买家',
        userMasked: maskUser(cp.weijinNo),
        level: 'L' + cp.level,
        region: cpAddr?.region ?? '',
        phone: cp.phone,
        wechat: cp.wechat,
        address: addrText,
      },
      deliveryMethod: o.deliveryMethod,
      myConfirmed: isBuyer ? o.buyerConfirmed : o.sellerConfirmed,
      peerConfirmed: isBuyer ? o.sellerConfirmed : o.buyerConfirmed,
      deliveryAddress: cpAddr ? {
        contact: cpAddr.contact,
        phone: cpAddr.phone,
        region: cpAddr.region,
        detail: cpAddr.detail,
        latitude: cpAddr.latitude ? Number(cpAddr.latitude) : null,
        longitude: cpAddr.longitude ? Number(cpAddr.longitude) : null,
      } : null,
    };
  }

  /** 交易完成 → 解冻买卖双方保证金 + 双方成交数 +1（C5/B7）。 */
  private async completeAndRelease(o: OrderFull) {
    const freezeFen = this.config.freezeFenFor(o.metal, Number(o.weight));
    // 双方同额解冻（unfreeze 内部 clamp 到实际冻结额，卖家未冻结时为 0，安全）。
    await this.margin.unfreeze(o.buyerId, freezeFen, o.orderNo);
    await this.margin.unfreeze(o.sellerId, freezeFen, o.orderNo);
    await this.prisma.$transaction([
      this.prisma.order.update({ where: { id: o.id }, data: { status: 'completed', completedAt: new Date() } }),
      this.prisma.user.update({ where: { id: o.buyerId }, data: { completedTrades: { increment: 1 } } }),
      this.prisma.user.update({ where: { id: o.sellerId }, data: { completedTrades: { increment: 1 } } }),
    ]);
  }

  /**
   * B2 定时兜底：一方已确认、另一方超时（firstConfirmedAt + 24h）→ 自动完成并解冻。
   * 返回自动完成的订单数。仅一方确认的才自动完成（双方确认已即时完成）。
   */
  async autoCompleteOverdue(): Promise<number> {
    const threshold = new Date(Date.now() - this.config.autoCompleteMs);
    const rows = await this.prisma.order.findMany({
      where: { status: 'locked_pending', firstConfirmedAt: { lte: threshold } },
      include: { buyer: true, seller: true },
    });
    let n = 0;
    for (const o of rows) {
      if (o.buyerConfirmed !== o.sellerConfirmed) {
        await this.completeAndRelease(o);
        n++;
      }
    }
    return n;
  }

  /** 双方确认完成（B1）。一方先确认记时点（B2 计时起点），双方齐 → 解冻+完成。 */
  async confirmComplete(userId: string, no: string) {
    const o = await this.find(userId, no);
    if (o.status !== 'locked_pending') throw new BizException('订单状态不可确认', 'BAD_STATUS', 3007);
    const isBuyer = o.buyerId === userId;
    const patch: Prisma.OrderUpdateInput = isBuyer ? { buyerConfirmed: true } : { sellerConfirmed: true };
    if (!o.firstConfirmedAt) patch.firstConfirmedAt = new Date(); // 首个确认 → 启动 24h 自动完成计时
    const updated = await this.prisma.order.update({ where: { id: o.id }, data: patch });
    if (updated.buyerConfirmed && updated.sellerConfirmed) {
      await this.completeAndRelease(o);
      return { myConfirmed: true, peerConfirmed: true, status: 'completed' };
    }
    return { myConfirmed: true, peerConfirmed: isBuyer ? updated.sellerConfirmed : updated.buyerConfirmed, status: 'locked_pending' };
  }

  /** 申请仲裁（B4）：聊天截图 ≤5 张 + 情况说明 ≤500 字，均必填；材料落库；暂停 4h 倒计时。 */
  async arbitration(userId: string, no: string, evidence?: { chatScreenshots?: string[]; description?: string }) {
    const o = await this.find(userId, no);
    if (o.status !== 'locked_pending') throw new BizException('当前状态不可申请仲裁', 'BAD_STATUS', 3007);
    const shots = evidence?.chatScreenshots ?? [];
    const desc = (evidence?.description ?? '').trim();
    if (shots.length === 0 || shots.length > 5) throw new BizException('请上传 1~5 张聊天截图', 'ARB_EVIDENCE', 2000);
    if (!desc || desc.length > 500) throw new BizException('请填写情况说明（≤500 字）', 'ARB_DESC', 2000);
    const arbId = 'ARB_' + o.id;
    await this.prisma.order.update({
      where: { id: o.id },
      data: { status: 'arbitrating', arbitratingStartAt: new Date(), arbReason: desc, arbEvidence: shots, countdownExpireAt: null },
    });
    return { arbId, status: 'arbitrating' };
  }

  async updateRelayStep(userId: string, no: string, body: { stepIndex: number; state: 'done' | 'cur' | 'todo'; desc?: string }) {
    const o = await this.find(userId, no);
    const rp = await this.prisma.relayProgress.findUnique({ where: { orderId: o.id } });
    if (!rp) throw new BizException('代交接记录不存在', 'NOT_FOUND', 2004);
    const steps = rp.steps as Array<{ title: string; desc: string; state: string }>;
    if (body.stepIndex < 0 || body.stepIndex >= steps.length) throw new BizException('步骤索引越界', 'PARAM', 2000);
    steps[body.stepIndex] = { ...steps[body.stepIndex], state: body.state, desc: body.desc ?? steps[body.stepIndex].desc };
    const isFinal = body.state === 'done' && body.stepIndex === steps.length - 1;
    const newStatus = isFinal ? '已完成' : rp.relayStatus;
    await this.prisma.relayProgress.update({ where: { orderId: o.id }, data: { steps, relayStatus: newStatus } });
    // B7：末步完成（买家打款）→ 订单完成并释放双方保证金。
    if (isFinal && o.status === 'relay_inspecting') {
      await this.completeAndRelease(o);
    }
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
        initiatorRole: null,
        peerAgreed: false,
        steps: [
          { title: '卖家送货到服务点', desc: '', state: 'todo' },
          { title: '平台专员看货核验', desc: '', state: 'todo' },
          { title: '买家打款 · 交易完成', desc: '', state: 'todo' },
          { title: '平台发货给买家', desc: '', state: 'todo' },
        ],
      };
    }
    return {
      relayStatus: rp.relayStatus,
      feePaid: rp.feePaid,
      initiatorRole: rp.initiatorId ? (rp.initiatorId === o.buyerId ? '买家' : '卖家') : null,
      peerAgreed: rp.peerAgreed,
      steps: rp.steps,
    };
  }

  /** 申请平台代交接（B6）：发起方（买或卖）支付 ¥100 → 待对方同意。 */
  async applyRelay(userId: string, no: string) {
    const o = await this.find(userId, no);
    if (o.buyerId !== userId && o.sellerId !== userId) throw new BizException('订单不存在', 'NOT_FOUND', 2004);
    if (o.status !== 'locked_pending') throw new BizException('当前状态不可申请代交接', 'BAD_STATUS', 3007);
    const existing = await this.prisma.relayProgress.findUnique({ where: { orderId: o.id } });
    if (existing?.feePaid) return this.relay(userId, no);

    const pay = await this.payment.pay(userId, 'relay_fee', this.config.relayFeeFen, o.orderNo);
    const steps = [
      { title: '卖家送货到服务点', desc: '待对方同意后开始', state: 'todo' },
      { title: '平台专员看货核验', desc: '核验成色 / 克重 / 品牌', state: 'todo' },
      { title: '买家打款 · 交易完成', desc: '核验通过后通知买家打款', state: 'todo' },
      { title: '平台发货给买家', desc: '物流配送', state: 'todo' },
    ];
    await this.prisma.relayProgress.upsert({
      where: { orderId: o.id },
      update: { feePaid: true, relayStatus: '待对方同意', steps, initiatorId: userId, peerAgreed: false },
      create: { orderId: o.id, feePaid: true, relayStatus: '待对方同意', steps, initiatorId: userId, peerAgreed: false },
    });
    // B8：转代交接不可改回自交（deliveryMethod 落 relay，订单待对方同意后进核验）。
    await this.prisma.order.update({ where: { id: o.id }, data: { deliveryMethod: 'relay' } });
    return { feePaid: true, relayStatus: '待对方同意', payment: pay };
  }

  /** 对方同意代交接（B6）→ 进入核验流程。 */
  async relayConsent(userId: string, no: string) {
    const o = await this.find(userId, no);
    const rp = await this.prisma.relayProgress.findUnique({ where: { orderId: o.id } });
    if (!rp || !rp.feePaid) throw new BizException('尚无待同意的代交接申请', 'NOT_FOUND', 2004);
    if (rp.initiatorId === userId) throw new BizException('发起方无需同意', 'BAD_STATUS', 3007);
    if (rp.peerAgreed) return this.relay(userId, no);
    const steps = [
      { title: '卖家送货到服务点', desc: '等待卖家送货核验', state: 'cur' },
      { title: '平台专员看货核验', desc: '核验成色 / 克重 / 品牌', state: 'todo' },
      { title: '买家打款 · 交易完成', desc: '核验通过后通知买家打款', state: 'todo' },
      { title: '平台发货给买家', desc: '物流配送', state: 'todo' },
    ];
    await this.prisma.relayProgress.update({ where: { orderId: o.id }, data: { peerAgreed: true, relayStatus: '核验中', steps } });
    await this.prisma.order.update({ where: { id: o.id }, data: { status: 'relay_inspecting' } });
    return { relayStatus: '核验中', peerAgreed: true, steps };
  }
}
