import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BizException } from '../../common/biz-exception';
import { maskUser } from '../../common/mask';

type ListingWithSeller = Prisma.ListingGetPayload<{ include: { seller: true } }>;

@Injectable()
export class ListingService {
  constructor(private readonly prisma: PrismaService) {}

  private map(l: ListingWithSeller) {
    return {
      listingId: l.id,
      seller: { userMasked: maskUser(l.seller.weijinNo), level: 'L' + l.seller.level, shopName: l.seller.nickname },
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
      refPriceCash: l.refPriceCash != null ? Number(l.refPriceCash).toFixed(2) : null,
      refPriceTransfer: l.refPriceTransfer != null ? Number(l.refPriceTransfer).toFixed(2) : null,
      supportTransfer: l.supportTransfer,
      status: l.status,
    };
  }

  async list(query: { metal?: string; shipMode?: string; category?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
    const where: Prisma.ListingWhereInput = { status: 'selling' };
    if (query.metal) where.metal = query.metal as Prisma.ListingWhereInput['metal'];
    if (query.shipMode === 'whole') where.shipMode = { in: ['whole_all', 'whole_fixed'] };
    else if (query.shipMode === 'bulk') where.shipMode = 'bulk';
    if (query.category) where.category = query.category;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({ where, include: { seller: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { list: rows.map((r) => this.map(r)), page, pageSize, total, hasMore: page * pageSize < total };
  }

  async detail(id: string) {
    const l = await this.prisma.listing.findUnique({ where: { id }, include: { seller: true } });
    if (!l) throw new BizException('挂单不存在', 'LISTING_NOT_FOUND', 2004);
    return this.map(l);
  }

  async publishEligibility(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, include: { margin: true } });
    if (!u) throw new BizException('用户不存在', 'USER_NOT_FOUND', 2004);
    return {
      realName: u.kycStatus === 'verified',
      contact: !!u.phone || !!u.wechat,
      marginOk: (u.margin?.available ?? 0n) > 0n,
      level: 'L' + u.level,
      maxQty: 5000,
      minQty: 1,
    };
  }

  async create(userId: string, dto: {
    metal: string; category: string; goodsName: string; tags?: string[]; images?: string[];
    batchNumber?: string; sourcePlace?: string; totalWeight: number; shipMode: string;
    minBatch?: number; lotSize?: number; refPriceCash?: number; refPriceTransfer?: number; supportTransfer?: boolean;
  }) {
    if (!dto?.metal || !dto?.totalWeight || !dto?.shipMode) throw new BizException('请填写完整挂单信息', 'LISTING_PARAM', 2000);
    const elig = await this.publishEligibility(userId);
    if (!elig.realName) throw new BizException('请先完成实名认证', 'NEED_REALNAME', 3010);
    if (!elig.marginOk) throw new BizException('请先充值保证金', 'NEED_MARGIN', 3001);
    const l = await this.prisma.listing.create({
      data: {
        sellerId: userId,
        metal: dto.metal as Prisma.ListingCreateInput['metal'],
        category: dto.category || '板料',
        goodsName: dto.goodsName || '',
        tags: dto.tags ?? [],
        images: dto.images ?? [],
        batchNumber: dto.batchNumber,
        sourcePlace: dto.sourcePlace,
        totalWeight: dto.totalWeight,
        remainingWeight: dto.totalWeight,
        shipMode: dto.shipMode as Prisma.ListingCreateInput['shipMode'],
        minBatch: dto.minBatch,
        lotSize: dto.lotSize,
        refPriceCash: dto.refPriceCash ?? 0,
        refPriceTransfer: dto.refPriceTransfer,
        supportTransfer: dto.supportTransfer ?? false,
      },
    });
    return { listingId: l.id, status: l.status };
  }
}
