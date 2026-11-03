import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { AdminGuard } from '../../common/auth/admin.guard';

/** 平台运营端（x-admin-token 鉴权）：实名人工审核。证件照用 GET /admin/file/<fileId> 查看。 */
@UseGuards(AdminGuard)
@Controller('admin/kyc')
export class AdminKycController {
  constructor(private readonly user: UserService) {}

  /** 列表：?status=pending（默认）| verified | rejected */
  @Get()
  list(@Query('status') status?: 'pending' | 'verified' | 'rejected') {
    return this.user.adminKycList(status || 'pending');
  }

  @Post(':userId/approve')
  approve(@Param('userId') userId: string) {
    return this.user.adminReviewKyc(userId, true);
  }

  /** 驳回：{ reason }，用户可修改后重新提交。 */
  @Post(':userId/reject')
  reject(@Param('userId') userId: string, @Body() body: { reason?: string }) {
    return this.user.adminReviewKyc(userId, false, body?.reason);
  }
}
