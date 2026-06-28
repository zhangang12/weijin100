import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 微信登录：{ code }。dev 可用 code='mock:<openid>' 直接登录。 */
  @Post('login')
  login(@Body() body: { code: string }) {
    return this.auth.login(body?.code);
  }

  @Post('refresh')
  refresh(@Body() body: { refreshToken: string }) {
    return this.auth.refresh(body?.refreshToken);
  }
}
