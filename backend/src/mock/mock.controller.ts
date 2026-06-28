import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import * as M from './mock.data';

/** 业务 Mock 接口（除行情外的其余全部接口）。
 *  路径与返回结构与原 Express routes.ts 完全一致；信封由全局拦截器统一包。
 *  控制器路径不带 /api/v1，全局前缀自动添加。
 *  注意：静态路由声明在参数路由之前（如 orders/badge 必须早于 orders/:no）。 */
@Controller()
export class MockController {
  // ---- 鉴权 / 通用 ----
  @Post('auth/login')
  authLogin() {
    return {
      accessToken: 'mock-access',
      refreshToken: 'mock-refresh',
      expiresIn: 7200,
      user: M.PROFILE,
    };
  }

  @Post('auth/refresh')
  authRefresh() {
    return { accessToken: 'mock-access', expiresIn: 7200 };
  }

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
      orderStatus: [
        'selling',
        'locked_pending',
        'completed',
        'relay_inspecting',
        'arbitrating',
        'cancelled',
      ],
    };
  }

  @Get('me/eligibility')
  meEligibility() {
    return M.ELIGIBILITY;
  }

  // ---- 行情 / 首页（纯 Mock 部分：价格提醒）----
  @Get('market/price-alerts')
  priceAlertsList() {
    return M.ALERTS;
  }

  @Post('market/price-alerts')
  priceAlertCreate() {
    return { id: 'AL_NEW' };
  }

  @Delete('market/price-alerts/:id')
  priceAlertDelete() {
    return { ok: true };
  }

  // ---- 我的 / 账户 ----
  @Get('me/profile')
  meProfileGet() {
    return M.PROFILE;
  }

  @Put('me/profile')
  meProfileUpdate() {
    return M.PROFILE;
  }

  @Get('me/kyc')
  meKycGet() {
    return M.KYC;
  }

  @Post('me/kyc')
  meKycSubmit() {
    return { ok: true };
  }

  @Get('margin/account')
  marginAccount() {
    return M.MARGIN;
  }

  @Post('margin/recharge')
  marginRecharge() {
    return { rechargeId: 'R_1', payParams: {} };
  }

  @Post('margin/refund')
  marginRefund() {
    return { refundId: 'RF_1', eta: 'T+1' };
  }

  @Get('level/me')
  levelMe() {
    return M.LEVEL;
  }

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

  @Get('address/list')
  addressList() {
    return M.ADDRESSES;
  }

  @Post('address')
  addressCreate() {
    return { ok: true };
  }

  @Put('address/:id/default')
  addressSetDefault() {
    return { ok: true };
  }

  @Delete('address/:id')
  addressDelete() {
    return { ok: true };
  }

  // ---- 订单 / 交割 ----
  // 静态路由优先：orders/badge 必须在 orders/:no 之前声明。
  @Get('orders')
  ordersList(@Query('tab') tab?: string) {
    return M.paged(tab ? M.ORDERS.filter((o) => o.status === tab) : M.ORDERS);
  }

  @Get('orders/badge')
  ordersBadge() {
    return {
      pendingCount: M.ORDERS.filter((o) => o.status === 'locked_pending').length,
    };
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

  // ---- 买家锁价（除 quote 外）----
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

  // ---- 货品发布 ----
  @Get('seller/publish/eligibility')
  sellerPublishEligibility() {
    return { realName: true, contact: true, marginOk: true, level: 'L2', maxQty: 5000, minQty: 1 };
  }

  @Post('listings')
  listingCreate() {
    return { listingId: 'L_NEW1', status: 'selling' };
  }
}
