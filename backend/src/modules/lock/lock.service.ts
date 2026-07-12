import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketService } from '../../market/market.service';
import { MarginService } from '../margin/margin.service';
import { ConfigService } from '../../config/config.service';
import { BizException } from '../../common/biz-exception';
import { genOrderNo, motherNoOf } from '../../common/order-no';

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
    const availableFen = Number(u.margin?.available ?? 0n);
    // C1/C2：可交易额度 = 可用余额 ÷ 固定保证金单价（与金价无关）。
    const unitFen = this.config.marginUnitOf(metal); // 每克所需保证金（分）
    const maxBuyableQty = unitFen > 0 ? Math.floor(availableFen / unitFen) : 0;
    return { buyerLevel: 'L' + u.level, deposit: availableFen, unitFen, maxBuyableQty, overLimit: false };
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
    // 权限模型硬校验：实名 + 联系方式（保证金由 freeze 兜底）。
    if (user.functionStatus === 'limited') throw new BizException('账号功能受限，暂不可锁价', 'FUNCTION_LIMITED', 3020); // E5
    if (user.kycStatus !== 'verified') throw new BizException('请先完成实名认证', 'NEED_REALNAME', 3010);
    if (!user.phone && !user.wechat) throw new BizException('请先补全联系方式', 'NEED_CONTACT', 3012);

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
    // C1/C5：冻结额 = 克重 × 固定保证金单价（金 ¥10/g 等），与成交价无关。
    const freezeFen = this.config.freezeFenFor(listing.metal, weight);

    // A4 先到先得：条件原子扣减库存（库存足才扣）
    const dec = await this.prisma.listing.updateMany({
      where: { id: listing.id, status: 'selling', remainingWeight: { gte: weight } },
      data: { remainingWeight: { decrement: weight } },
    });
    if (dec.count === 0) throw new BizException('库存不足或已被锁定', 'LISTING_SOLD', 3006);

    // C5 冻结买家保证金；失败则回滚库存
    try {
      await this.margin.freeze(userId, freezeFen);
    } catch (e) {
      await this.prisma.listing.update({ where: { id: listing.id }, data: { remainingWeight: { increment: weight } } });
      throw e;
    }
    // 卖家侧同额冻结（尽力而为，不阻断买家先到先得）：B7 完成时双方同额解冻。
    // 卖家若保证金不足则跳过冻结，解冻端 clamp 到实际冻结额，保证对账不为负。
    try {
      await this.margin.freeze(listing.sellerId, freezeFen, undefined);
    } catch {
      /* 卖家保证金不足，跳过冻结（其可用/冻结不变；后续违约扣罚以实际冻结为准） */
    }

    const expireAt = new Date(Date.now() + this.config.lockCountdownMs);
    // B9：母单 16 位（挂单派生）+ 子单 2 位（同挂单到达顺序）。
    const motherNo = motherNoOf(listing.id, listing.createdAt);
    const seq = (await this.prisma.order.count({ where: { listingId: listing.id } })) + 1;
    const order = await this.prisma.order.create({
      data: {
        orderNo: genOrderNo(motherNo, seq),
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
