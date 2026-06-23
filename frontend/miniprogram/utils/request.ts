import { BASE_URL, USE_MOCK } from '../config/env';
import { getToken, refreshToken, clearSession } from './auth';
import { resolveMock } from '../mock/index';

/** 统一响应信封（对齐 v0.1 §1.3） */
export interface ApiEnvelope<T> {
  code: number;
  bizCode?: string;
  message: string;
  data: T;
  requestId?: string;
}

export class BizError extends Error {
  code: number;
  bizCode?: string;
  constructor(code: number, message: string, bizCode?: string) {
    super(message);
    this.name = 'BizError';
    this.code = code;
    this.bizCode = bizCode;
  }
}

export interface RequestOptions {
  url: string;
  method?: WechatMiniprogram.RequestOption['method'];
  data?: Record<string, unknown>;
  auth?: boolean;        // 是否注入鉴权头（默认 true；游客接口设 false）
  loading?: boolean;     // 显示全局 loading
  idempotencyKey?: string;
  silent?: boolean;      // 失败不自动 toast
  _retry?: boolean;      // 内部：刷新 token 后重试标记
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function wxRequest(o: WechatMiniprogram.RequestOption) {
  return new Promise<WechatMiniprogram.RequestSuccessCallbackResult>((resolve, reject) => {
    wx.request({ ...o, success: resolve, fail: reject });
  });
}

/** 统一请求入口：注入鉴权、解信封、错误码映射、401 刷新重试、Mock 开关 */
export async function request<T = unknown>(opts: RequestOptions): Promise<T> {
  // Mock 模式：直接走本地数据
  if (USE_MOCK) {
    return resolveMock<T>(opts.url, opts.method || 'GET', opts.data);
  }

  if (opts.loading) wx.showLoading({ title: '加载中', mask: true });

  const header: Record<string, string> = { 'content-type': 'application/json', 'X-Client': 'miniapp' };
  const token = getToken();
  if (opts.auth !== false && token) header['Authorization'] = 'Bearer ' + token;
  if (opts.method && opts.method !== 'GET') header['Idempotency-Key'] = opts.idempotencyKey || uuid();

  try {
    const res = await wxRequest({
      url: BASE_URL + opts.url,
      method: opts.method || 'GET',
      data: opts.data,
      header,
    });

    // 传输层 401：刷新后重试一次
    if (res.statusCode === 401 && !opts._retry) {
      if (await refreshToken()) return request<T>({ ...opts, _retry: true });
      clearSession();
      throw new BizError(1002, '登录已失效，请重新进入', 'UNAUTHORIZED');
    }

    const body = res.data as ApiEnvelope<T>;
    if (body && typeof body.code === 'number') {
      if (body.code === 0) return body.data;
      if (body.bizCode === 'TOKEN_EXPIRED' && !opts._retry) {
        if (await refreshToken()) return request<T>({ ...opts, _retry: true });
      }
      throw new BizError(body.code, body.message || '请求失败', body.bizCode);
    }
    return body as unknown as T;
  } catch (err) {
    if (!opts.silent) {
      const msg = err instanceof BizError ? err.message : '网络异常，请稍后重试';
      wx.showToast({ title: msg, icon: 'none' });
    }
    throw err;
  } finally {
    if (opts.loading) wx.hideLoading();
  }
}
