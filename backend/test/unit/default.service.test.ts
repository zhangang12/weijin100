import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefaultService } from '../../src/modules/default/default.service';

/**
 * E3 信用修复单测：每累计 30 笔（无违约）消 1 条。
 * 用轻量内存 fake Prisma 直接构造 service。
 */
interface Rec { id: string; recordStatus: string; repairAtTrades: number | null; createdAt: Date }

function makeFake(completedTrades: number, recs: Rec[]) {
  const user = { id: 'u1', level: 3, completedTrades };
  const matchStatus = (r: Rec, w: any) => !w?.recordStatus?.in || w.recordStatus.in.includes(r.recordStatus);
  const matchRepair = (r: Rec, w: any) => {
    if (!w?.repairAtTrades) return true;
    if (w.repairAtTrades.not === null && r.repairAtTrades === null) return false;
    if (w.repairAtTrades.lte != null && !(r.repairAtTrades != null && r.repairAtTrades <= w.repairAtTrades.lte)) return false;
    return true;
  };
  const prisma = {
    user: { findUnique: async () => user },
    defaultRecord: {
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const r of recs) if (matchStatus(r, where) && matchRepair(r, where)) { Object.assign(r, data); count++; }
        return { count };
      },
      count: async ({ where }: any) => recs.filter((r) => matchStatus(r, where)).length,
      findFirst: async ({ where }: any) =>
        recs.filter((r) => matchStatus(r, where) && matchRepair(r, where)).sort((a, b) => +a.createdAt - +b.createdAt)[0] ?? null,
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = new DefaultService(prisma as any, {} as any, {} as any);
  return { svc, recs, user };
}

test('repairEligible：completedTrades 达阈值 → active 记录转 repaired', async () => {
  const { svc, recs } = makeFake(40, [
    { id: 'd1', recordStatus: 'active', repairAtTrades: 30, createdAt: new Date('2026-01-01') }, // 40>=30 → 修复
    { id: 'd2', recordStatus: 'active', repairAtTrades: 60, createdAt: new Date('2026-02-01') }, // 40<60 → 保留
  ]);
  const n = await svc.repairEligible('u1');
  assert.equal(n, 1);
  assert.equal(recs.find((r) => r.id === 'd1')!.recordStatus, 'repaired');
  assert.equal(recs.find((r) => r.id === 'd2')!.recordStatus, 'active');
});

test('summary：先结算修复，count 只算未修复，tradesToRepair 取最早一条', async () => {
  const { svc } = makeFake(45, [
    { id: 'd1', recordStatus: 'active', repairAtTrades: 30, createdAt: new Date('2026-01-01') }, // 会被修复
    { id: 'd2', recordStatus: 'active', repairAtTrades: 70, createdAt: new Date('2026-02-01') }, // 保留，还需 70-45=25
  ]);
  const s = await svc.summary('u1');
  assert.equal(s.defaultCount12m, 1);      // d1 修复后仅剩 d2
  assert.equal(s.tradesToRepair, 25);      // 70 - 45
  assert.equal(s.level, 'L3');
});
