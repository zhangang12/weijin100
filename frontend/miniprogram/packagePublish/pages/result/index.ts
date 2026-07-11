type Status = 'ok' | 'err';

interface ResultDetail {
  status?: Status;
  goods?: string;      // 成功：商品摘要（黄金 · 旧料 · 10000g）
  ship?: string;       // 成功：出货方式
  price?: string;      // 成功：当前报价
  failReason?: string; // 失败：失败原因
  errorCode?: string;  // 失败：错误码
}

interface PageData {
  /** 发布结果：ok 成功 / err 失败 */
  status: Status;
  // 成功态摘要卡
  goods: string;
  ship: string;
  price: string;
  // 失败态原因
  failReason: string;
  errorCode: string;
}

interface PageCustom {
  /** 再发一单 / 返回修改：返回表单页（保留已填内容） */
  goBack(): void;
  /** 查看商品：跳行情大厅 */
  goView(): void;
  /** 联系客服（占位） */
  contactCS(): void;
}

Page<PageData, PageCustom>({
  data: {
    status: 'ok',
    goods: '',
    ship: '',
    price: '',
    failReason: '非水贝现货或资料不全，请检查后重试',
    errorCode: '—',
  } as PageData,

  onLoad(q: Record<string, string>) {
    const status: Status = q.status === 'err' ? 'err' : 'ok';
    // 摘要 / 失败详情由发布页写入本地存储传递
    let detail: ResultDetail = {};
    try { detail = (wx.getStorageSync('publishResult') as ResultDetail) || {}; } catch { detail = {}; }
    wx.removeStorageSync('publishResult');

    this.setData({
      status,
      goods: detail.goods || '',
      ship: detail.ship || '',
      price: detail.price || '',
      failReason: detail.failReason || this.data.failReason,
      errorCode: detail.errorCode || this.data.errorCode,
    });
  },

  goBack() {
    // 表单页仍在栈中（发布页用 navigateTo 打开本页），返回即保留已填内容
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/publish/index' }) });
  },

  goView() {
    wx.switchTab({ url: '/pages/market/index' });
  },

  contactCS() {
    wx.showToast({ title: '客服功能开发中，请稍后', icon: 'none' });
  },
});
