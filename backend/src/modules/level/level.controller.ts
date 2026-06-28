import { Controller, Get, UseGuards } from '@nestjs/common';
import { LevelService } from './level.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/jwt-payload';

@UseGuards(JwtAuthGuard)
@Controller('level')
export class LevelController {
  constructor(private readonly level: LevelService) {}

  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.level.me(u.userId);
  }
}
