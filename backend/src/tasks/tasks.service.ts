import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarginService } from '../modules/margin/margin.service';
import { DefaultService } from '../modules/default/default.service';

/**
 * 定时任务服务（轮询模式，Redis/BullMQ 可用时可替换为 Bull 队列）。
 * 每分钟检查：
 *   1. 订单 4h 倒计时到期 → 超时违约判定
 *   2. 双方都已确认 24h 后 → 兜底自动完成（正常双方确认会立即完成，这里是异常兜底）
 *   3. 仲裁超时（4h 后）→ 按违约处理发起方
 */
@Injectable()
export class TasksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TasksService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly margin: MarginService,
    private readonly defaultSvc: DefaultService,
  ) {}

  onModuleInit() {
    // 生产环境每 60s 扫一次；开发环境可增大间隔
    this.timer = setInterval(() => this.runAll().catch(e => this.logger.error('task error', e)), 60_000);
    this.logger.log('定时任务已启动（60s 间隔）');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runAll() {
    await Promise.allSettled([
      this.checkExpiredOrders(),
      this.checkExpiredArbitrations(),
    ]);
  }

  /** 4h 交割期到期未双方确认 → 记超时违约（买卖双方各记一条） */
  private async checkExpiredOrders() {
    const expired = await this.prisma.order.findMany({
      where: {
        status: 'locked_pending',
        countdownExpireAt: { lte: new Date() },
      },
      include: { buyer: true, seller: true },
    });
    for (const o of expired) {
      this.logger.log(`订单超时: ${o.orderNo}`);
      try {
        await this.prisma.$transaction([
          this.prisma.order.update({ where: { id: o.id }, data: { status: 'defaulted', cancelledAt: new Date() } }),
        ]);
        // 双方各记一条违约
        await this.defaultSvc.recordTimeout(o.buyerId, o.id, '买家', Number(o.weight));
        await this.defaultSvc.recordTimeout(o.sellerId, o.id, '卖家', Number(o.weight));
      } catch (e) {
        this.logger.error(`处理超时订单失败 ${o.orderNo}`, e);
      }
    }
  }

  /** 仲裁超时（arbitratingStartAt + 4h）→ 按申请方违约处理 */
  private async checkExpiredArbitrations() {
    const threshold = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const expired = await this.prisma.order.findMany({
      where: {
        status: 'arbitrating',
        arbitratingStartAt: { lte: threshold },
      },
    });
    for (const o of expired) {
      this.logger.log(`仲裁超时: ${o.orderNo}`);
      try {
        await this.prisma.order.update({ where: { id: o.id }, data: { status: 'defaulted', cancelledAt: new Date() } });
        await this.defaultSvc.recordTimeout(o.buyerId, o.id, '买家（仲裁超时）', Number(o.weight));
      } catch (e) {
        this.logger.error(`处理超时仲裁失败 ${o.orderNo}`, e);
      }
    }
  }
}
