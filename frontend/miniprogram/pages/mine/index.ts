import { userApi, marginApi, defaultApi, addressApi } from '../../api/index';
import { ensureLogin } from '../../utils/auth';
import { fenToYuan } from '../../utils/format';
import { FEATURES } from '../../config/env';
import type { Profile, MarginAccount } from '../../types/models';

// 单个菜单项：右侧可展示 value（文本）/ chip（脱敏名等）/ badge（红点数）/ level（等级徽 + 笔数）
interface MenuItem {
  key: string;
  title: string;
  value?: string;      // 右侧普通文本（如 ¥3,000、v1.0.0、地址数）
  chip?: string;       // 右侧 chip（如 ✓ 陈**）
  badge?: number;      // 右侧红点数（>0 才显示，如违约次数）
  level?: string;      // 右侧等级徽（级别与佣金行）
  trades?: number;     // 等级徽后的累计笔数
}
interface MenuGroup {
  title: string;
  items: MenuItem[];
}

Page({
  data: {
    profile: null as Profile | null,
    margin: null as MarginAccount | null,
    avatarChar: '',          // 昵称首字（头像占位）
    balanceText: '0.00',     // 保证金余额（元，已格式化）
    isVerified: false,       // 实名是否通过
    isLimited: false,        // 功能受限（E5）
    menuGroups: [] as MenuGroup[],
    loading: true,
    marginOn: FEATURES.margin as boolean, // 保证金开关（关闭时不渲染保证金卡、不请求保证金账户）
  },

  onShow() {
    // 从地址/资料等页返回时刷新右侧值
    if (!this.data.loading) this.loadAll();
  },

  onLoad() {
    this.loadAll();
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      await ensureLogin();
      // 保证金关闭时不请求保证金账户接口
      const [profile, margin] = await Promise.all([
        userApi.getProfile(),
        FEATURES.margin ? userApi.getMargin() : Promise.resolve(null),
      ]);
      // 违约次数、地址数为「尽力获取」，失败不影响主体
      const [summary, addresses] = await Promise.all([
        defaultApi.getSummary().catch(() => null),
        addressApi.list().catch(() => [] as unknown[]),
      ]);
      const defaultCount = summary ? summary.defaultCount12m : 0;
      const addressCount = Array.isArray(addresses) ? addresses.length : 0;

      this.setData({
        profile,
        margin,
        avatarChar: (profile.nickname || '').charAt(0).toUpperCase(),
        balanceText: margin ? fenToYuan(margin.totalBalance) : '0.00',
        isVerified: profile.kycStatus === 'verified',
        isLimited: profile.functionStatus === 'limited',
        menuGroups: this.buildMenu(profile, margin, defaultCount, addressCount),
        loading: false,
      });
    } catch {
      // 兜底不崩：保持空态
      this.setData({ loading: false });
    }
  },

  // 组装三组菜单及右侧值（屏①）
  buildMenu(profile: Profile, margin: MarginAccount | null, defaultCount: number, addressCount: number): MenuGroup[] {
    const tradeItems: MenuItem[] = [
      { key: 'level', title: FEATURES.commission ? '级别与佣金' : '我的级别', level: profile.level, trades: profile.completedTrades },
      { key: 'orders', title: '我的订单' },
      { key: 'breach', title: '违约记录', badge: defaultCount },
    ];
    // 保证金关闭时不展示「保证金与额度」
    if (FEATURES.margin && margin) {
      tradeItems.unshift({ key: 'margin', title: '保证金与额度', value: `¥${fenToYuan(margin.totalBalance, 0)}` });
    }
    return [
      {
        title: '账户与认证',
        items: [
          { key: 'profile', title: '个人资料' },
          { key: 'kyc', title: '实名认证', chip: profile.kycStatus === 'verified' ? `✓ ${profile.realNameMasked || ''}` : '未实名' },
          { key: 'address', title: '收货 / 取货地址', value: String(addressCount) },
        ],
      },
      {
        title: FEATURES.margin ? '资产与交易' : '交易',
        items: tradeItems,
      },
      {
        title: '帮助与更多',
        items: [
          { key: 'feedback', title: '意见反馈' },
          { key: 'privacy', title: '隐私政策' },
          { key: 'agreement', title: '用户协议' },
          { key: 'about', title: '关于与客服', value: 'v1.0.0' },
        ],
      },
    ];
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
    if (!FEATURES.margin) return;
    wx.navigateTo({ url: '/packageMine/pages/margin-recharge/index' });
  },

  // 退款改为跳转到充值页的「退款」tab（不再直接调 refund({amount:0})）
  onRefund() {
    if (!FEATURES.margin) return;
    wx.navigateTo({ url: '/packageMine/pages/margin-recharge/index?mode=refund' });
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
      case 'address':
        wx.navigateTo({ url: '/packageMine/pages/address/index' });
        break;
      case 'orders':
        wx.switchTab({ url: '/pages/order/index' });
        break;
      case 'margin':
        if (FEATURES.margin) wx.navigateTo({ url: '/packageMine/pages/margin/index' });
        break;
      case 'level':
        wx.navigateTo({ url: '/packageMine/pages/level/index' });
        break;
      case 'breach':
        wx.navigateTo({ url: '/packageMine/pages/default/index' });
        break;
      case 'feedback':
        wx.navigateTo({ url: '/packageMine/pages/feedback/index' });
        break;
      case 'about':
        wx.navigateTo({ url: '/packageMine/pages/about/index' });
        break;
      case 'privacy':
      case 'agreement':
        wx.showToast({ title: '页面建设中', icon: 'none' });
        break;
      default:
        wx.showToast({ title: '待开发', icon: 'none' });
    }
  },
});
