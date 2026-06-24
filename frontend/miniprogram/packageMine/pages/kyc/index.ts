import { userApi } from '../../../api/index';
import type { KycInfo } from '../../../types/biz';

interface KycData {
  loading: boolean;
  status: KycInfo['status'];   // none / pending / verified / rejected
  // 只读态展示
  realName: string;
  idCardNo: string;
  // 未认证态表单
  formName: string;
  formIdCard: string;
  frontFiles: string[];        // 人像面 uploader value（最多 1）
  backFiles: string[];         // 国徽面 uploader value（最多 1）
  submitting: boolean;
}

Page<KycData, WechatMiniprogram.IAnyObject>({
  data: {
    loading: true,
    status: 'none',
    realName: '',
    idCardNo: '',
    formName: '',
    formIdCard: '',
    frontFiles: [],
    backFiles: [],
    submitting: false,
  },

  onLoad() {
    this.load();
  },

  async load() {
    try {
      const kyc = await userApi.getKyc();
      this.setData({
        loading: false,
        status: kyc.status,
        realName: kyc.realName || '',
        idCardNo: kyc.idCardNo || '',
      });
    } catch {
      // 错误提示已在 request 层处理；停在未认证态让用户可重试
      this.setData({ loading: false, status: 'none' });
    }
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ formName: e.detail.value });
  },

  onIdInput(e: WechatMiniprogram.Input) {
    this.setData({ formIdCard: e.detail.value.replace(/\s/g, '') });
  },

  onFrontChange(e: WechatMiniprogram.CustomEvent<{ value: string[] }>) {
    this.setData({ frontFiles: e.detail.value });
  },

  onBackChange(e: WechatMiniprogram.CustomEvent<{ value: string[] }>) {
    this.setData({ backFiles: e.detail.value });
  },

  async onSubmit() {
    if (this.data.submitting) return;

    const realName = this.data.formName.trim();
    const idCardNo = this.data.formIdCard.trim();
    const frontFileId = this.data.frontFiles[0] || '';
    const backFileId = this.data.backFiles[0] || '';

    if (!realName) { wx.showToast({ title: '请填写真实姓名', icon: 'none' }); return; }
    if (!idCardNo) { wx.showToast({ title: '请填写身份证号', icon: 'none' }); return; }
    if (!frontFileId) { wx.showToast({ title: '请上传身份证人像面', icon: 'none' }); return; }
    if (!backFileId) { wx.showToast({ title: '请上传身份证国徽面', icon: 'none' }); return; }

    this.setData({ submitting: true });
    try {
      await userApi.submitKyc({ realName, idCardNo, frontFileId, backFileId });
      wx.showToast({ title: '提交成功（Mock）', icon: 'success' });
      // 提交后切只读态展示本次填写信息（真接口可能为 pending 审核态，这里乐观切 verified）
      this.setData({
        status: 'verified',
        realName,
        idCardNo,
      });
    } catch {
      // 错误提示已在 request 层处理
    } finally {
      this.setData({ submitting: false });
    }
  },
});
