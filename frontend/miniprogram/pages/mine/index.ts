import { userApi } from '../../api/index';
import { fenToYuan } from '../../utils/format';
import type { Profile, MarginAccount } from '../../types/models';

interface MenuItem {
  key: string;
  title: string;
}

// 菜单分组（左标题右箭头）
const MENU_GROUPS: MenuItem[][] = [
  [
    { key: 'profile', title: '个人资料' },
    { key: 'kyc', title: '实名认证' },
    { key: 'margin', title: '保证金与额度' },
    { key: 'level', title: '级别与佣金' },
  ],
  [
    { key: 'orders', title: '我的订单' },
    { key: 'breach', title: '违约记录' },
  ],
  [
    { key: 'feedback', title: '意见反馈' },
    { key: 'about', title: '关于与客服' },
  ],
];

Page({
  data: {
    profile: null as Profile | null,
    margin: null as MarginAccount | null,
    avatarChar: '',          // 昵称首字（头像占位）
    balanceText: '0.00',     // 保证金余额（元，已格式化）
    isVerified: false,       // 实名是否通过
    menuGroups: MENU_GROUPS,
    loading: true,
  },

  onLoad() {
    this.loadAll();
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      const [profile, margin] = await Promise.all([
        userApi.getProfile(),
        userApi.getMargin(),
      ]);
      this.setData({
        profile,
        margin,
        avatarChar: (profile.nickname || '').charAt(0).toUpperCase(),
        balanceText: fenToYuan(margin.totalBalance),
        isVerified: profile.kycStatus === 'verified',
        loading: false,
      });
    } catch {
      // 兜底不崩：保持空态
      this.setData({ loading: false });
    }
  },

  // 复制微金号：仅做剪贴板 + toast
  onCopyNo() {
    const no = this.data.profile?.weijinNo;
    if (!no) return;
    wx.setClipboardData({
      data: no,
      success: () => wx.showToast({ title: '已复制', icon: 'none' }),
    });
  },

  onRecharge() {
    wx.navigateTo({ url: '/packageMine/pages/margin-recharge/index' });
  },

  onRefund() {
    wx.showToast({ title: '待开发', icon: 'none' });
  },

  onMenuTap(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key as string;
    switch (key) {
      case 'kyc':
        wx.navigateTo({ url: '/packageMine/pages/kyc/index' });
        break;
      case 'profile':
        wx.navigateTo({ url: '/packageMine/pages/profile-edit/index' });
        break;
      case 'orders':
        wx.switchTab({ url: '/pages/order/index' });
        break;
      default:
        wx.showToast({ title: '待开发', icon: 'none' });
    }
  },
});
