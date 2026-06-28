import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface PayResult {
  outTradeNo: string;
  status: string;
  payParams: Record<string, unknown>;
}

/**
 * 支付服务（当前 mock 驱动：立即成功）。
 * 正式接微信支付 V3：pay() 返回小程序 jsapi 下单参数，由支付回调置 paid。
 * 保留这层抽象，切真支付只换驱动，业务无感。
 */
@Injectable()
export class PaymentService {
  private readonly log = new Logger('Payment');
  constructor(private readonly prisma: PrismaService) {}

  async pay(
    userId: string,
    bizType: Prisma.PaymentRecordCreateInput['bizType'],
    amountFen: number,
    refOrderNo?: string,
  ): Promise<PayResult> {
    const outTradeNo = 'PAY' + Date.now() + Math.floor(Math.random() * 1000);
    const rec = await this.prisma.paymentRecord.create({
      data: { userId, bizType, amount: BigInt(amountFen), outTradeNo, refOrderNo, status: 'pending' },
    });
    // mock 驱动：立即支付成功（正式由微信支付回调置位）
    await this.prisma.paymentRecord.update({ where: { id: rec.id }, data: { status: 'paid', paidAt: new Date() } });
    this.log.log(`[mock-pay] ${bizType} ${amountFen}分 → paid (${outTradeNo})`);
    return { outTradeNo, status: 'paid', payParams: {} };
  }
}
