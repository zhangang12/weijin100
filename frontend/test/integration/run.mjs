/**
 * 前端 ↔ 后端 契约联调 harness（不含 UI 渲染）。
 * 把前端「真实」的 api/request/auth/guard 层用 esbuild 打包后，配 wx 垫片在 Node 里直接调，
 * 打真实后端（默认 http://127.0.0.1:3100/api/v1，由前端 env.ts 决定）。
 * 前提：后端已在运行且 DB 已 seed（含 devuser001）。用 `npm run test:integration`（后端脚本）串起来。
 */
import esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { rmSync } from 'node:fs';
import { installWx } from './wx-shim.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const C = { g: '\x1b[32m', r: '\x1b[31m', d: '\x1b[2m', c: '\x1b[36m', x: '\x1b[0m' };
let pass = 0, fail = 0; const failures = [];
const ok = (n, d = '') => { pass++; console.log(`  ${C.g}✓${C.x} ${n}${d ? C.d + ' — ' + d + C.x : ''}`); };
const bad = (n, d = '') => { fail++; failures.push(`${n} — ${d}`); console.log(`  ${C.r}✗ ${n}${C.x}${d ? C.r + ' — ' + d + C.x : ''}`); };
const check = (n, cond, d = '') => (cond ? ok(n, d) : bad(n, d));

async function main() {
  console.log(`${C.c}前端↔后端 契约联调（真实前端 api/auth/request 层 → 真后端）${C.x}\n`);
  installWx();

  // 打包前端真实网络/鉴权/api 层
  const bundle = path.join(os.tmpdir(), `wj-fe-bundle-${Date.now()}.mjs`);
  await esbuild.build({
    entryPoints: [path.join(DIR, '_entry.ts')],
    bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile: bundle, logLevel: 'silent',
  });
  const api = await import('file://' + bundle);
  const { marketApi, userApi, marginApi, lockApi, orderApi, publishApi, addressApi, alertApi, defaultApi, levelApi, requireEligibility, BizError } = api;

  // 1) 登录（前端真实 ensureLogin → /auth/login，DEV_LOGIN=mock:devuser001）
  const token = await api.ensureLogin();
  check('ensureLogin() 换到 JWT', typeof token === 'string' && token.length > 10, `token=${(token || '').slice(0, 12)}…`);

  // 2) 行情（游客 auth:false，信封解包）
  const quote = await marketApi.getQuote('gold');
  check('marketApi.getQuote 解包成功', quote && quote.marketPrice != null, `price=${quote?.marketPrice}`);

  // 3) 挂单列表
  const listings = await marketApi.getListings({ metal: 'gold', pageSize: 20 });
  check('marketApi.getListings 分页解包', listings && Array.isArray(listings.list) && listings.list.length > 0, `total=${listings?.total}`);
  // 选可锁散出挂单：起批量 ≤ 剩余库存；锁的克重 = 起批量（无则 1g）
  const bulk = (listings.list || []).find((l) => l.shipMode === 'bulk' && l.remainingWeight >= (l.minBatch || 1));
  const whole = (listings.list || []).find((l) => l.shipMode === 'whole_all');
  const lockWeight = bulk ? (bulk.minBatch && bulk.minBatch >= 1 ? bulk.minBatch : 1) : 0;
  check('存在可锁的散出挂单', !!bulk, bulk ? `id=${bulk.listingId} 剩=${bulk.remainingWeight} 起批=${bulk.minBatch}` : '无 bulk 挂单');

  // 4) 可购买上限（前端新接的接口）
  const bl = await lockApi.getBuyerLimit('gold');
  check('lockApi.getBuyerLimit', bl && bl.maxBuyableQty >= 0 && bl.unitFen === 1000, `maxQty=${bl?.maxBuyableQty} unitFen=${bl?.unitFen}`);

  // 5) 锁价（前端真实契约：submitLock 发 weight，不是 qty）→ 真下单 + 冻结
  let orderNo;
  if (bulk) {
    const r = await lockApi.submitLock({ listingId: bulk.listingId, weight: lockWeight, payMethod: 'cash' });
    orderNo = r.orderNo;
    check('lockApi.submitLock(weight) 成功下单', r.status === 'success' && !!r.orderNo, `weight=${lockWeight} orderNo=${r.orderNo}`);
  } else { bad('lockApi.submitLock', '无可锁挂单'); }

  // 6) 订单列表含新单
  const orders = await orderApi.getOrders('locked_pending');
  check('orderApi.getOrders 含新订单', orders?.list?.some((o) => o.orderNo === orderNo), `count=${orders?.list?.length}`);

  // 7) 订单详情：对手方含 address 字段（契约修复点）
  if (orderNo) {
    const d = await orderApi.getOrderDetail(orderNo);
    check('orderApi.getOrderDetail 对手方结构', d?.counterparty && d.counterparty.role === '卖家' && 'address' in d.counterparty, `role=${d?.counterparty?.role} addr有=${d?.counterparty && 'address' in d.counterparty}`);
  }

  // 8) 保证金账户：固定单价冻结（克重×¥10/g=×1000分）+ quota 由余额算
  const acc = await marginApi.getAccount();
  const expectFrozen = lockWeight * 1000;
  check(`marginApi.getAccount 冻结按固定单价(${lockWeight}g×¥10=${expectFrozen}分)`, acc && acc.frozen === expectFrozen && acc.quota && typeof acc.quota.gold === 'number', `frozen=${acc?.frozen} quota.gold=${acc?.quota?.gold}`);

  // 9) 我的资料
  const prof = await userApi.getProfile();
  check('userApi.getProfile', prof && prof.weijinNo && prof.level, `weijinNo=${prof?.weijinNo} level=${prof?.level}`);

  // 10) 地址 / 提醒 / 违约 / 级别
  check('addressApi.list', Array.isArray(await addressApi.list()));
  check('alertApi.list', Array.isArray(await alertApi.list()));
  check('defaultApi.getSummary', !!(await defaultApi.getSummary()));
  check('levelApi.getLevel', !!(await levelApi.getLevel()));

  // 11) 发布资质 + 发布（前端 api 扁平契约）
  const elig = await publishApi.getEligibility('gold');
  check('publishApi.getEligibility 已实名', elig && elig.realName === true, `marginOk=${elig?.marginOk}`);
  const pub = await publishApi.submit({ metal: 'gold', category: '板料', goodsName: '联调发布', totalWeight: 100, shipMode: 'bulk', minBatch: 1, priceMode: 'fixed', refPriceCash: 890, supportTransfer: false, images: ['x'] });
  check('publishApi.submit 扁平契约发布成功', pub && pub.listingId, `id=${pub?.listingId}`);

  // 12) 静默校验守卫（devuser001 资质齐 → true，无跳转）
  const g = await requireEligibility('lock');
  check('requireEligibility(lock) 通过', g === true);

  // 13) 负向：整出全量挂单锁 5g → 前端 request 层应抛 BizError(3005)
  if (whole) {
    try {
      await lockApi.submitLock({ listingId: whole.listingId, weight: 5, payMethod: 'cash' });
      bad('整出全量锁部分 → 应抛错', '未抛错');
    } catch (e) {
      check('整出全量锁部分 → BizError(3005) 透传', e instanceof BizError && e.code === 3005, `code=${e?.code}`);
    }
  }

  try { rmSync(bundle, { force: true }); } catch {}

  console.log(`\n${C.c}════════════════════════════${C.x}`);
  console.log(`  ${C.g}通过 ${pass}${C.x}   ${fail ? C.r : C.d}失败 ${fail}${C.x}   共 ${pass + fail}`);
  if (failures.length) { console.log(`\n${C.r}失败明细：${C.x}`); failures.forEach((f) => console.log(`  ${C.r}•${C.x} ${f}`)); }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(`${C.r}harness 异常：${C.x}`, e); process.exit(2); });
