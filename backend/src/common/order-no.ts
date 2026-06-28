/** 生成订单号：YYMMDD 9999 NNNNNN SS（与设计稿展示一致）。 */
export function genOrderNo(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const seq = Math.floor(Math.random() * 900000 + 100000);
  const suf = String(Math.floor(Math.random() * 90 + 10));
  return `${yy}${mm}${dd} 9999 ${seq} ${suf}`;
}
