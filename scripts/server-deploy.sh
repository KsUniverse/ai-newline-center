#!/usr/bin/env bash
# ============================================================
# 服务器部署脚本（解包方式）
# ============================================================
# 用途: 在服务器上将上传的 deploy.tar.gz 解包并启动/重启应用
#
# 用法（在宝塔终端或 SSH 中执行）:
#   cd /www/wwwroot/ai-newline-center
#   tar -xzf deploy.tar.gz           # 如果还没解包
#   bash server-deploy.sh
#
# 前提（宝塔软件商店安装）:
#   - Node.js 20+
#   - PM2（npm install -g pm2）
#   - PostgreSQL 16（数据库已创建）
#   - Redis 7
#
# 首次部署前:
#   cp .env.production.example .env
#   nano .env   # 填写数据库密码、Redis密码、NEXTAUTH_SECRET 等
# ============================================================

set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="ai-newline-center"
STANDALONE_DIR="$DEPLOY_DIR/standalone"
LOG_DIR="$DEPLOY_DIR/logs"

echo "======================================"
echo "  AI Newline Center — 服务器部署"
echo "======================================"
echo "  部署目录: $DEPLOY_DIR"
echo ""

# ---- 检查 .env ----
if [[ ! -f "$DEPLOY_DIR/.env" ]]; then
  if [[ -f "$DEPLOY_DIR/.env.production.example" ]]; then
    echo "⚠️  未找到 .env 文件！"
    echo "请执行: cp $DEPLOY_DIR/.env.production.example $DEPLOY_DIR/.env"
    echo "然后编辑 .env 填写正确的数据库密码、NEXTAUTH_SECRET 等"
    exit 1
  else
    echo "❌ 未找到 .env 文件，且没有 .env.production.example 可供参考"
    echo "请创建 $DEPLOY_DIR/.env 文件"
    exit 1
  fi
fi

# 加载环境变量
set -o allexport
source "$DEPLOY_DIR/.env"
set +o allexport

# ---- 检查 Node.js ----
if ! command -v node &>/dev/null; then
  echo "❌ 未找到 Node.js，请通过宝塔软件商店安装 Node.js 20"
  exit 1
fi
NODE_VER=$(node -v)
echo "✔  Node.js: $NODE_VER"

# ---- 检查 PM2 ----
if ! command -v pm2 &>/dev/null; then
  echo "⚠️  PM2 未安装，正在安装..."
  npm install -g pm2
fi
PM2_VER=$(pm2 -v)
echo "✔  PM2: $PM2_VER"

# ---- 检查 standalone 目录 ----
if [[ ! -f "$STANDALONE_DIR/server.js" ]]; then
  echo "❌ 未找到 $STANDALONE_DIR/server.js"
  echo "请确保已正确解压 deploy.tar.gz"
  exit 1
fi

# ---- 创建日志目录 ----
mkdir -p "$LOG_DIR"

# ---- 运行数据库迁移 ----
echo ""
echo "🗄️  运行数据库迁移..."
# 使用 npx 下载并运行 prisma（避免依赖本地安装）
cd "$DEPLOY_DIR"
DATABASE_URL="${DATABASE_URL}" \
  npx --yes prisma@6 migrate deploy \
  --schema="$DEPLOY_DIR/prisma/schema.prisma"
echo "✔  数据库迁移完成"

# ---- 种子数据（仅首次：标记文件防止重复执行）----
SEED_FLAG="$DEPLOY_DIR/.seed-done"
if [[ ! -f "$SEED_FLAG" ]]; then
  echo ""
  echo "🌱 初始化种子数据（首次部署）..."
  # standalone 中无法直接运行 seed.ts，跳过（种子数据可通过管理后台创建）
  # 如需执行种子，请在有完整 node_modules 的环境中运行 pnpm db:seed
  echo "⚠️  提示: 种子数据需在有完整源码的环境中运行 pnpm db:seed"
  echo "     或通过应用管理后台创建初始数据"
  touch "$SEED_FLAG"
fi

# ---- 写入 PM2 ecosystem（动态设置正确的 cwd 和日志路径）----
echo ""
echo "⚙️  写入 PM2 配置..."
cat > "$DEPLOY_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: "${APP_NAME}",
    script: "server.js",
    cwd: "${STANDALONE_DIR}",
    instances: 1,
    exec_mode: "fork",
    env_production: {
      NODE_ENV: "production",
      PORT: "${PORT:-3000}",
      HOSTNAME: "0.0.0.0",
    },
    error_file: "${LOG_DIR}/pm2-error.log",
    out_file: "${LOG_DIR}/pm2-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    watch: false,
    max_memory_restart: "1G",
    autorestart: true,
    restart_delay: 3000,
  }]
};
EOF

# 将 .env 中的环境变量复制到 standalone 目录（PM2 从 cwd 读取）
cp "$DEPLOY_DIR/.env" "$STANDALONE_DIR/.env"

# ---- 启动 / 重启 PM2 ----
echo ""
echo "🚀 启动/重启应用..."
if pm2 describe "$APP_NAME" &>/dev/null; then
  pm2 restart "$APP_NAME" --update-env
  echo "✔  应用已重启"
else
  pm2 start "$DEPLOY_DIR/ecosystem.config.js" --env production
  pm2 save
  echo "✔  应用已启动"
  echo ""
  echo "  设置开机自启（需要 root 权限）:"
  echo "  sudo $(pm2 startup | tail -1)"
fi

echo ""
echo "======================================"
echo "  ✅ 部署完成！"
echo "======================================"
echo "  应用访问: http://$(curl -s ifconfig.me 2>/dev/null || echo 'your-server-ip'):${PORT:-3000}"
echo "  查看日志: pm2 logs ${APP_NAME}"
echo "  监控面板: pm2 monit"
echo "======================================"
