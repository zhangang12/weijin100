// 数字键盘：用于克重/金额录入，change 抛出当前值，confirm 确认
Component({
  properties: {
    value: { type: String, value: '' },
  },
  data: {
    keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'],
  },
  methods: {
    onKey(e: WechatMiniprogram.TouchEvent) {
      const k = e.currentTarget.dataset.k as string;
      let v = this.data.value as string;
      if (k === '.') {
        if (v.includes('.')) return;
        v = v === '' ? '0.' : v + '.';
      } else {
        v = v === '0' ? k : v + k;
      }
      this.setData({ value: v });
      this.triggerEvent('change', { value: v });
    },
    onDelete() {
      const v = (this.data.value as string).slice(0, -1);
      this.setData({ value: v });
      this.triggerEvent('change', { value: v });
    },
    onConfirm() {
      this.triggerEvent('confirm', { value: this.data.value });
    },
  },
});
