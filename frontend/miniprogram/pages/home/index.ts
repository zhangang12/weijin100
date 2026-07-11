import { marketApi, alertApi } from '../../api/index';
import { requireEligibility } from '../../utils/guard';
import { ensureLogin } from '../../utils/auth';
import { moqText, withThousands } from '../../utils/format';
import { MarketSocket } from '../../utils/market.socket';
import { USE_MOCK } from '../../config/env';
import type { Listing, PriceSnapshot, Metal } from '../../types/api';

type QuoteView = PriceSnapshot & { quoteTimeText?: string };
type ListingView = Listing & { avatarChar: string; levelTier: 'hi' | 'mid' | 'lo'; moqText: string };
type MetalTab = { key: Metal; label: string };
type SortKey = 'price' | 'stock' | 'level';
type Cond = 'above' | 'below';

/** 由等级数字推算徽标档位（>=7 高 / >=4 中 / 否则 低） */
function tier(n: number): 'hi' | 'mid' | 'lo' {
  return n >= 7 ? 'hi' : n >= 4 ? 'mid' : 'lo';
}

/** 价格字符串（可能含千分位）→ 数字 */
function toNum(price?: string | number): number {
  return parseFloat(String(price ?? '').replace(/,/g, '')) || 0;
}

Page({
  data: {
    // —— 品类折页 Tab（屏1批注5）——
    metalTabs: [
      { key: 'gold', label: '黄金' },
      { key: 'silver', label: '白银' },
      { key: 'platinum', label: '铂金' },
    ] as MetalTab[],
    metal: 'gold' as Metal,

    quote: null as QuoteView | null,
    listings: [] as ListingView[],

    // —— 筛选条 ——
    chips: ['全部', '整出', '散出', '板料', '金条', '旧料'],
    activeChip: '全部',

    // —— 排序栏（屏3批注2）——
    sortOptions: [
      { key: 'price', label: '价格' },
      { key: 'stock', label: '库存' },
      { key: 'level', label: '等级' },
    ] as { key: SortKey; label: string }[],
    sortKey: 'price' as SortKey,
    sortDir: 'desc' as 'asc' | 'desc',
    total: 0,

    // —— 分页 / 加载态 ——
    page: 1,
    hasMore: false,
    loading: true,
    loadingMore: false,

    // —— 订阅底部弹窗（屏4）——
    sheetVisible: false,
    subMetal: 'gold' as Metal,
    subCurrentNum: 0,
    subCurrentText: '',
    subCond: 'above' as Cond,
    subQuick: '1' as '0.5' | '1' | '2' | 'manual',
    subTarget: '',
    subPush: true,
    subSms: false,
  },

  _ws: null as MarketSocket | null,

  onLoad() {
    this.loadAll();
    // 行情 WS：三品类全订阅，仅更新当前所选品类的大盘卡（游客亦可，onLoad 不触发登录）
    if (!USE_MOCK) {
      this._ws = new MarketSocket(['gold', 'silver', 'platinum'], (q) => {
        if (q.metal !== this.data.metal) return;
        const quoteTimeText = String(q.quoteTime).replace('T', ' ').replace(/\+.*$/, '');
        this.setData({ quote: Object.assign({}, q, { quoteTimeText }) });
      });
      this._ws.connect();
    }
  },

  onUnload() {
    this._ws?.close();
    this._ws = null;
  },

  onPullDownRefresh() {
    this.loadAll(() => wx.stopPullDownRefresh());
  },

  /** 上拉触底：加载下一页并追加 */
  onReachBottom() {
    this.loadMore();
  },

  /** 当前筛选 + 排序参数 */
  buildParams() {
    const chipParamMap: Record<string, { shipMode?: string; category?: string }> = {
      '全部': {},
      '整出': { shipMode: 'whole' },
      '散出': { shipMode: 'bulk' },
      '板料': { category: '板料' },
      '金条': { category: '金条' },
      '旧料': { category: '旧料' },
    };
    return {
      metal: this.data.metal,
      sort: `${this.data.sortKey}_${this.data.sortDir}`,
      ...(chipParamMap[this.data.activeChip] ?? {}),
    };
  },

  mapListings(list: Listing[]): ListingView[] {
    return (list || []).map((it) => {
      const num = Number(String(it.seller.level).replace('L', ''));
      return Object.assign({}, it, {
        avatarChar: it.seller.userMasked.charAt(0).toUpperCase(),
        levelTier: tier(num),
        moqText: moqText(it.shipMode, it.totalWeight, it.lotSize, it.minBatch),
      });
    });
  },

  /** 按当前品类拉取大盘报价 + 首页挂单（重置分页） */
  async loadAll(done?: () => void) {
    const metal = this.data.metal;
    this.setData({ loading: true });
    try {
      const [quote, page] = await Promise.all([
        marketApi.getQuote(metal),
        marketApi.getListings({ ...this.buildParams(), page: 1 }),
      ]);
      const quoteView: QuoteView = Object.assign({}, quote, {
        quoteTimeText: String(quote.quoteTime).replace('T', ' ').replace(/\+.*$/, ''),
      });
      this.setData({
        quote: quoteView,
        listings: this.mapListings(page.list),
        page: page.page,
        hasMore: page.hasMore,
        total: page.total,
        loading: false,
      });
    } catch {
      this.setData({ loading: false });
    }
    done && done();
  },

  /** 仅重拉挂单（筛选/排序变化，行情不变，重置分页） */
  async reloadListings() {
    this.setData({ loading: true });
    try {
      const page = await marketApi.getListings({ ...this.buildParams(), page: 1 });
      this.setData({
        listings: this.mapListings(page.list),
        page: page.page,
        hasMore: page.hasMore,
        total: page.total,
        loading: false,
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  /** 追加下一页 */
  async loadMore() {
    if (this.data.loadingMore || this.data.loading || !this.data.hasMore) return;
    const next = this.data.page + 1;
    this.setData({ loadingMore: true });
    try {
      const page = await marketApi.getListings({ ...this.buildParams(), page: next });
      this.setData({
        listings: this.data.listings.concat(this.mapListings(page.list)),
        page: page.page,
        hasMore: page.hasMore,
        total: page.total,
        loadingMore: false,
      });
    } catch {
      this.setData({ loadingMore: false });
    }
  },

  /** 切换品类折页：联动行情卡 + 列表 + 主题色 */
  onMetal(e: WechatMiniprogram.TouchEvent) {
    const metal = e.currentTarget.dataset.metal as Metal;
    if (metal === this.data.metal) return;
    this.setData({ metal });
    this.loadAll();
  },

  onChip(e: WechatMiniprogram.TouchEvent) {
    const chip = e.currentTarget.dataset.chip as string;
    if (chip === this.data.activeChip) return;
    this.setData({ activeChip: chip });
    this.reloadListings();
  },

  /** 排序：点同项切换升降，点它项换字段（默认降序） */
  onSort(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key as SortKey;
    if (key === this.data.sortKey) {
      this.setData({ sortDir: this.data.sortDir === 'desc' ? 'asc' : 'desc' });
    } else {
      this.setData({ sortKey: key, sortDir: 'desc' });
    }
    this.reloadListings();
  },

  // ———————————— 订阅底部弹窗（屏4）————————————

  /** 按目标价方向 + 快捷百分比算目标价（manual 不算） */
  computeTarget(cond: Cond, quick: string, base: number): string {
    if (quick === 'manual' || !(base > 0)) return this.data.subTarget;
    const pct = parseFloat(quick) / 100;
    const factor = cond === 'below' ? 1 - pct : 1 + pct;
    return withThousands((base * factor).toFixed(2));
  },

  onSubscribe() {
    const base = toNum(this.data.quote?.marketPrice);
    this.setData({
      sheetVisible: true,
      subMetal: this.data.metal,
      subCurrentNum: base,
      subCurrentText: base > 0 ? withThousands(base.toFixed(2)) : '--',
      subCond: 'above',
      subQuick: '1',
      subTarget: this.computeTarget('above', '1', base),
      subPush: true,
      subSms: false,
    });
  },

  closeSubscribe() {
    this.setData({ sheetVisible: false });
  },

  /** 阻止弹窗内容区点击穿透关闭 */
  noop() {},

  /** 弹窗内独立切品类：拉该品类现价重算目标价 */
  async onSubMetal(e: WechatMiniprogram.TouchEvent) {
    const metal = e.currentTarget.dataset.metal as Metal;
    if (metal === this.data.subMetal) return;
    this.setData({ subMetal: metal });
    try {
      const q = await marketApi.getQuote(metal);
      const base = toNum(q.marketPrice);
      this.setData({
        subCurrentNum: base,
        subCurrentText: base > 0 ? withThousands(base.toFixed(2)) : '--',
        subTarget: this.computeTarget(this.data.subCond, this.data.subQuick, base),
      });
    } catch {
      /* 保留原值 */
    }
  },

  onSubCond(e: WechatMiniprogram.TouchEvent) {
    const cond = e.currentTarget.dataset.cond as Cond;
    this.setData({
      subCond: cond,
      subTarget: this.computeTarget(cond, this.data.subQuick, this.data.subCurrentNum),
    });
  },

  onSubQuick(e: WechatMiniprogram.TouchEvent) {
    const quick = e.currentTarget.dataset.quick as '0.5' | '1' | '2' | 'manual';
    this.setData({
      subQuick: quick,
      subTarget: this.computeTarget(this.data.subCond, quick, this.data.subCurrentNum),
    });
  },

  /** 手动输入即切到「手动」态 */
  onSubInput(e: WechatMiniprogram.CustomEvent) {
    this.setData({ subTarget: (e.detail as { value: string }).value, subQuick: 'manual' });
  },

  onSubToggle(e: WechatMiniprogram.TouchEvent) {
    const ch = e.currentTarget.dataset.ch as 'push' | 'sms';
    if (ch === 'push') this.setData({ subPush: !this.data.subPush });
    else this.setData({ subSms: !this.data.subSms });
  },

  async submitSubscribe() {
    const target = toNum(this.data.subTarget);
    if (!(target > 0)) {
      wx.showToast({ title: '请输入有效目标价', icon: 'none' });
      return;
    }
    const channels: string[] = [];
    if (this.data.subPush) channels.push('push');
    if (this.data.subSms) channels.push('sms');
    if (channels.length === 0) {
      wx.showToast({ title: '请至少选择一种提醒方式', icon: 'none' });
      return;
    }
    try {
      // 提交为用户主动动作，按需登录（浏览行情/挂单仍免登录）
      await ensureLogin();
      await alertApi.create({
        metal: this.data.subMetal,
        condition: this.data.subCond,
        targetPrice: target.toFixed(2),
        channels,
      });
      this.setData({ sheetVisible: false });
      wx.showToast({ title: '已开启提醒', icon: 'success' });
    } catch {
      /* request 已统一 toast */
    }
  },

  async onLock(e: WechatMiniprogram.CustomEvent) {
    const listingId = (e.detail as { listingId: string }).listingId;
    // 静默校验：缺资质则跳「我的」补全；通过则进入买家锁价
    if (await requireEligibility('lock')) {
      wx.navigateTo({ url: `/packageLock/pages/lock/index?id=${listingId}` });
    }
  },
});
