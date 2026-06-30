Page({
  data: {
    types: ['功能建议', '问题反馈', '其他'],
    activeType: 0,
    content: '',
    submitting: false,
  },
  onTypeSelect(e: WechatMiniprogram.TouchEvent) {
    this.setData({ activeType: Number(e.currentTarget.dataset.idx) });
  },
  onInput(e: WechatMiniprogram.Input) {
    this.setData({ content: e.detail.value });
  },
  async onSubmit() {
    if (!this.data.content.trim()) return;
    this.setData({ submitting: true });
    // 后续接真实反馈接口
    await new Promise(r => setTimeout(r, 800));
    this.setData({ submitting: false });
    wx.showToast({ title: '感谢您的反馈！', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 1500);
  },
});
