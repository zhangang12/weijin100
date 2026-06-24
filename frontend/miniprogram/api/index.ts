import { request } from '../utils/request';
import type { PriceSnapshot, Listing, Paged, Metal } from '../types/api';
import type { Profile, MarginAccount, OrderItem, OrderTab } from '../types/models';
import type { KycInfo, LevelInfo, DefaultRecord, DefaultSummary, OrderDetail, RelayProgress } from '../types/biz';

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
};

/** 买家锁价 */
export const lockApi = {
  getListingDetail(id: string) { return request<Listing>({ url: `/market/listings/${id}`, auth: false }); },
  getQuote(metal: Metal = 'gold') { return request<PriceSnapshot>({ url: '/lock/quote/' + metal, auth: false }); },
  submitLock(body: { listingId: string; shipMode: string; qty: number; payMethod: string; snapshotVersion: string }) {
    return request<{ lockOrderId: string; status: string }>({ url: '/lock/orders', method: 'POST', data: body });
  },
  getLockResult(lockOrderId: string) {
    return request<{ status: 'processing' | 'success' | 'failed'; orderNo?: string; failReason?: string; sellerContact?: { phone: string; wechat: string } }>({ url: `/lock/orders/${lockOrderId}` });
  },
};

/** 货品发布 */
export const publishApi = {
  getEligibility() { return request<{ realName: boolean; contact: boolean; marginOk: boolean; level: string; maxQty: number; minQty: number }>({ url: '/seller/publish/eligibility' }); },
  submit(body: Record<string, unknown>) { return request<{ listingId: string; status: string }>({ url: '/listings', method: 'POST', data: body }); },
};
