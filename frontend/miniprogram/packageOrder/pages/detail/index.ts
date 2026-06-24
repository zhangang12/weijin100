import { orderApi } from '../../../api/index';
import { fenToYuan } from '../../../utils/format';
import type { OrderDetail } from '../../../types/biz';
import type { OrderStatus } from '../../../types/models';

/** tag 组件 type：订单状态专属语义色（st-*），与列表页保持一致 */
type TagType =
  | '' | 'cat' | 'zheng' | 'san' | 'spot'
  | 'st-selling' | 'st-locked' | 'st-done' | 'st-relay' | 'st-arb' | 'st-cancel';

/** 状态 → 中文文案 */
const STATUS_TEXT: Record<string, string> = {
  selling: '销售中',
  locked_pending: '锁价待处理',
  completed: '已完成',
  relay_inspecting: '中转质检',
  arbitrating: '仲裁中',
  cancelled: '已取消',
};

/** 状态 → tag 专属语义色 */
const STATUS_TAG_TYPE: Record<string, TagType> = {
  selling: 'st-selling',
  locked_pending: 'st-locked',
  completed: 'st-done',
  relay_inspecting: 'st-relay',
  arbitrating: 'st-arb',
  cancelled: 'st-cancel',
};

/** 交割方式 → 文案 */
const DELIVERY_TEXT: Record<OrderDetail['deliveryMethod'], string> = {
  face_to_face: '线下当面交割',
  platform_relay: '平台代交接',
};

/** 缺省订单号（onLoad 未带参时兜底，Mock 会回退到首条） */
const FALLBACK_ORDER_NO = '250603 9999 123456 01';

/** 秒 → 剩 H:MM:SS（静态展示，仅 locked_pending；分秒补零） */
function formatCountdown(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return `剩 ${h}:${pad(m)}:${pad(s)}`;
}

/** ISO8601 → 简洁本地时间（去掉 T 与时区尾巴），无值回空串 */
function formatTime(iso?: string): string {
  if (!iso) return '';
  return String(iso).replace('T', ' ').replace(/[+-]\d{2}:?\d{2}$/, '').replace(/Z$/, '');
}

interface DetailViewData {
  loading: boolean;
  orderNo: string;
  detail: OrderDetail | null;
  // 预格式化字段（VM 模式：WXML 纯展示，不做计算）
  statusText: string;
  statusTagType: TagType;
  isLocked: boolean;          // locked_pending：展示倒计时 + 操作按钮
  isCompleted: boolean;       // completed：展示完成时间、无按钮
  sideText: string;           // 买入 / 卖出
  totalCashText: string;      // 现金合计（元）
  totalTransferText: string;  // 转账合计（元，仅 supportsTransfer）
  countdownText: string;      // 剩 H:MM:SS（仅 locked_pending）
  createTimeText: string;
  completeTimeText: string;
  deliveryText: string;
  showConfirm: boolean;
  showRelay: boolean;
}

Page<DetailViewData, WechatMiniprogram.IAnyObject>({
  data: {
    loading: true,
    orderNo: '',
    detail: null,
    statusText: '',
    statusTagType: '',
    isLocked: false,
    isCompleted: false,
    sideText: '',
    totalCashText: '',
    totalTransferText: '',
    countdownText: '',
    createTimeText: '',
    completeTimeText: '',
    deliveryText: '',
    showConfirm: false,
    showRelay: false,
  },

  onLoad(query: Record<string, string | undefined>) {
    const orderNo = (query && query.orderNo) || FALLBACK_ORDER_NO;
    this.setData({ orderNo });
    this.load(orderNo);
  },

  /** 拉取详情并集中预格式化为 VM 字段 */
  async load(orderNo: string) {
    this.setData({ loading: true });
    try {
      const d = await orderApi.getOrderDetail(orderNo);
      const status = d.status as OrderStatus;
      this.setData({
        loading: false,
        detail: d,
        statusText: STATUS_TEXT[status] || status,
        statusTagType: STATUS_TAG_TYPE[status] ?? '',
        isLocked: status === 'locked_pending',
        isCompleted: status === 'completed',
        sideText: d.side === 'buy' ? '买入' : '卖出',
        totalCashText: fenToYuan(d.totalCash),
        totalTransferText:
          d.supportsTransfer && typeof d.totalTransfer === 'number' ? fenToYuan(d.totalTransfer) : '',
        countdownText: status === 'locked_pending' ? formatCountdown(d.countdownRemaining) : '',
        createTimeText: formatTime(d.createTime),
        completeTimeText: status === 'completed' ? formatTime(d.completeTime) : '',
        deliveryText: DELIVERY_TEXT[d.deliveryMethod] || '',
      });
    } catch {
      // 错误提示已在 request 层处理；停留 loading 态可重试
      this.setData({ loading: false });
    }
  },

  /** 拨打对手方电话（号码去空格） */
  onCall() {
    const phone = this.data.detail?.counterparty.phone;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: phone.replace(/\s+/g, '') });
  },

  /** 复制微信号 */
  onCopyWechat() {
    const wechat = this.data.detail?.counterparty.wechat;
    if (!wechat) return;
    wx.setClipboardData({
      data: wechat,
      success: () => wx.showToast({ title: '微信号已复制', icon: 'none' }),
    });
  },

  /** 导航到地址（占位：先 toast，后续接 wx.openLocation） */
  onNavigate() {
    // TODO: 接入经纬度后改为 wx.openLocation({ latitude, longitude, name, address })
    wx.showToast({ title: '导航功能开发中', icon: 'none' });
  },

  /** 申请仲裁 */
  onArbitration() {
    wx.navigateTo({ url: '/packageOrder/pages/arbitration/index?orderNo=' + encodeURIComponent(this.data.orderNo) });
  },

  /** 平台代交接：先弹申请说明（¥100 / 4 步） */
  openRelay() { this.setData({ showRelay: true }); },
  closeRelay() { this.setData({ showRelay: false }); },
  onRelaySubmit() {
    this.setData({ showRelay: false });
    wx.navigateTo({ url: '/packageOrder/pages/relay/index?orderNo=' + encodeURIComponent(this.data.orderNo) });
  },

  /** 确认交易完成：先弹 3 条核验清单 */
  openConfirm() { this.setData({ showConfirm: true }); },
  closeConfirm() { this.setData({ showConfirm: false }); },
  async onConfirmSubmit() {
    this.setData({ showConfirm: false });
    try {
      await orderApi.confirmComplete(this.data.orderNo);
      wx.showToast({ title: '已确认，等待对方确认', icon: 'none' });
    } catch {
      /* 错误提示已在 request 层处理 */
    }
  },
});
