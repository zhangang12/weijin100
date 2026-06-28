import type { Express } from 'express';
import * as M from './data/mock.js';
import { getQuote, allQuotes, quoteHealth } from './market/quote.js';
import { ok } from './envelope.js';

/** 注册全部 REST 路由（前缀 /api/v1，对齐《接口文档 v0.1》）。
 *  行情走真实数据源；其余为内存 Mock（写操作多为占位，业务状态机后续实现）。 */
export function registerRoutes(app: Express): void {
  const q = (metal: string) => getQuote(metal) || M.FALLBACK_QUOTE[metal] || M.FALLBACK_QUOTE.gold;

  // ---- 鉴权 / 通用 ----
  app.post('/api/v1/auth/login', (_req, res) => ok(res, { accessToken: 'mock-access', refreshToken: 'mock-refresh', expiresIn: 7200, user: M.PROFILE }));
  app.post('/api/v1/auth/refresh', (_req, res) => ok(res, { accessToken: 'mock-access', expiresIn: 7200 }));
  app.post('/api/v1/auth/phone', (_req, res) => ok(res, { phone: '138****6688' }));
  app.get('/api/v1/config/dict', (_req, res) => ok(res, { metal: ['gold', 'silver', 'platinum'], shipMode: ['whole_all', 'whole_fixed', 'bulk'], payMethod: ['cash', 'transfer'], orderStatus: ['selling', 'locked_pending', 'completed', 'relay_inspecting', 'arbitrating', 'cancelled'] }));
  app.get('/api/v1/me/eligibility', (_req, res) => ok(res, M.ELIGIBILITY));

  // ---- 行情 / 首页（真实数据源）----
  app.get('/api/v1/market/quote', (req, res) => ok(res, q(String(req.query.metal || 'gold'))));
  app.get('/api/v1/market/listings', (_req, res) => ok(res, M.paged(M.LISTINGS)));
  app.get('/api/v1/market/listings/:id', (req, res) => ok(res, M.LISTINGS.find((l) => l.listingId === req.params.id) || M.LISTINGS[0]));
  app.get('/api/v1/market/price-alerts', (_req, res) => ok(res, M.ALERTS));
  app.post('/api/v1/market/price-alerts', (_req, res) => ok(res, { id: 'AL_NEW' }));
  app.delete('/api/v1/market/price-alerts/:id', (_req, res) => ok(res, { ok: true }));

  // ---- 我的 / 账户 ----
  app.get('/api/v1/me/profile', (_req, res) => ok(res, M.PROFILE));
  app.put('/api/v1/me/profile', (_req, res) => ok(res, M.PROFILE));
  app.get('/api/v1/me/kyc', (_req, res) => ok(res, M.KYC));
  app.post('/api/v1/me/kyc', (_req, res) => ok(res, { ok: true }));
  app.get('/api/v1/margin/account', (_req, res) => ok(res, M.MARGIN));
  app.post('/api/v1/margin/recharge', (_req, res) => ok(res, { rechargeId: 'R_1', payParams: {} }));
  app.post('/api/v1/margin/refund', (_req, res) => ok(res, { refundId: 'RF_1', eta: 'T+1' }));
  app.get('/api/v1/level/me', (_req, res) => ok(res, M.LEVEL));
  app.get('/api/v1/default/summary', (_req, res) => ok(res, M.DEFAULT_SUMMARY));
  app.get('/api/v1/default/records', (_req, res) => ok(res, M.paged(M.DEFAULTS)));
  app.post('/api/v1/default/records/:id/appeal', (_req, res) => ok(res, { ok: true }));
  app.get('/api/v1/address/list', (_req, res) => ok(res, M.ADDRESSES));
  app.post('/api/v1/address', (_req, res) => ok(res, { ok: true }));
  app.put('/api/v1/address/:id/default', (_req, res) => ok(res, { ok: true }));
  app.delete('/api/v1/address/:id', (_req, res) => ok(res, { ok: true }));

  // ---- 订单 / 交割 ----
  app.get('/api/v1/orders', (req, res) => {
    const tab = req.query.tab as string | undefined;
    ok(res, M.paged(tab ? M.ORDERS.filter((o) => o.status === tab) : M.ORDERS));
  });
  app.get('/api/v1/orders/badge', (_req, res) => ok(res, { pendingCount: M.ORDERS.filter((o) => o.status === 'locked_pending').length }));
  app.post('/api/v1/orders/:no/confirm-complete', (_req, res) => ok(res, { myConfirmed: true, peerConfirmed: false, status: 'locked_pending' }));
  app.post('/api/v1/orders/:no/arbitration', (_req, res) => ok(res, { arbId: 'ARB_1', status: 'arbitrating' }));
  app.get('/api/v1/orders/:no/relay', (_req, res) => ok(res, M.RELAY));
  app.get('/api/v1/orders/:no', (req, res) => ok(res, M.orderDetail(decodeURIComponent(req.params.no))));

  // ---- 买家锁价 ----
  app.get('/api/v1/lock/quote/:metal', (req, res) => ok(res, q(req.params.metal)));
  app.get('/api/v1/lock/buyer-limit', (_req, res) => ok(res, { buyerLevel: 'L2', deposit: 300000, maxBuyableQty: 5000, overLimit: false }));
  app.post('/api/v1/lock/orders', (_req, res) => ok(res, { lockOrderId: 'LK_900001', status: 'processing' }));
  app.get('/api/v1/lock/orders/:id', (_req, res) => ok(res, { status: 'success', orderNo: '250603 9999 123456 02', sellerContact: { phone: '138 **** 8888', wechat: 'jiang_jewel88' } }));

  // ---- 货品发布 ----
  app.get('/api/v1/seller/publish/eligibility', (_req, res) => ok(res, { realName: true, contact: true, marginOk: true, level: 'L2', maxQty: 5000, minQty: 1 }));
  app.post('/api/v1/listings', (_req, res) => ok(res, { listingId: 'L_NEW1', status: 'selling' }));

  // ---- 健康检查 ----
  app.get('/api/v1/health', (_req, res) => ok(res, { quote: quoteHealth(), quotes: allQuotes() }));
}
