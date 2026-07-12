import { publishApi } from '../../../api/index';
import { BizError } from '../../../utils/request';

/** 金属 / 货品性质 / 出货方式 / 定价模式 选项（value 与后端枚举一致） */
const METALS = [
  { value: 'gold', label: '黄金' },
  { value: 'silver', label: '白银' },
  { value: 'platinum', label: '铂金' },
];
// F1 品类枚举：板料 / 金条·银条·铂条 / 旧料（label 与顺序对齐设计）
const CATEGORIES = [
  { value: 'plate', label: '板料' },
  { value: 'bar', label: '金条·银条·铂条' },
  { value: 'scrap', label: '旧料' },
];
// F3 出货方式采用两级结构（设计屏2/屏3）：
//   顶层 整出 / 散出；整出下再分「全数量整出→whole_all」「固定克重整出→whole_fixed」；散出→bulk
//   shipMode 仍直接保存后端枚举（whole_all / whole_fixed / bulk），提交逻辑不变
// F7 定价模式：大盘价+溢价(spot) / 一口固定价(fixed)，互斥
const PRICE_MODES = [
  { value: 'spot', label: '大盘价+溢价' },
  { value: 'fixed', label: '一口固定价' },
];

/** 确认发布清单汇总（提交前二次确认展示用） */
interface Summary {
  goodsName: string;
  categoryText: string; // 黄金 · 旧料
  qtyText: string;      // 10000g
  shipText: string;     // 整出全量 / 整出固量 1000g/份 / 散出 1g 起
  priceText: string;    // 大盘价 +2.5 现金 / 大盘价 +3.5 转账
  floorText: string;    // 未设置 / 12.00 元/克
  payText: string;      // 现金 / 转账 · 仅现金
}

interface PageData {
  // —— 资质 ——
  /** 资质拉取完成（用于控制提示条渲染时机） */
  eligibilityLoaded: boolean;
  /** 是否需要展示补全提示条（实名/联系方式/保证金任一缺失） */
  needComplete: boolean;
  /** 可发布上限（g），用于数量输入提示与超限校验 */
  maxQty: number;
  /** 可发布下限（g），仅展示参考 */
  minQty: number;

  // —— 选项常量（透传给 WXML 渲染 segment / chips） ——
  metals: typeof METALS;
  categories: typeof CATEGORIES;
  priceModes: typeof PRICE_MODES;

  // —— 表单值 ——
  metal: string;
  category: string;
  goodsName: string;      // 商品名称（商家自填，必填 F）
  quantity: string;       // input type=digit，保留字符串再转数字（提交为 totalWeight）
  shipMode: string;
  lotSize: string;        // 整出固量：每份克重
  minBatch: string;       // 散出：起批量(g)
  priceMode: string;

  // 大盘价 + 溢价
  cashSign: '+' | '-';        // 现金溢价符号
  cashPremium: string;        // 现金溢价数值
  transferSign: '+' | '-';    // 转账溢价符号
  transferPremium: string;    // 转账溢价数值
  floorPrice: string;         // 最低防守价（选填）

  // 一口固定价
  cashFixed: string;
  transferFixed: string;

  // 通用
  noTransfer: boolean;        // 不支持转账
  images: string[];
  agreedRules: boolean;
  submitting: boolean;

  // 报价「整卡跳转详选」（设计屏4/屏5）：主体只显示纯文本总结，详细设置在底部弹窗内
  showPriceSheet: boolean;
  priceSummary: string;       // 报价文本总结
  floorSummary: string;       // 最低防守价文本总结
  paySummary: string;         // 收款方式文本总结

  // 确认发布清单弹窗
  showConfirm: boolean;
  summary: Summary | null;
}

interface PageCustom {
  loadEligibility(): Promise<void>;
  onMetal(e: WechatMiniprogram.TouchEvent): void;
  onCategory(e: WechatMiniprogram.TouchEvent): void;
  onGoodsName(e: WechatMiniprogram.Input): void;
  onQuantity(e: WechatMiniprogram.Input): void;
  onShipTop(e: WechatMiniprogram.TouchEvent): void;   // 顶层：整出 / 散出
  onShipSub(e: WechatMiniprogram.TouchEvent): void;   // 整出下：全数量 / 固定克重
  onLotSize(e: WechatMiniprogram.Input): void;
  onMinBatch(e: WechatMiniprogram.Input): void;
  onPriceMode(e: WechatMiniprogram.TouchEvent): void;
  onCashSign(): void;
  onTransferSign(): void;
  onCashPremium(e: WechatMiniprogram.Input): void;
  onTransferPremium(e: WechatMiniprogram.Input): void;
  onFloorPrice(e: WechatMiniprogram.Input): void;
  onCashFixed(e: WechatMiniprogram.Input): void;
  onTransferFixed(e: WechatMiniprogram.Input): void;
  onPriceBlur(e: WechatMiniprogram.Input): void;      // 报价类输入 blur 时规整为 3 位小数
  onToggleNoTransfer(e: WechatMiniprogram.SwitchChange): void;
  onImages(e: WechatMiniprogram.CustomEvent<{ value: string[] }>): void;
  onToggleAgree(): void;
  openPriceSheet(): void;
  closePriceSheet(): void;
  refreshPriceSummary(): void;
  validate(): boolean;
  buildPriceText(): string;
  onSubmit(): void;
  closeConfirm(): void;
  doPublish(): Promise<void>;
  noop(): void;
}

/** 将报价类数值规整为 3 位小数字符串；空值原样返回（设计屏4/屏5「保留3位小数」） */
function fmt3(v: string): string {
  if (v === '' || v == null) return v;
  const n = Number(v);
  return isFinite(n) ? n.toFixed(3) : v;
}

Page<PageData, PageCustom>({
  data: {
    eligibilityLoaded: false,
    needComplete: false,
    maxQty: 0,
    minQty: 0,

    metals: METALS,
    categories: CATEGORIES,
    priceModes: PRICE_MODES,

    metal: 'gold',
    category: '',
    goodsName: '',
    quantity: '',
    shipMode: 'whole_all',
    lotSize: '',
    minBatch: '',
    priceMode: 'spot',

    cashSign: '+',
    cashPremium: '',
    transferSign: '+',
    transferPremium: '',
    floorPrice: '',

    cashFixed: '',
    transferFixed: '',

    noTransfer: false,
    images: [],
    agreedRules: false,
    submitting: false,

    showPriceSheet: false,
    priceSummary: '',
    floorSummary: '未设置（选填）',
    paySummary: '现金 / 转账',

    showConfirm: false,
    summary: null,
  } as PageData,

  onLoad() {
    this.loadEligibility();
    // 初始化报价总结（主体卡片纯文本展示）
    this.refreshPriceSummary();
  },

  /** 拉取发布资质：任一资质项缺失则提示补全（不强制阻断发布流程） */
  async loadEligibility() {
    try {
      const e = await publishApi.getEligibility();
      const needComplete = !e.realName || !e.contact || !e.marginOk;
      this.setData({
        eligibilityLoaded: true,
        needComplete,
        maxQty: e.maxQty || 0,
        minQty: e.minQty || 0,
      });
    } catch {
      // 资质接口异常：错误提示已在 request 层弹出，这里只标记加载完成
      this.setData({ eligibilityLoaded: true });
    }
  },

  // —— segment / chips 选择 ——
  onMetal(e) {
    this.setData({ metal: e.currentTarget.dataset.v as string });
  },
  onCategory(e) {
    this.setData({ category: e.currentTarget.dataset.v as string });
  },
  // 顶层出货方式：整出 / 散出。切到「整出」默认落到「全数量整出」，切到「散出」为 bulk
  onShipTop(e) {
    const top = e.currentTarget.dataset.v as string; // 'whole' | 'bulk'
    if (top === 'bulk') {
      this.setData({ shipMode: 'bulk' });
    } else if (this.data.shipMode === 'bulk') {
      this.setData({ shipMode: 'whole_all' });
    }
  },
  // 整出二级：全数量整出(whole_all) / 固定克重整出(whole_fixed)
  onShipSub(e) {
    this.setData({ shipMode: e.currentTarget.dataset.v as string });
  },
  onPriceMode(e) {
    this.setData({ priceMode: e.currentTarget.dataset.v as string });
  },

  // —— 输入 ——
  onGoodsName(e) { this.setData({ goodsName: e.detail.value }); },
  onQuantity(e) { this.setData({ quantity: e.detail.value }); },
  onLotSize(e) { this.setData({ lotSize: e.detail.value }); },
  onMinBatch(e) { this.setData({ minBatch: e.detail.value }); },
  onCashPremium(e) { this.setData({ cashPremium: e.detail.value }); },
  onTransferPremium(e) { this.setData({ transferPremium: e.detail.value }); },
  onFloorPrice(e) { this.setData({ floorPrice: e.detail.value }); },
  onCashFixed(e) { this.setData({ cashFixed: e.detail.value }); },
  onTransferFixed(e) { this.setData({ transferFixed: e.detail.value }); },

  // 报价类输入 blur：规整为 3 位小数展示（溢价 / 防守价 / 一口价共用，data-k 指定字段）
  onPriceBlur(e) {
    const key = e.currentTarget.dataset.k as keyof PageData;
    const formatted = fmt3(e.detail.value);
    if (formatted === '') return;
    this.setData({ [key]: formatted } as Partial<PageData>);
  },

  // —— 溢价符号切换 ——
  onCashSign() {
    this.setData({ cashSign: this.data.cashSign === '+' ? '-' : '+' });
  },
  onTransferSign() {
    this.setData({ transferSign: this.data.transferSign === '+' ? '-' : '+' });
  },

  // —— 不支持转账开关 ——
  onToggleNoTransfer(e) {
    this.setData({ noTransfer: e.detail.value });
  },

  // —— 图片（uploader bind:change，detail.value 为最新数组）——
  onImages(e) {
    this.setData({ images: e.detail.value || [] });
  },

  // —— 同意发布规则 ——
  onToggleAgree() {
    this.setData({ agreedRules: !this.data.agreedRules });
  },

  // —— 报价详选底部弹窗 ——
  openPriceSheet() {
    this.setData({ showPriceSheet: true });
  },
  /** 关闭详选弹窗（确认价格 / 遮罩关闭共用）：回写主体三行纯文本总结 */
  closePriceSheet() {
    this.refreshPriceSummary();
    this.setData({ showPriceSheet: false });
  },
  /** 根据当前定价数据刷新「报价 / 最低防守价 / 收款方式」总结文案 */
  refreshPriceSummary() {
    const d = this.data;
    const floorSummary = d.priceMode === 'spot' && d.floorPrice
      ? `${fmt3(d.floorPrice)} 元/克`
      : '未设置（选填）';
    this.setData({
      priceSummary: this.buildPriceText(),
      floorSummary,
      paySummary: d.noTransfer ? '仅现金' : '现金 / 转账',
    });
  },

  /** 表单校验：通过返回 true，失败弹 toast 并返回 false */
  validate(): boolean {
    const d = this.data;
    const qty = Number(d.quantity);

    if (!d.category) { wx.showToast({ title: '请选择货品性质', icon: 'none' }); return false; }
    if (!d.goodsName.trim()) { wx.showToast({ title: '请填写商品名称', icon: 'none' }); return false; }
    if (!(qty > 0)) { wx.showToast({ title: '请填写数量', icon: 'none' }); return false; }
    // 数量 ≤ 可发布上限（超限提示补足保证金；maxQty 未知/为 0 时不硬拦截）
    if (d.maxQty > 0 && qty > d.maxQty) {
      wx.showToast({ title: `超出可发布上限 ${d.maxQty}g，请补足保证金`, icon: 'none' });
      return false;
    }
    // 整出固量：每份克重 >0 且 ≤ 总数量
    if (d.shipMode === 'whole_fixed') {
      const lot = Number(d.lotSize);
      if (!(lot > 0)) { wx.showToast({ title: '请填写每份克重', icon: 'none' }); return false; }
      if (lot > qty) { wx.showToast({ title: '每份克重不能超过总数量', icon: 'none' }); return false; }
    }
    // 散出：起批量 ≥1 且 ≤ 总数量（F4）
    if (d.shipMode === 'bulk') {
      const mb = Number(d.minBatch);
      if (!(mb >= 1)) { wx.showToast({ title: '起批量需 ≥ 1g', icon: 'none' }); return false; }
      if (mb > qty) { wx.showToast({ title: '起批量不能超过总数量', icon: 'none' }); return false; }
    }
    // 定价校验
    if (d.priceMode === 'spot') {
      // F5：现货溢价范围 ±50 元/克
      const cash = Number(d.cashPremium || 0);
      if (cash > 50) { wx.showToast({ title: '溢价范围为 ±50 元/克', icon: 'none' }); return false; }
      if (!d.noTransfer) {
        const trans = Number(d.transferPremium || 0);
        if (trans > 50) { wx.showToast({ title: '溢价范围为 ±50 元/克', icon: 'none' }); return false; }
      }
    } else {
      // 一口固定价：现金价必填 >0
      if (!(Number(d.cashFixed) > 0)) { wx.showToast({ title: '请填写现金一口价', icon: 'none' }); return false; }
    }
    if (d.images.length < 1) { wx.showToast({ title: '请至少上传 1 张图片', icon: 'none' }); return false; }
    if (!d.agreedRules) { wx.showToast({ title: '请勾选同意发布规则', icon: 'none' }); return false; }
    return true;
  },

  /** 组装「报价」文案（现金 / 转账合并，只选其一则只显示一个价） */
  buildPriceText(): string {
    const d = this.data;
    if (d.priceMode === 'spot') {
      const cashVal = Number(d.cashPremium || 0);
      const cash = `大盘价 ${d.cashSign}${cashVal} 现金`;
      if (d.noTransfer) return `${cash} / 不支持转账`;
      const transVal = Number(d.transferPremium || 0);
      return `${cash} / 大盘价 ${d.transferSign}${transVal} 转账`;
    }
    const cash = `${Number(d.cashFixed || 0)} 元/克 现金`;
    if (d.noTransfer) return `${cash} / 不支持转账`;
    return `${cash} / ${Number(d.transferFixed || 0)} 元/克 转账`;
  },

  /** 点「确认发布」：先校验，通过后组装摘要并弹「确认发布清单」（屏7） */
  onSubmit() {
    if (this.data.submitting) return;
    if (!this.validate()) return;

    const d = this.data;
    const metalLabel = METALS.find((m) => m.value === d.metal)?.label || '';
    const catLabel = CATEGORIES.find((c) => c.value === d.category)?.label || '';
    const qty = Number(d.quantity);
    let shipText = `全数量整出 ${qty}g`;
    if (d.shipMode === 'whole_fixed') shipText = `固定克重整出 ${Number(d.lotSize)}g/份`;
    else if (d.shipMode === 'bulk') shipText = `散出 ${Number(d.minBatch)}g 起`;

    const summary: Summary = {
      goodsName: d.goodsName.trim(),
      categoryText: `${metalLabel} · ${catLabel}`,
      qtyText: `${qty}g`,
      shipText,
      priceText: this.buildPriceText(),
      floorText: d.priceMode === 'spot' && d.floorPrice ? `${Number(d.floorPrice)} 元/克` : '未设置',
      payText: d.noTransfer ? '仅现金' : '现金 / 转账',
    };
    this.setData({ summary, showConfirm: true });
  },

  /** 返回修改：关闭确认弹窗 */
  closeConfirm() {
    this.setData({ showConfirm: false });
  },

  noop() {},

  /** 确认发布：组装扁平化 body → 提交 → 跳结果页（对齐后端契约） */
  async doPublish() {
    if (this.data.submitting) return;
    const d = this.data;

    // 溢价带符号合成
    const signed = (sign: '+' | '-', v: string) => (sign === '-' ? -Number(v || 0) : Number(v || 0));
    const supportTransfer = !d.noTransfer;

    const body: Record<string, unknown> = {
      metal: d.metal,
      category: d.category,
      goodsName: d.goodsName.trim(),
      totalWeight: Number(d.quantity),
      shipMode: d.shipMode,
      priceMode: d.priceMode,
      supportTransfer,
      images: d.images,
    };
    if (d.shipMode === 'whole_fixed') body.lotSize = Number(d.lotSize);
    if (d.shipMode === 'bulk') body.minBatch = Number(d.minBatch);

    if (d.priceMode === 'spot') {
      // 现货：带符号现金溢价 + 转账溢价（不支持转账则 null）+ 最低防守价
      body.premiumCash = signed(d.cashSign, d.cashPremium);
      body.premiumTransfer = supportTransfer ? signed(d.transferSign, d.transferPremium) : null;
      if (d.floorPrice) body.floorPrice = Number(d.floorPrice);
    } else {
      // 一口固定价：现金一口价 + 转账一口价（不支持转账则 null）
      body.refPriceCash = Number(d.cashFixed || 0);
      body.refPriceTransfer = supportTransfer ? Number(d.transferFixed || 0) : null;
    }

    this.setData({ submitting: true });
    try {
      const res = await publishApi.submit(body);
      const status = res.status === 'failed' ? 'err' : 'ok';
      // 结果页摘要（成功卡）通过本地存储传递，避免超长 query
      wx.setStorageSync('publishResult', {
        status,
        goods: `${this.data.summary?.categoryText || ''} · ${Number(d.quantity)}g`,
        ship: this.data.summary?.shipText || '',
        price: this.data.summary?.priceText || '',
      });
      this.setData({ showConfirm: false });
      wx.navigateTo({ url: `/packagePublish/pages/result/index?status=${status}` });
    } catch (err) {
      // 失败：透传失败原因 / 错误码到结果页
      const failReason = err instanceof BizError ? err.message : '网络异常，请稍后重试';
      const errorCode = err instanceof BizError && err.bizCode ? err.bizCode : '—';
      wx.setStorageSync('publishResult', { status: 'err', failReason, errorCode });
      this.setData({ showConfirm: false });
      wx.navigateTo({ url: '/packagePublish/pages/result/index?status=err' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
