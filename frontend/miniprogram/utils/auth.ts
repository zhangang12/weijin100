import { BASE_URL, USE_MOCK, DEV_LOGIN, DEV_OPENID } from '../config/env';

const TOKEN_KEY = 'wj_access_token';
const REFRESH_KEY = 'wj_refresh_token';

export function getToken(): string | null {
  try { return wx.getStorageSync(TOKEN_KEY) || null; } catch { return null; }
}
function setTokens(access: string, refresh?: string) {
  wx.setStorageSync(TOKEN_KEY, access);
  if (refresh) wx.setStorageSync(REFRESH_KEY, refresh);
}
export function clearSession() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(REFRESH_KEY);
}

/** 启动恢复会话（游客可浏览，不强制登录） */
export function restoreSession() {
  // 预留：可在此校验 token 是否过期并静默刷新
}

interface TokenResp { accessToken: string; refreshToken?: string }

/** 微信登录换 JWT */
export async function login(): Promise<string> {
  if (USE_MOCK) { setTokens('mock-access', 'mock-refresh'); return 'mock-access'; }
  // DEV_LOGIN：用 mock:<openid> 绕过微信登录，无需真实 AppID，仅用于本地联调
  const code = DEV_LOGIN ? ('mock:' + DEV_OPENID) : (await wxLogin()).code;
  const res = await postRaw<TokenResp>('/auth/login', { code });
  setTokens(res.accessToken, res.refreshToken);
  return res.accessToken;
}

/** 确保已登录（操作类接口调用前） */
export async function ensureLogin(): Promise<string> {
  return getToken() || login();
}

export async function refreshToken(): Promise<boolean> {
  if (USE_MOCK) return true;
  try {
    const refresh = wx.getStorageSync(REFRESH_KEY);
    if (!refresh) return false;
    const res = await postRaw<TokenResp>('/auth/refresh', { refreshToken: refresh });
    setTokens(res.accessToken);
    return true;
  } catch { return false; }
}

/** getPhoneNumber 一键授权 → 后端解密手机号 */
export async function resolvePhoneNumber(e: WechatMiniprogram.ButtonGetPhoneNumber): Promise<string> {
  const detail = e.detail as { code?: string; encryptedData?: string; iv?: string };
  if (USE_MOCK) return '138****6688';
  const res = await postRaw<{ phone: string }>(
    '/auth/phone',
    detail.code ? { code: detail.code } : { encryptedData: detail.encryptedData, iv: detail.iv },
  );
  return res.phone;
}

function wxLogin() {
  return new Promise<WechatMiniprogram.LoginSuccessCallbackResult>((res, rej) =>
    wx.login({ success: res, fail: rej }),
  );
}

/** 不经过 request 的裸 POST，避免与 request.ts 形成循环依赖 */
function postRaw<T>(url: string, data: Record<string, unknown>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    wx.request({
      url: BASE_URL + url,
      method: 'POST',
      data,
      header: { 'content-type': 'application/json' },
      success: (r) => {
        const b = r.data as { code: number; message?: string; data: T };
        b && b.code === 0 ? resolve(b.data) : reject(new Error((b && b.message) || 'auth failed'));
      },
      fail: reject,
    });
  });
}
