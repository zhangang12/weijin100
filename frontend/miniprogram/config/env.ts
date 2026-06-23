/** 环境与全局配置。打包前按环境切换 ENV。 */
type EnvName = 'dev' | 'staging' | 'prod';

const ENV: EnvName = 'dev';

const BASE_URLS: Record<EnvName, string> = {
  dev: 'https://dev-api.weijin100.example/api/v1',
  staging: 'https://staging-api.weijin100.example/api/v1',
  prod: 'https://api.weijin100.example/api/v1',
};

export const BASE_URL = BASE_URLS[ENV];

/** 接口未就绪时用本地 Mock；后端联调时改为 false */
export const USE_MOCK = true;

/** 行情 WebSocket 地址（由 BASE_URL 推导，后端确认后调整） */
export const WS_URL = BASE_URL.replace(/^http/, 'ws').replace('/api/v1', '/ws/market');

/** 价格快照有效期（毫秒），见《业务规则确认表》A3，待业务确认 */
export const QUOTE_TTL_MS = 10_000;
