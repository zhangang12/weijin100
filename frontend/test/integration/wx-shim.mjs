// 最小 `wx` 垫片：让前端真实代码（request/auth/api）在 Node 里跑，把 wx.request 映射到真实 HTTP。
// 不模拟 UI（showToast/navigateTo 等记录调用即可）。存储用内存。

export function installWx() {
  const storage = new Map();
  const nav = []; // 记录 navigateTo/switchTab/redirectTo（供断言静默校验跳转）

  globalThis.wx = {
    request({ url, method = 'GET', data, header, success, fail }) {
      const opts = { method, headers: { ...(header || {}) } };
      if (method !== 'GET' && data !== undefined) opts.body = JSON.stringify(data);
      // GET 带 query
      let u = url;
      if (method === 'GET' && data && Object.keys(data).length) {
        const qs = new URLSearchParams(
          Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])),
        ).toString();
        u += (url.includes('?') ? '&' : '?') + qs;
      }
      fetch(u, opts)
        .then(async (r) => {
          const text = await r.text();
          let body = null;
          try { body = JSON.parse(text); } catch { body = text; }
          success && success({ statusCode: r.status, data: body, header: {} });
        })
        .catch((e) => (fail ? fail(e) : undefined));
    },
    login({ success }) { success && success({ code: 'devcode' }); },
    getStorageSync(k) { return storage.has(k) ? storage.get(k) : ''; },
    setStorageSync(k, v) { storage.set(k, v); },
    removeStorageSync(k) { storage.delete(k); },
    showToast() {}, showLoading() {}, hideLoading() {}, hideToast() {},
    showModal(o) { o && o.success && o.success({ confirm: true, cancel: false }); },
    navigateTo(o) { nav.push(['navigateTo', o && o.url]); o && o.fail && setTimeout(() => {}, 0); },
    switchTab(o) { nav.push(['switchTab', o && o.url]); },
    redirectTo(o) { nav.push(['redirectTo', o && o.url]); },
    navigateBack() {},
  };

  return { storage, nav };
}
