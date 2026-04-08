#!/bin/bash
# =============================================================
#  AI Newline Center — 首次部署初始化脚本
# =============================================================
# 前提: 已将压缩包解压到 /opt/ai-newline-center/
#
# 用法:
#   mkdir -p /opt/ai-newline-center
#   tar -xzf /tmp/app-v0.x.x.tar.gz -C /opt/ai-newline-center/
#   bash /opt/ai-newline-center/scripts/setup.sh
# =============================================================

set -e

APP_DIR="/www/wwwroot/ai-newline-center"
cd "$APP_DIR"

echo ""
echo "============================================================"
echo "  AI Newline Center — 首次部署初始化"
echo "============================================================"

# ─── 1. 检查 Node.js ─────────────────────────────────────────
echo ""
echo "[1/5] 检查运行环境..."
if ! command -v node &>/dev/null; then
  echo ""
  echo "  ❌ 未找到 Node.js 20+，请先安装:"
  echo "     curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
  echo "     apt-get install -y nodejs"
  exit 1
fi
NODE_VER=$(node --version)
echo "  ✓ Node.js: $NODE_VER"

# ─── 2. 安装 PM2 ─────────────────────────────────────────────
echo ""
echo "[2/5] 检查 PM2..."
if ! command -v pm2 &>/dev/null; then
  echo "  安装 PM2 (全局)..."
  npm install -g pm2
fi
echo "  ✓ PM2: $(pm2 --version)"

# ─── 3. 配置环境变量 ──────────────────────────────────────────
echo ""
echo "[3/5] 检查环境变量配置..."
if [ ! -f "$APP_DIR/.env.production" ]; then
  echo ""
  echo "  ⚠️  未找到 .env.production，需要先创建配置文件!"
  echo ""
  echo "  操作步骤:"
  echo "  ┌─────────────────────────────────────────────────────────────┐"
  echo "  │  1. cp $APP_DIR/.env.example $APP_DIR/.env.production       │"
  echo "  │  2. vi $APP_DIR/.env.production                             │"
  echo "  └─────────────────────────────────────────────────────────────┘"
  echo ""
  echo "  必填项说明:"
  echo "  DATABASE_URL   = mysql://用户名:密码@127.0.0.1:3306/数据库名"
  echo "  NEXTAUTH_SECRET= 随机32位密钥 (生成: openssl rand -base64 32)"
  echo "  NEXTAUTH_URL   = http://你的服务器公网IP:3000"
  echo "  AUTH_TRUST_HOST= true"
  echo "  CRAWLER_API_URL= http://爬虫服务地址:端口"
  echo ""
  echo "  配置完成后，重新运行: bash $APP_DIR/scripts/setup.sh"
  exit 0
fi
echo "  ✓ .env.production 已存在"

# 加载环境变量（PM2 将继承）
set -a
# shellcheck source=/dev/null
source "$APP_DIR/.env.production"
set +a

# ─── 4. 生成 Prisma Client ───────────────────────────────────
echo ""
echo "[4/6] 生成 Prisma Client..."

# 从包内读取 prisma 版本号，用隔离临时目录安装精确版本，避免 standalone 目录
# 下 pnpm 风格符号链接与 npm arborist 冲突。
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

# ─── 5. 数据库迁移 ────────────────────────────────────────────
echo ""
echo "[5/6] 运行数据库迁移..."

echo "  使用 prisma@$PRISMA_VERSION 执行迁移..."
npx --yes "prisma@$PRISMA_VERSION" migrate deploy --schema "$APP_DIR/prisma/schema.prisma"
echo "  ✓ 数据库结构已同步"

# ─── 6. 启动服务 ──────────────────────────────────────────────
echo ""
echo "[6/6] 启动服务..."
bash "$APP_DIR/scripts/start.sh"

echo ""
echo "============================================================"
echo "  ✅ 首次部署完成!"
echo ""
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "服务器IP")
echo "  访问地址: http://$SERVER_IP:3000"
echo ""
echo "  ── 设置开机自启 (推荐) ──────────────────────────────────"
echo "  运行: pm2 startup"
echo "  按提示复制并执行输出的命令（通常是 sudo env PATH=... pm2 startup）"
echo "  然后: pm2 save"
echo "============================================================"
