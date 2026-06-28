import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { MarginModule } from '../margin/margin.module';

@Module({
  imports: [MarginModule], // 注入 MarginService（完成时解冻）
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
