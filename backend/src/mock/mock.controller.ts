import { Controller, Get, Post } from '@nestjs/common';

/** 仅剩通用占位接口；其余均已迁真库（auth/me/margin/level/listing/address/alert/lock/order/default）。 */
@Controller()
export class MockController {
  @Post('auth/phone')
  authPhone() {
    // 微信手机号解密（需 session_key + 加密数据）；Sprint 接入真实解密
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
}
