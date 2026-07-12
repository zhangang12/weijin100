import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderAdminController } from './admin.controller';
import { OrderService } from './order.service';
import { MarginModule } from '../margin/margin.module';
import { DefaultModule } from '../default/default.module';
import { AdminGuard } from '../../common/auth/admin.guard';

@Module({
  imports: [MarginModule, DefaultModule], // 完成时解冻 + 仲裁裁决记违约
  controllers: [OrderController, OrderAdminController],
  providers: [OrderService, AdminGuard],
  exports: [OrderService], // 供定时任务 B2 自动完成复用
})
export class OrderModule {}
