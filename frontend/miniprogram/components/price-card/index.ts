// 金价大盘卡：展示实时金价 + 涨跌 + 溢价 + 当日高低 / 销售价 / 回购价
Component({
  properties: {
    quote: { type: Object },
  },
  data: {
    bars: [] as number[], // 迷你走势：sparkline 归一化后的柱高百分比
  },
  observers: {
    // 监听 quote 变化：把 sparkline 原始数值按 min-max 归一到 15%~100% 高度
    // （最低点保留 15% 底高，避免归一到 0 后细柱不可见）
    quote(q: { sparkline?: number[] } | null) {
      const arr = q && Array.isArray(q.sparkline) ? q.sparkline : [];
      if (!arr.length) {
        this.setData({ bars: [] }); // 数据为空时不渲染
        return;
      }
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      const range = max - min || 1; // 全平时避免除零
      const bars = arr.map((v) => Math.round(15 + ((v - min) / range) * 85));
      this.setData({ bars });
    },
  },
  methods: {
    // 溢价「?」释义：点一下弹窗说明溢价含义
    onPremiumHelp() {
      wx.showModal({
        title: '溢价说明',
        content: '溢价 = 平台在大盘价基础上的加价，由行情源给定。',
        showCancel: false,
        confirmText: '知道了',
      });
    },
  },
});
