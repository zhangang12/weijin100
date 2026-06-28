import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BizException } from '../../common/biz-exception';

interface AddrRow {
  id: string; type: string; contact: string; phone: string; region: string; detail: string; isDefault: boolean;
}

@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  private map(a: AddrRow) {
    return { id: a.id, type: a.type, contact: a.contact, phone: a.phone, region: a.region, detail: a.detail, isDefault: a.isDefault };
  }

  async list(userId: string) {
    const rows = await this.prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
    return rows.map((r) => this.map(r));
  }

  async create(userId: string, dto: { type?: string; contact: string; phone: string; region?: string; detail: string; isDefault?: boolean }) {
    if (!dto?.contact || !dto?.phone || !dto?.detail) throw new BizException('请填写完整地址', 'ADDR_PARAM', 2000);
    if (dto.isDefault) await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    const a = await this.prisma.address.create({
      data: { userId, type: dto.type || 'receive', contact: dto.contact, phone: dto.phone, region: dto.region || '', detail: dto.detail, isDefault: !!dto.isDefault },
    });
    return { id: a.id };
  }

  async setDefault(userId: string, id: string) {
    const a = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!a) throw new BizException('地址不存在', 'ADDR_NOT_FOUND', 2004);
    await this.prisma.$transaction([
      this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
      this.prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return { ok: true };
  }

  async remove(userId: string, id: string) {
    await this.prisma.address.deleteMany({ where: { id, userId } });
    return { ok: true };
  }
}
