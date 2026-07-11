/**
 * 微金100 后端 API 集成测试
 * 覆盖全部 43 条路由 + 关键业务流（锁价→下单→确认→解冻）+ 负向用例。
 * 依赖：服务器已在 http://localhost:3100 运行，DB 已 seed（demo_buyer / demo_seller）。
 * 运行：node test/api-integration.mjs
 */

const BASE = process.env.BASE || 'http://localhost:3100/api/v1';
const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', c: '\x1b[36m', d: '\x1b[2m', x: '\x1b[0m' };

let pass = 0, fail = 0;
const failures = [];
let group = '';

function section(name) { group = name; console.log(`\n${C.c}━━ ${name} ━━${C.x}`); }
function ok(name, detail = '') {
  pass++;
  console.log(`  ${C.g}✓${C.x} ${name}${detail ? C.d + ' — ' + detail + C.x : ''}`);
}
function bad(name, detail = '') {
  fail++;
  failures.push(`[${group}] ${name} — ${detail}`);
  console.log(`  ${C.r}✗ ${name}${C.x}${detail ? C.r + ' — ' + detail + C.x : ''}`);
}
function check(name, cond, detail = '') { cond ? ok(name, detail) : bad(name, detail); }

async function api(method, path, { token, body, rawBody, contentType } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  let payload;
  if (rawBody !== undefined) { headers['content-type'] = contentType || 'application/octet-stream'; payload = rawBody; }
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json, text };
}

// 断言助手
const isOk = (r) => r.json && r.json.code === 0;
const bizCode = (r) => (r.json ? r.json.code : `HTTP ${r.status}`);
const data = (r) => (r.json ? r.json.data : null);

async function main() {
  console.log(`${C.y}微金100 API 集成测试${C.x}  →  ${BASE}\n`);

  // ══════════════════ A. 认证 / 会话 ══════════════════
  section('A. 认证与会话');
  let buyerTok, sellerTok, buyerRefresh;
  {
    const r = await api('POST', '/auth/login', { body: { code: 'mock:demo_buyer' } });
    check('买家登录 POST /auth/login', isOk(r) && data(r)?.accessToken, `token=${(data(r)?.accessToken || '').slice(0, 12)}…`);
    buyerTok = data(r)?.accessToken; buyerRefresh = data(r)?.refreshToken;
    check('登录返回用户信息', data(r)?.user?.weijinNo === '100886699', `weijinNo=${data(r)?.user?.weijinNo}`);
  }
  {
    const r = await api('POST', '/auth/login', { body: { code: 'mock:demo_seller' } });
    check('卖家登录', isOk(r) && data(r)?.accessToken, `weijinNo=${data(r)?.user?.weijinNo}`);
    sellerTok = data(r)?.accessToken;
  }
  {
    const r = await api('POST', '/auth/login', { body: {} });
    check('登录缺 code → 业务拒绝', r.json?.code === 2000, `code=${bizCode(r)} msg=${r.json?.message}`);
  }
  {
    const r = await api('POST', '/auth/refresh', { body: { refreshToken: buyerRefresh } });
    check('刷新 token POST /auth/refresh', isOk(r) && data(r)?.accessToken, '');
  }
  {
    const r = await api('POST', '/auth/refresh', { body: { refreshToken: 'garbage.invalid.token' } });
    check('非法 refreshToken → 1002', r.json?.code === 1002, `code=${bizCode(r)}`);
  }

  // ══════════════════ B. 鉴权拦截 ══════════════════
  section('B. 鉴权拦截（无 token → 1001）');
  for (const [m, p] of [['GET', '/me/profile'], ['GET', '/margin/account'], ['GET', '/orders'], ['GET', '/level/me'], ['GET', '/address/list']]) {
    const r = await api(m, p);
    check(`${m} ${p} 无 token 被拦截`, r.json?.code === 1001, `code=${bizCode(r)}`);
  }

  // ══════════════════ C. 行情 / 公共 ══════════════════
  section('C. 行情与公共接口');
  for (const metal of ['gold', 'silver', 'platinum']) {
    const r = await api('GET', `/market/quote?metal=${metal}`);
    check(`GET /market/quote?metal=${metal}`, isOk(r) && data(r)?.marketPrice != null, `price=${data(r)?.marketPrice}`);
  }
  {
    const r = await api('GET', '/lock/quote/gold');
    check('GET /lock/quote/gold', isOk(r) && data(r)?.salePrice != null, `sale=${data(r)?.salePrice}`);
  }
  {
    const r = await api('GET', '/market/listings?metal=gold&page=1&pageSize=20');
    check('GET /market/listings', isOk(r) && Array.isArray(data(r)?.list), `total=${data(r)?.total}`);
  }
  {
    const r = await api('GET', '/market/listings/L_88001');
    check('GET /market/listings/:id', isOk(r) && data(r)?.listingId === 'L_88001', `weight=${data(r)?.totalWeight}`);
  }
  {
    const r = await api('GET', '/market/listings/NOPE_404');
    check('GET /market/listings/坏id → 2004', r.json?.code === 2004, `code=${bizCode(r)}`);
  }
  {
    const r = await api('GET', '/health');
    check('GET /health', isOk(r) && data(r)?.db === 'ok', `db=${data(r)?.db} quote=${data(r)?.quote}`);
  }
  {
    const r = await api('GET', '/config/dict');
    check('GET /config/dict', isOk(r) && data(r) != null, '');
  }

  // ══════════════════ D. 用户 / 实名 ══════════════════
  section('D. 用户与实名');
  {
    const r = await api('GET', '/me/profile', { token: buyerTok });
    check('GET /me/profile', isOk(r) && data(r)?.kycStatus === 'verified', `level=${data(r)?.level}`);
  }
  {
    const r = await api('PUT', '/me/profile', { token: buyerTok, body: { nickname: '金诚足金-测试' } });
    check('PUT /me/profile', isOk(r), `nickname=${data(r)?.nickname}`);
  }
  {
    const r = await api('GET', '/me/kyc', { token: buyerTok });
    check('GET /me/kyc', isOk(r), `status=${data(r)?.status ?? data(r)?.kycStatus}`);
  }
  {
    const r = await api('GET', '/me/eligibility', { token: buyerTok });
    check('GET /me/eligibility', isOk(r), '');
  }
  {
    const r = await api('GET', '/seller/publish/eligibility', { token: sellerTok });
    check('GET /seller/publish/eligibility (卖家)', isOk(r) && data(r)?.realName === true, `marginOk=${data(r)?.marginOk}`);
  }

  // ══════════════════ E. 保证金 ══════════════════
  section('E. 保证金');
  {
    const r = await api('GET', '/margin/account', { token: buyerTok });
    check('GET /margin/account', isOk(r) && typeof data(r)?.available === 'number', `available=${data(r)?.available} frozen=${data(r)?.frozen}`);
  }
  {
    const before = data(await api('GET', '/margin/account', { token: sellerTok }));
    const r = await api('POST', '/margin/recharge', { token: sellerTok, body: { amount: 100000, metal: 'gold', payMethod: 'wechat' } });
    const after = data(await api('GET', '/margin/account', { token: sellerTok }));
    check('POST /margin/recharge 到账', isOk(r) && after.available === before.available + 100000, `+${100000} → ${after.available}`);
  }
  {
    const r = await api('POST', '/margin/recharge', { token: sellerTok, body: { amount: 0 } });
    check('充值 0 → AMOUNT_INVALID 2000', r.json?.code === 2000, `code=${bizCode(r)}`);
  }
  {
    const r = await api('POST', '/margin/recharge', { token: sellerTok, body: { amount: 100 } });
    check('充值低于最低 ¥500 → RECHARGE_TOO_LOW 3013', r.json?.code === 3013, `code=${bizCode(r)}`);
  }
  {
    const r = await api('POST', '/margin/refund', { token: sellerTok, body: { amount: 1000 } });
    check('POST /margin/refund', isOk(r), `refundId=${data(r)?.refundId}`);
  }
  {
    const r = await api('POST', '/margin/refund', { token: sellerTok, body: { amount: 999999999999 } });
    check('退款超额 → REFUND_EXCEED 3002', r.json?.code === 3002, `code=${bizCode(r)}`);
  }

  // ══════════════════ F. 挂单发布 ══════════════════
  section('F. 挂单发布');
  let testListingId;
  {
    const r = await api('POST', '/listings', {
      token: sellerTok,
      body: { metal: 'gold', category: '板料', goodsName: '集成测试挂单', totalWeight: 1000, shipMode: 'bulk', minBatch: 1, refPriceCash: 890, supportTransfer: true, tags: ['板料', '散出'] },
    });
    testListingId = data(r)?.listingId;
    check('POST /listings 发布（bulk）', isOk(r) && testListingId, `id=${testListingId}`);
  }
  {
    const r = await api('POST', '/listings', { token: sellerTok, body: { category: '板料' } });
    check('发布缺 metal/totalWeight → 2000', r.json?.code === 2000, `code=${bizCode(r)}`);
  }
  {
    const r = await api('GET', '/lock/buyer-limit?metal=gold', { token: buyerTok });
    check('GET /lock/buyer-limit', isOk(r) && data(r)?.maxBuyableQty >= 0, `maxQty=${data(r)?.maxBuyableQty} deposit=${data(r)?.deposit}`);
  }

  // ══════════════════ G. 锁价 → 下单 → 确认（完整流）══════════════════
  section('G. 锁价下单完整业务流');
  const marginBefore = data(await api('GET', '/margin/account', { token: buyerTok }));
  let orderNo1;
  {
    const r = await api('POST', '/lock/orders', { token: buyerTok, body: { listingId: testListingId, qty: 10, payMethod: 'cash' } });
    orderNo1 = data(r)?.orderNo;
    check('POST /lock/orders 锁价（qty 别名）', isOk(r) && orderNo1, `orderNo=${orderNo1} lockId=${data(r)?.lockOrderId}`);
  }
  {
    const after = data(await api('GET', '/margin/account', { token: buyerTok }));
    // 10g × 891(实时价) × 10% = ¥891 = 89100 分
    const frozenDelta = after.frozen - marginBefore.frozen;
    check('锁价冻结保证金', frozenDelta > 0, `冻结 +${frozenDelta} 分（≈¥${(frozenDelta / 100).toFixed(0)}）`);
  }
  let lockDetailId;
  {
    // 取 lockOrderId 再查详情：重新锁一单拿 id 更稳，这里复用上面返回
    const r = await api('POST', '/lock/orders', { token: buyerTok, body: { listingId: testListingId, qty: 11, payMethod: 'cash' } });
    lockDetailId = data(r)?.lockOrderId;
    const d = await api('GET', `/lock/orders/${lockDetailId}`, { token: buyerTok });
    check('GET /lock/orders/:id', isOk(d) && data(d)?.orderNo, `status=${data(d)?.status}`);
  }
  {
    const r = await api('GET', '/orders', { token: buyerTok });
    const found = data(r)?.list?.some((o) => o.orderNo === orderNo1);
    check('GET /orders 含新订单', isOk(r) && found, `total=${data(r)?.total}`);
  }
  {
    const r = await api('GET', '/orders/badge', { token: buyerTok });
    check('GET /orders/badge', isOk(r) && typeof data(r)?.pendingCount === 'number', `pending=${data(r)?.pendingCount}`);
  }
  {
    const r = await api('GET', `/orders/${orderNo1}`, { token: buyerTok });
    check('GET /orders/:no 详情', isOk(r) && data(r)?.orderNo === orderNo1, `status=${data(r)?.status} weight=${data(r)?.weight}`);
  }
  {
    const r = await api('POST', `/orders/${orderNo1}/confirm-complete`, { token: buyerTok });
    check('买家确认 confirm-complete', isOk(r) && data(r)?.myConfirmed === true, `peer=${data(r)?.peerConfirmed} status=${data(r)?.status}`);
  }
  {
    const r = await api('POST', `/orders/${orderNo1}/confirm-complete`, { token: sellerTok });
    check('卖家确认 → 成交完成', isOk(r) && data(r)?.status === 'completed', `status=${data(r)?.status}`);
  }
  {
    const r = await api('POST', `/orders/${orderNo1}/confirm-complete`, { token: buyerTok });
    check('已完成订单再确认 → BAD_STATUS 3007', r.json?.code === 3007, `code=${bizCode(r)}`);
  }

  // ══════════════════ H. 订单子功能（仲裁 / 代交接）══════════════════
  section('H. 仲裁与平台代交接');
  let orderArb, orderRelay;
  {
    const r = await api('POST', '/lock/orders', { token: buyerTok, body: { listingId: testListingId, qty: 12, payMethod: 'cash' } });
    orderArb = data(r)?.orderNo;
    const a = await api('POST', `/orders/${orderArb}/arbitration`, { token: buyerTok, body: { chatScreenshots: ['fileid_1'], description: '对方未按时交割' } });
    check('POST /orders/:no/arbitration', isOk(a) && data(a)?.status === 'arbitrating', `arbId=${data(a)?.arbId}`);
  }
  {
    const r = await api('POST', '/lock/orders', { token: buyerTok, body: { listingId: testListingId, qty: 13, payMethod: 'cash' } });
    orderRelay = data(r)?.orderNo;
    const g = await api('GET', `/orders/${orderRelay}/relay`, { token: buyerTok });
    check('GET /orders/:no/relay', isOk(g) && data(g)?.steps, `status=${data(g)?.relayStatus}`);
    const ap = await api('POST', `/orders/${orderRelay}/relay/apply`, { token: buyerTok });
    check('POST /orders/:no/relay/apply（发起方付费→待对方同意）', isOk(ap) && data(ap)?.feePaid === true, `relayStatus=${data(ap)?.relayStatus}`);
    const cs = await api('POST', `/orders/${orderRelay}/relay/consent`, { token: sellerTok });
    check('POST /orders/:no/relay/consent（对方同意→核验中）', isOk(cs) && data(cs)?.peerAgreed === true, `relayStatus=${data(cs)?.relayStatus}`);
    const st = await api('POST', `/orders/${orderRelay}/relay/step`, { token: buyerTok, body: { stepIndex: 0, state: 'done', desc: '已送达' } });
    check('POST /orders/:no/relay/step', isOk(st) && Array.isArray(data(st)?.steps), `relayStatus=${data(st)?.relayStatus}`);
  }

  // ══════════════════ I. 锁价负向用例 ══════════════════
  section('I. 锁价负向用例');
  {
    const r = await api('POST', '/lock/orders', { token: sellerTok, body: { listingId: testListingId, qty: 5 } });
    check('卖家锁自己挂单 → SELF_LOCK 3004', r.json?.code === 3004, `code=${bizCode(r)}`);
  }
  {
    const r = await api('POST', '/lock/orders', { token: buyerTok, body: { listingId: 'NOPE', qty: 1 } });
    check('锁不存在挂单 → LISTING_UNAVAILABLE 3003', r.json?.code === 3003, `code=${bizCode(r)}`);
  }
  {
    // 建一个 minBatch=100 的 bulk 挂单，锁 1g 应低于起批
    const lr = await api('POST', '/listings', { token: sellerTok, body: { metal: 'gold', goodsName: '起批测试挂单', totalWeight: 500, shipMode: 'bulk', minBatch: 100, priceMode: 'fixed', refPriceCash: 890 } });
    const r = await api('POST', '/lock/orders', { token: buyerTok, body: { listingId: data(lr)?.listingId, qty: 1 } });
    check('低于起批量 → BELOW_MIN 3005', r.json?.code === 3005, `code=${bizCode(r)}`);
  }
  {
    const r = await api('POST', '/lock/orders', { token: buyerTok, body: { listingId: testListingId } });
    check('锁价缺 weight/qty → PARAM 2000', r.json?.code === 2000, `code=${bizCode(r)}`);
  }

  // ══════════════════ J. 地址 ══════════════════
  section('J. 收货地址');
  let newAddrId;
  {
    const r = await api('GET', '/address/list', { token: buyerTok });
    check('GET /address/list', isOk(r) && Array.isArray(data(r)), `count=${data(r)?.length}`);
  }
  {
    const r = await api('POST', '/address', { token: buyerTok, body: { type: 'receive', contact: '测试联系人', phone: '13900001111', region: '广东 深圳 福田', detail: '测试地址 88 号', isDefault: false } });
    newAddrId = data(r)?.id ?? data(r)?.addressId;
    check('POST /address 新建', isOk(r), `id=${newAddrId}`);
  }
  if (newAddrId) {
    const r = await api('PUT', `/address/${newAddrId}/default`, { token: buyerTok });
    check('PUT /address/:id/default', isOk(r), '');
    const d = await api('DELETE', `/address/${newAddrId}`, { token: buyerTok });
    check('DELETE /address/:id', isOk(d), '');
  } else {
    bad('地址后续操作', '未取得新建地址 id');
  }

  // ══════════════════ K. 价格提醒 ══════════════════
  section('K. 价格提醒');
  let alertId;
  {
    const r = await api('GET', '/market/price-alerts', { token: buyerTok });
    check('GET /market/price-alerts', isOk(r) && Array.isArray(data(r)), `count=${data(r)?.length}`);
  }
  {
    const r = await api('POST', '/market/price-alerts', { token: buyerTok, body: { metal: 'gold', condition: 'above', targetPrice: 950, channels: ['push'] } });
    alertId = data(r)?.id ?? data(r)?.alertId;
    check('POST /market/price-alerts', isOk(r), `id=${alertId}`);
  }
  if (alertId) {
    const r = await api('DELETE', `/market/price-alerts/${alertId}`, { token: buyerTok });
    check('DELETE /market/price-alerts/:id', isOk(r), '');
  } else { bad('删除提醒', '未取得提醒 id'); }

  // ══════════════════ L. 违约 / 申诉 ══════════════════
  section('L. 违约与申诉');
  let recordId;
  {
    const r = await api('GET', '/default/summary', { token: buyerTok });
    check('GET /default/summary', isOk(r), '');
  }
  {
    const r = await api('GET', '/default/records', { token: buyerTok });
    const rec = (data(r)?.list ?? data(r))?.[0];
    recordId = rec?.id ?? rec?.recordId;
    check('GET /default/records', isOk(r), `record=${recordId}`);
  }
  if (recordId) {
    const r = await api('POST', `/default/records/${recordId}/appeal`, { token: buyerTok, body: { reason: '非本人操作，系统误判', evidence: ['fileid_x'] } });
    check('POST /default/records/:id/appeal', isOk(r) || [3008, 3009, 2004].includes(r.json?.code), `code=${bizCode(r)} msg=${r.json?.message ?? ''}`);
  } else { bad('提交申诉', '未取得违约记录 id'); }

  // ══════════════════ M. 级别 ══════════════════
  section('M. 级别与佣金');
  {
    const r = await api('GET', '/level/me', { token: buyerTok });
    check('GET /level/me', isOk(r), `level=${data(r)?.level ?? data(r)?.currentLevel}`);
  }

  // ══════════════════ N. 文件存储 ══════════════════
  section('N. 文件上传 / 下载');
  {
    // 最小 PNG（1x1 透明）
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000154a24f5f0000000049454e44ae426082', 'hex');
    const up = await api('POST', '/upload?dir=test', { token: buyerTok, rawBody: png, contentType: 'image/png' });
    const fileId = data(up)?.fileId;
    check('POST /upload', isOk(up) && fileId, `fileId=${fileId}`);
    if (fileId) {
      const res = await fetch(`${BASE}/file/${fileId}`, { headers: { Authorization: 'Bearer ' + buyerTok } });
      const buf = Buffer.from(await res.arrayBuffer());
      check('GET /file/*（下载）', res.status === 200 && buf.length === png.length, `${res.status} ${buf.length}B / ${png.length}B`);
    } else { bad('GET /file/*', '未取得 fileId'); }
  }

  // ══════════════════ 汇总 ══════════════════
  console.log(`\n${C.c}════════════════════════════${C.x}`);
  console.log(`  ${C.g}通过 ${pass}${C.x}   ${fail ? C.r : C.d}失败 ${fail}${C.x}   共 ${pass + fail}`);
  if (failures.length) {
    console.log(`\n${C.r}失败明细：${C.x}`);
    failures.forEach((f) => console.log(`  ${C.r}•${C.x} ${f}`));
  }
  console.log('');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(`${C.r}测试运行异常：${C.x}`, e); process.exit(2); });
