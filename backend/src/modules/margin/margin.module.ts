import { Module } from '@nestjs/common';
import { MarginController } from './margin.controller';
import { MarginService } from './margin.service';

@Module({
  controllers: [MarginController],
  providers: [MarginService],
  exports: [MarginService], // 供锁价/订单/违约模块复用 freeze/unfreeze/deduct
})
export class MarginModule {}
