import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { DefaultService } from './default.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/jwt-payload';

@UseGuards(JwtAuthGuard)
@Controller('default')
export class DefaultController {
  constructor(private readonly def: DefaultService) {}

  @Get('summary')
  summary(@CurrentUser() u: AuthUser) {
    return this.def.summary(u.userId);
  }

  @Get('records')
  records(@CurrentUser() u: AuthUser) {
    return this.def.records(u.userId);
  }

  @Post('records/:id/appeal')
  appeal(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: { reason: string; evidence?: string[] }) {
    return this.def.appeal(u.userId, id, body);
  }
}
