// 挂单行：头像 + 脱敏账号 + 等级徽标 + 库存/起批 + 现金/转账双价 + 锁价按钮
// 期望 item 已由父页面补充：avatarChar / levelTier / moqText
Component({
  properties: {
    item: { type: Object },
  },
  methods: {
    onLock() {
      const item = this.properties.item as unknown as { listingId: string } | null;
      if (item) this.triggerEvent('lock', { listingId: item.listingId });
    },
  },
});
