import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { PulseService } from './pulse.service';

/** 行情模块：轮询服务 + REST 控制器（WS 由 main.ts 在 listen 后挂载）。 */
@Module({
  controllers: [MarketController],
  providers: [PulseService, MarketService],
  exports: [MarketService],
})
export class MarketModule {}
