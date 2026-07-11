import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OrderModule } from '../modules/order/order.module';

@Module({
  imports: [PrismaModule, OrderModule],
  providers: [TasksService],
})
export class TasksModule {}
