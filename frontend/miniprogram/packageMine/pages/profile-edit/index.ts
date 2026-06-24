import { userApi } from '../../../api/index';
import { resolvePhoneNumber } from '../../../utils/auth';
import type { Profile } from '../../../types/models';

interface ProfileEditData {
  loading: boolean;
  saving: boolean;
  // 只读展示
  weijinNo: string;
  realNameMasked: string;
  level: string;
  // 可编辑表单
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
    this.setData({ nickname: e.detail.value });
  },

  onPhoneInput(e: WechatMiniprogram.Input) {
    this.setData({ phone: e.detail.value.replace(/\s/g, '') });
  },

  onWechatInput(e: WechatMiniprogram.Input) {
    this.setData({ wechat: e.detail.value.trim() });
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
    if (!wechat) { wx.showToast({ title: '请填写微信号', icon: 'none' }); return; }

    this.setData({ saving: true });
    try {
      await userApi.saveProfile({ nickname, phone, wechat });
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch {
      // 错误提示已在 request 层处理
    } finally {
      this.setData({ saving: false });
    }
  },
});
