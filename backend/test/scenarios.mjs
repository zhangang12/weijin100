/**
 * 微金100 · 全业务场景测试（真 HTTP + 真库）
 * 按《业务规则确认结果.md》A–H 逐条建场景：正向 + 负向 + 边界。
 * 依赖：服务器在 http://localhost:3100 运行，DB 已迁移（seed 可选，本套用独立账号自举）。
 * 运行：node test/scenarios.mjs
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
const rndPhone = () => '138' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');

/** 自举一个账号：登录 → 补联系方式 → (实名) → (充保证金)。返回 token。 */
async function bootstrap(role, { verified = true, marginFen = 10_000_000 } = {}) {
  seq++;
  const openid = `s_${role}_${RUN}_${seq}`;
  const r = await api('POST', '/auth/login', { body: { code: 'mock:' + openid } });
  const token = D(r)?.accessToken;
  if (!token) throw new Error('bootstrap 登录失败: ' + JSON.stringify(r.json));
  await api('PUT', '/me/profile', { token, body: { phone: rndPhone(), wechat: openid } });
  if (verified) {
    const idc = '11010119900101' + String(seq).padStart(4, '0'); // 14+4=18 位
    const k = await api('POST', '/me/kyc', { token, body: { realName: '测试' + role + seq, idCardNo: idc, frontImg: 'f', backImg: 'b' } });
    if (!isOk(k)) throw new Error('bootstrap 实名失败: ' + JSON.stringify(k.json));
  }
  if (marginFen) await api('POST', '/margin/recharge', { token, body: { amount: marginFen } });
  return { token, openid };
}
async function publish(token, body) {
  const base = { metal: 'gold', category: '板料', goodsName: '场景挂单', priceMode: 'fixed', refPriceCash: 890, supportTransfer: true, images: ['x'] };
  const r = await api('POST', '/listings', { token, body: { ...base, ...body } });
  return { r, listingId: D(r)?.listingId };
}
const lock = (token, listingId, weight, payMethod = 'cash') => api('POST', '/lock/orders', { token, body: { listingId, weight, payMethod } });

async function main() {
  console.log(`${C.y}微金100 · 全业务场景测试${C.x}  →  ${BASE}  (run ${RUN})\n`);

  // ════════ A. 锁价与出货约束（A3/A4/A7 + F3 约束）════════
  section('A. 锁价 / 出货约束 / 先到先得');
  {
    const seller = await bootstrap('sellerA', { marginFen: 20_000_000 });
    const buyer = await bootstrap('buyerA');
    const buyer2 = await bootstrap('buyerA2');

    // 整出全量：锁部分 → MUST_WHOLE；锁全量 → 成功
    const { listingId: whole } = await publish(seller.token, { shipMode: 'whole_all', totalWeight: 100 });
    check('整出全量·锁部分 → MUST_WHOLE(3005)', code(await lock(buyer.token, whole, 50)) === 3005);
    const wholeOk = await lock(buyer.token, whole, 100);
    check('整出全量·锁全量 → 成功', isOk(wholeOk) && D(wholeOk)?.status === 'success', `orderNo=${D(wholeOk)?.orderNo}`);

    // A3 快照：fixed 定价下，成交价 = 挂单参考价
    const detail = await api('GET', `/orders/${D(wholeOk).orderNo}`, { token: buyer.token });
    check('A3 快照价 = 挂单报价(890)', Number(D(detail)?.priceCash) === 890, `priceCash=${D(detail)?.priceCash}`);

    // 整出固量：非整数倍 → MUST_LOT；整数倍 → 成功
    const { listingId: fixed } = await publish(seller.token, { shipMode: 'whole_fixed', totalWeight: 500, lotSize: 100 });
    check('整出固量·非整倍 → MUST_LOT(3005)', code(await lock(buyer.token, fixed, 150)) === 3005);
    check('整出固量·整数倍 → 成功', isOk(await lock(buyer.token, fixed, 200)));

    // 散出：低于起批 → BELOW_MIN；≥起批 → 成功
    const { listingId: bulk } = await publish(seller.token, { shipMode: 'bulk', totalWeight: 500, minBatch: 50 });
    check('散出·低于起批 → BELOW_MIN(3005)', code(await lock(buyer.token, bulk, 10)) === 3005);
    check('散出·达起批 → 成功', isOk(await lock(buyer.token, bulk, 50)));

    // A5 自锁：卖家锁自己 → SELF_LOCK
    const { listingId: selfL } = await publish(seller.token, { shipMode: 'bulk', totalWeight: 100, minBatch: 1 });
    check('A7/自锁·卖家锁自己 → SELF_LOCK(3004)', code(await lock(seller.token, selfL, 5)) === 3004);

    // A4 先到先得：两买家并发锁同一整出全量 → 一成功一 LISTING_SOLD
    const { listingId: race } = await publish(seller.token, { shipMode: 'whole_all', totalWeight: 100 });
    const [r1, r2] = await Promise.all([lock(buyer.token, race, 100), lock(buyer2.token, race, 100)]);
    const successes = [r1, r2].filter(isOk).length;
    // 输家可能是 LISTING_SOLD(3006) 或 LISTING_UNAVAILABLE(3003)（取决于是否已被置 sold），均属「被抢」
    const lost = [r1, r2].filter((r) => !isOk(r) && [3006, 3003].includes(code(r))).length;
    check('A4 先到先得·并发只成交一单', successes === 1 && lost === 1, `成功=${successes} 被抢=${lost} codes=${code(r1)},${code(r2)}`);
  }

  // ════════ B. 保证金与额度（C1–C6）════════
  section('B. 保证金 / 额度（C1-C6）');
  {
    // C1 冻结 = 克重 × 固定单价（金1000/银50/铂500 分/克）
    const s = await bootstrap('sellerB', { marginFen: 50_000_000 });
    const b = await bootstrap('buyerB', { marginFen: 50_000_000 });
    for (const [metal, unit] of [['gold', 1000], ['silver', 50], ['platinum', 500]]) {
      const { listingId } = await publish(s.token, { metal, shipMode: 'bulk', totalWeight: 1000, minBatch: 1, refPriceCash: metal === 'silver' ? 8 : metal === 'platinum' ? 230 : 890 });
      const before = D(await api('GET', '/margin/account', { token: b.token })).frozen;
      await lock(b.token, listingId, 10, 'cash');
      const after = D(await api('GET', '/margin/account', { token: b.token })).frozen;
      check(`C1 ${metal} 冻结 = 10g×${unit}分`, after - before === 10 * unit, `Δfrozen=${after - before}`);
    }

    // C2 可购买上限 = 可用余额 ÷ 单价
    const bl = await api('GET', '/lock/buyer-limit?metal=gold', { token: b.token });
    const acc = D(await api('GET', '/margin/account', { token: b.token }));
    check('C2 可买量 = 可用 ÷ 单价', D(bl)?.maxBuyableQty === Math.floor(acc.available / 1000), `maxQty=${D(bl)?.maxBuyableQty} avail=${acc.available}`);

    // C3 最低充值 500
    const fresh = await bootstrap('buyerC3', { verified: false, marginFen: 0 });
    check('C3 充值 < ¥500 → RECHARGE_TOO_LOW(3013)', code(await api('POST', '/margin/recharge', { token: fresh.token, body: { amount: 100 } })) === 3013);
    check('C3 充值 = ¥500 → 成功', isOk(await api('POST', '/margin/recharge', { token: fresh.token, body: { amount: 50000 } })));

    // C4 退款需无在途订单
    check('C4 有在途订单 → 退款拒(REFUND_HAS_INFLIGHT 3014)', code(await api('POST', '/margin/refund', { token: b.token, body: { amount: 1000 } })) === 3014);

    // C6 发布上限 = 保证金额度（超出即拒）
    const poor = await bootstrap('sellerC6', { marginFen: 50000 }); // ¥500 → 金上限 50g
    check('C6 发布超上限 → OVER_LIMIT(3016)', code((await publish(poor.token, { shipMode: 'bulk', totalWeight: 100, minBatch: 1 })).r) === 3016);
    check('C6 发布在上限内 → 成功', isOk((await publish(poor.token, { shipMode: 'bulk', totalWeight: 50, minBatch: 1 })).r));
  }

  // ════════ C. 订单交割 / 确认完成（B1/B5/B9 + C5 解冻）════════
  section('C. 订单交割 / 双方确认 / 解冻（B1/B9/C5）');
  {
    const s = await bootstrap('sellerC', { marginFen: 20_000_000 });
    const b = await bootstrap('buyerC');
    const { listingId } = await publish(s.token, { shipMode: 'bulk', totalWeight: 200, minBatch: 1 });

    const frozen0 = D(await api('GET', '/margin/account', { token: b.token })).frozen;
    const lk = await lock(b.token, listingId, 20);
    const orderNo = D(lk).orderNo;
    const frozen1 = D(await api('GET', '/margin/account', { token: b.token })).frozen;
    check('C5 锁价即冻结(20g×¥10=20000分)', frozen1 - frozen0 === 20000, `Δ=${frozen1 - frozen0}`);

    // B9 订单号 18 位纯数字
    check('B9 订单号 18 位', /^\d{18}$/.test(orderNo), `orderNo=${orderNo}`);

    // B1 单方确认 → 仍 locked_pending
    const c1 = await api('POST', `/orders/${orderNo}/confirm-complete`, { token: b.token });
    check('B1 单方确认 → 未完成', D(c1)?.status === 'locked_pending' && D(c1)?.myConfirmed === true);
    // B1 双方确认 → completed
    const c2 = await api('POST', `/orders/${orderNo}/confirm-complete`, { token: s.token });
    check('B1 双方确认 → completed', D(c2)?.status === 'completed');
    // C5 完成即解冻
    const frozen2 = D(await api('GET', '/margin/account', { token: b.token })).frozen;
    check('C5 完成即解冻(归零)', frozen2 === frozen0, `frozen=${frozen2}`);
    // B9 同挂单母单 16 位共享
    const lk2 = await lock(b.token, listingId, 20);
    check('B9 同挂单·母单 16 位共享', D(lk2).orderNo.slice(0, 16) === orderNo.slice(0, 16), `${orderNo} vs ${D(lk2).orderNo}`);
    // 已完成再确认 → BAD_STATUS
    check('已完成订单再确认 → BAD_STATUS(3007)', code(await api('POST', `/orders/${orderNo}/confirm-complete`, { token: b.token })) === 3007);
  }

  // ════════ D. 仲裁 / 平台裁决（B3/B4/B5 + A1/E1/E2）════════
  section('D. 仲裁 / 平台裁决（B3/B4/E1/E2）');
  {
    const s = await bootstrap('sellerD', { marginFen: 20_000_000 });
    const b = await bootstrap('buyerD');
    const { listingId } = await publish(s.token, { shipMode: 'bulk', totalWeight: 500, minBatch: 1, metal: 'gold' });
    const orderNo = D(await lock(b.token, listingId, 100)).orderNo; // 冻结 100×1000=100000

    // B4 仲裁材料校验
    check('B4 无截图 → ARB_EVIDENCE(2000)', code(await api('POST', `/orders/${orderNo}/arbitration`, { token: b.token, body: { chatScreenshots: [], description: '对方未交割' } })) === 2000);
    check('B4 无说明 → ARB_DESC(2000)', code(await api('POST', `/orders/${orderNo}/arbitration`, { token: b.token, body: { chatScreenshots: ['a'], description: '' } })) === 2000);
    check('B4 说明超500字 → ARB_DESC(2000)', code(await api('POST', `/orders/${orderNo}/arbitration`, { token: b.token, body: { chatScreenshots: ['a'], description: 'x'.repeat(501) } })) === 2000);

    // B3 申请仲裁 → arbitrating + 暂停倒计时
    const arb = await api('POST', `/orders/${orderNo}/arbitration`, { token: b.token, body: { chatScreenshots: ['a', 'b'], description: '对方未按时交割' } });
    check('B3 申请仲裁 → arbitrating', isOk(arb) && D(arb)?.status === 'arbitrating');
    const od = await api('GET', `/orders/${orderNo}`, { token: b.token });
    check('B3 仲裁暂停倒计时(countdownRemaining 空)', D(od)?.countdownRemaining == null, `remain=${D(od)?.countdownRemaining}`);
    // B5 仲裁中仍在「锁价待处理」tab
    const pend = await api('GET', '/orders?tab=locked_pending', { token: b.token });
    check('B5 仲裁中订单归入 locked_pending tab', D(pend)?.list?.some((o) => o.orderNo === orderNo && o.status === 'arbitrating'));

    // 裁决前双方冻结与总额
    const sAcc0 = D(await api('GET', '/margin/account', { token: s.token }));
    const bAcc0 = D(await api('GET', '/margin/account', { token: b.token }));
    // 平台判卖家违约（E1/E2）
    const noTok = await api('POST', `/admin/orders/${orderNo}/arbitration/resolve`, { body: { violator: 'seller' } });
    check('裁决·无 admin token → 401', noTok.status === 401);
    const rv = await api('POST', `/admin/orders/${orderNo}/arbitration/resolve`, { adminToken: ADMIN, body: { violator: 'seller', reason: '卖家违约' } });
    check('A1 平台判卖家违约 → defaulted', isOk(rv) && D(rv)?.status === 'defaulted');
    // E2 扣款=克重×单价(100g×¥10=100000)赔付守约买家；买家原冻结退回
    const sAcc1 = D(await api('GET', '/margin/account', { token: s.token }));
    const bAcc1 = D(await api('GET', '/margin/account', { token: b.token }));
    check('E2 违约方(卖家)扣罚 100000 分', sAcc0.frozen - sAcc1.frozen === 100000 || sAcc0.totalBalance - sAcc1.totalBalance === 100000, `Δfrozen=${sAcc0.frozen - sAcc1.frozen} Δtotal=${sAcc0.totalBalance - sAcc1.totalBalance}`);
    check('E2 守约方(买家)获赔 100000 分', bAcc1.available - bAcc0.available >= 100000, `Δavail=${bAcc1.available - bAcc0.available}`);
    // E1 卖家产生违约记录（penalty 含降级）
    const recs = await api('GET', '/default/records', { token: s.token });
    check('E1 卖家生成违约记录+阶梯处罚', (D(recs)?.list?.length ?? 0) >= 1 && /降|限制/.test(D(recs)?.list?.[0]?.penalty || ''), `penalty=${D(recs)?.list?.[0]?.penalty}`);
    // E4 申诉窗口内可申诉
    const recId = D(recs)?.list?.[0]?.id;
    check('E4 24h 内可提交申诉', isOk(await api('POST', `/default/records/${recId}/appeal`, { token: s.token, body: { reason: '非本人过错', evidence: ['x'] } })));
  }

  // ════════ E. 平台代交接（B6/B7/B8）════════
  section('E. 平台代交接（B6/B7/B8）');
  {
    const s = await bootstrap('sellerE', { marginFen: 20_000_000 });
    const b = await bootstrap('buyerE');
    const { listingId } = await publish(s.token, { shipMode: 'bulk', totalWeight: 200, minBatch: 1 });
    const orderNo = D(await lock(b.token, listingId, 20)).orderNo;

    // B6 发起方付费 → 待对方同意
    const ap = await api('POST', `/orders/${orderNo}/relay/apply`, { token: b.token });
    check('B6 发起代交接 → 待对方同意', isOk(ap) && D(ap)?.relayStatus === '待对方同意');
    // B8 转代交接后 deliveryMethod = relay
    const od = await api('GET', `/orders/${orderNo}`, { token: b.token });
    check('B8 deliveryMethod = relay', D(od)?.deliveryMethod === 'relay');
    // B6 发起方自己同意 → 拒
    check('B6 发起方不能自己同意 → BAD_STATUS(3007)', code(await api('POST', `/orders/${orderNo}/relay/consent`, { token: b.token })) === 3007);
    // B6 对方同意 → 核验中
    const cs = await api('POST', `/orders/${orderNo}/relay/consent`, { token: s.token });
    check('B6 对方同意 → 核验中', isOk(cs) && D(cs)?.peerAgreed === true);

    // B7 走完 4 步 → 订单完成 + 双方解冻 + 成交数+1
    const trades0 = D(await api('GET', '/level/me', { token: b.token })).completedTrades;
    const frozenB0 = D(await api('GET', '/margin/account', { token: b.token })).frozen;
    for (let i = 0; i < 4; i++) await api('POST', `/orders/${orderNo}/relay/step`, { token: s.token, body: { stepIndex: i, state: 'done', desc: 'step' + i } });
    const od2 = await api('GET', `/orders/${orderNo}`, { token: b.token });
    check('B7 末步完成 → 订单 completed', D(od2)?.status === 'completed', `status=${D(od2)?.status}`);
    const frozenB1 = D(await api('GET', '/margin/account', { token: b.token })).frozen;
    check('B7 完成释放买家保证金', frozenB1 < frozenB0 || frozenB1 === 0, `frozen ${frozenB0}→${frozenB1}`);
    const trades1 = D(await api('GET', '/level/me', { token: b.token })).completedTrades;
    check('B7/D1 完成后成交数 +1', trades1 === trades0 + 1, `${trades0}→${trades1}`);
  }

  // ════════ F. 违约受限（E5）════════
  section('F. 功能受限（E5）');
  {
    const s = await bootstrap('sellerF', { marginFen: 20_000_000 });
    const victim = await bootstrap('victimF'); // 将被判违约 → limited
    const { listingId } = await publish(s.token, { shipMode: 'bulk', totalWeight: 200, minBatch: 1 });
    const orderNo = D(await lock(victim.token, listingId, 10)).orderNo;
    await api('POST', `/orders/${orderNo}/arbitration`, { token: victim.token, body: { chatScreenshots: ['a'], description: '走仲裁' } });
    await api('POST', `/admin/orders/${orderNo}/arbitration/resolve`, { adminToken: ADMIN, body: { violator: 'buyer' } });
    // 现在 victim 是违约方 → functionStatus=limited
    const elig = await api('GET', '/me/eligibility', { token: victim.token });
    check('E5 违约方 functionStatus=limited', D(elig)?.functionStatus === 'limited', `status=${D(elig)?.functionStatus}`);
    // E5 受限用户锁价 → FUNCTION_LIMITED
    const { listingId: l2 } = await publish(s.token, { shipMode: 'bulk', totalWeight: 200, minBatch: 1 });
    check('E5 受限用户锁价 → FUNCTION_LIMITED(3020)', code(await lock(victim.token, l2, 5)) === 3020);
    // E5 受限用户发布 → FUNCTION_LIMITED
    check('E5 受限用户发布 → FUNCTION_LIMITED(3020)', code((await publish(victim.token, { shipMode: 'bulk', totalWeight: 10, minBatch: 1 })).r) === 3020);
  }

  // ════════ G. 货品发布（F1/F3-F8/F10）════════
  section('G. 货品发布（F 系列）');
  {
    const s = await bootstrap('sellerG', { marginFen: 50_000_000 });
    // F1 商品名称必填
    check('F1 无商品名称 → LISTING_NAME(2000)', code((await publish(s.token, { goodsName: '', shipMode: 'bulk', totalWeight: 100, minBatch: 1 })).r) === 2000);
    // F3 三种出货方式落库 + detail 回读
    for (const [sm, extra] of [['whole_all', { totalWeight: 100 }], ['whole_fixed', { totalWeight: 300, lotSize: 100 }], ['bulk', { totalWeight: 300, minBatch: 10 }]]) {
      const { listingId } = await publish(s.token, { shipMode: sm, ...extra });
      const det = await api('GET', `/market/listings/${listingId}`);
      check(`F3 出货方式 ${sm} 落库`, D(det)?.shipMode === sm, `shipMode=${D(det)?.shipMode}`);
    }
    // F4 散出起批：>总量 / <1
    check('F4 起批 > 总量 → MINBATCH_INVALID(2000)', code((await publish(s.token, { shipMode: 'bulk', totalWeight: 100, minBatch: 200 })).r) === 2000);
    // F5 溢价范围 ±50（spot 模式）
    check('F5 现金溢价 > 50 → PREMIUM_RANGE(2000)', code((await publish(s.token, { priceMode: 'spot', premiumCash: 60, floorPrice: 800, refPriceCash: undefined, shipMode: 'bulk', totalWeight: 100, minBatch: 1 })).r) === 2000);
    // F6 防守价：spot 行情源不可达 base=0 → refPriceCash = max(0+premium, floor)
    const { listingId: floorL } = await publish(s.token, { priceMode: 'spot', premiumCash: 5, floorPrice: 800, refPriceCash: undefined, shipMode: 'bulk', totalWeight: 100, minBatch: 1 });
    const floorDet = await api('GET', `/market/listings/${floorL}`);
    check('F6 报价 = max(大盘+溢价, 防守价)=800', Number(D(floorDet)?.refPriceCash) === 800, `refCash=${D(floorDet)?.refPriceCash}`);
    // F7 定价模式落库
    const { listingId: fx } = await publish(s.token, { priceMode: 'fixed', refPriceCash: 900, shipMode: 'bulk', totalWeight: 100, minBatch: 1 });
    check('F7 定价模式 fixed 落库', D(await api('GET', `/market/listings/${fx}`))?.priceMode === 'fixed');
    // F1 品类：旧料可发（F2 折后实重卖家自填，此处仅验品类可落）
    check('F1 旧料品类可发布', isOk((await publish(s.token, { category: '旧料', shipMode: 'bulk', totalWeight: 100, minBatch: 1 })).r));
    // F10 前置：无保证金不能发
    const noMargin = await bootstrap('sellerG10', { marginFen: 0 });
    check('F10 无保证金发布 → NEED_MARGIN(3001)', code((await publish(noMargin.token, { shipMode: 'bulk', totalWeight: 10, minBatch: 1 })).r) === 3001);
  }

  // ════════ H. 等级 / 佣金（D1-D3）════════
  section('H. 等级 / 佣金（D1-D3）');
  {
    const lv = await bootstrap('lvH');
    const me = await api('GET', '/level/me', { token: lv.token });
    check('D2 运营期免佣 feeWaived=true', D(me)?.feeWaived === true);
    check('D1 等级 L1-L9 且费率表 9 行', /^L[1-9]$/.test(D(me)?.currentLevel) && D(me)?.feeTable?.length === 9, `level=${D(me)?.currentLevel} rows=${D(me)?.feeTable?.length}`);
    // D3 上限只看保证金：同保证金不同等级 → maxQty 相同
    const seller = await bootstrap('sellerH', { marginFen: 30_000_000 });
    const el = await api('GET', '/seller/publish/eligibility?metal=gold', { token: seller.token });
    check('D3 发布上限 = 可用÷单价（与等级无关）', D(el)?.maxQty === Math.floor(30_000_000 / 1000), `maxQty=${D(el)?.maxQty}`);
  }

  // ════════ I. 账户与资料（H1-H4）════════
  section('I. 账户与资料（H1-H4）');
  {
    const u = await bootstrap('acctI', { verified: false, marginFen: 0 });
    // H2 实名格式校验 + 通过后锁定
    check('H2 身份证格式错 → KYC_IDCARD(2000)', code(await api('POST', '/me/kyc', { token: u.token, body: { realName: '张三', idCardNo: '123' } })) === 2000);
    check('H2 实名通过', isOk(await api('POST', '/me/kyc', { token: u.token, body: { realName: '张三', idCardNo: '110101199001010011' } })));
    check('H2 已实名再提交 → KYC_LOCKED(3018)', code(await api('POST', '/me/kyc', { token: u.token, body: { realName: '李四', idCardNo: '110101199001010022' } })) === 3018);
    // H3 微金号不可改（updateProfile 不接受 weijinNo）
    const p0 = D(await api('GET', '/me/profile', { token: u.token }));
    await api('PUT', '/me/profile', { token: u.token, body: { weijinNo: 'HACKED', nickname: '改名' } });
    const p1 = D(await api('GET', '/me/profile', { token: u.token }));
    check('H3 微金号唯一·不可改', p1.weijinNo === p0.weijinNo && p1.weijinNo !== 'HACKED', `weijinNo=${p1.weijinNo}`);
    // H1 联系方式落库
    check('H1 手机+微信已落库', !!p1.phone && !!p1.wechat, `phone=${p1.phone} wechat=${p1.wechat}`);
    // H4 地址最多 5 个 + 类型校验
    check('H4 地址类型非法 → ADDR_TYPE(2000)', code(await api('POST', '/address', { token: u.token, body: { type: 'bad', contact: 'a', phone: '13800000000', region: 'x', detail: 'y' } })) === 2000);
    for (let i = 0; i < 5; i++) await api('POST', '/address', { token: u.token, body: { type: 'receive', contact: '联系人' + i, phone: '13800000000', region: '广东深圳', detail: '地址' + i } });
    check('H4 第 6 个地址 → ADDR_LIMIT(3017)', code(await api('POST', '/address', { token: u.token, body: { type: 'receive', contact: 'x', phone: '13800000000', region: 'x', detail: 'z' } })) === 3017);
  }

  // ════════ J. 行情与提醒（G2/G3）════════
  section('J. 行情 / 订阅提醒（G2/G3）');
  {
    // G2 四价：销售价 > 回购价
    const q = await api('GET', '/market/quote?metal=gold');
    check('G2 销售价 > 回购价', Number(D(q)?.salePrice) > Number(D(q)?.buybackPrice), `sale=${D(q)?.salePrice} buyback=${D(q)?.buybackPrice}`);
    // G3 订阅每品类 ≤ 8
    const u = await bootstrap('alertJ', { verified: false, marginFen: 0 });
    for (let i = 0; i < 8; i++) await api('POST', '/market/price-alerts', { token: u.token, body: { metal: 'gold', condition: 'above', targetPrice: 900 + i, channels: ['push'] } });
    check('G3 第 9 条同品类提醒 → ALERT_LIMIT(3019)', code(await api('POST', '/market/price-alerts', { token: u.token, body: { metal: 'gold', condition: 'above', targetPrice: 999, channels: ['push'] } })) === 3019);
    check('G3 换品类(白银)可继续订阅', isOk(await api('POST', '/market/price-alerts', { token: u.token, body: { metal: 'silver', condition: 'below', targetPrice: 8, channels: ['push'] } })));
  }

  // ════════ 汇总 ════════
  console.log(`\n${C.c}════════════════════════════${C.x}`);
  console.log(`  ${C.g}通过 ${pass}${C.x}   ${fail ? C.r : C.d}失败 ${fail}${C.x}   共 ${pass + fail}`);
  if (failures.length) { console.log(`\n${C.r}失败明细：${C.x}`); failures.forEach((f) => console.log(`  ${C.r}•${C.x} ${f}`)); }
  console.log(`\n${C.d}未覆盖(需调度器/时间/无接口，由单测或运维兜底)：B2 24h自动完成、E3 信用修复(需30笔)、E4 过期申诉、B10 卖家取消库存${C.x}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(`${C.r}场景测试异常：${C.x}`, e); process.exit(2); });
