// 图片上传：选图 → 本地预览 → change 抛出 url 数组（真接口时在 onAdd 内 wx.uploadFile 换 fileId）
Component({
  properties: {
    value: { type: Array, value: [] },
    max: { type: Number, value: 9 },
  },
  methods: {
    onAdd() {
      const list = this.data.value as string[];
      const remain = (this.data.max as number) - list.length;
      if (remain <= 0) return;
      wx.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sizeType: ['compressed'],
        success: (res) => {
          const paths = res.tempFiles.map((f) => f.tempFilePath);
          const next = list.concat(paths);
          this.setData({ value: next });
          this.triggerEvent('change', { value: next });
        },
      });
    },
    onRemove(e: WechatMiniprogram.TouchEvent) {
      const i = e.currentTarget.dataset.i as number;
      const next = (this.data.value as string[]).slice();
      next.splice(i, 1);
      this.setData({ value: next });
      this.triggerEvent('change', { value: next });
    },
    onPreview(e: WechatMiniprogram.TouchEvent) {
      const i = e.currentTarget.dataset.i as number;
      const urls = this.data.value as string[];
      wx.previewImage({ current: urls[i], urls });
    },
  },
});
