import { addressApi } from '../../../api/index';
import type { Address } from '../../../types/biz';

const MAX_ADDRESS = 5; // 业务规则 H4：最多 5 个地址

type AddrType = Address['type'];

interface FormState {
  type: AddrType;
  contact: string;
  phone: string;
  region: string;
  detail: string;
  isDefault: boolean;
}

interface AddressViewData {
  list: Address[];
  loading: boolean;
  isFull: boolean;        // 是否已满 5 个
  showSheet: boolean;     // 新增弹窗显隐
  saving: boolean;        // 保存中（防重复提交）
  form: FormState;
}

const emptyForm = (): FormState => ({
  type: 'receive',
  contact: '',
  phone: '',
  region: '',
  detail: '',
  isDefault: false,
});

Page<AddressViewData, WechatMiniprogram.IAnyObject>({
  data: {
    list: [],
    loading: true,
    isFull: false,
    showSheet: false,
    saving: false,
    form: emptyForm(),
  },

  onLoad() {
    this.loadList();
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const list = await addressApi.list();
      this.setData({ list, isFull: list.length >= MAX_ADDRESS });
    } catch {
      // 错误提示已在 request 层统一处理
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 设为默认 */
  async onSetDefault(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id);
    const target = this.data.list.find((a) => a.id === id);
    if (!target || target.isDefault) return;
    try {
      await addressApi.setDefault(id);
      await this.loadList();
      wx.showToast({ title: '已设为默认', icon: 'success' });
    } catch {
      // 已统一处理
    }
  },

  /** 删除地址（二次确认） */
  onRemove(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id);
    wx.showModal({
      title: '删除地址',
      content: '确定删除该地址吗？',
      confirmColor: '#B8913F',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await addressApi.remove(id);
          await this.loadList();
          wx.showToast({ title: '已删除', icon: 'success' });
        } catch {
          // 已统一处理
        }
      },
    });
  },

  /** 打开新增弹窗 */
  onAdd() {
    if (this.data.isFull) {
      wx.showToast({ title: `最多 ${MAX_ADDRESS} 个地址`, icon: 'none' });
      return;
    }
    this.setData({ form: emptyForm(), showSheet: true });
  },

  onCloseSheet() {
    this.setData({ showSheet: false });
  },

  onPickType(e: WechatMiniprogram.TouchEvent) {
    const type = String(e.currentTarget.dataset.type) as AddrType;
    this.setData({ 'form.type': type });
  },

  onContactInput(e: WechatMiniprogram.Input) {
    this.setData({ 'form.contact': e.detail.value });
  },
  onPhoneInput(e: WechatMiniprogram.Input) {
    this.setData({ 'form.phone': e.detail.value });
  },
  onRegionInput(e: WechatMiniprogram.Input) {
    this.setData({ 'form.region': e.detail.value });
  },
  onDetailInput(e: WechatMiniprogram.Input) {
    this.setData({ 'form.detail': e.detail.value });
  },
  onToggleDefault(e: WechatMiniprogram.SwitchChange) {
    this.setData({ 'form.isDefault': e.detail.value });
  },

  /** 保存：校验必填 → save → 刷新列表 */
  async onSave() {
    if (this.data.saving) return;
    const { contact, phone, detail } = this.data.form;
    if (!contact.trim()) {
      wx.showToast({ title: '请填写联系人', icon: 'none' });
      return;
    }
    if (!phone.trim()) {
      wx.showToast({ title: '请填写电话', icon: 'none' });
      return;
    }
    if (!detail.trim()) {
      wx.showToast({ title: '请填写详细地址', icon: 'none' });
      return;
    }

    const body: Partial<Address> = {
      type: this.data.form.type,
      contact: contact.trim(),
      phone: phone.trim(),
      region: this.data.form.region.trim(),
      detail: detail.trim(),
      isDefault: this.data.form.isDefault,
    };

    this.setData({ saving: true });
    try {
      await addressApi.save(body);
      this.setData({ showSheet: false });
      await this.loadList();
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch {
      // 已统一处理
    } finally {
      this.setData({ saving: false });
    }
  },
});
