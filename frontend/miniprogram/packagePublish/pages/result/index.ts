type Status = 'ok' | 'err';

interface PageData {
  /** 发布结果：ok 成功 / err 失败 */
  status: Status;
}

interface PageCustom {
  /** 再发一单：返回上一页（表单页） */
  goBack(): void;
  /** 返回首页（tabBar 页，用 switchTab） */
  goHome(): void;
}

Page<PageData, PageCustom>({
  data: {
    status: 'ok',
  } as PageData,

  onLoad(q: Record<string, string>) {
    this.setData({ status: q.status === 'err' ? 'err' : 'ok' });
  },

  goBack() {
    wx.navigateBack();
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/index' });
  },
});
