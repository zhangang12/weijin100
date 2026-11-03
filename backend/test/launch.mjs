/**
 * 微金100 · 上线加固测试（真 HTTP + 真库）
 * 依赖：服务器以 KYC_AUTO_APPROVE=false（生产口径：实名人工审核）运行在 http://localhost:3100。
 * 覆盖：文件上传目录白名单 / 路径穿越 / 证件照仅本人与运营可看 / 实名审核流程 / 手机号授权接口。
 * 运行：node test/launch.mjs
 */
const BASE = process.env.BASE || 'http://localhost:3100/api/v1';
const ADMIN = process.env.ADMIN_TOKEN || 'dev_admin_token_change_me';
const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', c: '\x1b[36m', d: '\x1b[2m', x: '\x1b[0m' };
let pass = 0, fail = 0; const failures = []; let group = '';
const section = (n) => { group = n; console.log(`\n${C.c}━━ ${n} ━━${C.x}`); };
const check = (n, cond, d = '') => {
  if (cond) { pass++; console.log(`  ${C.g}✓${C.x} ${n}${d ? C.d + ' — ' + d + C.x : ''}`); }
  else { fail++; failures.push(`[${group}] ${n} — ${d}`); console.log(`  ${C.r}✗ ${n}${C.x}${d ? C.r + ' — ' + d + C.x : ''}`); }
};

async function api(method, path, { token, adminToken, body, raw, contentType } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (adminToken) headers['x-admin-token'] = adminToken;
  let payload;
  if (raw !== undefined) { headers['content-type'] = contentType; payload = raw; }
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const buf = Buffer.from(await res.arrayBuffer());
  let json = null; try { json = JSON.parse(buf.toString()); } catch {}
  return { status: res.status, json, buf };
}
const isOk = (r) => r.json && r.json.code === 0;
const code = (r) => (r.json ? r.json.code : `HTTP ${r.status}`);
const D = (r) => (r.json ? r.json.data : null);

const RUN = Date.now().toString().slice(-8);
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000154a24f5f0000000049454e44ae426082', 'hex');

async function login(tag) {
  const r = await api('POST', '/auth/login', { body: { code: `mock:launch_${tag}_${RUN}` } });
  return { token: D(r).accessToken, userId: D(r).user.userId };
}
/** 模拟小程序 wx.uploadFile：multipart/form-data，字段名 file */
async function uploadMultipart(token, dir, buf = PNG, filename = 'tmp.png', type = 'image/png') {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type }), filename);
  const res = await fetch(`${BASE}/upload?dir=${dir}`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function main() {
  console.log(`${C.y}微金100 · 上线加固测试${C.x}  →  ${BASE}  (run ${RUN})`);
  const a = await login('a');
  const b = await login('b');

  section('1. 文件上传');
  const up = await uploadMultipart(a.token, 'kyc');
  const fileId = D(up)?.fileId;
  check('multipart 上传证件照', isOk(up) && fileId?.startsWith(`kyc/${a.userId}/`) && !D(up).url, `fileId=${fileId}`);
  const dl = await api('GET', `/file/${fileId}`, { token: a.token });
  check('本人下载内容与上传一致（不含 multipart 包装）', dl.status === 200 && dl.buf.equals(PNG), `${dl.status} ${dl.buf.length}B`);
  check('他人下载证件照 → 403', (await api('GET', `/file/${fileId}`, { token: b.token })).status === 403);
  const adm = await api('GET', `/admin/file/${fileId}`, { adminToken: ADMIN });
  check('运营端可下载证件照', adm.status === 200 && adm.buf.equals(PNG));
  check('运营端无令牌 → 拒绝', (await api('GET', `/admin/file/${fileId}`)).status === 401);

  const pub = await uploadMultipart(b.token, 'listing');
  check('商品图返回公开 url', isOk(pub) && D(pub).url?.endsWith(`/uploads/${D(pub).fileId}`), D(pub)?.url);
  const st = await fetch(D(pub).url.replace(/^https?:\/\/[^/]+/, BASE.replace('/api/v1', '')));
  check('公开 url 可直接访问', st.status === 200);
  const kycPublic = await fetch(`${BASE.replace('/api/v1', '')}/uploads/${fileId}`);
  check('证件照不能走公开路径访问', kycPublic.status === 404, `HTTP ${kycPublic.status}`);

  check('非白名单目录 → 拒绝', code(await uploadMultipart(a.token, '..%2F..%2Ftmp')) === 2000);
  check('非图片文件 → 拒绝', code(await uploadMultipart(a.token, 'kyc', Buffer.from('#!/bin/sh'), 'x.sh', 'text/plain')) === 2000);
  check('octet-stream 按后缀识别为图片', isOk(await uploadMultipart(a.token, 'avatar', PNG, 'wxfile.png', 'application/octet-stream')));
  check('原始请求体上传（脚本用）', isOk(await api('POST', '/upload?dir=arb', { token: a.token, raw: PNG, contentType: 'image/png' })));
  const trav = await api('GET', `/file/kyc/${a.userId}/..%2F..%2F..%2F.env`, { token: a.token });
  check('路径穿越 → 拒绝', trav.status === 403 || trav.status === 404, `HTTP ${trav.status}`);

  section('2. 实名人工审核');
  const idc = '11010119900101' + RUN.slice(-4);
  check('不传证件照 → 拒绝', code(await api('POST', '/me/kyc', { token: a.token, body: { realName: '张三', idCardNo: idc } })) === 2000);
  const back = D(await uploadMultipart(b.token, 'kyc')).fileId;
  check('用他人证件照 → 拒绝', code(await api('POST', '/me/kyc', { token: a.token, body: { realName: '张三', idCardNo: idc, frontFileId: fileId, backFileId: back } })) === 2000);
  const myBack = D(await uploadMultipart(a.token, 'kyc')).fileId;
  const sub = await api('POST', '/me/kyc', { token: a.token, body: { realName: '张三', idCardNo: idc, frontFileId: fileId, backFileId: myBack } });
  check('提交 → 审核中', isOk(sub) && D(sub).status === 'pending', JSON.stringify(D(sub)));
  check('审核中不可下单/发布（eligibility.realName=false）', D(await api('GET', '/me/eligibility', { token: a.token }))?.realName === false);

  const list = D(await api('GET', '/admin/kyc', { adminToken: ADMIN })) || [];
  const row = list.find((k) => k.userId === a.userId);
  check('运营端待审列表含该用户（完整证件号+证件照）', row?.idCardNo === idc && row?.frontImg === fileId);
  check('运营端无令牌 → 拒绝', (await api('GET', '/admin/kyc')).status === 401);

  const rej = await api('POST', `/admin/kyc/${a.userId}/reject`, { adminToken: ADMIN, body: { reason: '照片不清晰' } });
  check('驳回', isOk(rej) && D(rej).status === 'rejected');
  const k1 = D(await api('GET', '/me/kyc', { token: a.token }));
  check('用户看到驳回原因', k1?.status === 'rejected' && k1?.rejectReason === '照片不清晰', JSON.stringify(k1));
  check('驳回后可重新提交', D(await api('POST', '/me/kyc', { token: a.token, body: { realName: '张三', idCardNo: idc, frontFileId: fileId, backFileId: myBack } }))?.status === 'pending');
  check('通过', D(await api('POST', `/admin/kyc/${a.userId}/approve`, { adminToken: ADMIN }))?.status === 'verified');
  check('通过后 profile.kycStatus=verified', D(await api('GET', '/me/profile', { token: a.token }))?.kycStatus === 'verified');
  check('通过后再提交 → KYC_LOCKED', code(await api('POST', '/me/kyc', { token: a.token, body: { realName: '李四', idCardNo: idc, frontFileId: fileId, backFileId: myBack } })) === 3018);
  check('重复审核 → 拒绝', code(await api('POST', `/admin/kyc/${a.userId}/approve`, { adminToken: ADMIN })) === 3018);

  section('3. 手机号授权');
  check('未登录 → 拒绝', (await api('POST', '/auth/phone', { body: { code: 'x' } })).status === 401);
  check('缺 code → 提示升级微信', code(await api('POST', '/auth/phone', { token: b.token, body: {} })) === 2000);
  const ph = await api('POST', '/auth/phone', { token: b.token, body: { code: 'dev' } });
  check('开发环境返回测试号并写入账号', isOk(ph) && /^1\d{10}$/.test(D(ph).phone) && D(await api('GET', '/me/profile', { token: b.token }))?.phone, JSON.stringify(D(ph)));

  console.log(`\n  ${C.g}通过 ${pass}${C.x}   ${fail ? C.r : C.d}失败 ${fail}${C.x}   共 ${pass + fail}`);
  if (failures.length) failures.forEach((f) => console.log(`  ${C.r}•${C.x} ${f}`));
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
