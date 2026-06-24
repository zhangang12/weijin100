import { defaultApi } from '../../../api/index';

interface PageData {
  /** 关联的违约记录 id（只读展示） */
  recordId: string;
  /** 证据图片 uploader value（聊天记录/凭证截图，最多 5 张，选填） */
  evidence: string[];
  /** 申诉理由文本（必填） */
  reason: string;
  /** 申诉理由已输入字数（右下角 {{reasonLen}}/500） */
  reasonLen: number;
  /** 提交中，防重复点击 */
  submitting: boolean;
}

interface PageCustom {
  onEvidenceChange(e: WechatMiniprogram.CustomEvent<{ value: string[] }>): void;
  onReasonInput(e: WechatMiniprogram.Input): void;
  onSubmit(): Promise<void>;
}

Page<PageData, PageCustom>({
  data: {
    recordId: 'D_001',
    evidence: [],
    reason: '',
    reasonLen: 0,
    submitting: false,
  } as PageData,

  onLoad(q: Record<string, string>) {
    this.setData({ recordId: q.recordId || 'D_001' });
  },

  // 证据 uploader 变更：组件 bind:change 抛 e.detail.value（string[]）
  onEvidenceChange(e: WechatMiniprogram.CustomEvent<{ value: string[] }>) {
    this.setData({ evidence: e.detail.value });
  },

  // 申诉理由输入：同步文本并更新字数
  onReasonInput(e: WechatMiniprogram.Input) {
    const v = e.detail.value;
    this.setData({ reason: v, reasonLen: v.length });
  },

  async onSubmit() {
    if (this.data.submitting) return;

    const reason = this.data.reason.trim();
    const evidence = this.data.evidence;

    // 理由必填；证据选填
    if (!reason) { wx.showToast({ title: '请填写申诉理由', icon: 'none' }); return; }

    this.setData({ submitting: true });
    try {
      await defaultApi.appeal(this.data.recordId, { reason, evidence });
      wx.showToast({ title: '申诉已提交，平台将尽快处理', icon: 'none' });
      // 提交成功后返回上一页（违约记录），由其刷新状态
      setTimeout(() => { wx.navigateBack(); }, 1000);
    } catch {
      // 错误提示已在 request 层处理，允许重试
    } finally {
      this.setData({ submitting: false });
    }
  },
});
