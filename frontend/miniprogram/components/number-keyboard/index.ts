// 数字键盘：用于克重/金额录入，change 抛出当前值，confirm 确认
// 支持：最多两位小数（decimals）、上限钳制（max，散出场景传剩余库存）
Component({
  properties: {
    value: { type: String, value: '' },
    // 上限（0 = 不限）：散出传剩余库存，超过则忽略本次输入
    max: { type: Number, value: 0 },
    // 最多小数位（克重默认两位）
    decimals: { type: Number, value: 2 },
  },
  data: {
    keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'],
  },
  methods: {
    onKey(e: WechatMiniprogram.TouchEvent) {
      const k = e.currentTarget.dataset.k as string;
      const decimals = this.data.decimals;
      const max = this.data.max;
      let v = this.data.value;
      if (k === '.') {
        if (decimals <= 0) return;      // 不允许小数
        if (v.includes('.')) return;    // 已有小数点
        v = v === '' ? '0.' : v + '.';
      } else {
        const dot = v.indexOf('.');
        // 小数位已达上限则忽略（保留两位小数）
        if (dot >= 0 && v.length - dot - 1 >= decimals) return;
        const next = v === '0' ? k : v + k;
        // 超过上限则忽略本次输入（钳制 ≤ 剩余库存）
        if (max > 0 && Number(next) > max) return;
        v = next;
      }
      this.setData({ value: v });
      this.triggerEvent('change', { value: v });
    },
    onDelete() {
      const v = this.data.value.slice(0, -1);
      this.setData({ value: v });
      this.triggerEvent('change', { value: v });
    },
    onConfirm() {
      this.triggerEvent('confirm', { value: this.data.value });
    },
  },
});
