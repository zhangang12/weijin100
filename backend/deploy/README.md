# 微金100 上线部署手册

- 服务器：阿里云 ECS `120.76.243.108`（Ubuntu）
- 接口域名：`api.weijin99.com`（小程序前端 `frontend/miniprogram/config/env.ts` 的 prod 已指向它）
- 编排：`docker-compose.prod.yml` = nginx + 后端 + postgres，数据都在宿主 `/data/`

## 0. 前置（非技术，必须先办）

| 事项 | 说明 |
|---|---|
| ICP 备案 | weijin99.com 备案通过前，域名在阿里云服务器上不能对外访问 |
| 小程序备案 | 公众平台后台提交 |
| 行情 IP 授权 | 让脉动 PulseData 客服把 `120.76.243.108` 加入白名单（正式端口 1008） |

## 1. 服务器装 docker（一次）

```bash
curl -fsSL https://get.docker.com | sudo sh -s -- --mirror Aliyun
sudo usermod -aG docker $USER   # 重新登录生效
```

## 2. 拉代码、填配置

```bash
git clone https://github.com/zhangang12/weijin100.git && cd weijin100/backend
cp .env.production.example .env
openssl rand -hex 32   # 分别生成 JWT_SECRET、ADMIN_TOKEN、PG_PASSWORD
vi .env                # 填上面三项 + WX_SECRET
```

后端启动时会自检：密钥太弱或缺微信配置直接拒绝启动。

## 3. 域名解析 + 证书

1. 阿里云 DNS：`api` 记录类型 A → `120.76.243.108`。
2. 证书：阿里云「数字证书管理服务」申请免费 DV 证书（DNS 验证，备案前即可申请），下载 **Nginx** 格式，上传到服务器：
   ```bash
   sudo cp xxx.pem /data/certs/api.weijin99.com.pem
   sudo cp xxx.key /data/certs/api.weijin99.com.key
   ```
   免费证书 90 天到期，到期前重新申请替换后执行 `docker compose -f docker-compose.prod.yml exec nginx nginx -s reload`。
3. 证书还没到位想先跑起来自测：`.env` 设 `NGINX_CONF=nginx.http.conf`（只开 80，小程序正式版不能用）。

## 4. 部署 / 更新

```bash
sh deploy/deploy.sh          # 首次和每次更新都用它（git pull 后再跑）
```

启动时自动执行数据库迁移。查看日志：`docker compose -f docker-compose.prod.yml logs -f backend`。

自测：

```bash
curl https://api.weijin99.com/api/v1/config/dict
curl "https://api.weijin99.com/api/v1/market/quote?metal=gold"   # 行情要等 IP 授权
```

## 5. 每日备份

```bash
crontab -e
0 3 * * * /home/<用户>/weijin100/backend/deploy/backup.sh >> /data/backup/backup.log 2>&1
```

## 6. 小程序后台配置（公众平台 → 开发管理 → 服务器域名）

- request 合法域名：`https://api.weijin99.com`
- uploadFile 合法域名：`https://api.weijin99.com`
- socket 合法域名：`wss://api.weijin99.com`
- downloadFile 合法域名：`https://api.weijin99.com`

## 7. 运营端操作（请求头 `x-admin-token: <ADMIN_TOKEN>`）

上线后实名为**人工审核**（`KYC_AUTO_APPROVE=false`），接入第三方三要素核验后再改自动。

| 操作 | 接口 |
|---|---|
| 待审核实名列表 | `GET /api/v1/admin/kyc?status=pending` |
| 查看证件照 | `GET /api/v1/admin/file/<frontImg 或 backImg>` |
| 通过 | `POST /api/v1/admin/kyc/<userId>/approve` |
| 驳回 | `POST /api/v1/admin/kyc/<userId>/reject`，body `{"reason":"照片不清晰"}` |
| 仲裁裁决 | `POST /api/v1/admin/orders/<订单号>/arbitration/resolve`，body `{"violator":"buyer"\|"seller"\|"none"}` |

示例：

```bash
curl -H "x-admin-token: $ADMIN_TOKEN" https://api.weijin99.com/api/v1/admin/kyc
```
