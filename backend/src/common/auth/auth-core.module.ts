import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JWT_SECRET, JWT_ACCESS_TTL } from '../../config/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalAuthGuard } from './optional-auth.guard';

/** 全局鉴权核心：JwtModule + 两个守卫，供所有业务模块直接注入使用。 */
@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: JWT_ACCESS_TTL as unknown as number },
    }),
  ],
  providers: [JwtAuthGuard, OptionalAuthGuard],
  exports: [JwtModule, JwtAuthGuard, OptionalAuthGuard],
})
export class AuthCoreModule {}
