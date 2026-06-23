import { request } from './request';
import { ensureLogin } from './auth';
import type { Eligibility } from '../types/api';

/**
 * 静默校验（核心交互规则）：操作前检查资质，缺则路由跳「我的」对应补全页。
 * 返回 true=可继续；false=已拦截/已跳转，调用方应中止。
 * 注：补全页（packageMine/*）尚未实现，属待开发；Mock 下资质全通过。
 */
export async function requireEligibility(action: 'lock' | 'publish'): Promise<boolean> {
  try {
    await ensureLogin();
    const e = await request<Eligibility>({ url: '/me/eligibility', data: { action }, silent: true });

    if (e.functionStatus === 'limited') {
      wx.showToast({ title: '账号功能受限，暂不可操作', icon: 'none' });
      return false;
    }
    if (!e.realName) return routeComplete('/packageMine/pages/kyc/index', '请先完成实名认证');
    if (!e.contact) return routeComplete('/packageMine/pages/profile-edit/index', '请先补全联系方式');
    if (!e.marginOk) return routeComplete('/packageMine/pages/margin-recharge/index', '请先补足保证金');
    return true;
  } catch {
    wx.showToast({ title: '校验失败，请重试', icon: 'none' });
    return false;
  }
}

function routeComplete(url: string, tip: string): false {
  wx.showToast({ title: tip, icon: 'none' });
  // 跳转目标补全页待开发；上线前接入「我的」分包
  setTimeout(() => wx.navigateTo({ url, fail: () => {} }), 700);
  return false;
}
