/** 后端配置（可用环境变量覆盖）。默认值与原 Express 版 config.ts 完全一致。 */
export const PORT = Number(process.env.PORT || 3100);

/**
 * 脉动行情数据源。
 * 默认走「免费测试」端口（无需 IP 授权，但仅奇偶小时限时）：
 *   HTTP http://39.107.99.235:8090/getQuote.php   WS ws://39.107.99.235:8889
 * 正式上线改为：HTTP http://39.107.99.235:1008/getQuote.php   WS ws://39.107.99.235/ws
 *   —— 并需联系数据商客服(@mdapi888)授权「后端服务器 IP」后才可取数。
 */
export const QUOTE_HTTP = process.env.QUOTE_HTTP || 'http://39.107.99.235:8090/getQuote.php';
export const QUOTE_WS = process.env.QUOTE_WS || 'ws://39.107.99.235:8889';
export const POLL_MS = Number(process.env.POLL_MS || 3000);

/** 金属 → 脉动订阅代码。RT_AU=融通金黄金(对应「融通足金价」)，RT_AG=融通金白银；铂金免费库无，正式库待确认 */
export const METAL_CODES: Record<string, string> = {
  gold: process.env.CODE_GOLD || 'RT_AU',
  silver: process.env.CODE_SILVER || 'RT_AG',
  platinum: process.env.CODE_PLATINUM || 'RT_PT',
};

/** 平台派生价配置（业务规则 G1/G2：溢价、销售价>回购价；最终口径由后端+业务定） */
export const PRICE_CFG: Record<string, { premium: number; buybackSpread: number }> = {
  gold: { premium: 4.73, buybackSpread: 2.0 },
  silver: { premium: 0.12, buybackSpread: 0.12 },
  platinum: { premium: 1.05, buybackSpread: 2.5 },
};

import * as path from 'node:path';

export const NODE_ENV = process.env.NODE_ENV || 'development';

/** 鉴权（JWT）。token 口径：access 2h / refresh 30d。 */
export const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
export const JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || '2h';
export const JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL || '30d';

/** 微信小程序（登录）。dev 测试号在 .env；上线换微金100自注册真号。 */
export const WX_APPID = process.env.WX_APPID || '';
export const WX_SECRET = process.env.WX_SECRET || '';

/** 文件存储：本地落盘（架构 v2，取消 OSS；保留 driver 抽象可后接 OSS）。 */
export const STORAGE_DRIVER = process.env.STORAGE_DRIVER || 'local';
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');

/** 缓存/锁/队列（Sprint3 起用 Redis；dev 期为空时走内存降级驱动）。 */
export const REDIS_URL = process.env.REDIS_URL || '';
