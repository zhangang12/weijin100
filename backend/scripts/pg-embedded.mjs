/**
 * 本地内嵌 PostgreSQL（自带二进制，免 sudo/brew/docker）。
 * 复用：`import { startPg } from './pg-embedded.mjs'`。
 * 直接运行 `node scripts/pg-embedded.mjs`：起库 → migrate → seed → 保持存活（供 `npm run dev:pg`）。
 * 连接串与 .env 的 DATABASE_URL 一致：postgresql://weijin:weijin_dev@localhost:5432/weijin100
 */
import EmbeddedPostgres from 'embedded-postgres';
import { rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.PGDATA_DIR || path.join(BACKEND_DIR, '.pgdata');

export async function startPg({ fresh = true } = {}) {
  if (fresh) { try { rmSync(DATA_DIR, { recursive: true, force: true }); } catch {} }
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'weijin',
    password: 'weijin_dev',
    port: 5432,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  try { await pg.createDatabase('weijin100'); } catch { /* 已存在 */ }
  return pg;
}

// 直接运行：起库 + 迁移 + 种子 + 保持存活
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const pg = await startPg();
  console.log('✅ PostgreSQL 就绪：postgresql://weijin:weijin_dev@localhost:5432/weijin100');
  const run = (cmd) => execSync(cmd, { cwd: BACKEND_DIR, stdio: 'inherit' });
  try {
    run('npx prisma migrate deploy');
    run('npm run seed');
    console.log('\n✅ 迁移 + 种子完成。现在另开一个终端跑 `npm run start` 即可联调。按 Ctrl+C 停库。\n');
  } catch (e) {
    console.error('迁移/种子失败：', e.message);
  }
  const shutdown = async () => { try { await pg.stop(); } catch {} process.exit(0); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  setInterval(() => {}, 1 << 30); // keepalive
}
