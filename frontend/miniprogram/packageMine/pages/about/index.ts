Page({
  data: {
    version: 'v1.0.0',
    // 客服信息（占位，后台配置后替换真实值）
    serviceWechat: 'weijin100_service',
    servicePhone: '400-888-8888',
    workTime: '周一至周六 9:00–21:00',
  },

  /** 复制客服微信 */
  onCopyService() {
    wx.setClipboardData({
      data: this.data.serviceWechat,
      success: () => wx.showToast({ title: '客服微信已复制', icon: 'none' }),
    });
  },

  /** 拨打客服电话 */
  onCallService() {
    const phone = this.data.servicePhone.replace(/[^0-9]/g, '');
    if (!phone) { wx.showToast({ title: '号码待配置', icon: 'none' }); return; }
    wx.makePhoneCall({ phoneNumber: phone, fail: () => { /* 用户取消，忽略 */ } });
  },

  /** 在线客服（占位，即将上线） */
  onOnlineService() {
    wx.showToast({ title: '在线客服即将上线', icon: 'none' });
  },

  /** 检查更新 */
  onCheckUpdate() {
    wx.showToast({ title: '已是最新版', icon: 'none' });
  },

  /** 用户协议 / 隐私政策（文档整理中占位） */
  onLegal(_e: WechatMiniprogram.TouchEvent) {
    wx.showToast({ title: '文档整理中', icon: 'none' });
  },
});
