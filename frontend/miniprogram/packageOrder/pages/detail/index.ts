import { orderApi, marketApi } from '../../../api/index';
import { fenToYuan, trendClass } from '../../../utils/format';
import type { OrderDetail } from '../../../types/biz';
import type { OrderStatus } from '../../../types/models';
import type { Metal } from '../../../types/api';

/** tag 组件 type：订单状态专属语义色（st-*），与列表页保持一致 */
type TagType =
  | '' | 'cat' | 'zheng' | 'san' | 'spot'
  | 'st-selling' | 'st-locked' | 'st-done' | 'st-relay' | 'st-arb' | 'st-cancel';

/** 状态 → 中文文案（B5/项目6：代交接·核验中、已违约） */
const STATUS_TEXT: Record<string, string> = {
  selling: '销售中',
  locked_pending: '锁价待处理',
  completed: '已完成',
  relay_inspecting: '平台代交接·核验中',
  arbitrating: '仲裁中',
  cancelled: '已取消',
  defaulted: '已违约',
};

/** 状态 → tag 专属语义色（defaulted 复用红色 st-arb） */
const STATUS_TAG_TYPE: Record<string, TagType> = {
  selling: 'st-selling',
  locked_pending: 'st-locked',
  completed: 'st-done',
  relay_inspecting: 'st-relay',
  arbitrating: 'st-arb',
  cancelled: 'st-cancel',
  defaulted: 'st-arb',
};

/** 交割方式 → 文案（后端 deliveryMethod: face_to_face | relay） */
const DELIVERY_TEXT: Record<string, string> = {
  face_to_face: '线下当面交割',
  relay: '平台代交接',
};

/** 出货方式 → 文案（销售中详情） */
const SHIP_TEXT: Record<string, string> = {
  whole_all: '整出全量',
  whole_fixed: '整出固量',
  bulk: '散出',
};

/** 缺省订单号（onLoad 未带参时兜底，Mock 会回退到首条） */
const FALLBACK_ORDER_NO = '250603 9999 123456 01';

/** 秒 → 剩 H:MM:SS；A2：归零后继续显示「已超时 HH:MM」而非消失 */
function formatCountdown(sec?: number): string {
  if (sec == null) return '';
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  if (sec <= 0) {
    const over = Math.abs(sec);
    const h = Math.floor(over / 3600);
    const m = Math.floor((over % 3600) / 60);
    return `已超时 ${pad(h)}:${pad(m)}`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
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
  isSelling: boolean;         // selling：我的挂单，展示剩余可锁 + 实时报价 + 取消/修改
  isRelayInProgress: boolean; // relay_inspecting：平台代交接核验中
  isOvertime: boolean;        // A2：倒计时归零
  sideText: string;           // 买入 / 卖出
  totalCashText: string;      // 现金合计（元）
  totalTransferText: string;  // 转账合计（元，仅 supportsTransfer）
  countdownText: string;      // 剩 H:MM:SS / 已超时 HH:MM（仅 locked_pending）
  createTimeText: string;
  completeTimeText: string;
  deliveryText: string;
  shipText: string;           // 出货方式（销售中）
  // 实时报价（销售中）
  quoteMarket: string;
  quoteChangeText: string;
  quoteTrendClass: string;
  // 代交接状态
  relayLoaded: boolean;
  relayStatus: string;        // 待发起 / 待对方同意 / 核验中 / 已完成
  relayFeePaid: boolean;
  relayPending: boolean;      // 已付费待对方同意
  amInitiator: boolean;       // 我是发起方
  canConsent: boolean;        // 我是对手方，可同意
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
    isSelling: false,
    isRelayInProgress: false,
    isOvertime: false,
    sideText: '',
    totalCashText: '',
    totalTransferText: '',
    countdownText: '',
    createTimeText: '',
    completeTimeText: '',
    deliveryText: '',
    shipText: '',
    quoteMarket: '',
    quoteChangeText: '',
    quoteTrendClass: '',
    relayLoaded: false,
    relayStatus: '',
    relayFeePaid: false,
    relayPending: false,
    amInitiator: false,
    canConsent: false,
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
      const overtime =
        status === 'locked_pending' && typeof d.countdownRemaining === 'number' && d.countdownRemaining <= 0;
      this.setData({
        loading: false,
        detail: d,
        statusText: STATUS_TEXT[status] || status,
        statusTagType: STATUS_TAG_TYPE[status] ?? '',
        isLocked: status === 'locked_pending',
        isCompleted: status === 'completed',
        isSelling: status === 'selling',
        isRelayInProgress: status === 'relay_inspecting',
        isOvertime: overtime,
        sideText: d.side === 'buy' ? '买入' : '卖出',
        totalCashText: fenToYuan(d.totalCash),
        totalTransferText:
          d.supportsTransfer && typeof d.totalTransfer === 'number' ? fenToYuan(d.totalTransfer) : '',
        countdownText: status === 'locked_pending' ? formatCountdown(d.countdownRemaining) : '',
        createTimeText: formatTime(d.createTime),
        completeTimeText: status === 'completed' ? formatTime(d.completeTime) : '',
        deliveryText: DELIVERY_TEXT[d.deliveryMethod] || '',
        shipText: d.shipMode ? SHIP_TEXT[d.shipMode] || d.shipMode : '',
      });
      // 锁价待处理 / 代交接核验中 → 拉代交接状态，决定入口/同意按钮
      if (status === 'locked_pending' || status === 'relay_inspecting') {
        this.loadRelay(orderNo, d);
      }
      // 销售中 → 拉实时报价小卡
      if (status === 'selling') {
        this.loadQuote(d.metal as Metal);
      }
    } catch {
      // 错误提示已在 request 层处理；停留 loading 态可重试
      this.setData({ loading: false });
    }
  },

  /** 代交接状态：判断我是否发起方、是否可同意 */
  async loadRelay(orderNo: string, d: OrderDetail) {
    try {
      const r = await orderApi.getRelay(orderNo);
      const mySideRole = d.side === 'buy' ? '买家' : '卖家';
      const amInitiator = !!r.initiatorRole && r.initiatorRole === mySideRole;
      const pending = !!r.feePaid && !r.peerAgreed && r.relayStatus === '待对方同意';
      this.setData({
        relayLoaded: true,
        relayStatus: r.relayStatus || '',
        relayFeePaid: !!r.feePaid,
        relayPending: pending,
        amInitiator,
        canConsent: pending && !amInitiator,
      });
    } catch {
      // 拉取失败：按「尚未发起」处理，允许申请
      this.setData({ relayLoaded: true, relayPending: false, canConsent: false });
    }
  },

  /** 销售中实时报价：大盘价 + 涨跌（红涨绿跌） */
  async loadQuote(metal: Metal) {
    try {
      const q = await marketApi.getQuote(metal || 'gold');
      this.setData({
        quoteMarket: q.marketPrice,
        quoteChangeText: `${q.change} ${q.changePercent}`,
        quoteTrendClass: trendClass(q.trend),
      });
    } catch {
      /* 报价失败忽略，仅不展示大盘价 */
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

  /** 导航到地址：有经纬度则调起地图，否则复制地址文本 */
  onNavigate() {
    const addr = (this.data.detail as any)?.deliveryAddress;
    if (addr?.latitude && addr?.longitude) {
      wx.openLocation({
        latitude: addr.latitude,
        longitude: addr.longitude,
        name: addr.contact || '交割地址',
        address: addr.region + addr.detail,
      });
    } else {
      const text = addr ? (addr.region + addr.detail) : (this.data.detail?.counterparty.address || '交割地址待确认');
      wx.setClipboardData({
        data: text,
        success: () => wx.showToast({ title: '地址已复制', icon: 'none' }),
      });
    }
  },

  /** 申请仲裁 */
  onArbitration() {
    wx.navigateTo({ url: '/packageOrder/pages/arbitration/index?orderNo=' + encodeURIComponent(this.data.orderNo) });
  },

  /** 平台代交接：先弹申请说明（¥100 / 4 步） */
  openRelay() { this.setData({ showRelay: true }); },
  closeRelay() { this.setData({ showRelay: false }); },
  /** 申请代交接：真正调 applyRelay（发起方付 ¥100 → 待对方同意） */
  async onRelaySubmit() {
    this.setData({ showRelay: false });
    wx.showLoading({ title: '支付并申请…', mask: true });
    try {
      await orderApi.applyRelay(this.data.orderNo);
      wx.hideLoading();
      wx.showToast({ title: '¥100 已支付，等待对方同意', icon: 'none' });
      this.load(this.data.orderNo); // 刷新为「待对方同意」态
    } catch {
      wx.hideLoading();
      /* 错误提示已在 request 层处理 */
    }
  },

  /** 对手方同意代交接：调 relayConsent → 进核验流程并跳进度页 */
  onConsent() {
    wx.showModal({
      title: '同意平台代交接',
      content: '同意后交割方式将锁定为平台代交接，不可改回当面自交。',
      confirmText: '同意',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await orderApi.relayConsent(this.data.orderNo);
          wx.showToast({ title: '已同意，进入平台核验', icon: 'none' });
          this.goRelay();
        } catch {
          /* 错误提示已在 request 层处理 */
        }
      },
    });
  },

  /** 进入代交接进度页 */
  goRelay() {
    wx.navigateTo({ url: '/packageOrder/pages/relay/index?orderNo=' + encodeURIComponent(this.data.orderNo) });
  },

  /** 销售中：取消订单（占位，仅取消剩余库存的确认提示 B10） */
  onCancelListing() {
    wx.showModal({
      title: '取消订单',
      content: '已被锁价的子单不可取消，仅取消剩余库存报价。确认取消？',
      confirmText: '确认取消',
      confirmColor: '#E0492F',
      success: (r) => {
        if (r.confirm) wx.showToast({ title: '取消功能开发中', icon: 'none' });
      },
    });
  },

  /** 销售中：修改商品参数（占位，跳货品发布修改页待接线） */
  onEditListing() {
    wx.showToast({ title: '请在货品发布页修改', icon: 'none' });
  },

  /** 确认交易完成：先弹核验清单 */
  openConfirm() { this.setData({ showConfirm: true }); },
  closeConfirm() { this.setData({ showConfirm: false }); },
  async onConfirmSubmit() {
    this.setData({ showConfirm: false });
    try {
      await orderApi.confirmComplete(this.data.orderNo);
      wx.showToast({ title: '已确认，等待对方确认', icon: 'none' });
      this.load(this.data.orderNo);
    } catch {
      /* 错误提示已在 request 层处理 */
    }
  },
});
