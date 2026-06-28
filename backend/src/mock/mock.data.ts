/** 业务 Mock 数据层（除行情走真实数据源外，其余为内存 Mock；后端实现真逻辑时替换为 DB） */
import type { PriceSnapshot } from '../market/market.service';

export const LISTINGS = [
  { listingId: 'L_88001', seller: { userMasked: 'j*****6', level: 'L9', shopName: '融通足金' }, metal: 'gold', category: '板料', goodsName: '融通足金价', tags: ['板料', '整出'], totalWeight: 1000, remainingWeight: 1000, shipMode: 'whole_all', refPriceCash: '891.00', refPriceTransfer: '892.00', supportTransfer: true },
  { listingId: 'L_88002', seller: { userMasked: 'k*****', level: 'L6', shopName: '融通足金' }, metal: 'gold', category: '板料', goodsName: '融通足金价', tags: ['板料', '散出', '现货'], totalWeight: 987, remainingWeight: 987, shipMode: 'bulk', minBatch: 1, refPriceCash: '890.50', refPriceTransfer: '891.50', supportTransfer: true },
  { listingId: 'L_88003', seller: { userMasked: 'l*****8', level: 'L9', shopName: '融通足金' }, metal: 'gold', category: '板料', goodsName: '融通足金价', tags: ['板料', '整出', '现货'], totalWeight: 1500, remainingWeight: 1500, shipMode: 'whole_fixed', lotSize: 500, refPriceCash: '891.00', refPriceTransfer: '892.00', supportTransfer: true },
  { listingId: 'L_88004', seller: { userMasked: 'm*****', level: 'L4', shopName: '融通足金' }, metal: 'gold', category: '旧料', goodsName: '融通足金价', tags: ['旧料', '散出', '现货'], totalWeight: 860, remainingWeight: 860, shipMode: 'bulk', minBatch: 50, refPriceCash: '889.50', refPriceTransfer: '890.50', supportTransfer: true },
  { listingId: 'L_88005', seller: { userMasked: 'n*****', level: 'L2', shopName: '融通足金' }, metal: 'gold', category: '板料', goodsName: '融通足金价', tags: ['板料', '散出'], totalWeight: 1200, remainingWeight: 1200, shipMode: 'bulk', minBatch: 100, refPriceCash: '890.00', refPriceTransfer: null, supportTransfer: false },
];

export const PROFILE = { userId: 'u_10086', weijinNo: '100886699', nickname: '金诚足金', level: 'L2', completedTrades: 13, kycStatus: 'verified', realNameMasked: '陈**', phone: '138****9999', wechat: 'chengjin_gold88', functionStatus: 'normal' };
export const MARGIN = { totalBalance: 300000, available: 300000, frozen: 0, refundable: 300000, quota: { gold: 300, silver: 6000, platinum: 600 } };
export const ELIGIBILITY = { realName: true, contact: true, marginOk: true, functionStatus: 'normal', maxQty: 5000 };
export const KYC = { status: 'verified', realName: '陈**', idCardNo: '4401**********1234' };
export const LEVEL = { currentLevel: 'L2', completedTrades: 13, tradesToNext: 7, progressPercent: 30, feeWaived: true, feeTable: [{ level: 'L1', gold: '0.30', silver: '0.020', platinum: '0.15' }, { level: 'L3', gold: '0.26', silver: '0.018', platinum: '0.13' }, { level: 'L5', gold: '0.22', silver: '0.015', platinum: '0.11' }, { level: 'L7', gold: '0.18', silver: '0.012', platinum: '0.09' }, { level: 'L9', gold: '0.15', silver: '0.010', platinum: '0.08' }] };
export const DEFAULTS = [{ id: 'D_001', type: '超时未交割', role: '卖家', weight: 500, deductAmount: 500000, penalty: '限制 3 天 + 降 1 级', relatedOrderNo: '250520 9999 110022 01', recordStatus: 'active', appealDeadline: '2026-05-21T10:00:00+08:00', createTime: '2026-05-20T10:00:00+08:00' }];
export const DEFAULT_SUMMARY = { defaultCount12m: 1, functionStatus: 'normal', tradesToRepair: 30 };
export const ORDERS = [
  { orderNo: '250603 9999 123456 01', side: 'buy', status: 'locked_pending', metal: 'gold', productName: '融通足金 · 品牌板料', weight: 3000, priceCash: '891.00', priceTransfer: '892.00', supportsTransfer: true, totalCash: 267300000, totalTransfer: 267600000, countdownRemaining: 13338, counterpartyMasked: 'j*****6', counterpartyLevel: 'L9', createTime: '2026-04-28T10:23:45+08:00' },
  { orderNo: '250603 9999 123455', side: 'sell', status: 'selling', metal: 'gold', productName: '融通足金价 · 板料', weight: 10000, priceCash: '891.00', priceTransfer: '892.00', supportsTransfer: true, totalCash: 891000000, totalTransfer: 892000000, createTime: '2026-04-28T07:42:00+08:00' },
  { orderNo: '250601 9999 120010 02', side: 'buy', status: 'completed', metal: 'gold', productName: '融通足金 · 金条', weight: 500, priceCash: '888.71', supportsTransfer: false, totalCash: 44435500, createTime: '2026-04-26T09:10:00+08:00', completeTime: '2026-04-26T14:32:00+08:00' },
];
export function orderDetail(no: string) {
  const base = ORDERS.find((o) => o.orderNo === no) || ORDERS[0];
  return { ...base, counterparty: { role: '卖家', userMasked: base.counterpartyMasked || 'j*****6', level: base.counterpartyLevel || 'L9', region: '广东深圳', phone: '138 **** 8888', wechat: 'jiang_jewel88', address: '深圳市罗湖区水贝珠宝交易中心 A 座 1588 室' }, deliveryMethod: 'face_to_face', myConfirmed: false, peerConfirmed: false };
}
export const RELAY = { relayStatus: '核验中', feePaid: true, steps: [{ title: '卖家送货到服务点', desc: '水贝现货核验点 · 06-03 11:20 已送达', state: 'done' }, { title: '平台专员看货核验', desc: '核验成色 / 克重 / 品牌，拍照留档', state: 'cur' }, { title: '买家打款 · 交易完成', desc: '核验通过后通知买家打款', state: 'todo' }, { title: '平台发货给买家', desc: '仅物流配送', state: 'todo' }] };
export const ADDRESSES = [{ id: 'AD_1', type: 'receive', contact: '陈先生', phone: '138****9999', region: '广东 深圳 罗湖', detail: '水贝珠宝交易中心 A 座 1588 室', isDefault: true }, { id: 'AD_2', type: 'pickup', contact: '陈先生', phone: '138****9999', region: '广东 深圳 罗湖', detail: '水贝现货核验点', isDefault: false }];
export const ALERTS = [{ id: 'AL_1', metal: 'gold', condition: 'above', targetPrice: '900.00', channels: ['push'] }, { id: 'AL_2', metal: 'gold', condition: 'below', targetPrice: '880.00', channels: ['push', 'sms'] }];

/** 行情兜底（测试端口休市/未授权时，/market/quote 仍有数据返回） */
export const FALLBACK_QUOTE: Record<string, PriceSnapshot> = {
  gold: { metal: 'gold', unit: '元/克', marketPrice: '891.00', change: '-2.00', changePercent: '-0.22%', trend: 'down', premium: '+4.73', dayHigh: '893.00', dayLow: '889.00', salePrice: '891.00', buybackPrice: '889.00', quoteTime: '2026-06-28T06:00:03+08:00', snapshotVersion: 'fallback', source: 'mock' },
  silver: { metal: 'silver', unit: '元/克', marketPrice: '13.30', change: '-0.10', changePercent: '-0.75%', trend: 'down', premium: '+0.12', dayHigh: '13.40', dayLow: '13.18', salePrice: '13.30', buybackPrice: '13.18', quoteTime: '2026-06-28T06:00:03+08:00', snapshotVersion: 'fallback', source: 'mock' },
  platinum: { metal: 'platinum', unit: '元/克', marketPrice: '236.40', change: '+1.20', changePercent: '+0.51%', trend: 'up', premium: '+1.05', dayHigh: '238.00', dayLow: '233.90', salePrice: '236.40', buybackPrice: '233.90', quoteTime: '2026-06-28T06:00:03+08:00', snapshotVersion: 'fallback', source: 'mock' },
};

export function paged<T>(list: T[]) {
  return { list, page: 1, pageSize: list.length, total: list.length, hasMore: false };
}
