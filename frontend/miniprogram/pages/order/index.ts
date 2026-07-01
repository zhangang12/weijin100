import { orderApi } from '../../api/index';
import { ensureLogin } from '../../utils/auth';
import { fenToYuan } from '../../utils/format';
import type { OrderItem, OrderTab } from '../../types/models';

/** tab 配置 */
type TabDef = { key: OrderTab; label: string };

/** tag 组件 type：通用视觉色 + 订单状态专属语义色（st-*） */
type TagType =
  | '' | 'cat' | 'zheng' | 'san' | 'spot'
  | 'st-selling' | 'st-locked' | 'st-done' | 'st-relay' | 'st-arb' | 'st-cancel';

/** 卡片视图模型：把分/秒/ISO 等预格式化好，WXML 里不做计算 */
type OrderView = OrderItem & {
  sideText: string;          // 买入 / 卖出
  sideClass: string;         // side-buy(蓝) / side-sell(金)
  statusText: string;        // 状态中文
  statusTagType: TagType;    // 状态 tag 颜色
  totalCashText: string;     // ¥ 已格式化
  totalTransferText: string; // 转账合计（仅 supportsTransfer）
  countdownText: string;     // 剩 H:MM:SS（仅 locked_pending）
  completeTimeText: string;  // 完成时间（仅 completed）
};

/** 状态 → 中文文案 */
const STATUS_TEXT: Record<string, string> = {
  selling: '销售中',
  locked_pending: '锁价待处理',
  completed: '已完成',
  relay_inspecting: '中转质检',
  arbitrating: '仲裁中',
  cancelled: '已取消',
};

/** 状态 → tag 专属语义色 */
const STATUS_TAG_TYPE: Record<string, TagType> = {
  selling: 'st-selling',          // 金
  locked_pending: 'st-locked',    // 橙（待处理，醒目）
  completed: 'st-done',           // 绿
  relay_inspecting: 'st-relay',   // 蓝
  arbitrating: 'st-arb',          // 红
  cancelled: 'st-cancel',         // 灰
};

/** 秒 → 剩 H:MM:SS（静态展示，分钟/秒补零） */
function formatCountdown(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return `剩 ${h}:${pad(m)}:${pad(s)}`;
}

/** ISO8601 → 简洁本地时间（去掉 T 与时区尾巴） */
function formatTime(iso?: string): string {
  if (!iso) return '';
  return String(iso).replace('T', ' ').replace(/\+.*$/, '');
}

/** OrderItem → OrderView：集中预格式化，保证 WXML 纯展示 */
function toView(it: OrderItem): OrderView {
  return Object.assign({}, it, {
    sideText: it.side === 'buy' ? '买入' : '卖出',
    sideClass: it.side === 'buy' ? 'side-buy' : 'side-sell',
    statusText: STATUS_TEXT[it.status] || it.status,
    statusTagType: STATUS_TAG_TYPE[it.status] ?? '',
    totalCashText: fenToYuan(it.totalCash),
    totalTransferText:
      it.supportsTransfer && typeof it.totalTransfer === 'number' ? fenToYuan(it.totalTransfer) : '',
    countdownText: it.status === 'locked_pending' ? formatCountdown(it.countdownRemaining) : '',
    completeTimeText: it.status === 'completed' ? formatTime(it.completeTime) : '',
  });
}

Page({
  data: {
    tabs: [
      { key: 'selling', label: '销售中' },
      { key: 'locked_pending', label: '锁价待处理' },
      { key: 'completed', label: '已完成' },
    ] as TabDef[],
    activeTab: 'selling' as OrderTab,
    orders: [] as OrderView[],
    pendingCount: 0, // 锁价待处理角标数
    loading: true,
  },

  async onLoad() {
    await ensureLogin();
    this.loadOrders('selling');
    this.loadBadge();
  },

  onPullDownRefresh() {
    Promise.all([this.loadOrders(this.data.activeTab), this.loadBadge()]).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /** 切 tab：更新选中态并重新拉取该 tab 列表 */
  onTab(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.tab as OrderTab;
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
    this.loadOrders(tab);
  },

  /** 按 tab 拉取订单并转视图模型 */
  async loadOrders(tab: OrderTab) {
    this.setData({ loading: true });
    try {
      const page = await orderApi.getOrders(tab);
      const orders = (page.list || []).map(toView);
      this.setData({ orders, loading: false });
    } catch {
      this.setData({ orders: [], loading: false });
    }
  },

  /** 拉取锁价待处理数量做角标（silent，失败不打断） */
  async loadBadge() {
    try {
      const { pendingCount } = await orderApi.getBadge();
      this.setData({ pendingCount: pendingCount || 0 });
    } catch {
      /* 角标失败忽略 */
    }
  },

  /** 点卡片 → 订单详情 */
  onCardTap(e: WechatMiniprogram.TouchEvent) {
    const no = e.currentTarget.dataset.no as string;
    if (no) wx.navigateTo({ url: '/packageOrder/pages/detail/index?orderNo=' + encodeURIComponent(no) });
  },
});
