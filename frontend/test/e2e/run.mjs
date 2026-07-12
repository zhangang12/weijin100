/**
 * 真机 e2e（微信开发者工具自动化）：miniprogram-automator 驱动真实小程序运行时。
 * 前提：① 开发者工具已登录 ② 安全设置→服务端口 + 自动化默认信任项目 均开启
 *      ③ 后端在 127.0.0.1:3100 运行且 DB 含 devuser001（USE_MOCK=false）。
 *
 * 注：DevTools Stable 2.01 下 automator 的 page.data()/导航方法会超时，但 evaluate() 正常，
 *     故一律用 evaluate（在真实小程序运行时里跑 JS）读页面数据 + 用 wx.* 导航——这才是真运行时。
 */
import automator from 'miniprogram-automator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.resolve(DIR, '../..');
const CLI = process.env.WX_CLI || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const C = { g: '\x1b[32m', r: '\x1b[31m', d: '\x1b[2m', c: '\x1b[36m', x: '\x1b[0m' };
let pass = 0, fail = 0; const failures = [];
const ok = (n, d = '') => { pass++; console.log(`  ${C.g}✓${C.x} ${n}${d ? C.d + ' — ' + d + C.x : ''}`); };
const bad = (n, d = '') => { fail++; failures.push(`${n} — ${d}`); console.log(`  ${C.r}✗ ${n}${C.x}${d ? C.r + ' — ' + d + C.x : ''}`); };
const check = (n, cond, d = '') => (cond ? ok(n, d) : bad(n, d));
const log = (m) => console.log(`  ${C.d}· ${m}${C.x}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`超时 ${ms}ms @ ${label}`)), ms))]);

// 在真实小程序运行时里读「当前页」的关键字段（只回原始值，避免序列化问题）
function readCurrent(mini) {
  return withTimeout(mini.evaluate(() => {
    const ps = getCurrentPages(); const c = ps[ps.length - 1] || {}; const d = c.data || {};
    const arr = Array.isArray(d.list) ? d.list : (Array.isArray(d.listings) ? d.listings : []);
    return {
      route: c.route || '',
      dataKeys: Object.keys(d).slice(0, 10),
      marketPrice: d.quote && d.quote.marketPrice != null ? String(d.quote.marketPrice) : null,
      metal: d.metal || null,
      count: arr.length,
      firstListingId: (arr[0] && arr[0].listingId) || null,
      // 我的页可能的字段
      hasProfile: !!(d.profile || d.weijinNo || d.userInfo || d.avatar),
      // 锁价页可能的字段
      hasLockCtx: !!(d.seller || d.listing || d.item || d.buyerLimit || d.metal || d.qty != null),
    };
  }), 12000, 'evaluate readCurrent');
}
// 用 wx.* 在运行时里导航（automator 自带导航方法在此版本会超时）
function nav(mini, method, url) {
  return withTimeout(mini.evaluate((m, u) => new Promise((resolve) => {
    wx[m]({ url: u, success: () => resolve('ok'), fail: (e) => resolve('fail:' + (e && e.errMsg)) });
  }), method, url), 12000, 'evaluate nav ' + method);
}

async function main() {
  console.log(`${C.c}真机 e2e（微信开发者工具自动化 · 真实小程序运行时 → 真后端）${C.x}\n`);
  console.log('▶ 启动开发者工具自动化端口并连接…（全新启动 IDE + 首次编译，可能较慢）');
  const mini = await automator.launch({ cliPath: CLI, projectPath: PROJ, timeout: 180000 });
  console.log('  ✓ 已连接自动化端口');

  try {
    const bridge = await withTimeout(mini.evaluate(() => 1 + 1), 12000, 'evaluate');
    check('自动化桥接可用（evaluate 在真运行时执行）', bridge === 2, `evaluate=${bridge}`);

    // ① 首页：轮询等待真后端数据到位（最多 ~12s）
    log('读取首页运行时数据（轮询等待后端数据）…');
    let home = await readCurrent(mini);
    for (let i = 0; i < 12 && (home.count === 0 || home.marketPrice == null); i++) { await sleep(1000); home = await readCurrent(mini); }
    check('当前页为首页', home.route === 'pages/home/index', `route=${home.route}`);
    check('首页金价卡有真实大盘价', home.marketPrice != null, `marketPrice=${home.marketPrice}`);
    check('首页挂单列表来自后端且非空', home.count > 0, `count=${home.count} 首条=${home.firstListingId}`);
    check('首页含品类折页 metal 态', !!home.metal, `metal=${home.metal}`);

    // ② 我的 tab（运行时导航）
    log('切到「我的」…');
    const r1 = await nav(mini, 'switchTab', '/pages/mine/index');
    await sleep(1800);
    const mine = await readCurrent(mini);
    check('我的页已加载', mine.route === 'pages/mine/index', `nav=${r1} route=${mine.route}`);
    check('我的页有渲染数据', mine.dataKeys.length > 0, `keys=${mine.dataKeys.join(',')}`);

    // ③ 锁价页（带 listingId，运行时导航）
    if (home.firstListingId) {
      log('进入锁价页…');
      const r2 = await nav(mini, 'navigateTo', '/packageLock/pages/lock/index?listingId=' + home.firstListingId);
      await sleep(1800);
      const lock = await readCurrent(mini);
      check('锁价页已加载', /packageLock\/pages\/lock/.test(lock.route), `nav=${r2} route=${lock.route}`);
      check('锁价页加载到挂单/卖家上下文', lock.hasLockCtx, `keys=${lock.dataKeys.join(',')}`);
    }
  } catch (e) {
    bad('e2e 运行异常', e.message);
  } finally {
    try { await withTimeout(mini.close(), 10000, 'close'); } catch {}
  }

  console.log(`\n${C.c}════════════════════════════${C.x}`);
  console.log(`  ${C.g}通过 ${pass}${C.x}   ${fail ? C.r : C.d}失败 ${fail}${C.x}   共 ${pass + fail}`);
  if (failures.length) { console.log(`\n${C.r}失败明细：${C.x}`); failures.forEach((f) => console.log(`  ${C.r}•${C.x} ${f}`)); }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(`${C.r}e2e 无法启动：${C.x}`, e.message); process.exit(2); });
