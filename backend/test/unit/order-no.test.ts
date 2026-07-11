import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genOrderNo, motherNoOf } from '../../src/common/order-no';

test('motherNoOf 生成 16 位母单号（YYMMDD + 10 位派生）', () => {
  const d = new Date('2026-01-02T00:00:00Z');
  const m = motherNoOf('listing_abc', d);
  assert.match(m, /^\d{16}$/, `实际: ${m}`);
  assert.ok(m.startsWith('260102'), `前缀应为当日: ${m}`);
});

test('motherNoOf 对同一挂单稳定（子单共享母单）', () => {
  const d = new Date('2026-01-02T00:00:00Z');
  assert.equal(motherNoOf('listing_abc', d), motherNoOf('listing_abc', d));
});

test('genOrderNo = 母单16 + 子单2 = 18 位，子单按顺序补零', () => {
  const m = '2601020000012345';
  assert.equal(genOrderNo(m, 1), m + '01');
  assert.equal(genOrderNo(m, 7), m + '07');
  assert.equal(genOrderNo(m, 12), m + '12');
  assert.match(genOrderNo(m, 3), /^\d{18}$/);
});

test('同母单不同子单前 16 位一致、后 2 位递增', () => {
  const m = motherNoOf('L1', new Date('2026-01-02T00:00:00Z'));
  const a = genOrderNo(m, 1);
  const b = genOrderNo(m, 2);
  assert.equal(a.slice(0, 16), b.slice(0, 16));
  assert.notEqual(a.slice(16), b.slice(16));
});
