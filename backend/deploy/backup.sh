#!/bin/bash
# 微金100 每日备份：PostgreSQL + uploads（金融数据，不可省）
# 部署到 ECS 后加 cron：  0 3 * * *  /path/backend/deploy/backup.sh >> /data/backup/backup.log 2>&1
set -euo pipefail

PG_CONTAINER=${PG_CONTAINER:-weijin100-pg}
PG_USER=${PG_USER:-weijin}
PG_DB=${PG_DB:-weijin100}
DIR=${BACKUP_DIR:-/data/backup}
KEEP_DAYS=${KEEP_DAYS:-14}
TS=$(date +%Y%m%d_%H%M%S)

mkdir -p "$DIR"

# 1) 数据库
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$DIR/db_$TS.sql.gz"

# 2) 上传文件
if [ -d /data/uploads ]; then
  tar czf "$DIR/uploads_$TS.tar.gz" -C /data uploads
fi

# 3) 清理过期 + （可选）同步异地/OSS
find "$DIR" -name "*.gz" -mtime +"$KEEP_DAYS" -delete
# 建议再加：ossutil cp "$DIR/db_$TS.sql.gz" oss://your-bucket/backup/  （异地留一份）

echo "✅ backup done: $TS"
