import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { AdminGuard } from '../../common/auth/admin.guard';

/** 平台运营端（x-admin-token 鉴权）：仲裁裁决等人工操作。 */
@UseGuards(AdminGuard)
@Controller('admin/orders')
export class OrderAdminController {
  constructor(private readonly order: OrderService) {}

  /** 仲裁裁决：violator = buyer | seller | none。 */
  @Post(':no/arbitration/resolve')
  resolve(@Param('no') no: string, @Body() body: { violator: 'buyer' | 'seller' | 'none'; reason?: string }) {
    return this.order.resolveArbitration(decodeURIComponent(no), body?.violator, body?.reason);
  }
}
