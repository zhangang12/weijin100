import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { OrderService } from '../../src/modules/order/order.service';

/**
 * 订单状态机单测：双方确认 → 完成 + 解冻；状态守卫；仲裁。
 * fake Prisma/Margin/Config/Payment 直接构造 service。
 */
type Order = Record<string, unknown>;

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord1',
    orderNo: '260101 9999 111111 22',
    buyerId: 'buyer1',
    sellerId: 'seller1',
    status: 'locked_pending',
    priceCash: 891,
    weight: 10,
    buyerConfirmed: false,
    sellerConfirmed: false,
    buyer: { weijinNo: '100886699', level: 2, phone: '', wechat: '' },
    seller: { weijinNo: '100886700', level: 9, phone: '', wechat: '' },
    ...overrides,
  };
}

function makeDeps(order: Order) {
  const prisma = {
    order: {
      findUnique: async () => order,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(order, data);
        return order;
      },
    },
    user: { update: async () => ({}) },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  const unfreeze = mock.fn(async () => {});
  const margin = { unfreeze };
  const config = { marginRatio: 0.1 };
  const payment = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = new OrderService(prisma as any, margin as any, config as any, payment as any);
  return { svc, order, unfreeze };
}

async function expectBiz(fn: () => Promise<unknown>, code: number) {
  try {
    await fn();
    assert.fail('应抛 BizException 却成功');
  } catch (e) {
    assert.equal((e as { code?: number }).code, code, (e as Error).message);
  }
}

test('单方确认 → 仍 locked_pending，不解冻', async () => {
  const { svc, order, unfreeze } = makeDeps(makeOrder());
  const r = await svc.confirmComplete('buyer1', order.orderNo as string);
  assert.equal(r.myConfirmed, true);
  assert.equal(r.peerConfirmed, false);
  assert.equal(r.status, 'locked_pending');
  assert.equal(unfreeze.mock.callCount(), 0);
  assert.equal(order.buyerConfirmed, true);
});

test('双方确认 → completed，且解冻买家保证金 (891×10×10% = 89100 分)', async () => {
  const { svc, order, unfreeze } = makeDeps(makeOrder({ buyerConfirmed: true }));
  const r = await svc.confirmComplete('seller1', order.orderNo as string);
  assert.equal(r.status, 'completed');
  assert.equal(r.myConfirmed, true);
  assert.equal(r.peerConfirmed, true);
  assert.equal(order.status, 'completed');
  assert.equal(unfreeze.mock.callCount(), 1);
  const args = unfreeze.mock.calls[0].arguments;
  assert.equal(args[0], 'buyer1');
  assert.equal(args[1], 89100);
});

test('非 locked_pending 状态确认 → BAD_STATUS(3007)', async () => {
  const { svc, order } = makeDeps(makeOrder({ status: 'completed' }));
  await expectBiz(() => svc.confirmComplete('buyer1', order.orderNo as string), 3007);
});

test('非买卖双方请求 → NOT_FOUND(2004)', async () => {
  const { svc, order } = makeDeps(makeOrder());
  await expectBiz(() => svc.confirmComplete('stranger', order.orderNo as string), 2004);
});

test('仲裁：locked_pending → arbitrating，arbId 稳定为 ARB_<orderId>', async () => {
  const { svc, order } = makeDeps(makeOrder());
  const r = await svc.arbitration('buyer1', order.orderNo as string, { description: '对方未交割' });
  assert.equal(r.status, 'arbitrating');
  assert.equal(r.arbId, 'ARB_ord1');
  assert.equal(order.status, 'arbitrating');
});

test('仲裁：非 locked_pending → BAD_STATUS(3007)', async () => {
  const { svc, order } = makeDeps(makeOrder({ status: 'completed' }));
  await expectBiz(() => svc.arbitration('buyer1', order.orderNo as string, {}), 3007);
});
