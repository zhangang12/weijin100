import { userApi } from '../../../api/index';
import { resolvePhoneNumber, getToken } from '../../../utils/auth';
import { BASE_URL } from '../../../config/env';
import type { Profile } from '../../../types/models';

interface ProfileEditData {
  loading: boolean;
  saving: boolean;
  // 只读展示
  weijinNo: string;
  realNameMasked: string;
  level: string;
  // 可编辑表单
  avatar: string;        // 头像 url / fileId（为空则显示文字占位）
  avatarChar: string;    // 无头像时的占位文字（取昵称首字）
  nickname: string;
  phone: string;
  wechat: string;
}

Page<ProfileEditData, WechatMiniprogram.IAnyObject>({
  data: {
    loading: true,
    saving: false,
    weijinNo: '',
    realNameMasked: '',
    level: '',
    avatar: '',
    avatarChar: '微',
    nickname: '',
    phone: '',
    wechat: '',
  },

  onLoad() {
    this.load();
  },

  async load() {
    try {
      const p: Profile = await userApi.getProfile();
      this.setData({
        loading: false,
        weijinNo: p.weijinNo || '',
        realNameMasked: p.realNameMasked || '',
        level: p.level || '',
        avatar: p.avatar || '',
        avatarChar: (p.nickname || p.realNameMasked || '微').charAt(0),
        nickname: p.nickname || '',
        phone: p.phone || '',
        wechat: p.wechat || '',
      });
    } catch {
      // 错误提示已在 request 层处理；停在可编辑态让用户可重试
      this.setData({ loading: false });
    }
  },

  onNicknameInput(e: WechatMiniprogram.Input) {
    const nickname = e.detail.value;
    // 同步占位首字，未设置头像时随昵称变化
    this.setData({ nickname, avatarChar: (nickname || this.data.realNameMasked || '微').charAt(0) });
  },

  onPhoneInput(e: WechatMiniprogram.Input) {
    this.setData({ phone: e.detail.value.replace(/\s/g, '') });
  },

  onWechatInput(e: WechatMiniprogram.Input) {
    this.setData({ wechat: e.detail.value.trim() });
  },

  /** 点击更换头像：选图 → 校验 → 上传 */
  onChooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (res) => {
        const file = res.tempFiles[0];
        if (!file) return;
        // 与图片上传组件一致：仅 jpg/png，单张 ≤10MB
        const okType = /\.(jpe?g|png)$/i.test(file.tempFilePath);
        const okSize = !file.size || file.size <= 10 * 1024 * 1024;
        if (!okType || !okSize) {
          wx.showToast({ title: '仅支持 jpg/png 且 ≤10MB', icon: 'none' });
          return;
        }
        this.uploadAvatar(file.tempFilePath);
      },
    });
  },

  /**
   * 上传头像到 POST /upload：成功取 url/fileId 存入 data.avatar；
   * 上传接口未就绪或失败时，保留本地临时路径预览，保存时仍带上（真实上传待联调）。
   */
  uploadAvatar(tempPath: string) {
    // 先本地预览，提升体感
    this.setData({ avatar: tempPath });
    wx.showLoading({ title: '上传中', mask: true });
    const token = getToken();
    wx.uploadFile({
      url: BASE_URL + '/upload',
      filePath: tempPath,
      name: 'file',
      header: token ? { Authorization: 'Bearer ' + token } : {},
      success: (res) => {
        try {
          const body = JSON.parse(res.data) as { code: number; data?: { fileId?: string; url?: string } };
          const url = body?.data?.url || body?.data?.fileId;
          if (body && body.code === 0 && url) {
            this.setData({ avatar: url });
          } else {
            // 接口未就绪：保留本地预览，真实上传待联调
            wx.showToast({ title: '已选择（上传待联调）', icon: 'none' });
          }
        } catch {
          wx.showToast({ title: '已选择（上传待联调）', icon: 'none' });
        }
      },
      fail: () => {
        // 上传失败：保留本地临时路径预览，保存时仍带上，真实上传待联调
        wx.showToast({ title: '已选择（上传待联调）', icon: 'none' });
      },
      complete: () => wx.hideLoading(),
    });
  },

  /** 微信一键获取手机号 */
  async onGetPhone(e: WechatMiniprogram.ButtonGetPhoneNumber) {
    try {
      const phone = await resolvePhoneNumber(e);
      this.setData({ phone });
    } catch {
      // 用户拒绝授权或解密失败
      wx.showToast({ title: '获取手机号失败', icon: 'none' });
    }
  },

  async onSave() {
    if (this.data.saving) return;

    const nickname = this.data.nickname.trim();
    const phone = this.data.phone.trim();
    const wechat = this.data.wechat.trim();

    if (!phone) { wx.showToast({ title: '请填写手机号', icon: 'none' }); return; }
    if (!/^1\d{10}$/.test(phone)) { wx.showToast({ title: '请输入正确的手机号', icon: 'none' }); return; }
    if (!wechat) { wx.showToast({ title: '请填写微信号', icon: 'none' }); return; }

    // 用变量承载 body（含可选 avatar），避免对象字面量的多余属性检查
    const body: { nickname: string; phone: string; wechat: string; avatar?: string } = { nickname, phone, wechat };
    if (this.data.avatar) body.avatar = this.data.avatar;

    this.setData({ saving: true });
    try {
      await userApi.saveProfile(body);
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch {
      // 错误提示已在 request 层处理
    } finally {
      this.setData({ saving: false });
    }
  },
});
