import { marketApi } from '../../api/index';
import { requireEligibility } from '../../utils/guard';
import { moqText } from '../../utils/format';
import type { Listing, PriceSnapshot } from '../../types/api';

function tier(n: number): 'hi' | 'mid' | 'lo' {
  return n >= 7 ? 'hi' : n >= 4 ? 'mid' : 'lo';
}

Page({
  data: {
    quote: null as (PriceSnapshot & { quoteTimeText?: string }) | null,
    listings: [] as Array<Listing & { avatarChar: string; levelTier: string; moqText: string }>,
    chips: ['全部', '整出', '散出', '板料', '金条', '旧料'],
    activeChip: '全部',
    loading: true,
  },

  onLoad() {
    this.loadAll();
  },

  onPullDownRefresh() {
    this.loadAll(() => wx.stopPullDownRefresh());
  },

  async loadAll(done?: () => void) {
    this.setData({ loading: true });
    try {
      const [quote, page] = await Promise.all([
        marketApi.getQuote('gold'),
        marketApi.getListings(),
      ]);

      const quoteView = Object.assign({}, quote, {
        quoteTimeText: String(quote.quoteTime).replace('T', ' ').replace(/\+.*$/, ''),
      });

      const listings = (page.list || []).map((it) => {
        const num = Number(it.seller.level.replace('L', ''));
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

  onChip(e: WechatMiniprogram.TouchEvent) {
    const chip = e.currentTarget.dataset.chip as string;
    this.setData({ activeChip: chip });
    // TODO: 按筛选条件重新拉取列表（接后端时补 params）
  },

  onSubscribe() {
    wx.navigateTo({ url: '/packageMine/pages/price-alert/index' });
  },

  async onLock(e: WechatMiniprogram.CustomEvent) {
    const listingId = (e.detail as { listingId: string }).listingId;
    // 静默校验：缺资质则跳「我的」补全；通过则进入买家锁价
    if (await requireEligibility('lock')) {
      wx.navigateTo({ url: `/packageLock/pages/lock/index?id=${listingId}` });
    }
  },
});
