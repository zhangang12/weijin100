import { lockApi } from '../../../api/index';
import { withThousands, formatWeight, fenToYuan } from '../../../utils/format';
import { requireEligibility } from '../../../utils/guard';
import type { Listing, Metal } from '../../../types/api';

function num(s?: string) { return Number(String(s || '0').replace(/,/g, '')) || 0; }
const METAL_NAME: Record<string, string> = { gold: '黄金', silver: '白银', platinum: '铂金' };

Page({
  data: {
    listingId: '',
    item: null as (Listing & { avatarChar: string; metalName: string }) | null,
    qty: 0,
    qtyStr: '',
    qtyDisplay: '0.00',   // 千分位两位小数展示
    qtyScene: '',         // 确认单「数量」带场景文案
    portions: 1,
    maxPortions: 1,
    cashTotal: '0.00',
    transferTotal: '0.00',
    orderTotal: '0.00',   // 当前付款方式对应的订单总价
    payMethod: 'cash' as 'cash' | 'transfer',
    // 可购买上限软约束卡
    limitLoaded: false,
    buyerLevel: '',
    depositYuan: '0.00',
    maxBuyableQty: 0,
    overLimit: false,
    // 数量硬校验（散出）
    qtyValid: true,
    qtyError: '',
    // UI 态
    showKeypad: false,
    showConfirm: false,
    agreed: false,
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
      this.setData({
        item, qty, qtyStr: String(qty), portions: 1, maxPortions,
        // 不支持转账的挂单锁定为现金
        payMethod: item.supportTransfer ? this.data.payMethod : 'cash',
      });
      this.calc();
      this.validate();
      this.loadLimit(item.metal);
    } catch { /* request 层已提示 */ }
  },

  /** 可购买上限（软约束卡）：级别 / 保证金 / 可购买总量 */
  async loadLimit(metal: Metal) {
    try {
      const lim = await lockApi.getBuyerLimit(metal);
      this.setData({
        limitLoaded: true,
        buyerLevel: lim.buyerLevel,
        depositYuan: fenToYuan(lim.deposit), // deposit 为分，展示除以 100
        maxBuyableQty: lim.maxBuyableQty,
      });
      this.checkOverLimit();
    } catch { /* 软约束加载失败不阻断锁价 */ }
  },

  calc() {
    const it = this.data.item;
    if (!it) return;
    const qty = this.data.qty;
    const cash = num(it.refPriceCash) * qty;
    const trans = it.supportTransfer ? num(it.refPriceTransfer) * qty : 0;
    const cashTotal = withThousands(cash.toFixed(2));
    const transferTotal = withThousands(trans.toFixed(2));
    const orderTotal = this.data.payMethod === 'transfer' ? transferTotal : cashTotal;
    const qtyDisplay = formatWeight(qty, 2);
    let qtyScene = '';
    if (it.shipMode === 'whole_all') qtyScene = `${qtyDisplay} g（整出全量）`;
    else if (it.shipMode === 'whole_fixed') qtyScene = `${qtyDisplay} g（整出固量 ${this.data.portions} 份）`;
    else qtyScene = `${qtyDisplay} g（散出）`;
    this.setData({ cashTotal, transferTotal, orderTotal, qtyDisplay, qtyScene });
    this.checkOverLimit();
  },

  /** 软约束：当前数量是否超可购买上限（不阻断提交，仅红字提示 + 补足入口） */
  checkOverLimit() {
    if (!this.data.limitLoaded) return;
    const over = this.data.qty > this.data.maxBuyableQty;
    if (over !== this.data.overLimit) this.setData({ overLimit: over });
  },

  /** 散出数量硬校验：≥ 起批量、≤ 剩余库存 */
  validate() {
    const it = this.data.item;
    if (!it) { this.setData({ qtyValid: false, qtyError: '' }); return; }
    let valid = true;
    let err = '';
    if (it.shipMode === 'bulk') {
      const min = it.minBatch || 1;
      const max = it.remainingWeight;
      const q = this.data.qty;
      if (!q || q <= 0) { valid = false; err = '请输入锁定克重'; }
      else if (q < min) { valid = false; err = `低于起批量 ${formatWeight(min)}g`; }
      else if (q > max) { valid = false; err = `超出剩余库存 ${formatWeight(max)}g`; }
    }
    this.setData({ qtyValid: valid, qtyError: err });
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
    this.validate();
  },

  stepPortion(e: WechatMiniprogram.TouchEvent) {
    const it = this.data.item;
    if (!it) return;
    let p = this.data.portions + Number(e.currentTarget.dataset.d);
    p = Math.min(Math.max(1, p), this.data.maxPortions);
    const qty = p * (it.lotSize || 0);
    this.setData({ portions: p, qty, qtyStr: String(qty) });
    this.calc();
    this.validate();
  },

  fillMax() {
    const it = this.data.item;
    if (!it) return;
    this.setData({ qty: it.remainingWeight, qtyStr: String(it.remainingWeight), showKeypad: false });
    this.calc();
    this.validate();
  },

  /** 付款方式切换（仅支持转账的挂单可选转账） */
  choosePay(e: WechatMiniprogram.TouchEvent) {
    const it = this.data.item;
    if (!it) return;
    const m = e.currentTarget.dataset.m as 'cash' | 'transfer';
    if (m === 'transfer' && !it.supportTransfer) return;
    if (m === this.data.payMethod) return;
    this.setData({ payMethod: m });
    this.calc();
  },

  /** 补足保证金 → 「我的 - 保证金充值」（inline 路由，非弹窗） */
  goRecharge() {
    wx.navigateTo({ url: '/packageMine/pages/margin-recharge/index', fail: () => {} });
  },

  /** 确认锁价 → 先静默校验资质，再弹确认单（pin7 核心交互） */
  async onReview() {
    const it = this.data.item;
    if (!it) return;
    if (!this.data.qtyValid) {
      wx.showToast({ title: this.data.qtyError || '请检查锁定数量', icon: 'none' });
      return;
    }
    // pin7：静默校验，返回 false 表示已被拦截并自动跳「我的」补全页
    const ok = await requireEligibility('lock');
    if (!ok) return;
    this.setData({ agreed: false, showConfirm: true });
  },
  closeConfirm() { this.setData({ showConfirm: false }); },
  toggleAgree() { this.setData({ agreed: !this.data.agreed }); },

  /** 提交锁价 → 跳处理结果页；失败（如库存被抢）跳失败结果页 */
  async onSubmit() {
    const it = this.data.item;
    if (!it || this.data.submitting) return;
    if (!this.data.agreed) { wx.showToast({ title: '请先勾选并同意锁价约定', icon: 'none' }); return; }
    this.setData({ submitting: true });
    const ctx = this.buildResultCtx();
    try {
      const res = await lockApi.submitLock({
        listingId: this.data.listingId,
        weight: this.data.qty,       // 新签名：weight（不是 qty/shipMode/snapshotVersion）
        payMethod: this.data.payMethod,
      });
      this.setData({ showConfirm: false, submitting: false });
      wx.redirectTo({ url: `/packageLock/pages/result/index?lockOrderId=${encodeURIComponent(res.lockOrderId || '')}&${ctx}` });
    } catch (err) {
      // 提交即失败（库存已被抢 LISTING_SOLD 等）→ 跳失败结果页并带 failReason，不停留在锁价页
      this.setData({ showConfirm: false, submitting: false });
      const e = err as { bizCode?: string; message?: string };
      const reason = e && e.bizCode === 'LISTING_SOLD' ? '订单已被抢走'
        : e && e.message ? e.message : '锁价失败，请稍后重试';
      wx.redirectTo({ url: `/packageLock/pages/result/index?status=failed&failReason=${encodeURIComponent(reason)}&${ctx}` });
    }
  },

  /** 结果页富卡片所需上下文，随 URL 带入 */
  buildResultCtx(): string {
    const it = this.data.item;
    if (!it) return '';
    return [
      `goods=${encodeURIComponent(it.metalName + '·' + it.category)}`,
      `weight=${encodeURIComponent(this.data.qtyDisplay)}`,
      `avatar=${encodeURIComponent(it.avatarChar)}`,
      `seller=${encodeURIComponent(it.seller.userMasked)}`,
      `level=${encodeURIComponent(it.seller.level)}`,
      `pay=${this.data.payMethod}`,
      `cash=${encodeURIComponent(this.data.cashTotal)}`,
      `transfer=${encodeURIComponent(this.data.transferTotal)}`,
      `support=${it.supportTransfer ? '1' : '0'}`,
    ].join('&');
  },
});
