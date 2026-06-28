import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/jwt-payload';

@UseGuards(JwtAuthGuard)
@Controller()
export class UserController {
  constructor(private readonly user: UserService) {}

  @Get('me/profile')
  profile(@CurrentUser() u: AuthUser) {
    return this.user.profile(u.userId);
  }

  @Put('me/profile')
  update(@CurrentUser() u: AuthUser, @Body() body: { nickname?: string; wechat?: string; avatar?: string; phone?: string }) {
    return this.user.updateProfile(u.userId, body);
  }

  @Get('me/kyc')
  kyc(@CurrentUser() u: AuthUser) {
    return this.user.kyc(u.userId);
  }

  @Post('me/kyc')
  submitKyc(@CurrentUser() u: AuthUser, @Body() body: { realName: string; idCardNo: string; frontImg?: string; backImg?: string }) {
    return this.user.submitKyc(u.userId, body);
  }

  @Get('me/eligibility')
  eligibility(@CurrentUser() u: AuthUser) {
    return this.user.eligibility(u.userId);
  }
}
