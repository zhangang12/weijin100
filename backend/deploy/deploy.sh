#!/bin/sh
# 微金100 一键部署 / 更新（在服务器 backend/ 目录执行：sh deploy/deploy.sh）
set -eu
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "❌ 缺 backend/.env：cp .env.production.example .env 后填真值"; exit 1; }
command -v docker >/dev/null || { echo "❌ 未安装 docker，见 deploy/README.md 第 1 步"; exit 1; }

NGINX_CONF=$(grep -E '^NGINX_CONF=' .env | cut -d= -f2 || true)
NGINX_CONF=${NGINX_CONF:-nginx.conf}

sudo mkdir -p /data/pgdata /data/uploads/listing /data/uploads/avatar /data/certs /data/acme /data/backup

if [ "$NGINX_CONF" = "nginx.conf" ] && [ ! -f /data/certs/api.weijin99.com.pem ]; then
  echo "❌ 证书不在 /data/certs/api.weijin99.com.pem(.key)。先放证书，或 .env 设 NGINX_CONF=nginx.http.conf 先跑 HTTP"
  exit 1
fi

# 系统自带 nginx 会占 80/443，与容器冲突
if systemctl is-active --quiet nginx 2>/dev/null; then
  echo "→ 停用系统自带 nginx（改由容器 nginx 对外）"
  sudo systemctl stop nginx && sudo systemctl disable nginx
fi

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload 2>/dev/null || true

echo "→ 等待后端启动…"
for i in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml exec -T backend wget -qO- http://127.0.0.1:3100/api/v1/config/dict >/dev/null 2>&1; then
    echo "✅ 后端已就绪"; docker compose -f docker-compose.prod.yml ps; exit 0
  fi
  sleep 2
done
echo "❌ 后端 60 秒未就绪，查看日志：docker compose -f docker-compose.prod.yml logs --tail=100 backend"
exit 1
