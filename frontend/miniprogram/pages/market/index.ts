import { marketApi } from '../../api/index';
import { requireEligibility } from '../../utils/guard';
import { moqText } from '../../utils/format';
import type { Listing, PriceSnapshot, Metal } from '../../types/api';

type QuoteView = PriceSnapshot & { quoteTimeText?: string };
type ListingView = Listing & { avatarChar: string; levelTier: 'hi' | 'mid' | 'lo'; moqText: string };
type MetalTab = { key: Metal; label: string };

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
    loading: true,
  },

  onLoad() {
    this.loadAll();
  },

  onPullDownRefresh() {
    this.loadAll(() => wx.stopPullDownRefresh());
  },

  /** 切换金属：更新选中态并重新拉取行情 + 挂单 */
  onMetal(e: WechatMiniprogram.TouchEvent) {
    const metal = e.currentTarget.dataset.metal as Metal;
    if (metal === this.data.metal) return;
    this.setData({ metal });
    this.loadAll();
  },

  /** 按当前金属拉取大盘报价与挂单列表 */
  async loadAll(done?: () => void) {
    const metal = this.data.metal;
    this.setData({ loading: true });
    try {
      const [quote, page] = await Promise.all([
        marketApi.getQuote(metal),
        marketApi.getListings({ metal }),
      ]);

      const quoteView: QuoteView = Object.assign({}, quote, {
        quoteTimeText: String(quote.quoteTime).replace('T', ' ').replace(/\+.*$/, ''),
      });

      const listings: ListingView[] = (page.list || []).map((it) => {
        const num = Number(String(it.seller.level).replace('L', ''));
        return Object.assign({}, it, {
          avatarChar: it.seller.userMasked.charAt(0).toUpperCase(),
          levelTier: tier(num),
          moqText: moqText(it.shipMode, it.totalWeight, it.lotSize, it.minBatch),
        });
      });

      this.setData({ quote: quoteView, listings, loading: false });
    } catch {
      this.setData({ loading: false });
    }
    done && done();
  },

  /** 挂单「锁价」：静默校验资质，通过则进入买家锁价分包 */
  async onLock(e: WechatMiniprogram.CustomEvent) {
    const listingId = (e.detail as { listingId: string }).listingId;
    if (await requireEligibility('lock')) {
      wx.navigateTo({ url: `/packageLock/pages/lock/index?id=${listingId}` });
    }
  },
});
