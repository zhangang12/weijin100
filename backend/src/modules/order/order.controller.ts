import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/jwt-payload';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly order: OrderService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query('tab') tab?: string) {
    return this.order.list(u.userId, tab);
  }

  @Get('badge')
  badge(@CurrentUser() u: AuthUser) {
    return this.order.badge(u.userId);
  }

  @Post(':no/confirm-complete')
  confirm(@CurrentUser() u: AuthUser, @Param('no') no: string) {
    return this.order.confirmComplete(u.userId, decodeURIComponent(no));
  }

  @Post(':no/arbitration')
  arbitration(@CurrentUser() u: AuthUser, @Param('no') no: string) {
    return this.order.arbitration(u.userId, decodeURIComponent(no));
  }

  @Get(':no/relay')
  relay(@CurrentUser() u: AuthUser, @Param('no') no: string) {
    return this.order.relay(u.userId, decodeURIComponent(no));
  }

  @Post(':no/relay/apply')
  applyRelay(@CurrentUser() u: AuthUser, @Param('no') no: string) {
    return this.order.applyRelay(u.userId, decodeURIComponent(no));
  }

  @Post(':no/relay/step')
  updateRelayStep(@CurrentUser() u: AuthUser, @Param('no') no: string, @Body() body: { stepIndex: number; state: 'done' | 'cur' | 'todo'; desc?: string }) {
    return this.order.updateRelayStep(u.userId, decodeURIComponent(no), body);
  }

  @Get(':no')
  detail(@CurrentUser() u: AuthUser, @Param('no') no: string) {
    return this.order.detail(u.userId, decodeURIComponent(no));
  }
}
