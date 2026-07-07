import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genOrderNo } from '../../src/common/order-no';

test('genOrderNo 形如 YYMMDD 9999 NNNNNN SS', () => {
  const no = genOrderNo();
  assert.match(no, /^\d{6} 9999 \d{6} \d{2}$/, `实际: ${no}`);
});

test('genOrderNo 前缀为当日日期', () => {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  assert.ok(genOrderNo().startsWith(`${yy}${mm}${dd} 9999 `));
});

test('genOrderNo 多次生成基本不重复', () => {
  const set = new Set(Array.from({ length: 200 }, () => genOrderNo()));
  // 序列 6 位 + 后缀 2 位随机，200 次碰撞概率极低
  assert.ok(set.size >= 199, `去重后数量: ${set.size}`);
});
