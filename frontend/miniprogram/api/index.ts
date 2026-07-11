import { request } from '../utils/request';
import type { PriceSnapshot, Listing, Paged, Metal, BuyerLimit } from '../types/api';
import type { Profile, MarginAccount, OrderItem, OrderTab } from '../types/models';
import type { KycInfo, LevelInfo, DefaultRecord, DefaultSummary, OrderDetail, RelayProgress, Address, PriceAlert } from '../types/biz';

/** 行情 / 首页 */
export const marketApi = {
  getQuote(metal: Metal = 'gold') { return request<PriceSnapshot>({ url: '/market/quote', data: { metal }, auth: false }); },
  getListings(params: { metal?: Metal; category?: string; shipMode?: string; sort?: string; page?: number } = {}) {
    return request<Paged<Listing>>({ url: '/market/listings', data: { metal: 'gold', page: 1, pageSize: 20, ...params }, auth: false });
  },
  getListingDetail(id: string) { return request<Listing>({ url: `/market/listings/${id}`, auth: false }); },
};

/** 我的 / 账户 / 实名 */
export const userApi = {
  getProfile() { return request<Profile>({ url: '/me/profile' }); },
  getMargin() { return request<MarginAccount>({ url: '/margin/account' }); },
  getKyc() { return request<KycInfo>({ url: '/me/kyc' }); },
  submitKyc(body: { realName: string; idCardNo: string; frontFileId: string; backFileId: string }) {
    return request<{ ok: boolean }>({ url: '/me/kyc', method: 'POST', data: body });
  },
  saveProfile(body: { nickname?: string; phone: string; wechat: string }) {
    return request<Profile>({ url: '/me/profile', method: 'PUT', data: body });
  },
};

/** 保证金 */
export const marginApi = {
  getAccount() { return request<MarginAccount>({ url: '/margin/account' }); },
  recharge(body: { metal: Metal; amount: number; payMethod?: string }) {
    return request<{ rechargeId: string; payParams: Record<string, unknown> }>({ url: '/margin/recharge', method: 'POST', data: body });
  },
  refund(body: { amount: number }) {
    return request<{ refundId: string; eta: string }>({ url: '/margin/refund', method: 'POST', data: body });
  },
};

/** 级别 / 佣金 */
export const levelApi = {
  getLevel() { return request<LevelInfo>({ url: '/level/me' }); },
};

/** 违约 */
export const defaultApi = {
  getSummary() { return request<DefaultSummary>({ url: '/default/summary' }); },
  getRecords() { return request<Paged<DefaultRecord>>({ url: '/default/records' }); },
  appeal(recordId: string, body: { reason: string; evidence: string[] }) {
    return request<{ ok: boolean }>({ url: `/default/records/${recordId}/appeal`, method: 'POST', data: body });
  },
};

/** 收货/取货地址 */
export const addressApi = {
  list() { return request<Address[]>({ url: '/address/list' }); },
  save(body: Partial<Address>) { return request<{ ok: boolean }>({ url: '/address', method: 'POST', data: body }); },
  remove(id: string) { return request<{ ok: boolean }>({ url: `/address/${id}`, method: 'DELETE' }); },
  setDefault(id: string) { return request<{ ok: boolean }>({ url: `/address/${id}/default`, method: 'PUT' }); },
};

/** 订阅金价提醒 */
export const alertApi = {
  list() { return request<PriceAlert[]>({ url: '/market/price-alerts' }); },
  create(body: { metal: string; condition: string; targetPrice: string; channels: string[] }) {
    return request<{ id: string }>({ url: '/market/price-alerts', method: 'POST', data: body });
  },
  remove(id: string) { return request<{ ok: boolean }>({ url: `/market/price-alerts/${id}`, method: 'DELETE' }); },
};

/** 订单 / 交割 */
export const orderApi = {
  getOrders(tab?: OrderTab) { return request<Paged<OrderItem>>({ url: '/orders', data: tab ? { tab } : {} }); },
  getOrderDetail(orderNo: string) { return request<OrderDetail>({ url: `/orders/${encodeURIComponent(orderNo)}` }); },
  getBadge() { return request<{ pendingCount: number }>({ url: '/orders/badge', silent: true }); },
  confirmComplete(orderNo: string) {
    return request<{ myConfirmed: boolean; peerConfirmed: boolean; status: string }>({ url: `/orders/${encodeURIComponent(orderNo)}/confirm-complete`, method: 'POST' });
  },
  submitArbitration(orderNo: string, body: { chatScreenshots: string[]; description: string }) {
    return request<{ arbId: string; status: string }>({ url: `/orders/${encodeURIComponent(orderNo)}/arbitration`, method: 'POST', data: body });
  },
  getRelay(orderNo: string) { return request<RelayProgress>({ url: `/orders/${encodeURIComponent(orderNo)}/relay` }); },
  /** 申请平台代交接（发起方付 ¥100，进入待对方同意）*/
  applyRelay(orderNo: string) {
    return request<{ feePaid: boolean; relayStatus: string }>({ url: `/orders/${encodeURIComponent(orderNo)}/relay/apply`, method: 'POST' });
  },
  /** 对方同意代交接 */
  relayConsent(orderNo: string) {
    return request<{ relayStatus: string; peerAgreed: boolean }>({ url: `/orders/${encodeURIComponent(orderNo)}/relay/consent`, method: 'POST' });
  },
  /** 更新代交接步骤（末步完成即释放双方保证金）*/
  updateRelayStep(orderNo: string, body: { stepIndex: number; state: 'done' | 'cur' | 'todo'; desc?: string }) {
    return request<RelayProgress>({ url: `/orders/${encodeURIComponent(orderNo)}/relay/step`, method: 'POST', data: body });
  },
};

/** 买家锁价 */
export const lockApi = {
  getListingDetail(id: string) { return request<Listing>({ url: `/market/listings/${id}`, auth: false }); },
  getQuote(metal: Metal = 'gold') { return request<PriceSnapshot>({ url: '/lock/quote/' + metal, auth: false }); },
  /** 可购买上限（级别/保证金/可买量），用于软约束卡 */
  getBuyerLimit(metal: Metal = 'gold') { return request<BuyerLimit>({ url: '/lock/buyer-limit', data: { metal } }); },
  submitLock(body: { listingId: string; weight: number; payMethod: string }) {
    return request<{ lockOrderId: string; status: string; orderNo?: string }>({ url: '/lock/orders', method: 'POST', data: body });
  },
  getLockResult(lockOrderId: string) {
    return request<{ status: 'processing' | 'success' | 'failed'; orderNo?: string; failReason?: string; sellerContact?: { phone: string; wechat: string } }>({ url: `/lock/orders/${lockOrderId}` });
  },
};

/** 货品发布 */
export const publishApi = {
  getEligibility(metal: Metal = 'gold') { return request<{ realName: boolean; contact: boolean; marginOk: boolean; level: string; maxQty: number; minQty: number }>({ url: '/seller/publish/eligibility', data: { metal } }); },
  submit(body: Record<string, unknown>) { return request<{ listingId: string; status: string }>({ url: '/listings', method: 'POST', data: body }); },
};
