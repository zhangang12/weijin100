Page({
  data: { version: 'v1.0.0' },
  onCopyService() {
    wx.setClipboardData({
      data: 'weijin100_service',
      success: () => wx.showToast({ title: '客服微信已复制', icon: 'none' }),
    });
  },
  onLegal(e: WechatMiniprogram.TouchEvent) {
    wx.showToast({ title: '文档整理中', icon: 'none' });
  },
});
