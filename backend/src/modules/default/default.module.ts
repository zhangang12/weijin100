import { Module } from '@nestjs/common';
import { DefaultController } from './default.controller';
import { DefaultService } from './default.service';
import { MarginModule } from '../margin/margin.module';

@Module({
  imports: [MarginModule], // 注入 MarginService（扣罚）
  controllers: [DefaultController],
  providers: [DefaultService],
  exports: [DefaultService],
})
export class DefaultModule {}
