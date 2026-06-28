import { Injectable } from '@nestjs/common';
import {
  PORT,
  QUOTE_HTTP,
  QUOTE_WS,
  POLL_MS,
  METAL_CODES,
  PRICE_CFG,
} from './config';

/** 配置服务：对外暴露与原 config.ts 完全一致的常量（从 env 读，默认值不变）。 */
@Injectable()
export class ConfigService {
  readonly port = PORT;
  readonly quoteHttp = QUOTE_HTTP;
  readonly quoteWs = QUOTE_WS;
  readonly pollMs = POLL_MS;
  readonly metalCodes = METAL_CODES;
  readonly priceCfg = PRICE_CFG;
}
