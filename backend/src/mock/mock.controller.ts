import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import * as M from './mock.data';

/** 尚未实现为真逻辑的接口（逐 Sprint 替换）。
 *  已迁真库并移出本控制器：auth/login·refresh、me/*、margin/*、level/me、
 *  market/listings(+:id)、seller/publish/eligibility、listings、address/*、market/price-alerts。
 *  路径不带 /api/v1；静态路由声明在参数路由之前。 */
@Controller()
export class MockController {
  // ---- 通用 ----
  @Post('auth/phone')
  authPhone() {
    return { phone: '138****6688' };
  }

  @Get('config/dict')
  configDict() {
    return {
      metal: ['gold', 'silver', 'platinum'],
      shipMode: ['whole_all', 'whole_fixed', 'bulk'],
      payMethod: ['cash', 'transfer'],
      orderStatus: ['selling', 'locked_pending', 'completed', 'relay_inspecting', 'arbitrating', 'cancelled'],
    };
  }

  // ---- 违约 / 申诉（Sprint 4）----
  @Get('default/summary')
  defaultSummary() {
    return M.DEFAULT_SUMMARY;
  }

  @Get('default/records')
  defaultRecords() {
    return M.paged(M.DEFAULTS);
  }

  @Post('default/records/:id/appeal')
  defaultAppeal() {
    return { ok: true };
  }

  // ---- 订单 / 交割（Sprint 3/4）----
  @Get('orders')
  ordersList(@Query('tab') tab?: string) {
    return M.paged(tab ? M.ORDERS.filter((o) => o.status === tab) : M.ORDERS);
  }

  @Get('orders/badge')
  ordersBadge() {
    return { pendingCount: M.ORDERS.filter((o) => o.status === 'locked_pending').length };
  }

  @Post('orders/:no/confirm-complete')
  orderConfirmComplete() {
    return { myConfirmed: true, peerConfirmed: false, status: 'locked_pending' };
  }

  @Post('orders/:no/arbitration')
  orderArbitration() {
    return { arbId: 'ARB_1', status: 'arbitrating' };
  }

  @Get('orders/:no/relay')
  orderRelay() {
    return M.RELAY;
  }

  @Get('orders/:no')
  orderDetail(@Param('no') no: string) {
    return M.orderDetail(decodeURIComponent(no));
  }

  // ---- 买家锁价（Sprint 3；quote 在 MarketModule）----
  @Get('lock/buyer-limit')
  lockBuyerLimit() {
    return { buyerLevel: 'L2', deposit: 300000, maxBuyableQty: 5000, overLimit: false };
  }

  @Post('lock/orders')
  lockOrderCreate() {
    return { lockOrderId: 'LK_900001', status: 'processing' };
  }

  @Get('lock/orders/:id')
  lockOrderDetail() {
    return {
      status: 'success',
      orderNo: '250603 9999 123456 02',
      sellerContact: { phone: '138 **** 8888', wechat: 'jiang_jewel88' },
    };
  }
}
