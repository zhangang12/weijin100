import { requireEligibility } from '../../utils/guard';

/**
 * 发布现货 · 入口/须知页（本期范围）
 * 说明：完整发布表单（金属/性质/数量/出货方式/定价两模式/图片上传/确认）较复杂，
 * 本期先实现「发布须知 + 入口」，正式表单页待后续开发。
 */
Page({
  data: {
    // 合规须知（来自业务规则，橙色提示风格）
    rules: [
      '仅限水贝实物现货，支持线下即时交割，无实物货源禁止挂单报价；',
      '非水贝合规现货、来路不明货品禁止上架；',
      '线下交割买卖双方须实名认证，平台核验后方可履约提货；',
      '严禁走私金 / 回收赃金 / 管制违禁品类，违规责任自负；',
      '买家锁单后卖家须 4 小时内履约交付，逾期按平台规则承担违约责任。',
    ] as string[],
    // 是否已勾选「我已阅读并同意《发布须知》」
    agreed: false as boolean,
  },

  // 切换勾选状态
  onToggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  // 开始发布：勾选后可点 → 资质静默校验 → 通过后进入发布表单
  async onStart() {
    if (!this.data.agreed) return;
    if (await requireEligibility('publish')) {
      // TODO: 正式发布表单页待开发，接入后改为：
      // wx.navigateTo({ url: '/packagePublish/pages/form/index' });
      wx.showToast({ title: '发布表单开发中', icon: 'none' });
    }
  },
});
