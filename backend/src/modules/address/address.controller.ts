import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AddressService } from './address.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/jwt-payload';

@UseGuards(JwtAuthGuard)
@Controller('address')
export class AddressController {
  constructor(private readonly addr: AddressService) {}

  @Get('list')
  list(@CurrentUser() u: AuthUser) {
    return this.addr.list(u.userId);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() body: Parameters<AddressService['create']>[1]) {
    return this.addr.create(u.userId, body);
  }

  @Put(':id/default')
  setDefault(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.addr.setDefault(u.userId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.addr.remove(u.userId, id);
  }
}
