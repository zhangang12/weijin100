import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ListingService } from './listing.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/jwt-payload';

@Controller()
export class ListingController {
  constructor(private readonly listing: ListingService) {}

  // 游客可浏览
  @Get('market/listings')
  list(@Query('metal') metal?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.listing.list({ metal, page: Number(page), pageSize: Number(pageSize) });
  }

  @Get('market/listings/:id')
  detail(@Param('id') id: string) {
    return this.listing.detail(id);
  }

  // 发布需登录
  @UseGuards(JwtAuthGuard)
  @Get('seller/publish/eligibility')
  eligibility(@CurrentUser() u: AuthUser) {
    return this.listing.publishEligibility(u.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('listings')
  create(@CurrentUser() u: AuthUser, @Body() body: Parameters<ListingService['create']>[1]) {
    return this.listing.create(u.userId, body);
  }
}
