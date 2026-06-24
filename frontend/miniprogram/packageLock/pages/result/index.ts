import { lockApi } from '../../../api/index';

type Status = 'processing' | 'success' | 'failed';

interface SellerContactVM {
  phone: string;
  wechat: string;
}

interface PageData {
  /** 锁价处理中 / 成功 / 失败 */
  status: Status;
  /** 订单号（成功态展示） */
  orderNo: string;
  /** 失败原因（失败态展示） */
  failReason: string;
  /** 联系卖家信息（成功态展示，VM 已预处理） */
  sellerContact: SellerContactVM | null;
  /** 是否存在卖家联系方式 */
  hasContact: boolean;
}

/** 自定义实例成员（非 data，挂在 this 上） */
interface PageCustom {
  /** 当前锁价单 id */
  lockOrderId: string;
  fetchResult(): Promise<void>;
  onCallSeller(): void;
  onCopyWechat(): void;
  goOrder(): void;
  goHome(): void;
  goMarket(): void;
}

Page<PageData, PageCustom>({
  data: {
    status: 'processing',
    orderNo: '',
    failReason: '',
    sellerContact: null,
    hasContact: false,
  } as PageData,

  // 当前锁价单 id（非展示态，存实例上）
  lockOrderId: 'LK_900001',

  onLoad(q: Record<string, string>) {
    this.lockOrderId = q.lockOrderId || 'LK_900001';
    this.setData({ status: 'processing' });
    // 模拟锁价撮合处理耗时，约 1.5s 后拉取结果
    setTimeout(() => { this.fetchResult(); }, 1500);
  },

  async fetchResult() {
    try {
      const res = await lockApi.getLockResult(this.lockOrderId);
      // VM 模式：在 .ts 内把所有展示字段预格式化好，WXML 纯展示
      const contact = res.sellerContact
        ? { phone: res.sellerContact.phone || '', wechat: res.sellerContact.wechat || '' }
        : null;
      this.setData({
        status: res.status,
        orderNo: res.orderNo || '',
        failReason: res.failReason || '',
        sellerContact: contact,
        hasContact: !!contact && (!!contact.phone || !!contact.wechat),
      });
    } catch {
      // 网络/接口异常：兜底为失败态（错误提示已在 request 层弹出）
      this.setData({ status: 'failed', failReason: '锁价结果获取失败，请稍后重试' });
    }
  },

  /** 拨打卖家电话：去掉空格再拨 */
  onCallSeller() {
    const phone = (this.data.sellerContact?.phone || '').replace(/\s/g, '');
    if (!phone) { wx.showToast({ title: '暂无电话', icon: 'none' }); return; }
    wx.makePhoneCall({ phoneNumber: phone });
  },

  /** 复制卖家微信号 */
  onCopyWechat() {
    const wechat = (this.data.sellerContact?.wechat || '').trim();
    if (!wechat) { wx.showToast({ title: '暂无微信号', icon: 'none' }); return; }
    wx.setClipboardData({
      data: wechat,
      success: () => { wx.showToast({ title: '微信号已复制', icon: 'success' }); },
    });
  },

  /** 查看订单（tabBar 页，用 switchTab） */
  goOrder() {
    wx.switchTab({ url: '/pages/order/index' });
  },

  /** 返回首页（tabBar 页，用 switchTab） */
  goHome() {
    wx.switchTab({ url: '/pages/home/index' });
  },

  /** 失败态：浏览同类 —— 返回行情列表 */
  goMarket() {
    wx.switchTab({ url: '/pages/market/index' });
  },
});
