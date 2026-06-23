import { lockApi } from '../../../api/index';
import { withThousands } from '../../../utils/format';
import type { Listing } from '../../../types/api';

function num(s?: string) { return Number(String(s || '0').replace(/,/g, '')) || 0; }
const METAL_NAME: Record<string, string> = { gold: '黄金', silver: '白银', platinum: '铂金' };

Page({
  data: {
    listingId: '',
    item: null as (Listing & { avatarChar: string; metalName: string }) | null,
    qty: 0,
    portions: 1,
    maxPortions: 1,
    cashTotal: '0.00',
    transferTotal: '0.00',
    submitting: false,
  },

  onLoad(q: Record<string, string>) {
    this.setData({ listingId: q.id || 'L_88001' });
    this.load();
  },

  async load() {
    try {
      const raw = await lockApi.getListingDetail(this.data.listingId);
      const item = Object.assign({}, raw, {
        avatarChar: raw.seller.userMasked.charAt(0).toUpperCase(),
        metalName: METAL_NAME[raw.metal] || raw.metal,
      });
      let qty = 0;
      let maxPortions = 1;
      if (item.shipMode === 'whole_all') {
        qty = item.remainingWeight;
      } else if (item.shipMode === 'whole_fixed') {
        maxPortions = Math.max(1, Math.floor(item.remainingWeight / (item.lotSize || 1)));
        qty = item.lotSize || 0;
      } else {
        qty = item.minBatch || 1;
      }
      this.setData({ item, qty, portions: 1, maxPortions });
      this.calc();
    } catch { /* 错误提示已在 request 层 */ }
  },

  calc() {
    const it = this.data.item;
    if (!it) return;
    const qty = this.data.qty;
    const cash = num(it.refPriceCash) * qty;
    const trans = it.supportTransfer ? num(it.refPriceTransfer) * qty : 0;
    this.setData({
      cashTotal: withThousands(cash.toFixed(2)),
      transferTotal: withThousands(trans.toFixed(2)),
    });
  },

  onQtyInput(e: WechatMiniprogram.Input) {
    this.setData({ qty: Number(e.detail.value) || 0 });
    this.calc();
  },

  stepPortion(e: WechatMiniprogram.TouchEvent) {
    const it = this.data.item;
    if (!it) return;
    let p = this.data.portions + Number(e.currentTarget.dataset.d);
    p = Math.min(Math.max(1, p), this.data.maxPortions);
    this.setData({ portions: p, qty: p * (it.lotSize || 0) });
    this.calc();
  },

  fillMax() {
    const it = this.data.item;
    if (!it) return;
    this.setData({ qty: it.remainingWeight });
    this.calc();
  },

  async onConfirm() {
    const it = this.data.item;
    if (!it || this.data.submitting) return;
    if (this.data.qty <= 0) { wx.showToast({ title: '请输入数量', icon: 'none' }); return; }
    this.setData({ submitting: true });
    try {
      await lockApi.submitLock({
        listingId: this.data.listingId,
        shipMode: it.shipMode,
        qty: this.data.qty,
        payMethod: 'cash',
        snapshotVersion: 'mock',
      });
      wx.showToast({ title: '锁价已提交（Mock）', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1200);
    } catch { /* */ } finally {
      this.setData({ submitting: false });
    }
  },
});
