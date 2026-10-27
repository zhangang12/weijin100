import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MarginService } from '../../src/modules/margin/margin.service';

/**
 * 保证金金额数学单测。金额一律「分」(BigInt)。
 * 用轻量 fake Prisma 直接构造 service（不走 Nest DI）。
 */
function makeFakePrisma(init: { totalBalance: bigint; available: bigint; frozen: bigint }) {
  const acct: Record<string, unknown> = { id: 'acct1', userId: 'u1', ...init };
  const txns: Record<string, unknown>[] = [];
  const prisma = {
    marginAccount: {
      upsert: async () => acct,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(acct, data);
        return acct;
      },
    },
    marginTxn: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        txns.push(data);
        return data;
      },
    },
    // 退款 C4 守卫：无在途订单 + 无未结违约
    order: { count: async () => 0 },
    defaultRecord: { count: async () => 0 },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  return { prisma, acct, txns };
}

const fakeConfig = { minRechargeFen: 50000, marginUnitFen: { gold: 1000, silver: 50, platinum: 500 }, marginEnabled: true };

const svc = (f: ReturnType<typeof makeFakePrisma>, config: Record<string, unknown> = fakeConfig) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new MarginService(f.prisma as any, config as any);
const svcOff = (f: ReturnType<typeof makeFakePrisma>) => svc(f, { ...fakeConfig, marginEnabled: false });

async function expectBiz(fn: () => Promise<unknown>, code: number) {
  try {
    await fn();
    assert.fail('应抛出 BizException 却成功了');
  } catch (e) {
    assert.equal((e as { code?: number }).code, code, `bizCode 不符: ${(e as Error).message}`);
  }
}

test('recharge 增加 total 与 available', async () => {
  const f = makeFakePrisma({ totalBalance: 0n, available: 0n, frozen: 0n });
  const r = await svc(f).recharge('u1', 100000);
  assert.equal(f.acct.available, 100000n);
  assert.equal(f.acct.totalBalance, 100000n);
  assert.equal(r.credited, 100000);
  assert.equal(r.available, 100000);
});

test('recharge 金额 <=0 抛 AMOUNT_INVALID(2000)', async () => {
  const f = makeFakePrisma({ totalBalance: 0n, available: 0n, frozen: 0n });
  await expectBiz(() => svc(f).recharge('u1', 0), 2000);
  await expectBiz(() => svc(f).recharge('u1', -5), 2000);
});

test('refund 从 available 扣减', async () => {
  const f = makeFakePrisma({ totalBalance: 50000n, available: 50000n, frozen: 0n });
  await svc(f).refund('u1', 20000);
  assert.equal(f.acct.available, 30000n);
  assert.equal(f.acct.totalBalance, 30000n);
});

test('refund 超过可用抛 REFUND_EXCEED(3002)', async () => {
  const f = makeFakePrisma({ totalBalance: 10000n, available: 10000n, frozen: 0n });
  await expectBiz(() => svc(f).refund('u1', 10001), 3002);
});

test('freeze 可用→冻结', async () => {
  const f = makeFakePrisma({ totalBalance: 100000n, available: 100000n, frozen: 0n });
  await svc(f).freeze('u1', 30000, 'ORD1');
  assert.equal(f.acct.available, 70000n);
  assert.equal(f.acct.frozen, 30000n);
  assert.equal(f.acct.totalBalance, 100000n); // 冻结不改总额
});

test('freeze 超过可用抛 MARGIN_NOT_ENOUGH(3001)', async () => {
  const f = makeFakePrisma({ totalBalance: 100000n, available: 20000n, frozen: 0n });
  await expectBiz(() => svc(f).freeze('u1', 20001), 3001);
});

test('unfreeze 冻结→可用', async () => {
  const f = makeFakePrisma({ totalBalance: 100000n, available: 70000n, frozen: 30000n });
  await svc(f).unfreeze('u1', 30000, 'ORD1');
  assert.equal(f.acct.available, 100000n);
  assert.equal(f.acct.frozen, 0n);
});

test('unfreeze 超过冻结数按冻结数封顶（不越界）', async () => {
  const f = makeFakePrisma({ totalBalance: 100000n, available: 70000n, frozen: 30000n });
  await svc(f).unfreeze('u1', 999999);
  assert.equal(f.acct.frozen, 0n);
  assert.equal(f.acct.available, 100000n); // 仅解冻 30000，不会多加
});

test('deduct 从冻结扣罚并减总额，按冻结封顶', async () => {
  const f = makeFakePrisma({ totalBalance: 100000n, available: 70000n, frozen: 30000n });
  await svc(f).deduct('u1', 999999, 'ORD1');
  assert.equal(f.acct.frozen, 0n);
  assert.equal(f.acct.totalBalance, 70000n); // 100000 - 30000
  assert.equal(f.acct.available, 70000n); // available 不变
});

// ---------- 保证金关闭（MARGIN_ENABLED=false）：平台不经手用户资金 ----------
test('关闭时 recharge / refund 抛 MARGIN_DISABLED(3021)，余额不变', async () => {
  const f = makeFakePrisma({ totalBalance: 0n, available: 0n, frozen: 0n });
  await expectBiz(() => svcOff(f).recharge('u1', 50000), 3021);
  await expectBiz(() => svcOff(f).refund('u1', 100), 3021);
  assert.equal(f.acct.totalBalance, 0n);
  assert.equal(f.txns.length, 0);
});

test('关闭时 freeze / deduct / compensate 为空操作', async () => {
  const f = makeFakePrisma({ totalBalance: 0n, available: 0n, frozen: 0n });
  await svcOff(f).freeze('u1', 20000); // 无余额也不抛
  await svcOff(f).deduct('u1', 20000);
  await svcOff(f).compensate('u1', 20000);
  assert.equal(f.acct.totalBalance, 0n);
  assert.equal(f.txns.length, 0);
});

test('关闭时 unfreeze 仍放行历史冻结额，无冻结则不记流水', async () => {
  const f = makeFakePrisma({ totalBalance: 30000n, available: 0n, frozen: 30000n });
  await svcOff(f).unfreeze('u1', 30000);
  assert.equal(f.acct.available, 30000n);
  assert.equal(f.txns.length, 1);
  await svcOff(f).unfreeze('u1', 30000); // 已无冻结
  assert.equal(f.txns.length, 1);
});
