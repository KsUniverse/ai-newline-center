#!/usr/bin/env bash
# ============================================================
# 本地打包脚本 — Mac / Linux
# ============================================================
# 用途: 在本地构建 Next.js standalone 产物并打包成 deploy.tar.gz
#        上传到服务器后用 scripts/server-deploy.sh 部署
#
# 用法:
#   bash scripts/local-pack.sh
#
# 前提:
#   - 已安装 Node.js 20 + pnpm
#   - .env 文件中有可用的 DATABASE_URL（用于 prisma generate）
#
# 产物: deploy.tar.gz（约 50-200MB，含 standalone + prisma 迁移文件）
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "======================================"
echo "  AI Newline Center — 本地打包"
echo "======================================"
echo ""

cd "$PROJECT_DIR"

# 检查 pnpm
if ! command -v pnpm &>/dev/null; then
  echo "❌ 未找到 pnpm，请先安装: npm install -g pnpm"
  exit 1
fi

echo "📦 [1/5] 安装依赖..."
pnpm install --frozen-lockfile

echo "⚡ [2/5] 生成 Prisma Client..."
pnpm prisma generate

echo "🔨 [3/5] 构建 Next.js..."
pnpm run build

echo "📁 [4/5] 整理部署文件..."
rm -rf .deploy-tmp
mkdir -p .deploy-tmp/standalone

# Standalone 产物
cp -r .next/standalone/. .deploy-tmp/standalone/
# 静态资源必须手动复制进 standalone
cp -r .next/static .deploy-tmp/standalone/.next/static
# public 目录（注意: storage/ 子目录在服务器运行时生成，跳过）
rsync -a --exclude='storage/' public/ .deploy-tmp/standalone/public/ 2>/dev/null || \
  { mkdir -p .deploy-tmp/standalone/public; find public -maxdepth 1 -not -name 'storage' | tail -n +2 | xargs -I{} cp -r {} .deploy-tmp/standalone/public/ 2>/dev/null || true; }

# Prisma 迁移文件（服务器端执行 migrate deploy）
cp -r prisma .deploy-tmp/prisma
cp package.json .deploy-tmp/

# PM2 配置 + 部署脚本
cp ecosystem.config.js .deploy-tmp/
cp scripts/server-deploy.sh .deploy-tmp/

echo "🗜️  [5/5] 压缩打包..."
cd .deploy-tmp
tar -czf "$PROJECT_DIR/deploy.tar.gz" .
cd "$PROJECT_DIR"
rm -rf .deploy-tmp

FILESIZE=$(du -sh deploy.tar.gz | cut -f1)
echo ""
echo "======================================"
echo "  ✅ 打包完成！"
echo "======================================"
echo "  📦 文件: deploy.tar.gz ($FILESIZE)"
echo ""
echo "  下一步:"
echo "  1. 通过宝塔文件管理器将 deploy.tar.gz 上传到服务器"
echo "     目标路径: /www/wwwroot/ai-newline-center/"
echo "  2. 在宝塔终端或 SSH 执行:"
echo "     cd /www/wwwroot/ai-newline-center"
echo "     tar -xzf deploy.tar.gz"
echo "     bash server-deploy.sh"
echo "======================================"
