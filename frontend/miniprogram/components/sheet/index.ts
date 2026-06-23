// 底部弹窗：show 控制显隐，关闭触发 close 事件，内容用 slot
Component({
  properties: {
    show: { type: Boolean, value: false },
    title: { type: String, value: '' },
  },
  methods: {
    onClose() { this.triggerEvent('close'); },
    noop() {},
  },
});
