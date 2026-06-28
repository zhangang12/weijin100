import { Module } from '@nestjs/common';
import { MockController } from './mock.controller';

/** 业务 Mock 模块：承载除行情外的全部 REST 接口。 */
@Module({
  controllers: [MockController],
})
export class MockModule {}
