// 结果页：成功 / 失败，操作区用 slot
Component({
  properties: {
    status: { type: String, value: 'ok' }, // ok | err
    title: { type: String, value: '' },
    desc: { type: String, value: '' },
  },
});
