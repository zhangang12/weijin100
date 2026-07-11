import { defaultApi } from '../../../api/index';
import { fenToYuan } from '../../../utils/format';
import type { DefaultRecord, DefaultSummary } from '../../../types/biz';

/** ISO8601 → 「YYYY-MM-DD HH:mm:ss」（去掉 T 与时区，仅取本地展示串） */
function cleanTime(iso: string): string {
  const [date = '', rest = ''] = iso.split('T');
  const time = rest.replace(/[+-]\d{2}:?\d{2}$/, '').replace(/Z$/, '');
  return time ? `${date} ${time}` : date;
}

const STATUS_TEXT: Record<DefaultRecord['recordStatus'], string> = {
  active: '生效中',
  repaired: '已修复',
  appealing: '申诉中',
  appealed: '已申诉',
  revoked: '已撤销',
};

/** 单价（分/克）→ 展示「¥10 / g」形式（去尾零） */
function unitLabel(deductAmount: number, weight: number): string {
  if (!weight) return '';
  const yuanPerG = deductAmount / weight / 100; // 分/克 → 元/克
  return `¥${Number(yuanPerG.toFixed(3))} / g`;
}

/** 拆分处罚串「限制 3 天 + 降 1 级」→ 功能限制 / 信用降级 两段 */
function splitPenalty(penalty: string): { limit: string; degrade: string } {
  const parts = (penalty || '').split('+').map((s) => s.trim());
  const limit = parts.find((p) => p.includes('限制') || p.includes('天')) || '';
  const degrade = parts.find((p) => p.includes('降') || p.includes('级') || p.includes('清零')) || '';
  return { limit, degrade };
}

interface DefaultRecordVM {
  id: string;
  type: string;
  role: '买家' | '卖家';
  weight: number;
  deductText: string;        // 元，带千分位
  unitLabel: string;         // ¥10 / g
  penalty: string;
  penaltyLimit: string;      // 限制 3 天
  penaltyDegrade: string;    // 降 1 级
  relatedOrderNo: string;
  recordStatus: DefaultRecord['recordStatus'];
  statusText: string;
  createTimeText: string;
  isRevoked: boolean;        // 已撤销/申诉成立 → 置灰
  appealExpired: boolean;    // 24h 申诉窗口是否已过
  canAppeal: boolean;        // 生效中 且 未过期
}

interface DefaultViewData {
  loading: boolean;
  defaultCount12m: number;
  functionStatus: 'normal' | 'limited';
  limitedDaysLeft: number;
  tradesToRepair: number;
  records: DefaultRecordVM[];
  showDetail: boolean;
  detail: DefaultRecordVM | null;
}

Page<DefaultViewData, WechatMiniprogram.IAnyObject>({
  data: {
    loading: true,
    defaultCount12m: 0,
    functionStatus: 'normal',
    limitedDaysLeft: 0,
    tradesToRepair: 0,
    records: [],
    showDetail: false,
    detail: null,
  },

  onLoad() {
    this.load();
  },

  async load() {
    try {
      const [summary, paged]: [DefaultSummary, { list: DefaultRecord[] }] = await Promise.all([
        defaultApi.getSummary(),
        defaultApi.getRecords(),
      ]);
      const now = Date.now();
      const records: DefaultRecordVM[] = paged.list.map((r) => {
        const { limit, degrade } = splitPenalty(r.penalty);
        const appealExpired = r.appealDeadline ? Date.parse(r.appealDeadline) < now : true;
        const isRevoked = r.recordStatus === 'revoked' || r.recordStatus === 'repaired';
        return {
          id: r.id,
          type: r.type,
          role: r.role,
          weight: r.weight,
          deductText: fenToYuan(r.deductAmount),
          unitLabel: unitLabel(r.deductAmount, r.weight),
          penalty: r.penalty,
          penaltyLimit: limit,
          penaltyDegrade: degrade,
          relatedOrderNo: r.relatedOrderNo,
          recordStatus: r.recordStatus,
          statusText: STATUS_TEXT[r.recordStatus] || r.recordStatus,
          createTimeText: cleanTime(r.createTime),
          isRevoked,
          appealExpired,
          canAppeal: r.recordStatus === 'active' && !appealExpired,
        };
      });
      this.setData({
        loading: false,
        defaultCount12m: summary.defaultCount12m,
        functionStatus: summary.functionStatus,
        limitedDaysLeft: summary.limitedDaysLeft || 0,
        tradesToRepair: summary.tradesToRepair,
        records,
      });
    } catch {
      // 错误提示已在 request 层处理；停留在 loading 态让用户可重试
      this.setData({ loading: false });
    }
  },

  /** 打开违约判定详情弹窗（屏⑩） */
  onShowDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const detail = this.data.records.find((r) => r.id === id) || null;
    this.setData({ detail, showDetail: true });
  },
  onCloseDetail() {
    this.setData({ showDetail: false });
  },
  noop() { /* 阻止弹窗内部点击穿透关闭 */ },

  /** 从弹窗内点「去申诉」 */
  onAppealFromDetail() {
    const d = this.data.detail;
    if (!d) return;
    if (!d.canAppeal) {
      wx.showToast({ title: '申诉窗口已关闭（判定后 24h 内）', icon: 'none' });
      return;
    }
    this.setData({ showDetail: false });
    wx.navigateTo({ url: '/packageMine/pages/appeal/index?recordId=' + d.id });
  },

  /** 记录卡内「去申诉」（仅生效中且 24h 内可点） */
  onAppeal(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const rec = this.data.records.find((r) => r.id === id);
    if (rec && !rec.canAppeal) {
      wx.showToast({ title: '申诉窗口已关闭（判定后 24h 内）', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/packageMine/pages/appeal/index?recordId=' + id });
  },
});
