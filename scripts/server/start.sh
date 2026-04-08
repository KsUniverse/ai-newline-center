#!/bin/bash
# =============================================================
#  AI Newline Center — 启动 / 重载服务
# =============================================================
# 用法: bash /opt/ai-newline-center/scripts/start.sh
# 说明: 从 .env.production 加载环境变量，然后用 PM2 启动服务
# =============================================================

set -e

APP_DIR="/www/wwwroot/ai-newline-center"
cd "$APP_DIR"

# 检查 .env.production
if [ ! -f ".env.production" ]; then
  echo ""
  echo "❌ 未找到 $APP_DIR/.env.production"
  echo ""
  echo "   请参考模板创建配置文件:"
  echo "   cp $APP_DIR/.env.example $APP_DIR/.env.production"
  echo "   vi $APP_DIR/.env.production"
  exit 1
fi

# 加载生产环境变量（PM2 进程将继承这些变量）
set -a
# shellcheck source=/dev/null
source .env.production
set +a

# 确保日志和存储目录存在
mkdir -p logs
mkdir -p public/storage/covers
mkdir -p public/storage/videos

# 启动或热重载
if pm2 list 2>/dev/null | grep -q "ai-newline-center"; then
  echo "🔄 热重载服务（零停机）..."
  pm2 reload ecosystem.config.cjs --update-env
else
  echo "🚀 首次启动服务..."
  pm2 start ecosystem.config.cjs
fi

# 保存进程列表（pm2 startup 开机自启依赖此步骤）
pm2 save

echo ""
echo "✅ 服务运行状态:"
pm2 show ai-newline-center 2>/dev/null || pm2 status
echo ""
echo "常用命令:"
echo "  查看日志: pm2 logs ai-newline-center --lines 50"
echo "  查看状态: pm2 status"
echo "  停止服务: pm2 stop ai-newline-center"
echo "  重启服务: pm2 restart ai-newline-center"
