/**
 * 微金100 · 合规模式测试（真 HTTP + 真库）
 * 校验上线默认配置 MARGIN_ENABLED=false + ONLINE_PAY_ENABLED=false：
 *   平台不经手用户资金——不可充值/退款；下单、发布不校验不冻结保证金；违约不扣款；代交接服务费线下结算。
 * 依赖：服务器以上述开关（默认值）运行在 http://localhost:3100。
 * 运行：node test/compliance-off.mjs
 */
const BASE = process.env.BASE || 'http://localhost:3100/api/v1';
const ADMIN = process.env.ADMIN_TOKEN || 'dev_admin_token_change_me';
const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', c: '\x1b[36m', d: '\x1b[2m', x: '\x1b[0m' };
let pass = 0, fail = 0; const failures = []; let group = '';
const section = (n) => { group = n; console.log(`\n${C.c}━━ ${n} ━━${C.x}`); };
const ok = (n, d = '') => { pass++; console.log(`  ${C.g}✓${C.x} ${n}${d ? C.d + ' — ' + d + C.x : ''}`); };
const bad = (n, d = '') => { fail++; failures.push(`[${group}] ${n} — ${d}`); console.log(`  ${C.r}✗ ${n}${C.x}${d ? C.r + ' — ' + d + C.x : ''}`); };
const check = (n, cond, d = '') => (cond ? ok(n, d) : bad(n, d));

async function api(method, path, { token, adminToken, body } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (adminToken) headers['x-admin-token'] = adminToken;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json };
}
const isOk = (r) => r.json && r.json.code === 0;
const code = (r) => (r.json ? r.json.code : `HTTP ${r.status}`);
const D = (r) => (r.json ? r.json.data : null);

const RUN = Date.now().toString().slice(-8);
let seq = 0;
const rndPhone = () => '139' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');

/** 自举账号：登录 → 补联系方式 → 实名。不充值（合规模式下无法充值）。 */
async function bootstrap(role) {
  seq++;
  const openid = `co_${role}_${RUN}_${seq}`;
  const r = await api('POST', '/auth/login', { body: { code: 'mock:' + openid } });
  const token = D(r)?.accessToken;
  if (!token) throw new Error('bootstrap 登录失败: ' + JSON.stringify(r.json));
  await api('PUT', '/me/profile', { token, body: { phone: rndPhone(), wechat: openid } });
  const idc = '11010119850101' + String(seq).padStart(4, '0');
  const k = await api('POST', '/me/kyc', { token, body: { realName: '合规' + role + seq, idCardNo: idc, frontImg: 'f', backImg: 'b' } });
  if (!isOk(k)) throw new Error('bootstrap 实名失败: ' + JSON.stringify(k.json));
  return { token, openid };
}
async function publish(token, body) {
  const base = { metal: 'gold', category: '板料', goodsName: '合规挂单', priceMode: 'fixed', refPriceCash: 890, supportTransfer: true, images: ['x'] };
  const r = await api('POST', '/listings', { token, body: { ...base, ...body } });
  return { r, listingId: D(r)?.listingId };
}
const lock = (token, listingId, weight) => api('POST', '/lock/orders', { token, body: { listingId, weight, payMethod: 'cash' } });
const account = async (token) => D(await api('GET', '/margin/account', { token }));

async function main() {
  console.log(`${C.y}微金100 · 合规模式测试（保证金关闭 / 线下结算）${C.x}  →  ${BASE}  (run ${RUN})\n`);

  section('1. 充值 / 退款关闭');
  {
    const u = await bootstrap('acct');
    const acc = await account(u.token);
    check('保证金账户 enabled=false', acc?.enabled === false, `enabled=${acc?.enabled}`);
    check('充值 → MARGIN_DISABLED(3021)', code(await api('POST', '/margin/recharge', { token: u.token, body: { amount: 50000 } })) === 3021);
    check('退款 → MARGIN_DISABLED(3021)', code(await api('POST', '/margin/refund', { token: u.token, body: { amount: 100 } })) === 3021);
    const after = await account(u.token);
    check('余额仍为 0（未入账）', after?.totalBalance === 0 && after?.available === 0, `total=${after?.totalBalance}`);
  }

  section('2. 无保证金可发布 / 下单');
  {
    const s = await bootstrap('seller');
    const b = await bootstrap('buyer');
    const elig = D(await api('GET', '/me/eligibility', { token: b.token }));
    check('下单资格 marginOk=true（不校验保证金）', elig?.marginOk === true);
    const pe = D(await api('GET', '/seller/publish/eligibility?metal=gold', { token: s.token }));
    check('发布资格 marginOk=true 且不设上限(maxQty=null)', pe?.marginOk === true && pe?.maxQty === null, `maxQty=${pe?.maxQty}`);
    const big = await publish(s.token, { shipMode: 'bulk', totalWeight: 100000, minBatch: 1 });
    check('零保证金发布 100kg → 成功（无保证金上限）', isOk(big.r), `code=${code(big.r)}`);
    const lim = D(await api('GET', '/lock/buyer-limit?metal=gold', { token: b.token }));
    check('可买上限：marginEnabled=false、maxBuyableQty=null', lim?.marginEnabled === false && lim?.maxBuyableQty === null);

    const lk = await lock(b.token, big.listingId, 50);
    check('零保证金下单 → 成功', isOk(lk) && D(lk)?.status === 'success', `code=${code(lk)}`);
    const bAcc = await account(b.token), sAcc = await account(s.token);
    check('下单不冻结买卖双方', bAcc?.frozen === 0 && sAcc?.frozen === 0, `buyer=${bAcc?.frozen} seller=${sAcc?.frozen}`);

    const orderNo = D(lk).orderNo;
    await api('POST', `/orders/${orderNo}/confirm-complete`, { token: b.token });
    const done = await api('POST', `/orders/${orderNo}/confirm-complete`, { token: s.token });
    check('双方确认 → completed', D(done)?.status === 'completed');
    const bAcc2 = await account(b.token);
    check('完成后账户无变动', bAcc2?.totalBalance === 0 && bAcc2?.frozen === 0);

    const self = await lock(s.token, big.listingId, 5);
    check('自买提示不含「锁」字', code(self) === 3004 && !/锁/.test(self.json?.message || ''), `message=${self.json?.message}`);
  }

  section('3. 违约只降级受限、不扣款');
  {
    const s = await bootstrap('sellerD');
    const b = await bootstrap('buyerD');
    const { listingId } = await publish(s.token, { shipMode: 'bulk', totalWeight: 500, minBatch: 1 });
    const orderNo = D(await lock(b.token, listingId, 100)).orderNo;
    await api('POST', `/orders/${orderNo}/arbitration`, { token: b.token, body: { chatScreenshots: ['a'], description: '对方未按时交货' } });
    const rv = await api('POST', `/admin/orders/${orderNo}/arbitration/resolve`, { adminToken: ADMIN, body: { violator: 'seller', reason: '卖家违约' } });
    check('平台判卖家违约 → defaulted', isOk(rv) && D(rv)?.status === 'defaulted');
    const rec = D(await api('GET', '/default/records', { token: s.token }))?.list?.[0];
    check('违约记录扣款额 = 0', rec && Number(rec.deductAmount) === 0, `deductAmount=${rec?.deductAmount}`);
    check('违约记录仍有阶梯处罚', /降|限制/.test(rec?.penalty || ''), `penalty=${rec?.penalty}`);
    const sAcc = await account(s.token), bAcc = await account(b.token);
    check('双方账户无扣款/赔付', sAcc?.totalBalance === 0 && bAcc?.totalBalance === 0);
    const se = D(await api('GET', '/me/eligibility', { token: s.token }));
    check('违约方 functionStatus=limited', se?.functionStatus === 'limited');
  }

  section('4. 代交接服务费线下结算');
  {
    const s = await bootstrap('sellerR');
    const b = await bootstrap('buyerR');
    const { listingId } = await publish(s.token, { shipMode: 'bulk', totalWeight: 200, minBatch: 1 });
    const orderNo = D(await lock(b.token, listingId, 20)).orderNo;
    const ap = await api('POST', `/orders/${orderNo}/relay/apply`, { token: b.token });
    check('发起代交接 → 待对方同意', isOk(ap) && D(ap)?.relayStatus === '待对方同意');
    check('不走线上支付（payment=null, feeSettlement=offline）', D(ap)?.payment === null && D(ap)?.feeSettlement === 'offline');
    const rl = D(await api('GET', `/orders/${orderNo}/relay`, { token: s.token }));
    check('代交接详情 feeSettlement=offline', rl?.feeSettlement === 'offline');
    check('对方同意 → 核验中', isOk(await api('POST', `/orders/${orderNo}/relay/consent`, { token: s.token })));
  }

  console.log(`\n${C.c}════════════════════════════${C.x}`);
  console.log(`  ${C.g}通过 ${pass}${C.x}   ${fail ? C.r : C.d}失败 ${fail}${C.x}   共 ${pass + fail}`);
  if (failures.length) { console.log(`\n${C.r}失败明细：${C.x}`); failures.forEach((f) => console.log(`  ${C.r}•${C.x} ${f}`)); }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(`${C.r}合规模式测试异常：${C.x}`, e); process.exit(2); });
