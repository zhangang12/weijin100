import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MarginModule } from '../modules/margin/margin.module';
import { DefaultModule } from '../modules/default/default.module';

@Module({
  imports: [PrismaModule, MarginModule, DefaultModule],
  providers: [TasksService],
})
export class TasksModule {}
