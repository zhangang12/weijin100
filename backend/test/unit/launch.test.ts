import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { DefaultService } from '../../src/modules/default/default.service';
import { TasksService } from '../../src/tasks/tasks.service';

/** 上线加固：E5 限制到期、生产启动自检。 */

function fakeDefault(user: any) {
  const updates: any[] = [];
  const prisma = {
    user: {
      findUnique: async () => user,
      update: async ({ data }: any) => { updates.push(data); Object.assign(user, data); return user; },
    },
    defaultRecord: { count: async () => 0, create: async ({ data }: any) => ({ id: 'd1', ...data }) },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = new DefaultService(prisma as any, { enabled: false } as any, {} as any);
  return { svc, updates };
}

test('recordDefault：首次违约限制 3 天，写入 limitedUntil', async () => {
  const user = { id: 'u1', level: 3, completedTrades: 0, functionStatus: 'normal', limitedUntil: null };
  const { svc } = fakeDefault(user);
  const t0 = Date.now();
  await svc.recordDefault({ userId: 'u1', type: '拒不交货', role: '卖家' });
  assert.equal(user.functionStatus, 'limited');
  const days = ((user.limitedUntil as unknown as Date).getTime() - t0) / 86400000;
  assert.ok(days > 2.99 && days < 3.01, `days=${days}`);
});

test('recordDefault：已在更长限制中，不缩短到期时间', async () => {
  const later = new Date(Date.now() + 20 * 86400000);
  const user = { id: 'u1', level: 3, completedTrades: 0, functionStatus: 'limited', limitedUntil: later };
  const { svc } = fakeDefault(user);
  await svc.recordDefault({ userId: 'u1', type: '拒不交货', role: '卖家' });
  assert.equal(user.limitedUntil, later);
});

test('releaseExpiredLimits：只恢复已到期的受限用户', async () => {
  const now = Date.now();
  const users = [
    { id: 'a', functionStatus: 'limited', limitedUntil: new Date(now - 1000) },
    { id: 'b', functionStatus: 'limited', limitedUntil: new Date(now + 86400000) },
    { id: 'c', functionStatus: 'normal', limitedUntil: null },
  ];
  const prisma = {
    user: {
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const u of users) {
          if (u.functionStatus === where.functionStatus && u.limitedUntil && u.limitedUntil <= where.limitedUntil.lte) {
            Object.assign(u, data); count++;
          }
        }
        return { count };
      },
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks = new TasksService(prisma as any, {} as any);
  assert.equal(await tasks.releaseExpiredLimits(), 1);
  assert.equal(users[0].functionStatus, 'normal');
  assert.equal(users[1].functionStatus, 'limited');
});

/** config.ts 在 import 时读 env，用子进程隔离。 */
function prodProblems(env: Record<string, string>): string[] {
  const out = execFileSync(process.execPath, ['-r', 'ts-node/register', '-e',
    "console.log(JSON.stringify(require('./src/config/config').prodConfigProblems()))"], {
    env: { PATH: process.env.PATH ?? '', TS_NODE_TRANSPILE_ONLY: '1', ...env },
  });
  return JSON.parse(out.toString().trim().split('\n').pop()!);
}

test('prodConfigProblems：开发环境不检查', () => {
  assert.deepEqual(prodProblems({ NODE_ENV: 'development' }), []);
});

test('prodConfigProblems：生产环境缺密钥 / 用默认值 → 拒绝', () => {
  const p = prodProblems({ NODE_ENV: 'production', JWT_SECRET: 'change_me_in_prod' });
  assert.equal(p.length, 4);
});

test('prodConfigProblems：生产环境配置齐全 → 通过', () => {
  const s = 'a'.repeat(64);
  assert.deepEqual(prodProblems({
    NODE_ENV: 'production', JWT_SECRET: s, ADMIN_TOKEN: s.replace(/a/g, 'b'),
    WX_APPID: 'wx1', WX_SECRET: 'x', DATABASE_URL: 'postgresql://x',
  }), []);
});
