import { defaultApi } from '../../../api/index';
import { fenToYuan } from '../../../utils/format';
import type { DefaultRecord, DefaultSummary } from '../../../types/biz';

/** ISO8601 → 「YYYY-MM-DD HH:mm:ss」（去掉 T 与时区，仅取本地展示串） */
function cleanTime(iso: string): string {
  // 形如 2026-05-20T10:00:00+08:00 → 取 T 前日期 + T 后时间（去时区后缀）
  const [date = '', rest = ''] = iso.split('T');
  const time = rest.replace(/[+-]\d{2}:?\d{2}$/, '').replace(/Z$/, '');
  return time ? `${date} ${time}` : date;
}

const STATUS_TEXT: Record<DefaultRecord['recordStatus'], string> = {
  active: '生效中',
  repaired: '已修复',
  appealed: '已申诉',
};

interface DefaultRecordVM {
  id: string;
  type: string;
  role: '买家' | '卖家';
  weight: number;
  deductText: string;        // 元，带千分位
  penalty: string;
  relatedOrderNo: string;
  recordStatus: DefaultRecord['recordStatus'];
  statusText: string;
  createTimeText: string;
}

interface DefaultViewData {
  loading: boolean;
  defaultCount12m: number;
  functionStatus: 'normal' | 'limited';
  tradesToRepair: number;
  records: DefaultRecordVM[];
}

Page<DefaultViewData, WechatMiniprogram.IAnyObject>({
  data: {
    loading: true,
    defaultCount12m: 0,
    functionStatus: 'normal',
    tradesToRepair: 0,
    records: [],
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
      const records: DefaultRecordVM[] = paged.list.map((r) => ({
        id: r.id,
        type: r.type,
        role: r.role,
        weight: r.weight,
        deductText: fenToYuan(r.deductAmount),
        penalty: r.penalty,
        relatedOrderNo: r.relatedOrderNo,
        recordStatus: r.recordStatus,
        statusText: STATUS_TEXT[r.recordStatus],
        createTimeText: cleanTime(r.createTime),
      }));
      this.setData({
        loading: false,
        defaultCount12m: summary.defaultCount12m,
        functionStatus: summary.functionStatus,
        tradesToRepair: summary.tradesToRepair,
        records,
      });
    } catch {
      // 错误提示已在 request 层处理；停留在 loading 态让用户可重试
      this.setData({ loading: false });
    }
  },

  /** 去申诉（仅生效中记录，24h 内） */
  onAppeal(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: '/packageMine/pages/appeal/index?recordId=' + id });
  },
});
