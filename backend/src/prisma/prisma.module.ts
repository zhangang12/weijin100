import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** 全局 Prisma 模块：任何模块无需 import 即可注入 PrismaService。 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
