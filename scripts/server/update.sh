#!/bin/bash
# =============================================================
#  AI Newline Center — 版本更新脚本
# =============================================================
# 用法: bash /opt/ai-newline-center/scripts/update.sh /tmp/app-v0.x.x.tar.gz
#
# 说明:
#   - 原地更新，不影响 .env.production 和 public/storage/ 用户数据
#   - 自动运行数据库迁移（无变化时自动跳过）
#   - PM2 热重载，零停机更新
# =============================================================

set -e

ARCHIVE="${1:?用法: bash update.sh /tmp/app-v0.x.x.tar.gz}"
APP_DIR="/www/wwwroot/ai-newline-center"

# 检查应用目录
if [ ! -d "$APP_DIR" ]; then
  echo "❌ 应用目录不存在，请先执行首次部署:"
  echo "   mkdir -p $APP_DIR"
  echo "   tar -xzf $ARCHIVE -C $APP_DIR/"
  echo "   bash $APP_DIR/scripts/setup.sh"
  exit 1
fi

# 检查 .env.production
if [ ! -f "$APP_DIR/.env.production" ]; then
  echo "❌ 未找到 $APP_DIR/.env.production，请先完成首次部署配置"
  exit 1
fi

echo ""
echo "============================================================"
echo "  AI Newline Center — 版本更新"
echo "============================================================"

# ─── 1. 解压新版本 ────────────────────────────────────────────
echo ""
echo "[1/3] 解压新版本..."
echo "  (保留 .env.production 和 public/storage/ 用户数据)"
# .env.production 和 public/storage 不在包内，不会被覆盖
tar -xzf "$ARCHIVE" -C "$APP_DIR"

# 确保存储目录和日志目录存在
mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/public/storage/covers"
mkdir -p "$APP_DIR/public/storage/videos"
echo "  ✓ 解压完成"

# ─── 2. 生成 Prisma Client ───────────────────────────────────
echo ""
echo "[2/4] 生成 Prisma Client..."
cd "$APP_DIR"
set -a
# shellcheck source=/dev/null
source .env.production
set +a
PRISMA_VERSION=$(cat "$APP_DIR/prisma/.prisma-version" 2>/dev/null || echo "6")
PRISMA_BOOTSTRAP_DIR="/tmp/ai-newline-prisma-bootstrap"
mkdir -p "$PRISMA_BOOTSTRAP_DIR"
if [ ! -f "$PRISMA_BOOTSTRAP_DIR/package.json" ]; then
  cat > "$PRISMA_BOOTSTRAP_DIR/package.json" <<'EOF'
{
  "name": "ai-newline-prisma-bootstrap",
  "private": true
}
EOF
fi

echo "  在临时目录安装 prisma@$PRISMA_VERSION 与 @prisma/client@$PRISMA_VERSION..."
npm install --prefix "$PRISMA_BOOTSTRAP_DIR" --no-save --omit=dev "prisma@$PRISMA_VERSION" "@prisma/client@$PRISMA_VERSION"

APP_PRISMA_CLIENT_DIR=$(node -e "const fs=require('node:fs'); console.log(fs.realpathSync(process.argv[1]))" "$APP_DIR/node_modules/@prisma/client")
APP_PRISMA_RUNTIME_DIR="$APP_PRISMA_CLIENT_DIR/runtime"
BOOTSTRAP_PRISMA_RUNTIME_DIR="$PRISMA_BOOTSTRAP_DIR/node_modules/@prisma/client/runtime"

echo "  补齐 @prisma/client/runtime ..."
rm -rf "$APP_PRISMA_RUNTIME_DIR"
cp -R "$BOOTSTRAP_PRISMA_RUNTIME_DIR" "$APP_PRISMA_RUNTIME_DIR"

echo "  使用临时 Prisma CLI 生成客户端..."
"$PRISMA_BOOTSTRAP_DIR/node_modules/.bin/prisma" generate --schema "$APP_DIR/prisma/schema.prisma"
echo "  ✓ Prisma Client 已按服务器环境生成"

# ─── 3. 数据库迁移 ────────────────────────────────────────────
echo ""
echo "[3/4] 运行数据库迁移..."
npx --yes "prisma@$PRISMA_VERSION" migrate deploy --schema "$APP_DIR/prisma/schema.prisma"
echo "  ✓ 数据库结构已同步（无变化时自动跳过）"

# ─── 4. 重启服务 ──────────────────────────────────────────────
echo ""
echo "[4/4] 热重载服务..."
bash "$APP_DIR/scripts/start.sh"

echo ""
echo "============================================================"
echo "  ✅ 更新完成!"
echo "============================================================"
