import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketService } from '../../market/market.service';
import { MarginService } from '../margin/margin.service';
import { ConfigService } from '../../config/config.service';
import { BizException } from '../../common/biz-exception';
import { genOrderNo } from '../../common/order-no';

@Injectable()
export class LockService {
  // In-flight dedup: prevents double-tap while Redis is not yet available (see P1 todo)
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly market: MarketService,
    private readonly margin: MarginService,
    private readonly config: ConfigService,
  ) {}

  /** 快照价（确认即取 A3）：优先实时行情销售价，回退挂单参考价。 */
  private snapshot(metal: string, fallback: number) {
    const q = this.market.getQuote(metal);
    if (q) return { price: Number(q.salePrice), version: q.snapshotVersion };
    return { price: fallback, version: 'ref' };
  }

  async buyerLimit(userId: string, metal = 'gold') {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, include: { margin: true } });
    if (!u) throw new BizException('用户不存在', 'USER_NOT_FOUND', 2004);
    const available = Number(u.margin?.available ?? 0n);
    const snap = this.snapshot(metal, 0);
    const unit = snap.price * this.config.marginRatio; // 每克所需保证金（元）
    const maxBuyableQty = unit > 0 ? Math.floor(available / 100 / unit) : 0;
    return { buyerLevel: 'L' + u.level, deposit: available, maxBuyableQty, overLimit: false };
  }

  /** 锁价下单：快照 + 先到先得扣库存(A4) + 冻结保证金(C5) + 生成订单。 */
  async createLock(userId: string, dto: { listingId: string; weight: number; payMethod?: string }) {
    if (!dto?.listingId || !dto?.weight) throw new BizException('参数错误', 'PARAM', 2000);
    const weight = Number(dto.weight);
    const idempotencyKey = `${userId}:${dto.listingId}:${weight}`;
    if (this.inFlight.has(idempotencyKey)) throw new BizException('请勿重复提交', 'DUPLICATE_LOCK', 2009);
    this.inFlight.add(idempotencyKey);
    try {
      return await this._createLock(userId, dto, weight);
    } finally {
      this.inFlight.delete(idempotencyKey);
    }
  }

  private async _createLock(userId: string, dto: { listingId: string; weight: number; payMethod?: string }, weight: number) {
    if (!(weight > 0)) throw new BizException('数量非法', 'PARAM', 2000);
    const payMethod = dto.payMethod === 'transfer' ? 'transfer' : 'cash';

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BizException('用户不存在', 'USER_NOT_FOUND', 2004);
    if (user.kycStatus !== 'verified') throw new BizException('请先完成实名认证', 'NEED_REALNAME', 3010);

    const listing = await this.prisma.listing.findUnique({ where: { id: dto.listingId }, include: { seller: true } });
    if (!listing || listing.status !== 'selling') throw new BizException('挂单不可用', 'LISTING_UNAVAILABLE', 3003);
    if (listing.sellerId === userId) throw new BizException('不能锁定自己的挂单', 'SELF_LOCK', 3004);

    // 出货方式约束
    if (listing.shipMode === 'whole_all' && weight !== Number(listing.totalWeight)) {
      throw new BizException('该挂单需整出全部', 'MUST_WHOLE', 3005);
    }
    if (listing.shipMode === 'whole_fixed' && listing.lotSize && weight % Number(listing.lotSize) !== 0) {
      throw new BizException('需按固定克重整数倍锁价', 'MUST_LOT', 3005);
    }
    if (listing.shipMode === 'bulk' && listing.minBatch && weight < Number(listing.minBatch)) {
      throw new BizException('低于起批量', 'BELOW_MIN', 3005);
    }

    const snap = this.snapshot(listing.metal, Number(listing.refPriceCash));
    const price = snap.price;
    const totalFen = Math.round(weight * price * 100);
    const freezeFen = Math.round(weight * price * this.config.marginRatio * 100);

    // A4 先到先得：条件原子扣减库存（库存足才扣）
    const dec = await this.prisma.listing.updateMany({
      where: { id: listing.id, status: 'selling', remainingWeight: { gte: weight } },
      data: { remainingWeight: { decrement: weight } },
    });
    if (dec.count === 0) throw new BizException('库存不足或已被锁定', 'LISTING_SOLD', 3006);

    // C5 冻结保证金；失败则回滚库存
    try {
      await this.margin.freeze(userId, freezeFen);
    } catch (e) {
      await this.prisma.listing.update({ where: { id: listing.id }, data: { remainingWeight: { increment: weight } } });
      throw e;
    }

    const expireAt = new Date(Date.now() + this.config.lockCountdownMs);
    const order = await this.prisma.order.create({
      data: {
        orderNo: genOrderNo(),
        buyerId: userId,
        sellerId: listing.sellerId,
        listingId: listing.id,
        status: 'locked_pending',
        metal: listing.metal,
        productName: listing.goodsName || `${listing.category} ${listing.metal}`,
        weight,
        priceCash: price,
        payMethod,
        supportsTransfer: listing.supportTransfer,
        totalCash: BigInt(totalFen),
        deliveryMethod: 'face_to_face',
        countdownExpireAt: expireAt,
      },
    });
    const lock = await this.prisma.lockOrder.create({
      data: {
        buyerId: userId,
        listingId: listing.id,
        metal: listing.metal,
        weight,
        payMethod,
        snapshotPrice: price,
        snapshotVersion: snap.version,
        quoteTime: new Date(),
        status: 'success',
        orderId: order.id,
        expiresAt: expireAt,
      },
    });

    // 库存归零 → 下架
    const after = await this.prisma.listing.findUnique({ where: { id: listing.id } });
    if (after && Number(after.remainingWeight) <= 0) {
      await this.prisma.listing.update({ where: { id: listing.id }, data: { status: 'sold' } });
    }

    return { lockOrderId: lock.id, status: 'success', orderNo: order.orderNo, orderId: order.id };
  }

  async lockDetail(userId: string, id: string) {
    const lock = await this.prisma.lockOrder.findUnique({ where: { id }, include: { order: { include: { seller: true } } } });
    if (!lock || lock.buyerId !== userId) throw new BizException('锁价单不存在', 'NOT_FOUND', 2004);
    const o = lock.order;
    return {
      status: lock.status,
      orderNo: o?.orderNo ?? null,
      sellerContact: o ? { phone: o.seller.phone, wechat: o.seller.wechat } : null,
    };
  }
}
