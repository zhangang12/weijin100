import { orderApi } from '../../../api/index';

interface PageData {
  /** 关联订单号（只读展示） */
  orderNo: string;
  /** 聊天记录截图 uploader value（最多 5 张，必填） */
  shots: string[];
  /** 情况说明文本 */
  description: string;
  /** 情况说明已输入字数（右下角 {{descLen}}/500） */
  descLen: number;
  /** 提交中，防重复点击 */
  submitting: boolean;
}

interface PageCustom {
  onShotsChange(e: WechatMiniprogram.CustomEvent<{ value: string[] }>): void;
  onDescInput(e: WechatMiniprogram.Input): void;
  onSubmit(): Promise<void>;
}

Page<PageData, PageCustom>({
  data: {
    orderNo: '',
    shots: [],
    description: '',
    descLen: 0,
    submitting: false,
  } as PageData,

  onLoad(q: Record<string, string>) {
    this.setData({ orderNo: q.orderNo || '' });
  },

  // 截图 uploader 变更：组件 bind:change 抛 e.detail.value（string[]）
  onShotsChange(e: WechatMiniprogram.CustomEvent<{ value: string[] }>) {
    this.setData({ shots: e.detail.value });
  },

  // 情况说明输入：同步文本并更新字数
  onDescInput(e: WechatMiniprogram.Input) {
    const v = e.detail.value;
    this.setData({ description: v, descLen: v.length });
  },

  async onSubmit() {
    if (this.data.submitting) return;

    const shots = this.data.shots;
    const description = this.data.description.trim();

    if (shots.length === 0) { wx.showToast({ title: '请上传聊天记录截图', icon: 'none' }); return; }
    if (!description) { wx.showToast({ title: '请填写情况说明', icon: 'none' }); return; }

    this.setData({ submitting: true });
    try {
      await orderApi.submitArbitration(this.data.orderNo, { chatScreenshots: shots, description });
      wx.showToast({ title: '已提交仲裁', icon: 'success' });
      // 提交成功后返回上一页（订单详情），由其刷新为「仲裁中」
      setTimeout(() => { wx.navigateBack(); }, 800);
    } catch {
      // 错误提示已在 request 层处理，允许重试
    } finally {
      this.setData({ submitting: false });
    }
  },
});
