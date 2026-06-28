import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/** JwtService 来自全局 AuthCoreModule，WeChatService/PrismaService/ConfigService 均为全局。 */
@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
