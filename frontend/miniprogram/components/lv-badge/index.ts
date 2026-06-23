// 等级徽标：按 L 分层变色（高 L7-9 金 / 中 L4-6 青 / 低 L1-3 灰）
Component({
  properties: { level: { type: String, value: 'L1' } },
  data: { tier: 'lo' },
  observers: {
    level(v: string) {
      const n = Number(String(v).replace('L', '')) || 1;
      this.setData({ tier: n >= 7 ? 'hi' : n >= 4 ? 'mid' : 'lo' });
    },
  },
});
