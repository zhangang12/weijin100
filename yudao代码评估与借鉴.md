# 前开发者 yudao 代码评估与借鉴

> 来源：`/Users/zhangang/Downloads/yudao-feifei0812-master`（前开发者代码）。
> 结论先行：**这是 yudao(芋道/ruoyi-vue-pro) Java/Spring-Boot 平台 + 前人在其上写的同域业务雏形**。
> **决策（2026-06-28，用户确认）：后端保持 NestJS，不转 Java；yudao 仅作业务/凭据/支付登录参考。**

## 1. 小程序 AppID/Secret —— 这里没有真号
仓库内所有 AppID 均为 **yudao 框架自带演示测试号**（`wx5b23ba7a5589ecbb`、`wx63c280fe3248a3e7`、`wxa4c8259e43a47829` 等，注释标明各贡献者测试号）；社交登录种子 `system_social_client` 配的也是测试号。
- **行动项**：仍需在微信公众平台**注册"微金100"小程序**，拿到真实 `AppID + AppSecret` 给后端 `.env`（`WX_APPID/WX_SECRET`）。

## 2. 前人的同域业务（作者"来财"，在 yudao-module-product 下）
| 表/类 | 对应我们 | 备注 |
|---|---|---|
| `product_goods_source` 货源/挂单 | Listing | 有 tradeType(**BUY 求购/SELL 货源**)、类目、起批量、库存、价格、性质(板料/旧料/条)、**批号**、**货源地**、**图片(≤5)**、**锁单时长** |
| `product_goods_source_trade` 货源交易 | LockOrder/Order | 买/卖家、订单状态、联系方式、微信号、结束时间 |
| `product_goods_source_breach` 违约 | DefaultRecord | 违约方(买/卖)、双方信息、原因、时间 |
| `GoldPriceSyncJob` 金价同步 | 行情对接 | **同一脉动源 `39.107.99.235:1008`** |

**完成度低、可参考但不直接用**：金价 Job 主体被注释、JSON 解析有 bug（取 `body`，实际是 `data.body[]`，我们已正确处理）；状态用字符串"0/1"；**缺保证金/价格快照/双方确认/平台代交接**；混入"美妆生产日期"模板残留字段。**整体不如我们现有设计（prisma 16 表 + 业务规则 v1.0）完整。**

## 3. 已借鉴进我们项目
- Prisma `Listing` 增补：`images`（商品图≤5）、`batchNumber`（批号）、`sourcePlace`（货源地）—— 前人有、我们之前漏的字段。
- 行情源口径确认：前人也用脉动 **1008 正式端口**，印证我们的配置；其解析 bug 我们已规避。

## 4. 待你/业务确认的两点
1. **真实 AppID/AppSecret**：注册"微金100"小程序后提供（最小启动集之一）。
2. **是否要"求购(BUY)"**：前人模型支持买家发"求购"单，但我们《业务规则 v1.0》只有"卖家发货源→买家锁价"。**要不要加求购方向？** 需业务拍板（不阻塞，先按 v1.0 卖家驱动做）。

## 5. yudao 值得参考的实现（建 Sprint 1/支付时回看）
- **微信小程序登录**（社交登录 `member/service/auth` + `system_social_client`）→ 参考我们 `jscode2session + JWT` 实现。
- **微信小程序支付** `pay/.../weixin/WxLitePayClient.java` + 钱包充值 `PayWalletRechargeServiceImpl` → 参考我们 保证金充值/代交接支付。
- 会员/等级/地址、RBAC/字典/OSS/短信 —— 作为我们自建对应能力时的字段/流程参照。
