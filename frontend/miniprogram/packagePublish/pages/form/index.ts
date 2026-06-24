import { publishApi } from '../../../api/index';

/** 金属 / 货品性质 / 出货方式 / 定价模式 选项（value 与后端约定一致） */
const METALS = [
  { value: 'gold', label: '黄金' },
  { value: 'silver', label: '白银' },
  { value: 'platinum', label: '铂金' },
];
const CATEGORIES = [
  { value: 'plate', label: '板料' },
  { value: 'bar', label: '金条' },
  { value: 'scrap', label: '旧料' },
];
const SHIP_MODES = [
  { value: 'whole_all', label: '整出全量' },
  { value: 'whole_fixed', label: '整出固量' },
  { value: 'scatter', label: '散出' },
];
const PRICE_MODES = [
  { value: 'market', label: '大盘价+溢价' },
  { value: 'fixed', label: '一口固定价' },
];

interface PageData {
  // —— 资质 ——
  /** 资质拉取完成（用于控制提示条渲染时机） */
  eligibilityLoaded: boolean;
  /** 是否需要展示补全提示条（实名/联系方式/保证金任一缺失） */
  needComplete: boolean;
  /** 可发布上限（g），用于数量输入提示 */
  maxQty: number;
  /** 可发布下限（g），仅展示参考 */
  minQty: number;

  // —— 选项常量（透传给 WXML 渲染 segment / chips） ——
  metals: typeof METALS;
  categories: typeof CATEGORIES;
  shipModes: typeof SHIP_MODES;
  priceModes: typeof PRICE_MODES;

  // —— 表单值 ——
  metal: string;
  category: string;
  quantity: string;       // input type=digit，保留字符串再转数字
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
}

interface PageCustom {
  loadEligibility(): Promise<void>;
  onMetal(e: WechatMiniprogram.TouchEvent): void;
  onCategory(e: WechatMiniprogram.TouchEvent): void;
  onQuantity(e: WechatMiniprogram.Input): void;
  onShipMode(e: WechatMiniprogram.TouchEvent): void;
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
  onToggleNoTransfer(e: WechatMiniprogram.SwitchChange): void;
  onImages(e: WechatMiniprogram.CustomEvent<{ value: string[] }>): void;
  onToggleAgree(): void;
  onSubmit(): Promise<void>;
}

Page<PageData, PageCustom>({
  data: {
    eligibilityLoaded: false,
    needComplete: false,
    maxQty: 0,
    minQty: 0,

    metals: METALS,
    categories: CATEGORIES,
    shipModes: SHIP_MODES,
    priceModes: PRICE_MODES,

    metal: 'gold',
    category: '',
    quantity: '',
    shipMode: 'whole_all',
    lotSize: '',
    minBatch: '',
    priceMode: 'market',

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
  } as PageData,

  onLoad() {
    this.loadEligibility();
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
  onShipMode(e) {
    this.setData({ shipMode: e.currentTarget.dataset.v as string });
  },
  onPriceMode(e) {
    this.setData({ priceMode: e.currentTarget.dataset.v as string });
  },

  // —— 输入 ——
  onQuantity(e) { this.setData({ quantity: e.detail.value }); },
  onLotSize(e) { this.setData({ lotSize: e.detail.value }); },
  onMinBatch(e) { this.setData({ minBatch: e.detail.value }); },
  onCashPremium(e) { this.setData({ cashPremium: e.detail.value }); },
  onTransferPremium(e) { this.setData({ transferPremium: e.detail.value }); },
  onFloorPrice(e) { this.setData({ floorPrice: e.detail.value }); },
  onCashFixed(e) { this.setData({ cashFixed: e.detail.value }); },
  onTransferFixed(e) { this.setData({ transferFixed: e.detail.value }); },

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

  /** 确认发布：必填校验从简 → 组装 body → 提交 → 跳结果页 */
  async onSubmit() {
    if (this.data.submitting) return;
    const d = this.data;

    // 必填项校验（数量 / 性质 / 图片≥1 / 同意规则）
    if (!d.category) { wx.showToast({ title: '请选择货品性质', icon: 'none' }); return; }
    if (!(Number(d.quantity) > 0)) { wx.showToast({ title: '请填写数量', icon: 'none' }); return; }
    if (d.shipMode === 'whole_fixed' && !(Number(d.lotSize) > 0)) {
      wx.showToast({ title: '请填写每份克重', icon: 'none' }); return;
    }
    if (d.shipMode === 'scatter' && !(Number(d.minBatch) >= 1)) {
      wx.showToast({ title: '起批量需 ≥ 1g', icon: 'none' }); return;
    }
    if (d.images.length < 1) { wx.showToast({ title: '请至少上传 1 张图片', icon: 'none' }); return; }
    if (!d.agreedRules) { wx.showToast({ title: '请勾选同意发布规则', icon: 'none' }); return; }

    // 组装价格：大盘价用「符号+数值」合成带符号溢价；固定价直接取值
    const signed = (sign: '+' | '-', v: string) => (sign === '-' ? -Number(v || 0) : Number(v || 0));
    let pricing: Record<string, unknown>;
    if (d.priceMode === 'market') {
      pricing = {
        priceMode: 'market',
        cash: signed(d.cashSign, d.cashPremium),
        transfer: d.noTransfer ? null : signed(d.transferSign, d.transferPremium),
        floorPrice: d.floorPrice ? Number(d.floorPrice) : undefined,
      };
    } else {
      pricing = {
        priceMode: 'fixed',
        cash: Number(d.cashFixed || 0),
        transfer: d.noTransfer ? null : Number(d.transferFixed || 0),
      };
    }

    const body: Record<string, unknown> = {
      metal: d.metal,
      category: d.category,
      quantity: Number(d.quantity),
      shipMode: d.shipMode,
      lotSize: d.shipMode === 'whole_fixed' ? Number(d.lotSize) : undefined,
      minBatch: d.shipMode === 'scatter' ? Number(d.minBatch) : undefined,
      pricing,
      images: d.images,
      agreedRules: d.agreedRules,
    };

    this.setData({ submitting: true });
    try {
      const res = await publishApi.submit(body);
      const status = res.status === 'failed' ? 'err' : 'ok';
      wx.redirectTo({ url: `/packagePublish/pages/result/index?status=${status}` });
    } catch {
      // 接口异常：错误提示已在 request 层弹出，跳失败结果页
      wx.redirectTo({ url: '/packagePublish/pages/result/index?status=err' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
