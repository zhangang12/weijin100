/** 环境与全局配置。打包前按环境切换 ENV。 */
type EnvName = 'dev' | 'staging' | 'prod';

const ENV: EnvName = 'dev';

const BASE_URLS: Record<EnvName, string> = {
  // 本机后端：模拟器用 127.0.0.1，真机调试改为局域网 IP，如 http://192.168.1.100:3000/api/v1
  dev: 'http://127.0.0.1:3000/api/v1',
  staging: 'https://staging-api.weijin100.example/api/v1',
  prod: 'https://api.weijin100.example/api/v1',
};

export const BASE_URL = BASE_URLS[ENV];

/** 接口未就绪时用本地 Mock；后端联调时改为 false */
export const USE_MOCK = false;

/**
 * 开发联调登录绕过：true 时跳过 wx.login()，直接用 mock code 换 JWT。
 * 后端 wechat.service 支持 `mock:<openid>` 前缀，无需真实 AppID/Secret。
 * 上线前必须改为 false。
 */
export const DEV_LOGIN = true;

/** 联调用的测试 openid，对应后端自动创建的测试账号 */
export const DEV_OPENID = 'devuser001';

/** 行情 WebSocket 地址（由 BASE_URL 推导，后端确认后调整） */
export const WS_URL = BASE_URL.replace(/^http/, 'ws').replace('/api/v1', '/ws/market');

/** 价格快照有效期（毫秒），见《业务规则确认表》A3，待业务确认 */
export const QUOTE_TTL_MS = 10_000;
