#!/usr/bin/env bash
# ============================================================
# PostgreSQL → MySQL 数据导出脚本
# ============================================================
# 用途: 从旧的 PostgreSQL 数据库导出所有数据，生成可以在 MySQL 中执行的 INSERT 语句
#
# 用法:
#   bash scripts/export-pg-data.sh
#
# 前提:
#   - 已安装 PostgreSQL 客户端 (psql, pg_dump)
#   - .env 文件中有有效的 DATABASE_URL (postgresql://...)
#
# 产物: scripts/pg-data-export.sql (INSERT 语句集合)
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_FILE="$SCRIPT_DIR/pg-data-export.sql"

echo "======================================"
echo "  PostgreSQL 数据导出"
echo "======================================"

# 加载 .env
if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -o allexport; source "$PROJECT_DIR/.env"; set +o allexport
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ 未设置 DATABASE_URL，请检查 .env 文件"
  exit 1
fi

# 解析数据库连接信息（格式: postgresql://user:pass@host:port/db）
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\)[:/].*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*@[^:]*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

DB_PORT="${DB_PORT:-5432}"

echo "数据库: $DB_NAME @ $DB_HOST:$DB_PORT"

# 检查 pg_dump
if ! command -v pg_dump &>/dev/null; then
  echo "❌ 未找到 pg_dump，请安装 PostgreSQL 客户端"
  echo "  macOS: brew install postgresql"
  echo "  Ubuntu: apt install postgresql-client"
  exit 1
fi

echo ""
echo "🗄️  导出数据中..."

# 导出所有表的 INSERT 语句（保持数据完整性的顺序）
PGPASSWORD="$DB_PASS" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --data-only \
  --inserts \
  --no-owner \
  --no-acl \
  --column-inserts \
  -t organizations \
  -t users \
  -t douyin_accounts \
  -t benchmark_accounts \
  -t benchmark_account_members \
  -t employee_collection_videos \
  -t douyin_login_sessions \
  -t douyin_videos \
  -t benchmark_videos \
  -t video_snapshots \
  -t benchmark_video_snapshots \
  -t ai_model_configs \
  -t ai_step_bindings \
  -t ai_workspaces \
  -t ai_workspace_transcripts \
  -t ai_transcript_segments \
  -t ai_decomposition_annotations \
  -t ai_rewrite_drafts \
  -t transcriptions \
  > "$OUTPUT_FILE.pg_raw"

echo "✔  原始导出完成"
echo ""
echo "🔄  转换 PostgreSQL → MySQL 格式差异..."

# 写入 MySQL 兼容的头部
cat > "$OUTPUT_FILE" << 'HEADER'
-- ============================================================
-- PostgreSQL → MySQL 数据迁移 INSERT 语句
-- 注意事项：
--   1. 请先执行 mysql-ddl.sql 创建所有表
--   2. 检查 tags 字段 - PostgreSQL 数组格式 '{"a","b"}' 需手动转换为 '["a","b"]'
--   3. 外键约束可能导致顺序问题，如报错可临时禁用：SET FOREIGN_KEY_CHECKS=0;
--   4. 执行完毕后重新启用：SET FOREIGN_KEY_CHECKS=1;
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;
SET time_zone='+08:00';

HEADER

# 过滤掉 PostgreSQL 特有的语句，保留 INSERT
grep "^INSERT INTO" "$OUTPUT_FILE.pg_raw" >> "$OUTPUT_FILE" 2>/dev/null || true

# 追加尾部
echo "" >> "$OUTPUT_FILE"
echo "SET FOREIGN_KEY_CHECKS=1;" >> "$OUTPUT_FILE"

# 清理临时文件
rm -f "$OUTPUT_FILE.pg_raw"

LINE_COUNT=$(grep -c "^INSERT INTO" "$OUTPUT_FILE" 2>/dev/null || echo "0")

echo ""
echo "======================================"
echo "  ✅ 数据导出完成！"
echo "======================================"
echo "  文件: $OUTPUT_FILE"
echo "  INSERT 语句数: $LINE_COUNT"
echo ""
echo "  ⚠️  重要提醒:"
echo "  如果 douyin_videos 或 benchmark_videos 中有 tags 数据，"
echo "  PostgreSQL 数组格式为 '{\"tag1\",\"tag2\"}'"
echo "  需要手动转换为 MySQL JSON 格式 '[\"tag1\",\"tag2\"]'"
echo ""
echo "  在 MySQL 中执行数据导入:"
echo "  mysql -u USER -p DATABASE < scripts/mysql-ddl.sql"
echo "  mysql -u USER -p DATABASE < scripts/pg-data-export.sql"
echo "======================================"
