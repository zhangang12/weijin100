import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { BizException } from '../../common/biz-exception';

export interface Code2SessionResult {
  openid: string;
  sessionKey?: string;
  unionid?: string;
}

/** 微信小程序服务：登录 jscode2session（支付/订阅消息后续接入）。 */
@Injectable()
export class WeChatService {
  private readonly log = new Logger('WeChat');
  constructor(private readonly config: ConfigService) {}

  /**
   * code → openid。
   * - dev 便捷：code 以 `mock:` 开头时直接取其后缀作为 openid（无需真实小程序即可联调）。
   * - 配了 WX_APPID/SECRET：调真实接口换 openid。
   * - 没配：dev 兜底按 code 派生稳定 openid。
   */
  async code2Session(code: string): Promise<Code2SessionResult> {
    if (code.startsWith('mock:')) {
      return { openid: code.slice(5) || 'mock_openid', sessionKey: 'mock' };
    }
    const { wxAppid, wxSecret } = this.config;
    if (!wxAppid || !wxSecret) {
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
}
