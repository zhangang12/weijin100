import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/jwt-payload';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 微信登录：{ code }。dev 可用 code='mock:<openid>' 直接登录（生产禁用）。 */
  @Post('login')
  login(@Body() body: { code: string }) {
    return this.auth.login(body?.code);
  }

  @Post('refresh')
  refresh(@Body() body: { refreshToken: string }) {
    return this.auth.refresh(body?.refreshToken);
  }

  /** 手机号一键授权：{ code }（getPhoneNumber 按钮回调里的 code）→ 写入用户并返回完整手机号。 */
  @UseGuards(JwtAuthGuard)
  @Post('phone')
  phone(@CurrentUser() u: AuthUser, @Body() body: { code?: string }) {
    return this.auth.bindPhone(u.userId, body?.code);
  }
}
