import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { LockService } from './lock.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/jwt-payload';

@UseGuards(JwtAuthGuard)
@Controller('lock')
export class LockController {
  constructor(private readonly lock: LockService) {}

  @Get('buyer-limit')
  buyerLimit(@CurrentUser() u: AuthUser, @Query('metal') metal?: string) {
    return this.lock.buyerLimit(u.userId, metal || 'gold');
  }

  @Post('orders')
  create(@CurrentUser() u: AuthUser, @Body() body: { listingId: string; weight?: number; qty?: number; payMethod?: string; shipMode?: string; snapshotVersion?: string }) {
    return this.lock.createLock(u.userId, {
      ...body,
      weight: body.weight ?? body.qty ?? 0,
    });
  }

  @Get('orders/:id')
  detail(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.lock.lockDetail(u.userId, id);
  }
}
