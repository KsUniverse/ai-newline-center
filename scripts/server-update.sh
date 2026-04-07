#!/usr/bin/env bash
# ============================================================
# 服务器更新脚本（基于 Git）
# ============================================================
# 用途: 拉取最新代码后，一键完成重新构建和零停机重启
#
# 用法（在宝塔终端或 SSH 中执行）:
#   cd /www/wwwroot/ai-newline-center
#   bash scripts/server-update.sh
# ============================================================

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="ai-newline-center"

echo "======================================"
echo "  AI Newline Center — 更新部署"
echo "======================================"
echo "  项目目录: $APP_DIR"
echo ""

cd "$APP_DIR"

# 加载环境变量
if [[ -f "$APP_DIR/.env" ]]; then
  set -o allexport; source "$APP_DIR/.env"; set +o allexport
fi

# ---- 拉取代码 ----
echo "📥 [1/5] 拉取最新代码..."
git pull
echo "✔  代码已更新至: $(git rev-parse --short HEAD)"

# ---- 安装依赖（依赖有变化时） ----
echo ""
echo "📦 [2/5] 安装依赖..."
pnpm install --frozen-lockfile

# ---- Prisma ----
echo ""
echo "⚡ [3/5] 更新 Prisma Client..."
pnpm prisma generate

echo ""
echo "🗄️  运行数据库迁移..."
pnpm prisma migrate deploy

# ---- 构建 ----
echo ""
echo "🔨 [4/5] 构建 Next.js..."
pnpm run build

# ---- 整理 Standalone ----
echo ""
echo "📁 [4.5] 整理 standalone..."
cp -r .next/static .next/standalone/.next/static
rsync -a --exclude='storage/' public/ .next/standalone/public/ 2>/dev/null || true
mkdir -p .next/standalone/public/storage/covers .next/standalone/public/storage/videos
# 确保 standalone 内的 .env 同步最新
cp .env .next/standalone/.env

# ---- 重启 ----
echo ""
echo "♻️  [5/5] 重启应用..."
if pm2 describe "$APP_NAME" &>/dev/null; then
  pm2 reload "$APP_NAME" --update-env
  echo "✔  应用已零停机重载"
else
  echo "⚠️  PM2 进程不存在，执行首次启动..."
  pm2 start "$APP_DIR/ecosystem.config.js" --env production
  pm2 save
fi

echo ""
echo "======================================"
echo "  ✅ 更新完成！版本: $(git rev-parse --short HEAD)"
echo "======================================"
echo "  查看日志: pm2 logs ${APP_NAME}"
echo "======================================"
