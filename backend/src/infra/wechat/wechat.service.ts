import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { BizException } from '../../common/biz-exception';

export interface Code2SessionResult {
  openid: string;
  sessionKey?: string;
  unionid?: string;
}

/** 微信小程序服务：登录 jscode2session、手机号获取（支付/订阅消息后续接入）。 */
@Injectable()
export class WeChatService {
  private readonly log = new Logger('WeChat');
  private accessToken: { value: string; expireAt: number } | null = null;
  constructor(private readonly config: ConfigService) {}

  /**
   * code → openid。
   * - dev 便捷：code 以 `mock:` 开头时直接取其后缀作为 openid（无需真实小程序即可联调）；生产环境禁用。
   * - 配了 WX_APPID/SECRET：调真实接口换 openid。
   * - 没配：dev 兜底按 code 派生稳定 openid（生产启动自检会拦下缺配置）。
   */
  async code2Session(code: string): Promise<Code2SessionResult> {
    const { wxAppid, wxSecret, isProd } = this.config;
    if (code.startsWith('mock:')) {
      if (isProd) throw new BizException('微信登录失败', 'WX_AUTH_FAIL', 5002);
      return { openid: code.slice(5) || 'mock_openid', sessionKey: 'mock' };
    }
    if (!wxAppid || !wxSecret) {
      if (isProd) throw new BizException('微信服务暂时不可用', 'WX_UNAVAILABLE', 5001);
      this.log.warn('WX_APPID/SECRET 未配置，使用 dev 派生 openid');
      return { openid: 'dev_' + code.slice(0, 24) };
    }
    const url =
      `https://api.weixin.qq.com/sns/jscode2session?appid=${wxAppid}` +
      `&secret=${wxSecret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    let j: { openid?: string; session_key?: string; unionid?: string; errcode?: number; errmsg?: string };
    try {
      const res = await fetch(url);
      j = (await res.json()) as typeof j;
    } catch {
      throw new BizException('微信服务暂时不可用', 'WX_UNAVAILABLE', 5001);
    }
    if (!j.openid) {
      throw new BizException('微信登录失败: ' + (j.errmsg || String(j.errcode) || 'unknown'), 'WX_AUTH_FAIL', 5002);
    }
    return { openid: j.openid, sessionKey: j.session_key, unionid: j.unionid };
  }

  /**
   * getPhoneNumber 按钮返回的 code → 手机号（基础库 2.21.2+ 的新接口，无需 session_key 解密）。
   * dev 未配 AppSecret 时返回固定测试号，便于联调。
   */
  async getPhoneNumber(code: string): Promise<string> {
    const { wxAppid, wxSecret, isProd } = this.config;
    if (!wxAppid || !wxSecret) {
      if (isProd) throw new BizException('微信服务暂时不可用', 'WX_UNAVAILABLE', 5001);
      return '13800006688';
    }
    let j: { errcode?: number; errmsg?: string; phone_info?: { purePhoneNumber?: string } };
    try {
      const res = await fetch(
        `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${await this.getAccessToken()}`,
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) },
      );
      j = (await res.json()) as typeof j;
    } catch {
      throw new BizException('微信服务暂时不可用', 'WX_UNAVAILABLE', 5001);
    }
    if (j.errcode === 40001 || j.errcode === 42001) this.accessToken = null; // token 失效，下次重取
    const phone = j.phone_info?.purePhoneNumber;
    if (!phone) throw new BizException('获取手机号失败: ' + (j.errmsg || String(j.errcode)), 'WX_PHONE_FAIL', 5003);
    return phone;
  }

  /** 接口调用凭证（稳定版 access_token，提前 5 分钟刷新）。 */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expireAt > Date.now()) return this.accessToken.value;
    let j: { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string };
    try {
      const res = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ grant_type: 'client_credential', appid: this.config.wxAppid, secret: this.config.wxSecret }),
      });
      j = (await res.json()) as typeof j;
    } catch {
      throw new BizException('微信服务暂时不可用', 'WX_UNAVAILABLE', 5001);
    }
    if (!j.access_token) throw new BizException('微信凭证获取失败: ' + (j.errmsg || String(j.errcode)), 'WX_UNAVAILABLE', 5001);
    this.accessToken = { value: j.access_token, expireAt: Date.now() + ((j.expires_in ?? 7200) - 300) * 1000 };
    return j.access_token;
  }
}
