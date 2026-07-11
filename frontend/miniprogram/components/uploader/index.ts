// 图片上传：选图 → 校验(仅 jpg/png、单张 ≤10MB) → 本地预览 → change 抛出 url 数组
// （真接口时在 onAdd 内 wx.uploadFile 换 fileId）
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
          const MAX_SIZE = 10 * 1024 * 1024; // 单张 ≤10MB（F8）
          const valid: string[] = [];
          let rejected = false;
          res.tempFiles.forEach((f) => {
            // 仅允许 jpg/png（按临时文件后缀判断），且大小 ≤10MB
            const okType = /\.(jpe?g|png)$/i.test(f.tempFilePath);
            const okSize = !f.size || f.size <= MAX_SIZE;
            if (okType && okSize) valid.push(f.tempFilePath);
            else rejected = true;
          });
          if (rejected) {
            wx.showToast({ title: '仅支持 jpg/png 且单张 ≤10MB', icon: 'none' });
          }
          if (!valid.length) return;
          const next = list.concat(valid);
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
