/** 环境与全局配置。打包前按环境切换 ENV。 */
type EnvName = 'dev' | 'staging' | 'prod';

const ENV: EnvName = 'prod';

const BASE_URLS: Record<EnvName, string> = {
  // 本机后端：模拟器用 127.0.0.1，真机调试改为局域网 IP，如 http://192.168.1.100:3000/api/v1
  dev: 'http://127.0.0.1:3100/api/v1',
  staging: 'https://staging-api.weijin100.example/api/v1',
  // 线上后端：域名须为小程序「服务器域名」里配置的合法域名（niuniu.qimeduo.com）。
  // ⚠️ 路径 /api/v1 假设线上部署的是本项目 NestJS 后端（全局前缀 /api/v1）；若线上前缀不同请改这里。
  prod: 'https://niuniu.qimeduo.com/api/v1',
};

export const BASE_URL = BASE_URLS[ENV];

/** 接口未就绪时用本地 Mock；后端联调时改为 false */
export const USE_MOCK = false;

/**
 * 开发联调登录绕过：true 时跳过 wx.login()，直接用 mock code 换 JWT。
 * 后端 wechat.service 支持 `mock:<openid>` 前缀，无需真实 AppID/Secret。
 * 上线已改为 false → 走真实 wx.login（需后端配好该小程序的 WX_APPID/WX_SECRET）。
 * 若线上后端尚未配好微信登录、只想先出体验版验证界面，可临时改回 true。
 */
export const DEV_LOGIN = false;

/** 联调用的测试 openid，对应后端自动创建的测试账号 */
export const DEV_OPENID = 'devuser001';

/**
 * 功能开关（合规）：暂无增值电信业务经营许可证，平台不经手用户资金。
 * - margin：保证金（充值 / 退款 / 冻结 / 扣罚）整体关闭，相关入口与文案不展示。
 * - onlinePay：线上支付关闭，平台代交接服务费改线下结算。
 * - commission：佣金（运营期免佣、线上不收费），级别页不展示费率表与佣金说明。
 * 恢复时须同步后端 MARGIN_ENABLED / ONLINE_PAY_ENABLED，并重新提审。
 */
export const FEATURES = { margin: false, onlinePay: false, commission: false } as const;

/** 行情 WebSocket 地址（由 BASE_URL 推导，后端确认后调整） */
export const WS_URL = BASE_URL.replace(/^http/, 'ws').replace('/api/v1', '/ws/market');

/** 价格快照有效期（毫秒），见《业务规则确认表》A3，待业务确认 */
export const QUOTE_TTL_MS = 10_000;
