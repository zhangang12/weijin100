import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';

/** 全局配置模块：任何模块无需 import 即可注入 ConfigService。 */
@Global()
@Module({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
