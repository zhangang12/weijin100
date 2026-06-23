# 微金100 小程序前端（原生 + TypeScript）

贵金属 C2C 撮合小程序的前端工程。**前后端分离**，接口契约见仓库根目录《接口文档方案 v0.1》。

## 运行

1. 用**微信开发者工具** → 「导入项目」→ 选择本 `frontend/` 目录。
2. **AppID**：填你的真实 AppID。`project.config.json` 当前用 `touristappid`（测试号，部分能力受限）。
3. TypeScript 由开发者工具内置编译（`useCompilerPlugins: ["typescript"]`），无需手动构建。
4. 默认 **`USE_MOCK = true`**（`miniprogram/config/env.ts`）：**无需后端即可跑通首页**。联调时改为 `false` 并配置 `BASE_URL`。

## 目录结构

```
frontend/
├─ project.config.json        微信项目配置（miniprogramRoot=miniprogram/）
├─ tsconfig.json / package.json
└─ miniprogram/
   ├─ app.json                页面/分包/tabBar/window
   ├─ app.ts / app.wxss
   ├─ styles/tokens.wxss      设计令牌（红涨绿跌、奶油金）
   ├─ config/env.ts           环境 + USE_MOCK 开关 + BASE_URL/WS
   ├─ types/api.ts            接口类型（对齐 v0.1）
   ├─ utils/
   │  ├─ request.ts           统一请求（信封/错误码/401刷新/Mock开关）
   │  ├─ auth.ts              wx.login→JWT、refresh、getPhoneNumber 一键授权
   │  ├─ guard.ts             静默校验（操作前查资质→跳「我的」补全）
   │  └─ format.ts            金额/克重/起批量/红涨绿跌格式化
   ├─ mock/index.ts           本地 Mock 数据（首页可离线跑通）
   ├─ api/index.ts            类型化接口函数
   ├─ components/
   │  ├─ price-card/          金价大盘卡
   │  └─ goods-row/           挂单行（含锁价按钮，触发 lock 事件）
   ├─ pages/                  home(已实现) / market / publish / order / mine(占位)
   └─ packageLock/            买家锁价分包（占位）
```

## 关键约定

- **设计令牌**：所有颜色/圆角用 `var(--xxx)`（定义在 `styles/tokens.wxss` 的 `page` 上，自定义属性会继承进组件）。**红涨绿跌**：`--up` 红=涨、`--down` 绿=跌。
- **金额以后端为准**，前端仅展示/试算；金额建议「分」整数传输。
- **静默校验**：点「锁价/发布」先 `requireEligibility()` 查资质，缺则跳「我的」补全页（补全页待开发）。
- **Mock 开关**：`config/env.ts` 的 `USE_MOCK`；`utils/request.ts` 据此走 `mock/` 或真实 `wx.request`。

## 已实现 / 待办

- ✅ 工程脚手架 + 分包 + tabBar；请求层/鉴权/守卫/令牌/类型/Mock/API。
- ✅ **行情首页竖切**：金价大盘卡 + 筛选 chips + 挂单列表（金价卡/挂单行组件）+ 锁价跳转（走守卫）。
- ⬜ 其余 tab 页（行情/发布/订单/我的）、买家锁价/我的/订单/发布分包页面。
- ⬜ 组件库其余组件（等级徽标抽组件、数字键盘、底部弹窗、结果页、上传…）。
- ⬜ 真接口联调（`USE_MOCK=false`）、WebSocket 行情、微信支付、实名 OCR。

## 类型检查

```bash
cd frontend && npm install && npm run typecheck
```

（需安装 `miniprogram-api-typings` 才能解析 `wx` 全局类型。）
