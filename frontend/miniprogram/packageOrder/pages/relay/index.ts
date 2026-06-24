import { orderApi } from '../../../api/index';
import type { RelayProgress, RelayStep } from '../../../types/biz';

/** 时间线步骤 VM：在 .ts 内把展示态预处理好，WXML 纯展示（VM 模式） */
interface StepVM {
  title: string;
  desc: string;
  state: RelayStep['state'];        // done / cur / todo
  dot: string;                      // 圆点内符号：done='✓'，其余空
  dotClass: string;                 // 'dot done' | 'dot cur' | 'dot todo'
  titleClass: string;               // 'st-title on' | 'st-title off'
  last: boolean;                    // 末步：不绘制下方竖连接线
}

interface PageData {
  loading: boolean;
  orderNo: string;
  relayStatus: string;              // banner 文案，如「交接中」
  feePaid: boolean;                 // 服务费 ¥100 已付/待付
  feeText: string;                  // 预格式化：'已付' | '待付'
  steps: StepVM[];
}

interface PageCustom {
  load(): Promise<void>;
  onContactAgent(): void;
  onViewReport(): void;
}

Page<PageData, PageCustom>({
  data: {
    loading: true,
    orderNo: '',
    relayStatus: '',
    feePaid: false,
    feeText: '待付',
    steps: [],
  } as PageData,

  onLoad(q: Record<string, string>) {
    this.setData({ orderNo: q.orderNo || '' });
    this.load();
  },

  async load() {
    try {
      const res: RelayProgress = await orderApi.getRelay(this.data.orderNo);
      const total = res.steps.length;
      const steps: StepVM[] = res.steps.map((s, i) => ({
        title: s.title,
        desc: s.desc,
        state: s.state,
        dot: s.state === 'done' ? '✓' : '',
        dotClass: 'dot ' + s.state,
        titleClass: 'st-title ' + (s.state === 'todo' ? 'off' : 'on'),
        last: i === total - 1,
      }));
      this.setData({
        loading: false,
        relayStatus: res.relayStatus || '进行中',
        feePaid: res.feePaid,
        feeText: res.feePaid ? '已付' : '待付',
        steps,
      });
    } catch {
      // 错误提示已在 request 层处理；停在 loading 兜底，避免渲染空时间线
      this.setData({ loading: false });
    }
  },

  // 联系专员（开发中占位）
  onContactAgent() {
    wx.showToast({ title: '（开发中）', icon: 'none' });
  },

  // 查看核验报告（开发中占位）
  onViewReport() {
    wx.showToast({ title: '（开发中）', icon: 'none' });
  },
});
