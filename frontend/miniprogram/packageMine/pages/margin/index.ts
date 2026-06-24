import { marginApi } from '../../../api/index';
import { fenToYuan } from '../../../utils/format';
import type { MarginAccount } from '../../../types/models';

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

  onRefund() {
    wx.showToast({ title: '退款 T+1 原路返还（开发中）', icon: 'none' });
  },
});
