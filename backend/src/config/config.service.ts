import { Injectable } from '@nestjs/common';
import * as C from './config';

/** 配置服务：集中暴露 env 配置（默认值见 config.ts）。 */
@Injectable()
export class ConfigService {
  readonly port = C.PORT;
  readonly nodeEnv = C.NODE_ENV;
  // 行情
  readonly quoteHttp = C.QUOTE_HTTP;
  readonly quoteWs = C.QUOTE_WS;
  readonly pollMs = C.POLL_MS;
  readonly metalCodes = C.METAL_CODES;
  readonly priceCfg = C.PRICE_CFG;
  // 鉴权
  readonly jwtSecret = C.JWT_SECRET;
  readonly jwtAccessTtl = C.JWT_ACCESS_TTL;
  readonly jwtRefreshTtl = C.JWT_REFRESH_TTL;
  // 微信
  readonly wxAppid = C.WX_APPID;
  readonly wxSecret = C.WX_SECRET;
  // 平台管理端
  readonly adminToken = C.ADMIN_TOKEN;
  // 存储 / 缓存
  readonly storageDriver = C.STORAGE_DRIVER;
  readonly uploadDir = C.UPLOAD_DIR;
  readonly redisUrl = C.REDIS_URL;
  // 交易
  /** @deprecated 保证金改固定单价（C1），见 marginUnitFen。 */
  readonly marginRatio = C.MARGIN_RATIO;
  readonly marginUnitFen = C.MARGIN_UNIT_FEN;
  readonly minRechargeFen = C.MIN_RECHARGE_FEN;
  readonly lockCountdownMs = C.LOCK_COUNTDOWN_MS;
  readonly autoCompleteMs = C.AUTO_COMPLETE_MS;
  readonly relayFeeFen = C.RELAY_FEE_FEN;

  /** 每克保证金单价（分）。未知金属回退到黄金口径。 */
  marginUnitOf(metal: string): number {
    return C.MARGIN_UNIT_FEN[metal] ?? C.MARGIN_UNIT_FEN.gold;
  }

  /** 冻结/解冻额（分）= 克重 × 单价。金额确定，冻结与解冻可精确重算。 */
  freezeFenFor(metal: string, weight: number): number {
    return Math.round(weight * this.marginUnitOf(metal));
  }
}
