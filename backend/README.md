# 微金100 后端（Node + TypeScript）

实现《接口文档方案 v0.1》契约 + 业务规则 v1.0。**行情走真实数据源（脉动 PulseData）**，其余业务接口当前为内存 Mock（真业务状态机 / DB / 微信登录 / 支付为后续）。

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

## 配置
见 `.env.example`：`PORT / QUOTE_HTTP / QUOTE_WS / POLL_MS / CODE_GOLD/SILVER/PLATINUM`。

## 前端联调
小程序：把 `frontend/miniprogram/config/env.ts` 的 `USE_MOCK=false`、`BASE_URL` 指向本后端（开发者工具需关闭「校验合法域名」或配置域名）。已启用 CORS。

## 已实现 / 待办
- ✅ **行情真实对接**（HTTP 轮询 + WS 推送）、统一响应信封、约 40 个接口（契约齐全可联调）、CORS。
- ⬜ **真业务逻辑**：锁价快照/并发/幂等、订单状态机、保证金冻结/解冻/扣罚、违约判定、双方确认、平台代交接。
- ⬜ **持久化**（DB）、**微信登录**（`jscode2session`）、**微信支付**、**鉴权 JWT 校验**、实名 OCR。
- ⬜ **铂金正式代码**、**正式端口 IP 授权**（需运维提供后端公网 IP 给数据商）。
