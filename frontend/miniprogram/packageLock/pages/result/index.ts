import { lockApi } from '../../../api/index';

type Status = 'processing' | 'success' | 'failed';

Page({
  data: {
    /** 锁价处理中 / 成功 / 失败 */
    status: 'processing' as Status,
    orderNo: '',
    failReason: '',
    // 联系卖家（成功态）
    phone: '',
    wechat: '',
    hasPhone: false,
    hasWechat: false,
    // 上下文（锁价页 URL 带入，供富卡片展示）
    goods: '',
    weight: '',
    avatar: '',
    seller: '',
    level: '',
    deals: '',   // 商家累计成交数（锁价页透传，空串则不展示）
    pay: 'cash',
    cashTotal: '',
    transferTotal: '',
    support: false,
  },

  // 非展示态，挂在实例上
  lockOrderId: '',
  pollLeft: 6,

  onLoad(q: Record<string, string>) {
    const dec = (s?: string) => decodeURIComponent(s || '');
    this.lockOrderId = q.lockOrderId || '';
    // 富卡片上下文（成功/失败都可用）
    this.setData({
      goods: dec(q.goods),
      weight: dec(q.weight),
      avatar: dec(q.avatar),
      seller: dec(q.seller),
      level: dec(q.level),
      deals: dec(q.deals),
      pay: q.pay || 'cash',
      cashTotal: dec(q.cash),
      transferTotal: dec(q.transfer),
      support: q.support === '1',
    });
    // 提交阶段直接失败（库存被抢等）→ 带 failReason 直达失败态，不轮询
    if (q.status === 'failed') {
      this.setData({ status: 'failed', failReason: dec(q.failReason) || '订单已被抢走' });
      return;
    }
    // 缓冲页：约 1.5s 后拉取撮合结果（并发抢锁仲裁窗口）
    this.setData({ status: 'processing' });
    setTimeout(() => { this.fetchResult(); }, 1500);
  },

  async fetchResult() {
    try {
      const res = await lockApi.getLockResult(this.lockOrderId);
      // 仍在处理中：有限次轮询后再定夺
      if (res.status === 'processing' && this.pollLeft > 0) {
        this.pollLeft -= 1;
        setTimeout(() => { this.fetchResult(); }, 1200);
        return;
      }
      const phone = (res.sellerContact && res.sellerContact.phone) || '';
      const wechat = (res.sellerContact && res.sellerContact.wechat) || '';
      this.setData({
        status: res.status === 'processing' ? 'failed' : res.status,
        orderNo: res.orderNo || '',
        failReason: res.failReason || (res.status === 'processing' ? '锁价超时，请稍后在订单中查看' : ''),
        phone,
        wechat,
        hasPhone: !!phone,
        hasWechat: !!wechat,
      });
    } catch {
      // 网络/接口异常：兜底为失败态（错误提示已在 request 层弹出）
      this.setData({ status: 'failed', failReason: this.data.failReason || '锁价结果获取失败，请稍后重试' });
    }
  },

  /** 拨打卖家电话：去掉空格再拨 */
  onCallSeller() {
    const phone = (this.data.phone || '').replace(/\s/g, '');
    if (!phone) { wx.showToast({ title: '暂无电话', icon: 'none' }); return; }
    wx.makePhoneCall({ phoneNumber: phone });
  },

  /** 复制卖家微信号 */
  onCopyWechat() {
    const wechat = (this.data.wechat || '').trim();
    if (!wechat) { wx.showToast({ title: '暂无微信号', icon: 'none' }); return; }
    wx.setClipboardData({
      data: wechat,
      success: () => { wx.showToast({ title: '微信号已复制', icon: 'success' }); },
    });
  },

  /** 查看订单（tabBar 页，用 switchTab） */
  goOrder() { wx.switchTab({ url: '/pages/order/index' }); },

  /** 继续选购 / 浏览同类 —— 回行情列表（tabBar 页） */
  goMarket() { wx.switchTab({ url: '/pages/market/index' }); },

  /** 失败态：联系客服 */
  contactService() {
    wx.showModal({
      title: '联系客服',
      content: '客服热线 400-8100-100（9:00-21:00）',
      confirmText: '拨打',
      success: (r) => { if (r.confirm) wx.makePhoneCall({ phoneNumber: '4008100100' }); },
    });
  },
});
