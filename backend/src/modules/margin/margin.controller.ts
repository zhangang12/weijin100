import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { MarginService } from './margin.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/jwt-payload';

@UseGuards(JwtAuthGuard)
@Controller('margin')
export class MarginController {
  constructor(private readonly margin: MarginService) {}

  @Get('account')
  account(@CurrentUser() u: AuthUser) {
    return this.margin.account(u.userId);
  }

  @Post('recharge')
  recharge(@CurrentUser() u: AuthUser, @Body() body: { amount: number }) {
    return this.margin.recharge(u.userId, body?.amount);
  }

  @Post('refund')
  refund(@CurrentUser() u: AuthUser, @Body() body: { amount: number }) {
    return this.margin.refund(u.userId, body?.amount);
  }
}
