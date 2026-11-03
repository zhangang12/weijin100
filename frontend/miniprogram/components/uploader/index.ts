// 图片上传：选图 → 校验(仅 jpg/png、单张 ≤10MB) → wx.uploadFile 到 /upload?dir= → change 抛出 fileId/url 数组
// 公开目录（listing/avatar）抛出可展示的 url；私密目录（kyc/arb/appeal）抛出 fileId，缩略图用本地临时路径展示。
import { BASE_URL, USE_MOCK } from '../../config/env';
import { getToken } from '../../utils/auth';

function uploadOne(filePath: string, dir: string): Promise<string> {
  if (USE_MOCK) return Promise.resolve(filePath);
  const token = getToken();
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${BASE_URL}/upload?dir=${dir}`,
      filePath,
      name: 'file',
      header: token ? { Authorization: 'Bearer ' + token } : {},
      success: (res) => {
        try {
          const body = JSON.parse(res.data) as { code: number; message?: string; data?: { fileId?: string; url?: string } };
          const id = body.data?.url || body.data?.fileId;
          if (body.code === 0 && id) resolve(id);
          else reject(new Error(body.message || '上传失败'));
        } catch {
          reject(new Error('上传失败'));
        }
      },
      fail: () => reject(new Error('上传失败，请检查网络')),
    });
  });
}

Component({
  properties: {
    value: { type: Array, value: [] },
    max: { type: Number, value: 9 },
    /** 上传目录：listing | avatar | kyc | arb | appeal */
    dir: { type: String, value: 'listing' },
  },
  data: {
    previews: [] as string[],
  },
  observers: {
    // 页面外部设置/回显图片（如编辑挂单带出已有公开 url）时同步预览；自身 change 回写的同长度数组不覆盖本地预览
    value(v: string[]) {
      if (v.length !== (this.data.previews as string[]).length) this.setData({ previews: v.slice() });
    },
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
        success: async (res) => {
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

          wx.showLoading({ title: '上传中', mask: true });
          const ids: string[] = [];
          const shown: string[] = [];
          let error = '';
          for (const p of valid) {
            try {
              ids.push(await uploadOne(p, this.data.dir as string));
              shown.push(p);
            } catch (e) {
              error = (e as Error).message;
            }
          }
          wx.hideLoading();
          if (error) wx.showToast({ title: error, icon: 'none' });
          if (!ids.length) return;

          const next = list.concat(ids);
          this.setData({ value: next, previews: (this.data.previews as string[]).concat(shown) });
          this.triggerEvent('change', { value: next });
        },
      });
    },
    onRemove(e: WechatMiniprogram.TouchEvent) {
      const i = e.currentTarget.dataset.i as number;
      const next = (this.data.value as string[]).slice();
      const previews = (this.data.previews as string[]).slice();
      next.splice(i, 1);
      previews.splice(i, 1);
      this.setData({ value: next, previews });
      this.triggerEvent('change', { value: next });
    },
    onPreview(e: WechatMiniprogram.TouchEvent) {
      const i = e.currentTarget.dataset.i as number;
      const urls = this.data.previews as string[];
      wx.previewImage({ current: urls[i], urls });
    },
  },
});
