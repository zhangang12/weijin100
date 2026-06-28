# 微金100 后端（NestJS + TypeScript）

实现《接口文档方案 v0.1》契约 + 业务规则 v1.0。**行情走真实数据源（脉动 PulseData）**，其余业务接口当前为内存 Mock（真业务状态机将逐模块替换，路径/结构不变）。技术栈：NestJS + PostgreSQL(Prisma) + Redis；总体方案见根目录 [技术方案与开发计划_v1.md](../技术方案与开发计划_v1.md)，数据模型见 [prisma/schema.prisma](prisma/schema.prisma)。

## 一键启动
```bash
cd backend
npm install      # 首次
npm start        # 默认 http://localhost:3100
```
或双击 **`启动.command`**（macOS，自动 install + start）。

- REST：`http://localhost:3100/api/v1`
- WS：`ws://localhost:3100/ws/market`（连接即推 snapshot，2s 推 tick，支持 `{ping}` 心跳）
- 自检：`http://localhost:3100/api/v1/market/quote?metal=gold`

## 行情数据源（脉动 PulseData）

| 项 | 说明 |
|---|---|
| 测试端口（默认） | HTTP `:8090/getQuote.php`、WS `:8889`；**无需 IP 授权**，但**仅奇偶小时限时**（融通金/伦敦金属偶数小时） |
| 正式端口 | HTTP `:1008/getQuote.php`、WS `/ws`；**必须先联系数据商客服 `@mdapi888` 授权后端服务器公网 IP**，否则返回「IP 未授权」 |
| 代码映射 | 黄金=`RT_AU`（融通金，对应「融通足金价」）、白银=`RT_AG`、铂金=`RT_PT`（免费库无，正式库待确认） |
| 字段映射 | `Price/Diff/DiffRate/High/Low/Time` → `PriceSnapshot`；**销售价/回购价/溢价为平台派生**（见 `config.PRICE_CFG`，业务 G1/G2，最终由后端+业务定） |
| 容错 | 拉取失败（限时/未授权/网络）保留上次缓存；首启无数据时 `/market/quote` 用 `FALLBACK_QUOTE` 兜底 |

切正式：改 `.env` 的 `QUOTE_HTTP/QUOTE_WS` 为 1008/`/ws` 并授权 IP 即可，代码无需改。

> 行情/Mock 接口**无需数据库**即可启动（`npm start` 即可联调）。下列 DB/Redis 仅为后续真业务逻辑准备。

## 数据库 / 缓存（本地，后续真逻辑用）
```bash
docker compose -f docker-compose.dev.yml up -d   # 起 PostgreSQL + Redis
cp .env.example .env                              # 配置 DATABASE_URL/REDIS_URL（已含本地默认值）
npx prisma migrate dev --name init                # 按 prisma/schema.prisma 建表
```

## 配置
见 `.env.example`：服务 `PORT`；行情 `QUOTE_HTTP/QUOTE_WS/POLL_MS/CODE_*`；`DATABASE_URL/REDIS_URL`；鉴权 `JWT_*`；微信 `WX_*/WXPAY_*`；阿里云 `OSS_*/SMS_*`（后三类待业务/运维提供）。

## 前端联调
小程序：把 `frontend/miniprogram/config/env.ts` 的 `USE_MOCK=false`、`BASE_URL` 指向本后端（开发者工具需关闭「校验合法域名」或配置域名）。已启用 CORS。

## 已实现 / 待办

**✅ 已实现真库（Sprint 0–4，全链路验证通过）**
- 工程骨架：信封拦截器 + 异常过滤器(业务码段) + 全局前缀 `/api/v1` + CORS；infra 驱动抽象(wechat/storage-local/sms)。
- 行情真实对接（脉动 PulseData，HTTP 轮询 + WS 推送 + 兜底）。
- **鉴权**：微信登录 `jscode2session`(dev 支持 `mock:<openid>`) + JWT(access/refresh) + 游客/鉴权守卫。
- **账户**：me/profile·kyc·eligibility、保证金 account/recharge/refund + freeze/unfreeze/deduct、级别。
- **挂单**：浏览/详情/发布(实名+保证金校验)；**地址**、**金价提醒** CRUD。
- **锁价核心闭环**：快照(A3) + 先到先得扣库存(A4 原子) + 冻结保证金(C5) + 生成订单(4h倒计时) + 双方确认完成(解冻+成交数+1) + 仲裁。
- **违约/申诉**：明细/汇总/申诉 + 违约判定服务(扣罚/降级/受限)。
- 金额全程「分」整数对账正确；数据模型 16 表；本机 PG 已迁移+种子。

**⬜ 待外部依赖 / 后续**
- **微信支付 V3**（保证金充值真扣款、平台代交接 ¥100）——待商户号。
- **违约自动判定 / 24h 自动完成 / T+1 退款**（BullMQ 延时任务）——待 Redis(Sprint 3 中间件)。
- **实名 OCR + 人脸核身**（当前 dev 直接置 verified）——待资质。
- **正式行情端口 IP 授权 + 铂金代码**；微信手机号解密；幂等键(Redis)。
- 部署：`docker-compose.prod` + Nginx + 备份脚本（架构见 `../架构方案与实施计划_v2.md`）。
