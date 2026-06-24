import { marginApi } from '../../../api/index';
import type { Metal } from '../../../types/api';

const MIN_FEN = 50000; // 最低 ¥500 起充
const QUICK_AMOUNTS = [500, 1000, 5000, 10000]; // 元

interface MetalOption {
  value: Metal;
  label: string;
}

interface RechargeViewData {
  metalOptions: MetalOption[];
  metalIndex: number;     // 选中金属下标
  amount: string;         // 金额输入（元，字符串，便于受控）
  quickAmounts: number[]; // 快捷金额（元）
  submitting: boolean;
}

Page<RechargeViewData, WechatMiniprogram.IAnyObject>({
  data: {
    metalOptions: [
      { value: 'gold', label: '黄金' },
      { value: 'silver', label: '白银' },
      { value: 'platinum', label: '铂金' },
    ],
    metalIndex: 0,
    amount: '',
    quickAmounts: QUICK_AMOUNTS,
    submitting: false,
  },

  onSelectMetal(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ metalIndex: index });
  },

  onAmountInput(e: WechatMiniprogram.Input) {
    this.setData({ amount: e.detail.value });
  },

  onQuickPick(e: WechatMiniprogram.TouchEvent) {
    const val = Number(e.currentTarget.dataset.amount);
    this.setData({ amount: String(val) });
  },

  async onConfirm() {
    if (this.data.submitting) return;

    const yuan = Number(this.data.amount);
    if (!yuan || yuan <= 0 || !Number.isFinite(yuan)) {
      wx.showToast({ title: '请输入充值金额', icon: 'none' });
      return;
    }

    const fen = Math.round(yuan * 100);
    if (fen < MIN_FEN) {
      wx.showToast({ title: '最低 ¥500 起充', icon: 'none' });
      return;
    }

    const metal = this.data.metalOptions[this.data.metalIndex].value;
    this.setData({ submitting: true });
    try {
      await marginApi.recharge({ metal, amount: fen });
      wx.showToast({ title: '已发起充值（Mock）', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch {
      // 错误提示已在 request 层处理
    } finally {
      this.setData({ submitting: false });
    }
  },
});
