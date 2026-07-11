import { marketApi } from '../../api/index';
import { requireEligibility } from '../../utils/guard';
import { moqText } from '../../utils/format';
import type { Listing, PriceSnapshot, Metal } from '../../types/api';

type QuoteView = PriceSnapshot & { quoteTimeText?: string };
type ListingView = Listing & { avatarChar: string; levelTier: 'hi' | 'mid' | 'lo'; moqText: string };
type MetalTab = { key: Metal; label: string };
type SortKey = 'price' | 'stock' | 'level';

/** 由等级数字推算徽标档位（>=7 高 / >=4 中 / 否则 低） */
function tier(n: number): 'hi' | 'mid' | 'lo' {
  return n >= 7 ? 'hi' : n >= 4 ? 'mid' : 'lo';
}

Page({
  data: {
    metalTabs: [
      { key: 'gold', label: '黄金' },
      { key: 'silver', label: '白银' },
      { key: 'platinum', label: '铂金' },
    ] as MetalTab[],
    metal: 'gold' as Metal,
    quote: null as QuoteView | null,
    listings: [] as ListingView[],

    // 排序栏 + 结果计数
    sortOptions: [
      { key: 'price', label: '价格' },
      { key: 'stock', label: '库存' },
      { key: 'level', label: '等级' },
    ] as { key: SortKey; label: string }[],
    sortKey: 'price' as SortKey,
    sortDir: 'desc' as 'asc' | 'desc',
    total: 0,

    // 分页 / 加载态
    page: 1,
    hasMore: false,
    loading: true,
    loadingMore: false,
  },

  onLoad() {
    this.loadAll();
  },

  onPullDownRefresh() {
    this.loadAll(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    this.loadMore();
  },

  buildParams() {
    return { metal: this.data.metal, sort: `${this.data.sortKey}_${this.data.sortDir}` };
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

  /** 切换金属：更新选中态并重新拉取行情 + 挂单 */
  onMetal(e: WechatMiniprogram.TouchEvent) {
    const metal = e.currentTarget.dataset.metal as Metal;
    if (metal === this.data.metal) return;
    this.setData({ metal });
    this.loadAll();
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

  /** 按当前金属拉取大盘报价与挂单列表（重置分页） */
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

  /** 仅重拉挂单（排序变化，行情不变，重置分页） */
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

  /** 挂单「锁价」：静默校验资质，通过则进入买家锁价分包 */
  async onLock(e: WechatMiniprogram.CustomEvent) {
    const listingId = (e.detail as { listingId: string }).listingId;
    if (await requireEligibility('lock')) {
      wx.navigateTo({ url: `/packageLock/pages/lock/index?id=${listingId}` });
    }
  },
});
