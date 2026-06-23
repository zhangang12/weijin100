import type { Trend } from '../types/api';

/** 千分位 */
export function withThousands(n: number | string): string {
  const parts = String(n).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

/** 金额（分）→ 元，带千分位与小数位 */
export function fenToYuan(fen: number, decimals = 2): string {
  const sign = fen < 0 ? '-' : '';
  const v = Math.abs(fen) / 100;
  return sign + withThousands(v.toFixed(decimals));
}

/** 红涨绿跌 class（前端据 trend 上色，不靠正负号） */
export function trendClass(t: Trend): string {
  return t === 'up' ? 'c-up' : t === 'down' ? 'c-down' : 'c-flat';
}

/** 克重展示：保留小数位 + 千分位 */
export function formatWeight(g: number, decimals = 0): string {
  return withThousands(g.toFixed(decimals));
}

/** 起批量展示文案：整出=全量起批，散出=Xg起批 */
export function moqText(shipMode: string, totalWeight: number, lotSize?: number, minBatch?: number): string {
  if (shipMode === 'bulk') return `${formatWeight(minBatch ?? 1)}g起批`;
  if (shipMode === 'whole_fixed') return `${formatWeight(lotSize ?? totalWeight)}g起批`;
  return `${formatWeight(totalWeight)}g起批`; // whole_all
}
