/**
 * 订单号（业务规则 B9）：母单 16 位 + 子单 2 位 = 18 位。
 *   - 母单 16 位：同一挂单的所有子单共享（YYMMDD(6) + 挂单派生 10 位）。
 *   - 子单 2 位：同母单内按到达顺序 01~99。
 * 展示形如「YYMMDD XXXXXXXXXX SS」，落库去空格为纯 18 位数字串。
 */

/** 由挂单（id + 创建时间）派生稳定的 16 位母单号，同一挂单恒定。 */
export function motherNoOf(listingId: string, createdAt: Date): string {
  const yy = String(createdAt.getFullYear()).slice(2);
  const mm = String(createdAt.getMonth() + 1).padStart(2, '0');
  const dd = String(createdAt.getDate()).padStart(2, '0');
  // 由挂单 id 生成稳定 10 位数字（简单确定性散列，dev 足够；上线可换发号器）。
  let h = 0;
  for (let i = 0; i < listingId.length; i++) h = (h * 31 + listingId.charCodeAt(i)) % 10_000_000_000;
  const tail = String(h).padStart(10, '0');
  return `${yy}${mm}${dd}${tail}`; // 16 位
}

/** 子单号 = 母单 16 位 + 顺序 2 位（seq 从 1 起）。 */
export function genOrderNo(motherNo: string, seq: number): string {
  const ss = String(Math.min(99, Math.max(1, seq))).padStart(2, '0');
  return `${motherNo}${ss}`; // 18 位
}
