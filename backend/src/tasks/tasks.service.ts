import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderService } from '../modules/order/order.service';

/**
 * 定时任务服务（轮询模式，Redis/BullMQ 可用时可替换为 Bull 队列）。
 *
 * 业务规则对齐（重要）：
 *   A2：4h 倒计时归零**不自动判违约**——继续计时、提示尽快交割；违约由守约方发起仲裁、平台人工判定。
 *   B3：仲裁期间**暂停倒计时**、平台 2h 内致电人工判定，**不自动判申请方违约**。
 *   B2：一方已确认、另一方超时 24h → 自动完成并解冻（本任务唯一的自动动作）。
 * 故本任务仅做 B2 自动完成；4h/仲裁到期均不再自动处置（防止误罚守约方）。
 */
@Injectable()
export class TasksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TasksService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly order: OrderService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.runAll().catch((e) => this.logger.error('task error', e)), 60_000);
    this.logger.log('定时任务已启动（60s 间隔）');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runAll() {
    await Promise.allSettled([
      this.autoCompleteOverdue(),
      this.logOverduePending(),
    ]);
  }

  /** B2：一方确认 + 另一方超时 24h → 自动完成。 */
  private async autoCompleteOverdue() {
    const n = await this.order.autoCompleteOverdue();
    if (n > 0) this.logger.log(`B2 自动完成订单 ${n} 笔`);
  }

  /**
   * A2：4h 归零仅记录/可用于推送提醒，不自动判违约。
   * 这里仅统计逾期未完成订单数用于观测（不改状态、不记违约）。
   */
  private async logOverduePending() {
    const overdue = await this.prisma.order.count({
      where: { status: 'locked_pending', countdownExpireAt: { lte: new Date() } },
    });
    if (overdue > 0) this.logger.log(`交割超时(继续计时,待人工/仲裁) 订单 ${overdue} 笔`);
  }
}
