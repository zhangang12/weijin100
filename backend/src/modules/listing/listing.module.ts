import { Module } from '@nestjs/common';
import { ListingController } from './listing.controller';
import { ListingService } from './listing.service';
import { MarketModule } from '../../market/market.module';

@Module({
  imports: [MarketModule], // spot 定价需大盘销售价
  controllers: [ListingController],
  providers: [ListingService],
  exports: [ListingService],
})
export class ListingModule {}
