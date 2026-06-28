import { Module } from '@nestjs/common';
import { LockController } from './lock.controller';
import { LockService } from './lock.service';
import { MarketModule } from '../../market/market.module';
import { MarginModule } from '../margin/margin.module';

@Module({
  imports: [MarketModule, MarginModule], // 注入 MarketService(快照) / MarginService(冻结)
  controllers: [LockController],
  providers: [LockService],
})
export class LockModule {}
