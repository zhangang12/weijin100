import type { PriceSnapshot, Listing, Eligibility, Paged, Metal } from '../types/api';
import type { Profile, MarginAccount, OrderItem } from '../types/models';

/** 三金属行情 Mock（对齐设计稿数值） */
const QUOTES: Record<Metal, PriceSnapshot> = {
  gold: {
    metal: 'gold', unit: '元/克', marketPrice: '1,029.71', change: '-5.00', changePercent: '-0.49%',
    trend: 'down', premium: '+4.73', dayHigh: '1,031.20', dayLow: '1,026.40',
    salePrice: '1,029.71', buybackPrice: '1,027.71', sparkline: [22, 18, 20, 14, 24, 18, 28, 22, 30, 25, 33],
    quoteTime: '2026-04-28T12:57:40+08:00', snapshotVersion: 'mock-gold-v1',
  },
  silver: {
    metal: 'silver', unit: '元/克', marketPrice: '8.64', change: '+0.03', changePercent: '+0.35%',
    trend: 'up', premium: '+0.12', dayHigh: '8.69', dayLow: '8.55',
    salePrice: '8.64', buybackPrice: '8.52', sparkline: [12, 14, 13, 18, 16, 22, 20, 26, 24, 30, 33],
    quoteTime: '2026-04-28T12:57:40+08:00', snapshotVersion: 'mock-silver-v1',
  },
  platinum: {
    metal: 'platinum', unit: '元/克', marketPrice: '236.40', change: '+1.20', changePercent: '+0.51%',
    trend: 'up', premium: '+1.05', dayHigh: '238.00', dayLow: '233.10',
    salePrice: '236.40', buybackPrice: '233.90', sparkline: [20, 18, 22, 19, 24, 26, 23, 28, 30, 29, 33],
    quoteTime: '2026-04-28T12:57:40+08:00', snapshotVersion: 'mock-plat-v1',
  },
};

const LISTINGS: Listing[] = [
  { listingId: 'L_88001', seller: { userMasked: 'j*****6', level: 'L9', shopName: '融通足金' }, metal: 'gold', category: '板料', goodsName: '融通足金价', tags: ['板料', '整出'], totalWeight: 1000, remainingWeight: 1000, shipMode: 'whole_all', refPriceCash: '1,032.21', refPriceTransfer: '1,033.21', supportTransfer: true },
  { listingId: 'L_88002', seller: { userMasked: 'k*****', level: 'L6', shopName: '融通足金' }, metal: 'gold', category: '板料', goodsName: '融通足金价', tags: ['板料', '散出', '现货'], totalWeight: 987, remainingWeight: 987, shipMode: 'bulk', minBatch: 1, refPriceCash: '1,031.80', refPriceTransfer: '1,032.80', supportTransfer: true },
  { listingId: 'L_88003', seller: { userMasked: 'l*****8', level: 'L9', shopName: '融通足金' }, metal: 'gold', category: '板料', goodsName: '融通足金价', tags: ['板料', '整出', '现货'], totalWeight: 1500, remainingWeight: 1500, shipMode: 'whole_fixed', lotSize: 500, refPriceCash: '1,032.21', refPriceTransfer: '1,033.21', supportTransfer: true },
  { listingId: 'L_88004', seller: { userMasked: 'm*****', level: 'L4', shopName: '融通足金' }, metal: 'gold', category: '旧料', goodsName: '融通足金价', tags: ['旧料', '散出', '现货'], totalWeight: 860, remainingWeight: 860, shipMode: 'bulk', minBatch: 50, refPriceCash: '1,030.50', refPriceTransfer: '1,031.50', supportTransfer: true },
  { listingId: 'L_88005', seller: { userMasked: 'n*****', level: 'L2', shopName: '融通足金' }, metal: 'gold', category: '板料', goodsName: '融通足金价', tags: ['板料', '散出'], totalWeight: 1200, remainingWeight: 1200, shipMode: 'bulk', minBatch: 100, refPriceCash: '1,031.00', refPriceTransfer: undefined, supportTransfer: false },
];

const PROFILE: Profile = {
  userId: 'u_10086', weijinNo: '100886699', nickname: '金诚足金', level: 'L2', completedTrades: 13,
  kycStatus: 'verified', realNameMasked: '陈**', phone: '138****9999', wechat: 'chengjin_gold88', functionStatus: 'normal',
};

const MARGIN: MarginAccount = {
  totalBalance: 300000, available: 300000, frozen: 0, refundable: 300000,
  quota: { gold: 300, silver: 6000, platinum: 600 },
};

const ELIGIBILITY: Eligibility = { realName: true, contact: true, marginOk: true, functionStatus: 'normal', maxQty: 5000 };

const ORDERS: OrderItem[] = [
  { orderNo: '250603 9999 123456 01', side: 'buy', status: 'locked_pending', metal: 'gold', productName: '融通足金 · 品牌板料', weight: 3000, priceCash: '1,032.21', priceTransfer: '1,033.21', supportsTransfer: true, totalCash: 309663000, totalTransfer: 309963000, countdownRemaining: 13338, counterpartyMasked: 'j*****6', counterpartyLevel: 'L9', createTime: '2026-04-28T10:23:45+08:00' },
  { orderNo: '250603 9999 123455', side: 'sell', status: 'selling', metal: 'gold', productName: '融通足金价 · 板料', weight: 10000, priceCash: '1,032.21', priceTransfer: '1,033.21', supportsTransfer: true, totalCash: 1032210000, totalTransfer: 1033210000, createTime: '2026-04-28T07:42:00+08:00' },
  { orderNo: '250601 9999 120010 02', side: 'buy', status: 'completed', metal: 'gold', productName: '融通足金 · 金条', weight: 500, priceCash: '1,028.71', supportsTransfer: false, totalCash: 51435500, createTime: '2026-04-26T09:10:00+08:00', completeTime: '2026-04-26T14:32:00+08:00' },
];

function paged<T>(list: T[]): Paged<T> {
  return { list, page: 1, pageSize: list.length, total: list.length, hasMore: false };
}

/** Mock 路由解析：按 url + 入参返回数据，模拟网络延迟 */
export function resolveMock<T>(url: string, _method: string, data?: Record<string, unknown>): Promise<T> {
  const metal = (data && (data.metal as Metal)) || 'gold';
  let payload: unknown = null;

  if (url.startsWith('/market/quote') || url.startsWith('/lock/quote')) {
    payload = QUOTES[metal] || QUOTES.gold;
  } else if (url.startsWith('/market/listings/') || url.startsWith('/lock/orders/')) {
    const id = url.split('/').pop();
    payload = LISTINGS.find((l) => l.listingId === id) || LISTINGS[0];
  } else if (url.startsWith('/market/listings')) {
    payload = paged(LISTINGS);
  } else if (url.startsWith('/me/eligibility')) {
    payload = ELIGIBILITY;
  } else if (url.startsWith('/me/profile') || url.startsWith('/me/detail')) {
    payload = PROFILE;
  } else if (url.startsWith('/margin/account')) {
    payload = MARGIN;
  } else if (url.startsWith('/orders/badge')) {
    payload = { pendingCount: ORDERS.filter((o) => o.status === 'locked_pending').length };
  } else if (url.startsWith('/orders/')) {
    const no = decodeURIComponent(url.split('/orders/').pop() || '');
    payload = ORDERS.find((o) => o.orderNo === no) || ORDERS[0];
  } else if (url.startsWith('/orders')) {
    const tab = data && (data.tab as string);
    const list = tab ? ORDERS.filter((o) => o.status === tab) : ORDERS;
    payload = paged(list);
  } else if (url.startsWith('/auth/')) {
    payload = { accessToken: 'mock-access', refreshToken: 'mock-refresh', phone: '138****6688' };
  }

  return new Promise((resolve) => setTimeout(() => resolve(payload as T), 220));
}
