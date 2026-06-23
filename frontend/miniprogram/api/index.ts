import { request } from '../utils/request';
import type { PriceSnapshot, Listing, Paged, Metal } from '../types/api';
import type { Profile, MarginAccount, OrderItem, OrderTab } from '../types/models';

/** 行情 / 首页 */
export const marketApi = {
  getQuote(metal: Metal = 'gold') {
    return request<PriceSnapshot>({ url: '/market/quote', data: { metal }, auth: false });
  },
  getListings(params: { metal?: Metal; category?: string; shipMode?: string; sort?: string; page?: number; pageSize?: number } = {}) {
    return request<Paged<Listing>>({ url: '/market/listings', data: { metal: 'gold', page: 1, pageSize: 20, ...params }, auth: false });
  },
  getListingDetail(id: string) {
    return request<Listing>({ url: `/market/listings/${id}`, auth: false });
  },
};

/** 我的 / 账户 */
export const userApi = {
  getProfile() {
    return request<Profile>({ url: '/me/profile' });
  },
  getMargin() {
    return request<MarginAccount>({ url: '/margin/account' });
  },
};

/** 订单 */
export const orderApi = {
  getOrders(tab?: OrderTab) {
    return request<Paged<OrderItem>>({ url: '/orders', data: tab ? { tab } : {} });
  },
  getOrderDetail(orderNo: string) {
    return request<OrderItem>({ url: `/orders/${encodeURIComponent(orderNo)}` });
  },
  getBadge() {
    return request<{ pendingCount: number }>({ url: '/orders/badge', silent: true });
  },
};

/** 买家锁价 */
export const lockApi = {
  getListingDetail(id: string) {
    return request<Listing>({ url: `/market/listings/${id}`, auth: false });
  },
  getQuote(metal: Metal = 'gold') {
    return request<PriceSnapshot>({ url: '/lock/quote/' + metal, auth: false });
  },
  submitLock(body: { listingId: string; shipMode: string; qty: number; payMethod: string; snapshotVersion: string }) {
    return request<{ lockOrderId: string; status: string }>({ url: '/lock/orders', method: 'POST', data: body });
  },
};
