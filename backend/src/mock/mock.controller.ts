import { Controller, Get, Post } from '@nestjs/common';
import * as M from './mock.data';

/** 尚未实现为真逻辑的接口（Sprint 4 替换：违约/申诉/代交接细节）。
 *  已迁真库：auth/login·refresh、me/*、margin/*、level/me、market/listings、
 *  seller/publish、listings、address/*、market/price-alerts、lock/*、orders/*。 */
@Controller()
export class MockController {
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
}
