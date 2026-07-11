import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BizException } from '../../common/biz-exception';

@Injectable()
export class AlertService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.priceAlert.findMany({ where: { userId, enabled: true }, orderBy: { createdAt: 'desc' } });
    return rows.map((a) => ({
      id: a.id,
      metal: a.metal,
      condition: a.condition,
      targetPrice: Number(a.targetPrice).toFixed(2),
      channels: a.channels,
    }));
  }

  async create(userId: string, dto: { metal: string; condition: string; targetPrice: number | string; channels?: string[] }) {
    if (!dto?.metal || !dto?.condition || dto?.targetPrice == null) throw new BizException('请填写提醒条件', 'ALERT_PARAM', 2000);
    // G3：每品类最多 8 条。
    const count = await this.prisma.priceAlert.count({ where: { userId, metal: dto.metal as Prisma.PriceAlertCreateInput['metal'], enabled: true } });
    if (count >= 8) throw new BizException('每品类最多 8 条提醒', 'ALERT_LIMIT', 3019);
    const a = await this.prisma.priceAlert.create({
      data: {
        userId,
        metal: dto.metal as Prisma.PriceAlertCreateInput['metal'],
        condition: dto.condition,
        targetPrice: String(dto.targetPrice),
        channels: dto.channels ?? ['push'],
      },
    });
    return { id: a.id };
  }

  async remove(userId: string, id: string) {
    await this.prisma.priceAlert.deleteMany({ where: { id, userId } });
    return { ok: true };
  }
}
