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
    qtyStr: '',
    portions: 1,
    maxPortions: 1,
    cashTotal: '0.00',
    transferTotal: '0.00',
    showKeypad: false,
    showConfirm: false,
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
      if (item.shipMode === 'whole_all') qty = item.remainingWeight;
      else if (item.shipMode === 'whole_fixed') {
        maxPortions = Math.max(1, Math.floor(item.remainingWeight / (item.lotSize || 1)));
        qty = item.lotSize || 0;
      } else qty = item.minBatch || 1;
      this.setData({ item, qty, qtyStr: String(qty), portions: 1, maxPortions });
      this.calc();
    } catch { /* request 层已提示 */ }
  },

  calc() {
    const it = this.data.item;
    if (!it) return;
    const qty = this.data.qty;
    const cash = num(it.refPriceCash) * qty;
    const trans = it.supportTransfer ? num(it.refPriceTransfer) * qty : 0;
    this.setData({ cashTotal: withThousands(cash.toFixed(2)), transferTotal: withThousands(trans.toFixed(2)) });
  },

  /** 散出：弹自建数字键盘 */
  openKeypad() {
    if (this.data.item && this.data.item.shipMode === 'bulk') this.setData({ showKeypad: true });
  },
  closeKeypad() { this.setData({ showKeypad: false }); },
  onKeypad(e: WechatMiniprogram.CustomEvent) {
    const v = (e.detail as { value: string }).value;
    this.setData({ qtyStr: v, qty: Number(v) || 0 });
    this.calc();
  },

  stepPortion(e: WechatMiniprogram.TouchEvent) {
    const it = this.data.item;
    if (!it) return;
    let p = this.data.portions + Number(e.currentTarget.dataset.d);
    p = Math.min(Math.max(1, p), this.data.maxPortions);
    const qty = p * (it.lotSize || 0);
    this.setData({ portions: p, qty, qtyStr: String(qty) });
    this.calc();
  },

  fillMax() {
    const it = this.data.item;
    if (!it) return;
    this.setData({ qty: it.remainingWeight, qtyStr: String(it.remainingWeight), showKeypad: false });
    this.calc();
  },

  /** 确认锁价 → 弹确认单 */
  onReview() {
    if (!this.data.item) return;
    if (this.data.qty <= 0) { wx.showToast({ title: '请输入数量', icon: 'none' }); return; }
    this.setData({ showConfirm: true });
  },
  closeConfirm() { this.setData({ showConfirm: false }); },

  /** 提交锁价 → 跳处理结果页 */
  async onSubmit() {
    const it = this.data.item;
    if (!it || this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const res = await lockApi.submitLock({
        listingId: this.data.listingId,
        shipMode: it.shipMode,
        qty: this.data.qty,
        payMethod: 'cash',
        snapshotVersion: 'mock',
      });
      this.setData({ showConfirm: false });
      wx.redirectTo({ url: '/packageLock/pages/result/index?lockOrderId=' + (res.lockOrderId || 'LK_900001') });
    } catch { /* */ } finally {
      this.setData({ submitting: false });
    }
  },
});
