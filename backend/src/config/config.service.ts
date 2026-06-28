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
  // 存储 / 缓存
  readonly storageDriver = C.STORAGE_DRIVER;
  readonly uploadDir = C.UPLOAD_DIR;
  readonly redisUrl = C.REDIS_URL;
}
