import { requireEligibility } from '../../utils/guard';
import { FEATURES } from '../../config/env';

/** 发布现货 tab：落地页 + 发布须知弹窗（同意后进表单） */
Page({
  data: {
    showRules: false,
    agreed: false,
    marginOn: FEATURES.margin as boolean, // 保证金开关：关闭时发布条件不提保证金
    rules: [
      '仅限水贝实物现货，无实物货源禁止挂单报价；',
      '非水贝合规现货、来路不明货品禁止上架；',
      '线下交货买卖双方须实名认证，平台核验后方可履约；',
      '严禁走私金 / 回收赃金 / 管制违禁品类，违规责任自负；',
      '买家下单后须 4 小时内履约交付，逾期按平台规则承担违约责任。',
    ] as string[],
  },

  openRules() {
    this.setData({ showRules: true });
  },
  closeRules() {
    this.setData({ showRules: false, agreed: false });
  },
  onToggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },
  /** 阻止遮罩点击穿透 / 关闭（须知不可点遮罩关闭） */
  noop() {},

  /** 同意须知 → 静默校验资质 → 进入发布表单 */
  async onConfirm() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意发布须知', icon: 'none' });
      return;
    }
    this.setData({ showRules: false });
    if (await requireEligibility('publish')) {
      wx.navigateTo({ url: '/packagePublish/pages/form/index' });
    }
  },
});
