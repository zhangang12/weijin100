import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketService } from '../../market/market.service';
import { ConfigService } from '../../config/config.service';
import { BizException } from '../../common/biz-exception';
import { maskUser } from '../../common/mask';

type ListingWithSeller = Prisma.ListingGetPayload<{ include: { seller: true } }>;

/** 发布挂单入参（与前端表单提交契约一致，扁平结构）。 */
interface CreateListingDto {
  metal: string;
  category: string;
  goodsName: string;
  tags?: string[];
  images?: string[];
  batchNumber?: string;
  sourcePlace?: string;
  totalWeight: number;
  shipMode: string; // whole_all | whole_fixed | bulk
  minBatch?: number;
  lotSize?: number;
  priceMode?: string; // spot | fixed
  premiumCash?: number; // spot 现金溢价（带符号）
  premiumTransfer?: number | null; // spot 转账溢价
  refPriceCash?: number; // fixed 现金一口价
  refPriceTransfer?: number | null; // fixed 转账一口价
  floorPrice?: number; // 最低防守价
  supportTransfer?: boolean;
}

const PREMIUM_LIMIT = 50; // F5：发布溢价范围 ±50 元/克

@Injectable()
export class ListingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly market: MarketService,
    private readonly config: ConfigService,
  ) {}

  private map(l: ListingWithSeller) {
    return {
      listingId: l.id,
      seller: { userMasked: maskUser(l.seller.weijinNo), level: 'L' + l.seller.level, shopName: l.seller.nickname, deals: l.seller.completedTrades },
      metal: l.metal,
      category: l.category,
      goodsName: l.goodsName,
      tags: l.tags,
      images: l.images,
      batchNumber: l.batchNumber,
      sourcePlace: l.sourcePlace,
      totalWeight: Number(l.totalWeight),
      remainingWeight: Number(l.remainingWeight),
      shipMode: l.shipMode,
      minBatch: l.minBatch != null ? Number(l.minBatch) : null,
      lotSize: l.lotSize != null ? Number(l.lotSize) : null,
      priceMode: l.priceMode,
      premiumCash: l.premiumCash != null ? Number(l.premiumCash).toFixed(2) : null,
      premiumTransfer: l.premiumTransfer != null ? Number(l.premiumTransfer).toFixed(2) : null,
      floorPrice: l.floorPrice != null ? Number(l.floorPrice).toFixed(2) : null,
      refPriceCash: l.refPriceCash != null ? Number(l.refPriceCash).toFixed(2) : null,
      refPriceTransfer: l.refPriceTransfer != null ? Number(l.refPriceTransfer).toFixed(2) : null,
      supportTransfer: l.supportTransfer,
      status: l.status,
    };
  }

  /** 排序参数（价格/库存/等级 + 升降）→ Prisma orderBy。默认按最新。 */
  private orderByOf(sort?: string): Prisma.ListingOrderByWithRelationInput {
    const dir: Prisma.SortOrder = sort?.endsWith('_asc') ? 'asc' : 'desc';
    if (sort?.startsWith('price')) return { refPriceCash: dir };
    if (sort?.startsWith('stock')) return { remainingWeight: dir };
    if (sort?.startsWith('level')) return { seller: { level: dir } };
    return { createdAt: 'desc' };
  }

  async list(query: { metal?: string; shipMode?: string; category?: string; sort?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
    const where: Prisma.ListingWhereInput = { status: 'selling' };
    if (query.metal) where.metal = query.metal as Prisma.ListingWhereInput['metal'];
    if (query.shipMode === 'whole') where.shipMode = { in: ['whole_all', 'whole_fixed'] };
    else if (query.shipMode === 'bulk') where.shipMode = 'bulk';
    if (query.category) where.category = query.category;
    const orderBy = this.orderByOf(query.sort);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({ where, include: { seller: true }, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { list: rows.map((r) => this.map(r)), page, pageSize, total, hasMore: page * pageSize < total };
  }

  async detail(id: string) {
    const l = await this.prisma.listing.findUnique({ where: { id }, include: { seller: true } });
    if (!l) throw new BizException('挂单不存在', 'LISTING_NOT_FOUND', 2004);
    return this.map(l);
  }

  async publishEligibility(userId: string, metal = 'gold') {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, include: { margin: true } });
    if (!u) throw new BizException('用户不存在', 'USER_NOT_FOUND', 2004);
    const availableFen = Number(u.margin?.available ?? 0n);
    const unitFen = this.config.marginUnitOf(metal);
    // C6：可发布上限 = 可用保证金额度 ÷ 单价（与等级无关）。
    const maxQty = unitFen > 0 ? Math.floor(availableFen / unitFen) : 0;
    return {
      realName: u.kycStatus === 'verified',
      contact: !!u.phone || !!u.wechat,
      marginOk: availableFen > 0,
      functionStatus: u.functionStatus,
      level: 'L' + u.level,
      maxQty,
      minQty: 1,
    };
  }

  /** 计算入库参考价：spot=大盘销售价+溢价（并 max 防守价）；fixed=一口价。 */
  private computePrices(dto: CreateListingDto): { refCash: number; refTransfer: number | null } {
    const supportTransfer = dto.supportTransfer ?? false;
    if (dto.priceMode === 'fixed') {
      const refCash = Number(dto.refPriceCash ?? 0);
      const refTransfer = supportTransfer && dto.refPriceTransfer != null ? Number(dto.refPriceTransfer) : null;
      return { refCash, refTransfer };
    }
    // spot：以大盘销售价为基准（取不到则回退 0，锁价时会实时重新取快照）。
    const q = this.market.getQuote(dto.metal);
    const base = q ? Number(q.salePrice) : 0;
    const floor = dto.floorPrice != null ? Number(dto.floorPrice) : 0;
    const refCash = Math.max(base + Number(dto.premiumCash ?? 0), floor);
    const refTransfer = supportTransfer
      ? Math.max(base + Number(dto.premiumTransfer ?? 0), floor)
      : null;
    return { refCash, refTransfer };
  }

  async create(userId: string, dto: CreateListingDto) {
    // F10 前置：实名 + 联系方式 + 保证金（后端硬校验，与前端静默守卫双保险）。
    const elig = await this.publishEligibility(userId, dto?.metal || 'gold');
    if (elig.functionStatus === 'limited') throw new BizException('账号功能受限，暂不可发布', 'FUNCTION_LIMITED', 3020); // E5
    if (!elig.realName) throw new BizException('请先完成实名认证', 'NEED_REALNAME', 3010);
    if (!elig.contact) throw new BizException('请先补全联系方式', 'NEED_CONTACT', 3012);
    if (!elig.marginOk) throw new BizException('请先充值保证金', 'NEED_MARGIN', 3001);

    // 必填与范围校验
    if (!dto?.metal || !dto?.shipMode) throw new BizException('请填写完整挂单信息', 'LISTING_PARAM', 2000);
    if (!dto?.goodsName || !dto.goodsName.trim()) throw new BizException('请填写商品名称', 'LISTING_NAME', 2000);
    const totalWeight = Number(dto.totalWeight);
    if (!(totalWeight > 0)) throw new BizException('请填写数量', 'LISTING_PARAM', 2000);
    if (totalWeight > elig.maxQty) throw new BizException('超出可发布上限，请补足保证金', 'OVER_LIMIT', 3016);
    if (dto.shipMode === 'whole_fixed') {
      const lot = Number(dto.lotSize);
      if (!(lot > 0) || lot > totalWeight) throw new BizException('每份克重需 >0 且 ≤ 总数量', 'LOT_INVALID', 2000);
    }
    if (dto.shipMode === 'bulk') {
      const mb = Number(dto.minBatch);
      if (!(mb >= 1) || mb > totalWeight) throw new BizException('起批量需 ≥1g 且 ≤ 总数量', 'MINBATCH_INVALID', 2000); // F4
    }
    if ((dto.priceMode ?? 'spot') === 'spot') {
      if (Math.abs(Number(dto.premiumCash ?? 0)) > PREMIUM_LIMIT) throw new BizException('现金溢价超出 ±50 元/克', 'PREMIUM_RANGE', 2000); // F5
      if (dto.supportTransfer && Math.abs(Number(dto.premiumTransfer ?? 0)) > PREMIUM_LIMIT) throw new BizException('转账溢价超出 ±50 元/克', 'PREMIUM_RANGE', 2000);
    }

    const { refCash, refTransfer } = this.computePrices(dto);

    const l = await this.prisma.listing.create({
      data: {
        sellerId: userId,
        metal: dto.metal as Prisma.ListingCreateInput['metal'],
        category: dto.category || '板料',
        goodsName: dto.goodsName.trim(),
        tags: dto.tags ?? [],
        images: dto.images ?? [],
        batchNumber: dto.batchNumber,
        sourcePlace: dto.sourcePlace,
        totalWeight,
        remainingWeight: totalWeight,
        shipMode: dto.shipMode as Prisma.ListingCreateInput['shipMode'],
        minBatch: dto.shipMode === 'bulk' ? dto.minBatch : null,
        lotSize: dto.shipMode === 'whole_fixed' ? dto.lotSize : null,
        priceMode: dto.priceMode === 'fixed' ? 'fixed' : 'spot',
        premiumCash: dto.priceMode === 'fixed' ? null : dto.premiumCash,
        premiumTransfer: dto.priceMode === 'fixed' ? null : dto.premiumTransfer ?? null,
        floorPrice: dto.floorPrice,
        refPriceCash: refCash,
        refPriceTransfer: refTransfer,
        supportTransfer: dto.supportTransfer ?? false,
      },
    });
    return { listingId: l.id, status: l.status };
  }
}
