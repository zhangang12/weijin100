import { marginApi } from '../../../api/index';
import { fenToYuan } from '../../../utils/format';
import type { MarginAccount } from '../../../types/models';
import { FEATURES } from '../../../config/env';

/** 保证金关闭（FEATURES.margin=false）时拦截外部直达：提示后返回，无上一页则回「我的」 */
function blockIfMarginOff(): boolean {
  if (FEATURES.margin) return false;
  wx.setNavigationBarTitle({ title: '暂未开放', fail: () => {} });
  wx.showToast({ title: '该功能暂未开放', icon: 'none' });
  setTimeout(() => {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/mine/index', fail: () => {} }) });
  }, 1200);
  return true;
}

interface MarginViewData {
  loading: boolean;
  // 预格式化金额（WXML 不能调用 import 函数，统一在 .ts 内格式化为字符串）
  totalBalanceText: string;  // 元，带千分位
  availableText: string;
  frozenText: string;
  // 三金属可交易额度（单位 g，按需求不加千分位，直接展示数值）
  quotaGold: number;
  quotaSilver: number;
  quotaPlatinum: number;
}

Page<MarginViewData, WechatMiniprogram.IAnyObject>({
  data: {
    loading: true,
    totalBalanceText: '0.00',
    availableText: '0.00',
    frozenText: '0.00',
    quotaGold: 0,
    quotaSilver: 0,
    quotaPlatinum: 0,
  },

  onLoad() {
    // 开关关闭：不请求账户，loading 保持 true → 页面主体不渲染
    if (blockIfMarginOff()) return;
    this.load();
  },

  async load() {
    try {
      const acc: MarginAccount = await marginApi.getAccount();
      this.setData({
        loading: false,
        totalBalanceText: fenToYuan(acc.totalBalance),
        availableText: fenToYuan(acc.available),
        frozenText: fenToYuan(acc.frozen),
        quotaGold: acc.quota.gold,
        quotaSilver: acc.quota.silver,
        quotaPlatinum: acc.quota.platinum,
      });
    } catch {
      // 错误提示已在 request 层处理；停留在 loading 卡上让用户可重试
      this.setData({ loading: false });
    }
  },

  onRecharge() {
    wx.navigateTo({ url: '/packageMine/pages/margin-recharge/index' });
  },

  // 退款改为跳转到充值页的「退款」tab（含可退金额/部分退款/条件校验/二次确认）
  onRefund() {
    wx.navigateTo({ url: '/packageMine/pages/margin-recharge/index?mode=refund' });
  },
});
