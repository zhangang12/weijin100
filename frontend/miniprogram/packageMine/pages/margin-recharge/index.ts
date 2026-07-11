import { marginApi } from '../../../api/index';
import { fenToYuan } from '../../../utils/format';
import type { Metal } from '../../../types/api';
import type { MarginAccount } from '../../../types/models';

const MIN_RECHARGE_FEN = 50000; // 最低 ¥500 起充
const QUICK_WEIGHTS = [100, 500, 1000, 5000]; // 快捷克重（g）

// 保证金单价（分/克）：金 ¥10、银 ¥0.5、铂 ¥5（业务规则 C1）
interface MetalOption {
  value: Metal;
  label: string;
  unitFen: number;   // 分/克
  unitLabel: string; // 展示：¥10 / g
}
const METALS: MetalOption[] = [
  { value: 'gold', label: '黄金', unitFen: 1000, unitLabel: '¥10 / g' },
  { value: 'silver', label: '白银', unitFen: 50, unitLabel: '¥0.5 / g' },
  { value: 'platinum', label: '铂金', unitFen: 500, unitLabel: '¥5 / g' },
];

// 支付方式（充值）
const PAY_METHODS = [
  { key: 'wechat', label: '微信支付' },
  { key: 'alipay', label: '支付宝' },
  { key: 'bank', label: '银行卡' },
];

interface RechargeViewData {
  mode: 'recharge' | 'refund';
  metals: MetalOption[];
  metalIndex: number;
  // 充值
  weight: string;            // 计划交易克重（受控输入）
  quickWeights: number[];
  calcRowLabel: string;      // 黄金 500 g × ¥10 / g
  calcAmountText: string;    // 应充金额（元，已格式化）
  currentBalanceText: string;// 当前余额（元）
  payMethods: { key: string; label: string }[];
  payIndex: number;
  rechargeBtnText: string;
  // 退款
  totalBalanceText: string;
  frozenText: string;
  refundableText: string;
  refundable: number;        // 可退（分）
  noFrozen: boolean;         // 无在途冻结
  refundAmount: string;      // 退款金额（元，受控输入）
  refundBtnText: string;
  // 通用
  loaded: boolean;
  submitting: boolean;
}

Page<RechargeViewData, WechatMiniprogram.IAnyObject>({
  data: {
    mode: 'recharge',
    metals: METALS,
    metalIndex: 0,
    weight: '500',
    quickWeights: QUICK_WEIGHTS,
    calcRowLabel: '',
    calcAmountText: '0.00',
    currentBalanceText: '0.00',
    payMethods: PAY_METHODS,
    payIndex: 0,
    rechargeBtnText: '确认充值',
    totalBalanceText: '0.00',
    frozenText: '0.00',
    refundableText: '0.00',
    refundable: 0,
    noFrozen: true,
    refundAmount: '',
    refundBtnText: '申请退款',
    loaded: false,
    submitting: false,
  },

  onLoad(options: Record<string, string>) {
    // 支持 ?mode=refund 直达退款 tab
    if (options && options.mode === 'refund') this.setData({ mode: 'refund' });
    this.loadAccount();
  },

  async loadAccount() {
    try {
      const acc: MarginAccount = await marginApi.getAccount();
      this.setData({
        loaded: true,
        currentBalanceText: fenToYuan(acc.totalBalance),
        totalBalanceText: fenToYuan(acc.totalBalance),
        frozenText: fenToYuan(acc.frozen),
        refundableText: fenToYuan(acc.refundable),
        refundable: acc.refundable,
        noFrozen: acc.frozen === 0,
        // 退款默认预填「可退余额」
        refundAmount: acc.refundable > 0 ? String(acc.refundable / 100) : '',
      });
      this.recompute();
    } catch {
      this.setData({ loaded: true });
      this.recompute();
    }
  },

  // ===== tab 切换 =====
  onSwitchMode(e: WechatMiniprogram.TouchEvent) {
    const mode = e.currentTarget.dataset.mode as 'recharge' | 'refund';
    if (mode === this.data.mode) return;
    this.setData({ mode });
  },

  // ===== 充值：金属 / 克重 / 支付方式 =====
  onSelectMetal(e: WechatMiniprogram.TouchEvent) {
    this.setData({ metalIndex: Number(e.currentTarget.dataset.index) });
    this.recompute();
  },
  onWeightInput(e: WechatMiniprogram.Input) {
    this.setData({ weight: e.detail.value });
    this.recompute();
  },
  onQuickWeight(e: WechatMiniprogram.TouchEvent) {
    this.setData({ weight: String(e.currentTarget.dataset.weight) });
    this.recompute();
  },
  onSelectPay(e: WechatMiniprogram.TouchEvent) {
    this.setData({ payIndex: Number(e.currentTarget.dataset.index) });
  },

  // ===== 退款金额 =====
  onRefundInput(e: WechatMiniprogram.Input) {
    this.setData({ refundAmount: e.detail.value });
    this.recompute();
  },
  onRefundAll() {
    this.setData({ refundAmount: this.data.refundable > 0 ? String(this.data.refundable / 100) : '' });
    this.recompute();
  },

  // 统一重算按钮上的金额文案（WXML 不能调用函数，预格式化到 data）
  recompute() {
    const m = this.data.metals[this.data.metalIndex];
    const w = Number(this.data.weight) || 0;
    const amountFen = Math.round(w * m.unitFen);
    const rAmt = Number(this.data.refundAmount) || 0;
    const rFen = Math.round(rAmt * 100);
    this.setData({
      calcRowLabel: `${m.label} ${w || 0} g × ${m.unitLabel}`,
      calcAmountText: fenToYuan(amountFen),
      rechargeBtnText: amountFen > 0 ? `确认充值 ¥${fenToYuan(amountFen)}` : '确认充值',
      refundBtnText: rFen > 0 ? `申请退款 ¥${fenToYuan(rFen)}` : '申请退款',
    });
  },

  // ===== 提交充值 =====
  async onConfirmRecharge() {
    if (this.data.submitting) return;
    const m = this.data.metals[this.data.metalIndex];
    const w = Number(this.data.weight);
    if (!w || w <= 0 || !Number.isFinite(w)) {
      wx.showToast({ title: '请输入计划交易克重', icon: 'none' });
      return;
    }
    const fen = Math.round(w * m.unitFen);
    if (fen < MIN_RECHARGE_FEN) {
      wx.showToast({ title: '最低充值 ¥500', icon: 'none' });
      return;
    }
    const payMethod = this.data.payMethods[this.data.payIndex].key;
    this.setData({ submitting: true });
    try {
      await marginApi.recharge({ metal: m.value, amount: fen, payMethod });
      wx.showToast({ title: '已发起充值', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch {
      // 错误提示已在 request 层处理
    } finally {
      this.setData({ submitting: false });
    }
  },

  // ===== 提交退款（必须传真实金额，后端校验无在途 + 无未结违约）=====
  async onConfirmRefund() {
    if (this.data.submitting) return;
    const yuan = Number(this.data.refundAmount);
    if (!yuan || yuan <= 0 || !Number.isFinite(yuan)) {
      wx.showToast({ title: '请输入退款金额', icon: 'none' });
      return;
    }
    let fen = Math.round(yuan * 100);
    if (fen > this.data.refundable) {
      wx.showToast({ title: '超出可退余额', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认退款',
      content: `将退款 ¥${fenToYuan(fen)}，原路返还、无手续费，预计 T+1 到账。是否继续？`,
      confirmText: '确认退款',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ submitting: true });
        try {
          await marginApi.refund({ amount: fen });
          wx.showToast({ title: '退款申请已提交', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 900);
        } catch {
          // 后端可能因「有在途订单 / 未结违约」拒绝，错误提示已在 request 层处理
        } finally {
          this.setData({ submitting: false });
        }
      },
    });
  },
});
