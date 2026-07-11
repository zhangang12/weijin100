import { orderApi } from '../../api/index';
import { ensureLogin } from '../../utils/auth';
import { fenToYuan } from '../../utils/format';
import type { OrderItem, OrderTab } from '../../types/models';

/** tab 配置 */
type TabDef = { key: OrderTab; label: string };

/** 买卖向筛选胶囊值 */
type SideFilter = 'all' | 'sell' | 'buy';

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
  countdownText: string;     // 剩 H:MM:SS / 已超时 HH:MM（仅 locked_pending）
  isOvertime: boolean;       // 倒计时归零（A2：继续展示「已超时」）
  completeTimeText: string;  // 完成时间（仅 completed）
  statusBarText: string;     // 底部状态条文案（销售中剩余可锁 / 已完成结语）
  statusBarClass: string;    // sell / done
  hasCounterparty: boolean;  // 是否展示对手方联系快捷键
};

/** 状态 → 中文文案（B5/项目6：代交接·核验中、已违约） */
const STATUS_TEXT: Record<string, string> = {
  selling: '销售中',
  locked_pending: '锁价待处理',
  completed: '已完成',
  relay_inspecting: '平台代交接·核验中',
  arbitrating: '仲裁中',
  cancelled: '已取消',
  defaulted: '已违约',
};

/** 状态 → tag 专属语义色（defaulted 复用红色 st-arb） */
const STATUS_TAG_TYPE: Record<string, TagType> = {
  selling: 'st-selling',          // 金
  locked_pending: 'st-locked',    // 橙（待处理，醒目）
  completed: 'st-done',           // 绿
  relay_inspecting: 'st-relay',   // 蓝
  arbitrating: 'st-arb',          // 红
  cancelled: 'st-cancel',         // 灰
  defaulted: 'st-arb',            // 红（违约）
};

/** 秒 → 剩 H:MM:SS；A2：归零后继续显示「已超时 HH:MM」而非消失 */
function formatCountdown(sec?: number): string {
  if (sec == null) return '';
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  if (sec <= 0) {
    const over = Math.abs(sec);
    const h = Math.floor(over / 3600);
    const m = Math.floor((over % 3600) / 60);
    return `已超时 ${pad(h)}:${pad(m)}`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `剩 ${h}:${pad(m)}:${pad(s)}`;
}

/** ISO8601 → 简洁本地时间（去掉 T 与时区尾巴） */
function formatTime(iso?: string): string {
  if (!iso) return '';
  return String(iso).replace('T', ' ').replace(/\+.*$/, '');
}

/** OrderItem → OrderView：集中预格式化，保证 WXML 纯展示 */
function toView(it: OrderItem): OrderView {
  const overtime =
    it.status === 'locked_pending' && typeof it.countdownRemaining === 'number' && it.countdownRemaining <= 0;
  // 底部状态条：销售中显示剩余可锁；已完成显示成交结语
  let statusBarText = '';
  let statusBarClass = '';
  if (it.status === 'selling') {
    statusBarText =
      typeof it.remainingWeight === 'number' ? `剩余可锁价 ${it.remainingWeight}g` : '销售中 · 等待买家锁价';
    statusBarClass = 'sell';
  } else if (it.status === 'completed') {
    const t = formatTime(it.completeTime);
    statusBarText = t ? `已完成 · ${t} 双方确认交割` : '已完成 · 双方确认交割';
    statusBarClass = 'done';
  }
  return Object.assign({}, it, {
    sideText: it.side === 'buy' ? '买入' : '卖出',
    sideClass: it.side === 'buy' ? 'side-buy' : 'side-sell',
    statusText: STATUS_TEXT[it.status] || it.status,
    statusTagType: STATUS_TAG_TYPE[it.status] ?? '',
    totalCashText: fenToYuan(it.totalCash),
    totalTransferText:
      it.supportsTransfer && typeof it.totalTransfer === 'number' ? fenToYuan(it.totalTransfer) : '',
    countdownText: it.status === 'locked_pending' ? formatCountdown(it.countdownRemaining) : '',
    isOvertime: overtime,
    completeTimeText: it.status === 'completed' ? formatTime(it.completeTime) : '',
    statusBarText,
    statusBarClass,
    // 联系快捷键仅对进行中订单展示（锁价待处理/仲裁中/代交接中）
    hasCounterparty:
      !!it.counterpartyMasked &&
      (it.status === 'locked_pending' || it.status === 'arbitrating' || it.status === 'relay_inspecting'),
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
    orders: [] as OrderView[],       // 当前 tab 全量
    viewOrders: [] as OrderView[],   // 经买卖向 + 单号搜索过滤后的展示列表
    sideFilter: 'all' as SideFilter, // 全部 / 我的卖出 / 我的买入
    searchNo: '',                    // 单号搜索关键字
    pendingCount: 0,                 // 锁价待处理角标数
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

  /** 切 tab：重置筛选并重新拉取该 tab 列表 */
  onTab(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.tab as OrderTab;
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab, sideFilter: 'all', searchNo: '' });
    this.loadOrders(tab);
  },

  /** 买卖向筛选胶囊 */
  onSideFilter(e: WechatMiniprogram.TouchEvent) {
    const side = e.currentTarget.dataset.side as SideFilter;
    if (side === this.data.sideFilter) return;
    this.setData({ sideFilter: side });
    this.applyFilter();
  },

  /** 单号搜索输入 */
  onSearchInput(e: WechatMiniprogram.Input) {
    this.setData({ searchNo: e.detail.value });
    this.applyFilter();
  },

  /** 依据买卖向 + 单号在本地过滤（销售中 tab 均为本人挂单，忽略买卖向） */
  applyFilter() {
    const { orders, sideFilter, searchNo, activeTab } = this.data;
    let list = orders;
    if (activeTab !== 'selling' && sideFilter !== 'all') {
      list = list.filter((o) => o.side === sideFilter);
    }
    const q = searchNo.replace(/\s+/g, '');
    if (q) list = list.filter((o) => o.orderNo.replace(/\s+/g, '').includes(q));
    this.setData({ viewOrders: list });
  },

  /** 按 tab 拉取订单并转视图模型 */
  async loadOrders(tab: OrderTab) {
    this.setData({ loading: true });
    try {
      const page = await orderApi.getOrders(tab);
      const orders = (page.list || []).map(toView);
      this.setData({ orders, loading: false });
      this.applyFilter();
    } catch {
      this.setData({ orders: [], viewOrders: [], loading: false });
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
    this.goDetail(e.currentTarget.dataset.no as string);
  },
  onDetail(e: WechatMiniprogram.TouchEvent) {
    this.goDetail(e.currentTarget.dataset.no as string);
  },
  goDetail(no?: string) {
    if (no) wx.navigateTo({ url: '/packageOrder/pages/detail/index?orderNo=' + encodeURIComponent(no) });
  },

  /** 对手方联系快捷键：列表无联系明细，统一跳详情联系卡 */
  onContact(e: WechatMiniprogram.TouchEvent) {
    this.goDetail(e.currentTarget.dataset.no as string);
  },

  /** 销售中：取消订单（占位，仅取消剩余库存的确认提示） */
  onCancelListing(e: WechatMiniprogram.TouchEvent) {
    const no = e.currentTarget.dataset.no as string;
    wx.showModal({
      title: '取消订单',
      content: '已被锁价的子单不可取消，仅取消剩余库存报价。确认取消？',
      confirmText: '确认取消',
      confirmColor: '#E0492F',
      success: (r) => {
        if (r.confirm) wx.showToast({ title: '取消功能开发中', icon: 'none' });
      },
    });
    void no;
  },

  /** 销售中：修改（占位，跳转货品发布修改页待接线） */
  onEditListing() {
    wx.showToast({ title: '请在货品发布页修改', icon: 'none' });
  },

  /** 锁价待处理：申请仲裁 → 仲裁页 */
  onArbitrate(e: WechatMiniprogram.TouchEvent) {
    const no = e.currentTarget.dataset.no as string;
    if (no) wx.navigateTo({ url: '/packageOrder/pages/arbitration/index?orderNo=' + encodeURIComponent(no) });
  },

  /** 锁价待处理：确认交易完成（B1/B2 二次确认） */
  onConfirm(e: WechatMiniprogram.TouchEvent) {
    const no = e.currentTarget.dataset.no as string;
    if (!no) return;
    wx.showModal({
      title: '确认交易完成',
      content: '请确认已当面核验实物、货款已结清。一方确认后，另一方 24 小时无确认将自动完成。',
      confirmText: '确认完成',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await orderApi.confirmComplete(no);
          wx.showToast({ title: '已确认，等待对方确认', icon: 'none' });
          this.loadOrders(this.data.activeTab);
          this.loadBadge();
        } catch {
          /* 错误提示已在 request 层处理 */
        }
      },
    });
  },

  /** 代交接·核验中：查看代交接进度 */
  onViewRelay(e: WechatMiniprogram.TouchEvent) {
    const no = e.currentTarget.dataset.no as string;
    if (no) wx.navigateTo({ url: '/packageOrder/pages/relay/index?orderNo=' + encodeURIComponent(no) });
  },
});
