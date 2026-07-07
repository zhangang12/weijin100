import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LockService } from '../../src/modules/lock/lock.service';

/**
 * 锁价：出货方式约束守卫 + buyerLimit 行情源不可用时的兜底（回归测试）。
 */
function makeSvc(opts: {
  listing?: Record<string, unknown> | null;
  user?: Record<string, unknown> | null;
  getQuote?: () => Record<string, unknown> | null;
}) {
  const defaultUser = { kycStatus: 'verified', level: 2, margin: { available: 30000000n } };
  const user = 'user' in opts ? opts.user : defaultUser;
  const prisma = {
    user: { findUnique: async () => user },
    listing: {
      findUnique: async () => opts.listing ?? null,
      updateMany: async () => ({ count: 1 }),
      update: async () => opts.listing,
    },
    order: { create: async () => ({ id: 'o1', orderNo: 'x' }) },
    lockOrder: { create: async () => ({ id: 'l1' }) },
  };
  const market = { getQuote: opts.getQuote ?? (() => ({ salePrice: '891', snapshotVersion: 'v1' })) };
  const margin = { freeze: async () => {} };
  const config = { marginRatio: 0.1, lockCountdownMs: 4 * 3600 * 1000 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new LockService(prisma as any, market as any, margin as any, config as any);
}

async function expectBiz(fn: () => Promise<unknown>, code: number) {
  try {
    await fn();
    assert.fail('应抛 BizException 却成功');
  } catch (e) {
    assert.equal((e as { code?: number }).code, code, (e as Error).message);
  }
}

// ---------- buyerLimit 兜底回归 ----------
test('buyerLimit：行情源可用时按实时价算可买量', async () => {
  const svc = makeSvc({
    user: { level: 2, margin: { available: 30000000n } },
    getQuote: () => ({ salePrice: '900', snapshotVersion: 'v1' }),
  });
  const r = await svc.buyerLimit('u1', 'gold');
  // 300000 元 / (900 × 10%) = 3333
  assert.equal(r.maxBuyableQty, 3333);
  assert.equal(r.deposit, 30000000);
});

test('buyerLimit：行情源不可用时回退参考价（不再恒为 0）', async () => {
  const svc = makeSvc({
    user: { level: 2, margin: { available: 30000000n } },
    getQuote: () => null, // 行情源断
  });
  const r = await svc.buyerLimit('u1', 'gold');
  // 回退到 FALLBACK_QUOTE.gold 售价 891：300000 / (891 × 10%) = 3367
  assert.equal(r.maxBuyableQty, 3367);
  assert.ok(r.maxBuyableQty > 0, '回退后可买量必须 > 0');
});

test('buyerLimit：用户不存在 → USER_NOT_FOUND(2004)', async () => {
  const svc = makeSvc({ user: null });
  await expectBiz(() => svc.buyerLimit('nope', 'gold'), 2004);
});

// ---------- 出货方式守卫 ----------
test('whole_all：克重不等于总量 → MUST_WHOLE(3005)', async () => {
  const svc = makeSvc({ listing: { id: 'L', status: 'selling', sellerId: 'seller1', metal: 'gold', shipMode: 'whole_all', totalWeight: 1000 } });
  await expectBiz(() => svc.createLock('buyer1', { listingId: 'L', weight: 999 }), 3005);
});

test('whole_fixed：非固定克重整数倍 → MUST_LOT(3005)', async () => {
  const svc = makeSvc({ listing: { id: 'L', status: 'selling', sellerId: 'seller1', metal: 'gold', shipMode: 'whole_fixed', lotSize: 500 } });
  await expectBiz(() => svc.createLock('buyer1', { listingId: 'L', weight: 700 }), 3005);
});

test('bulk：低于起批量 → BELOW_MIN(3005)', async () => {
  const svc = makeSvc({ listing: { id: 'L', status: 'selling', sellerId: 'seller1', metal: 'gold', shipMode: 'bulk', minBatch: 100 } });
  await expectBiz(() => svc.createLock('buyer1', { listingId: 'L', weight: 50 }), 3005);
});

test('不能锁自己的挂单 → SELF_LOCK(3004)', async () => {
  const svc = makeSvc({ listing: { id: 'L', status: 'selling', sellerId: 'buyer1', metal: 'gold', shipMode: 'bulk', minBatch: 1 } });
  await expectBiz(() => svc.createLock('buyer1', { listingId: 'L', weight: 10 }), 3004);
});

test('未实名 → NEED_REALNAME(3010)', async () => {
  const svc = makeSvc({
    user: { kycStatus: 'none' },
    listing: { id: 'L', status: 'selling', sellerId: 'seller1', metal: 'gold', shipMode: 'bulk', minBatch: 1 },
  });
  await expectBiz(() => svc.createLock('buyer1', { listingId: 'L', weight: 10 }), 3010);
});

test('缺 weight → PARAM(2000)', async () => {
  const svc = makeSvc({ listing: { id: 'L', status: 'selling', sellerId: 'seller1', metal: 'gold', shipMode: 'bulk', minBatch: 1 } });
  await expectBiz(() => svc.createLock('buyer1', { listingId: 'L', weight: 0 }), 2000);
});
