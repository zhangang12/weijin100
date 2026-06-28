import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AlertService } from './alert.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/jwt-payload';

@UseGuards(JwtAuthGuard)
@Controller('market/price-alerts')
export class AlertController {
  constructor(private readonly alert: AlertService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.alert.list(u.userId);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() body: Parameters<AlertService['create']>[1]) {
    return this.alert.create(u.userId, body);
  }

  @Delete(':id')
  remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.alert.remove(u.userId, id);
  }
}
