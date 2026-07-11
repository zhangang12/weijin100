import { alertApi } from '../../../api/index';
import type { PriceAlert } from '../../../types/biz';

type Metal = PriceAlert['metal'];
type Condition = PriceAlert['condition'];
type Channel = PriceAlert['channels'][number];

/** 品类 / 条件 / 渠道 文案映射（WXML 为 VM 模式不能调函数，统一在此预处理） */
const METAL_LABEL: Record<Metal, string> = { gold: '黄金', silver: '白银', platinum: '铂金' };
const CHANNEL_LABEL: Record<Channel, string> = { push: '推送', sms: '短信' };

/** 列表项视图模型：把渠道徽提前算好，避免 WXML 内做映射 */
interface AlertVM extends PriceAlert {
  metalLabel: string;
  condLabel: string;        // 涨到 / 跌到
  isUp: boolean;            // above → 红
  channelTags: Array<{ key: Channel; label: string }>;
}

interface FormState {
  metal: Metal;
  condition: Condition;
  targetPrice: string;      // input(type=digit) 原始字符串
  channels: Channel[];      // 可多选，至少一个
}

interface AlertViewData {
  list: AlertVM[];
  loading: boolean;
  showSheet: boolean;
  saving: boolean;          // 防重复提交
  form: FormState;
}

const emptyForm = (): FormState => ({
  metal: 'gold',
  condition: 'above',
  targetPrice: '',
  channels: ['push'],       // 默认勾选推送，保证至少一个
});

function toVM(a: PriceAlert): AlertVM {
  return {
    ...a,
    metalLabel: METAL_LABEL[a.metal] ?? a.metal,
    condLabel: a.condition === 'above' ? '涨到' : '跌到',
    isUp: a.condition === 'above',
    channelTags: a.channels.map((c) => ({ key: c, label: CHANNEL_LABEL[c] ?? c })),
  };
}

Page<AlertViewData, WechatMiniprogram.IAnyObject>({
  data: {
    list: [],
    loading: true,
    showSheet: false,
    saving: false,
    form: emptyForm(),
  },

  onLoad() {
    this.loadList();
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const list = await alertApi.list();
      this.setData({ list: list.map(toVM) });
    } catch {
      // 错误提示已在 request 层统一处理
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 删除提醒（二次确认）→ 刷新 */
  onRemove(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id);
    wx.showModal({
      title: '删除提醒',
      content: '确定删除该条金价提醒吗？',
      confirmColor: '#B8913F',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await alertApi.remove(id);
          await this.loadList();
          wx.showToast({ title: '已删除', icon: 'success' });
        } catch {
          // 已统一处理
        }
      },
    });
  },

  /** 打开新增弹窗 */
  onAdd() {
    this.setData({ form: emptyForm(), showSheet: true });
  },

  onCloseSheet() {
    this.setData({ showSheet: false });
  },

  onPickMetal(e: WechatMiniprogram.TouchEvent) {
    const metal = String(e.currentTarget.dataset.metal) as Metal;
    this.setData({ 'form.metal': metal });
  },

  onPickCondition(e: WechatMiniprogram.TouchEvent) {
    const condition = String(e.currentTarget.dataset.condition) as Condition;
    this.setData({ 'form.condition': condition });
  },

  onPriceInput(e: WechatMiniprogram.Input) {
    this.setData({ 'form.targetPrice': e.detail.value });
  },

  /** 渠道多选：点选切换，保留至少一个的校验留到提交时 */
  onToggleChannel(e: WechatMiniprogram.TouchEvent) {
    const ch = String(e.currentTarget.dataset.channel) as Channel;
    const channels = this.data.form.channels.slice();
    const idx = channels.indexOf(ch);
    if (idx >= 0) channels.splice(idx, 1);
    else channels.push(ch);
    this.setData({ 'form.channels': channels });
  },

  /** 开启提醒：校验目标价>0 且至少一个渠道 → create → 关弹窗 + 刷新 + toast */
  async onSubmit() {
    if (this.data.saving) return;
    const { metal, condition, targetPrice, channels } = this.data.form;

    const priceNum = Number(targetPrice);
    if (!targetPrice.trim() || !(priceNum > 0)) {
      wx.showToast({ title: '请输入有效目标价', icon: 'none' });
      return;
    }
    if (channels.length === 0) {
      wx.showToast({ title: '请至少选择一种提醒方式', icon: 'none' });
      return;
    }
    // G3：每个品类最多 8 条提醒
    const sameMetalCount = this.data.list.filter((a) => a.metal === metal).length;
    if (sameMetalCount >= 8) {
      wx.showToast({ title: '每个品类最多 8 条提醒', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      await alertApi.create({ metal, condition, targetPrice: targetPrice.trim(), channels });
      this.setData({ showSheet: false });
      await this.loadList();
      wx.showToast({ title: '已开启提醒', icon: 'success' });
    } catch {
      // 已统一处理
    } finally {
      this.setData({ saving: false });
    }
  },
});
