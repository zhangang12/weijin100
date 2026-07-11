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
  relayStatus: string;              // banner 文案，如「核验中」
  feePaid: boolean;                 // 服务费 ¥100 已付/待付
  feeText: string;                  // 预格式化：'已付' | '待付'
  steps: StepVM[];
  curIndex: number;                 // 当前进行中步骤下标（-1 表示无）
  hasCur: boolean;                  // 是否存在进行中步骤（决定底部主按钮）
  advanceLabel: string;             // 主按钮文案（末步=完成交易）
  advancing: boolean;               // 推进中防重复
}

interface PageCustom {
  load(): Promise<void>;
  onContactAgent(): void;
  onViewReport(): void;
  onAdvance(): Promise<void>;
}

Page<PageData, PageCustom>({
  data: {
    loading: true,
    orderNo: '',
    relayStatus: '',
    feePaid: false,
    feeText: '待付',
    steps: [],
    curIndex: -1,
    hasCur: false,
    advanceLabel: '',
    advancing: false,
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
      // 当前进行中步骤：驱动底部主按钮（末步=买家打款·完成交易）
      const curIndex = steps.findIndex((s) => s.state === 'cur');
      const isLast = curIndex >= 0 && curIndex === total - 1;
      const curTitle = curIndex >= 0 ? steps[curIndex].title : '';
      const advanceLabel = curTitle.indexOf('打款') >= 0 || isLast ? '确认打款 · 完成交易' : '标记完成 · 进入下一步';
      this.setData({
        loading: false,
        relayStatus: res.relayStatus || '进行中',
        feePaid: res.feePaid,
        feeText: res.feePaid ? '已付' : '待付',
        steps,
        curIndex,
        hasCur: curIndex >= 0,
        advanceLabel,
      });
    } catch {
      // 错误提示已在 request 层处理；停在 loading 兜底，避免渲染空时间线
      this.setData({ loading: false });
    }
  },

  /** 推进当前步骤：updateRelayStep 驱动；末步完成 → 后端释放双方保证金（B7）。 */
  async onAdvance() {
    if (this.data.advancing) return;
    const idx = this.data.curIndex;
    const total = this.data.steps.length;
    if (idx < 0) return;
    const isLast = idx === total - 1;
    this.setData({ advancing: true });
    try {
      if (isLast) {
        // 末步（平台发货）完成 → 交易完成、释放双方保证金
        await orderApi.updateRelayStep(this.data.orderNo, { stepIndex: idx, state: 'done', desc: '交易完成，双方保证金已释放' });
        wx.showToast({ title: '交易完成，保证金已释放', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 900);
        return;
      }
      // 中间步骤：当前置 done，下一步置 cur
      await orderApi.updateRelayStep(this.data.orderNo, { stepIndex: idx, state: 'done' });
      await orderApi.updateRelayStep(this.data.orderNo, { stepIndex: idx + 1, state: 'cur' });
      await this.load();
    } catch {
      /* 错误提示已在 request 层处理 */
    } finally {
      this.setData({ advancing: false });
    }
  },

  // 联系专员：复制平台客服微信号
  onContactAgent() {
    wx.setClipboardData({
      data: 'weijin100_service',
      success: () => wx.showToast({ title: '客服微信已复制', icon: 'none' }),
    });
  },

  // 查看核验报告：暂无报告链接，提示订阅消息通知
  onViewReport() {
    wx.showModal({
      title: '核验报告',
      content: '报告生成后将通过微信通知您，请留意订阅消息。',
      showCancel: false,
      confirmText: '我知道了',
    });
  },
});
