import { METAL_CODES, PRICE_CFG, POLL_MS } from '../config.js';
import { fetchQuotes, type PulseQuote } from './pulse.js';

/** 对齐《接口文档 v0.1》PriceSnapshot */
export interface PriceSnapshot {
  metal: string;
  unit: string;
  marketPrice: string;
  change: string;
  changePercent: string;
  trend: 'up' | 'down' | 'flat';
  premium: string;
  dayHigh: string;
  dayLow: string;
  salePrice: string;
  buybackPrice: string;
  quoteTime: string;
  snapshotVersion: string;
  source: string; // 脉动代码，调试用
}

const METALS = ['gold', 'silver', 'platinum'] as const;
const DEC: Record<string, number> = { gold: 2, silver: 2, platinum: 2 };
const cache: Record<string, PriceSnapshot> = {};
let lastOk = 0;

function fmt(n: number, d = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function toISO(t: string): string {
  return t && t.includes(' ') ? t.replace(' ', 'T') + '+08:00' : t;
}

/** 脉动原始 → 我们的 PriceSnapshot（含平台派生 销售价/回购价/溢价） */
function mapSnapshot(metal: string, q: PulseQuote): PriceSnapshot {
  const cfg = PRICE_CFG[metal] || { premium: 0, buybackSpread: 0 };
  const d = DEC[metal] ?? 2;
  const price = q.Price;
  const sale = price; // 销售价（平台高卖；可叠加溢价，业务 G1 定）
  const buyback = price - cfg.buybackSpread; // 回购价（平台低收；G2 销售>回购）
  return {
    metal,
    unit: '元/克',
    marketPrice: fmt(price, d),
    change: (q.Diff >= 0 ? '+' : '') + fmt(q.Diff, d),
    changePercent: (q.DiffRate >= 0 ? '+' : '') + q.DiffRate + '%',
    trend: q.DiffRate > 0 ? 'up' : q.DiffRate < 0 ? 'down' : 'flat',
    premium: (cfg.premium >= 0 ? '+' : '') + cfg.premium,
    dayHigh: fmt(q.High, d),
    dayLow: fmt(q.Low, d),
    salePrice: fmt(sale, d),
    buybackPrice: fmt(buyback, d),
    quoteTime: toISO(q.Time),
    snapshotVersion: 'v-' + q.LastTime,
    source: q.StockCode,
  };
}

/** 拉一次并更新缓存（失败保留上次） */
export async function pollOnce(): Promise<void> {
  const codes = METALS.map((m) => METAL_CODES[m]).filter(Boolean);
  try {
    const raw = await fetchQuotes(codes);
    let hit = 0;
    for (const m of METALS) {
      const q = raw[METAL_CODES[m]];
      if (q) { cache[m] = mapSnapshot(m, q); hit++; }
    }
    if (hit) lastOk = Date.now();
  } catch {
    // 未授权 / 限时 / 网络：保留上次缓存，由 /market/quote 兜底
  }
}

export function getQuote(metal = 'gold'): PriceSnapshot | null {
  return cache[metal] || null;
}
export function allQuotes(): Record<string, PriceSnapshot> {
  return cache;
}
export function quoteHealth() {
  return { metals: Object.keys(cache), lastOkAt: lastOk ? new Date(lastOk).toISOString() : null };
}

/** 启动轮询 */
export function startPoller(): void {
  pollOnce();
  setInterval(pollOnce, POLL_MS);
}
