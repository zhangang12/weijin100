/**
 * 一键集成联调：内嵌 PG → migrate → seed → 启动后端 → 打 api-integration.mjs（真 HTTP + 真库）→ 退出码透传。
 * 无需外部 PostgreSQL。用法：`npm run test:integration`。
 */
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startPg } from './pg-embedded.mjs';

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd) => execSync(cmd, { cwd: BACKEND_DIR, stdio: 'inherit' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitHealth(timeoutMs = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch('http://localhost:3100/api/v1/health');
      if (r.status === 200) return true;
    } catch { /* not up yet */ }
    await sleep(1000);
  }
  return false;
}

let pg, server, code = 1;

/** 以给定开关启动后端；detached 让 npm→nest→node 成为独立进程组，便于整组回收（否则 nest 子进程会泄漏占用 3100）。 */
async function startServer(flags) {
  server = spawn('npm', ['run', 'start'], { cwd: BACKEND_DIR, stdio: 'inherit', detached: true, env: { ...process.env, ...flags } });
  if (!(await waitHealth())) throw new Error('后端未在超时内就绪');
}
async function stopServer() {
  if (server?.pid) { try { process.kill(-server.pid, 'SIGKILL'); } catch { try { server.kill('SIGKILL'); } catch {} } }
  server = null;
  await sleep(1000);
}

try {
  console.log('▶ 启动内嵌 PostgreSQL…');
  pg = await startPg();
  console.log('▶ prisma migrate deploy…'); run('npx prisma migrate deploy');
  console.log('▶ seed…'); run('npm run seed');

  // 第一轮：保证金/线上支付开启——覆盖拿到许可证后要恢复的完整资金逻辑。
  console.log('▶ 启动后端服务（MARGIN_ENABLED=true / ONLINE_PAY_ENABLED=true）…');
  await startServer({ MARGIN_ENABLED: 'true', ONLINE_PAY_ENABLED: 'true' });

  console.log('▶ 运行 API 集成测试（真 HTTP + 真库）…');
  let apiCode = 0, scCode = 0, coCode = 0, feCode = 0;
  try { run('node test/api-integration.mjs'); } catch { apiCode = 1; }

  console.log('\n▶ 运行 全业务场景测试（A–H 规则逐条，真 HTTP + 真库）…');
  try { run('node test/scenarios.mjs'); } catch { scCode = 1; }

  // 第二轮：上线默认配置（保证金关闭 + 线下结算）。
  await stopServer();
  console.log('\n▶ 重启后端服务（上线默认：MARGIN_ENABLED=false / ONLINE_PAY_ENABLED=false）…');
  await startServer({ MARGIN_ENABLED: 'false', ONLINE_PAY_ENABLED: 'false' });

  console.log('\n▶ 运行 合规模式测试（不经手用户资金）…');
  try { run('node test/compliance-off.mjs'); } catch { coCode = 1; }

  console.log('\n▶ 运行 前端↔后端 契约联调 harness（前端真实 api/auth 层 → 真后端）…');
  const FE_DIR = path.resolve(BACKEND_DIR, '../frontend');
  try { execSync('npm run test:integration', { cwd: FE_DIR, stdio: 'inherit' }); } catch { feCode = 1; }

  code = apiCode || scCode || coCode || feCode;
} catch (e) {
  console.error('集成联调失败：', e.message);
  code = 1;
} finally {
  await stopServer();
  if (pg) { try { await pg.stop(); } catch {} }
  await sleep(500);
  process.exit(code);
}
