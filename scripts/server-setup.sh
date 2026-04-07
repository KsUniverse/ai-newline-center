#!/usr/bin/env bash
# ============================================================
# 服务器首次部署脚本（基于 Git）
# ============================================================
# 用途: 在服务器上克隆项目后，一键完成依赖安装、构建、数据库初始化、PM2启动
#
# 用法（在宝塔终端或 SSH 中执行）:
#   cd /www/wwwroot/ai-newline-center   # 已 git clone 的项目目录
#   cp .env.production.example .env
#   nano .env                           # 填写所有配置项
#   bash scripts/server-setup.sh
#
# 前提（宝塔软件商店安装）:
#   - Node.js 20+
#   - Git
#   - PostgreSQL 16（并已创建数据库）
#   - Redis 7
# ============================================================

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="ai-newline-center"
LOG_DIR="$APP_DIR/logs"

echo "======================================"
echo "  AI Newline Center — 首次部署"
echo "======================================"
echo "  项目目录: $APP_DIR"
echo ""

cd "$APP_DIR"

# ---- 检查 .env ----
if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "❌ 未找到 .env 文件！"
  echo "请执行: cp .env.production.example .env && nano .env"
  exit 1
fi
set -o allexport; source "$APP_DIR/.env"; set +o allexport

# ---- 检查工具 ----
for cmd in node npm git; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "❌ 未找到 $cmd，请通过宝塔软件商店安装"
    exit 1
  fi
done
echo "✔  Node.js $(node -v)  |  npm $(npm -v)  |  Git $(git --version | awk '{print $3}')"

# ---- 安装 pnpm ----
if ! command -v pnpm &>/dev/null; then
  echo "⚙️  安装 pnpm..."
  npm install -g pnpm
fi
echo "✔  pnpm $(pnpm -v)"

# ---- 安装 PM2 ----
if ! command -v pm2 &>/dev/null; then
  echo "⚙️  安装 PM2..."
  npm install -g pm2
fi
echo "✔  PM2 $(pm2 -v)"

# ---- 安装依赖 ----
echo ""
echo "📦 [1/5] 安装依赖..."
pnpm install --frozen-lockfile

# ---- Prisma ----
echo ""
echo "⚡ [2/5] 生成 Prisma Client..."
pnpm prisma generate

echo ""
echo "🗄️  [3/5] 运行数据库迁移..."
pnpm prisma migrate deploy

# ---- 种子数据 ----
SEED_FLAG="$APP_DIR/.seed-done"
if [[ ! -f "$SEED_FLAG" ]]; then
  echo ""
  echo "🌱 初始化种子数据..."
  pnpm db:seed && touch "$SEED_FLAG" || {
    echo "⚠️  Seed 执行失败，可能已存在数据，跳过"
    touch "$SEED_FLAG"
  }
fi

# ---- 构建 ----
echo ""
echo "🔨 [4/5] 构建 Next.js..."
pnpm run build

# ---- 整理 standalone 目录 ----
echo ""
echo "📁 [4.5] 整理 standalone 静态资源..."
cp -r .next/static .next/standalone/.next/static
# 只复制非 storage 的 public 文件
rsync -a --exclude='storage/' public/ .next/standalone/public/ 2>/dev/null || \
  { mkdir -p .next/standalone/public; cp -r public/* .next/standalone/public/ 2>/dev/null || true; }
# 保持 storage 目录存在
mkdir -p .next/standalone/public/storage/covers
mkdir -p .next/standalone/public/storage/videos
# 将运行时 .env 复制到 standalone
cp .env .next/standalone/.env

# ---- 日志目录 ----
mkdir -p "$LOG_DIR"

# ---- 写入 PM2 ecosystem ----
echo ""
echo "⚙️  [5/5] 配置 PM2..."
cat > "$APP_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: "${APP_NAME}",
    script: "server.js",
    cwd: "${APP_DIR}/.next/standalone",
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

# ---- 启动 PM2 ----
pm2 start "$APP_DIR/ecosystem.config.js" --env production
pm2 save

echo ""
echo "======================================"
echo "  ✅ 首次部署完成！"
echo "======================================"
echo "  访问地址: http://$(curl -s ifconfig.me 2>/dev/null || echo 'your-server-ip'):${PORT:-3000}"
echo ""
echo "  设置 PM2 开机自启（需要 root）:"
echo "  sudo env PATH=\$PATH:$(which node) $(which pm2) startup systemd -u $(whoami) --hp $HOME"
echo ""
echo "  查看日志:  pm2 logs ${APP_NAME}"
echo "  应用状态:  pm2 status"
echo "======================================"
