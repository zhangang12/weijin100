import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { MarketModule } from './market/market.module';
import { MockModule } from './mock/mock.module';

/** 根模块：全局配置 + 行情模块 + 业务 Mock 模块。 */
@Module({
  imports: [ConfigModule, MarketModule, MockModule],
})
export class AppModule {}
