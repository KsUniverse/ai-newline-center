# AI Newline Center — 部署指南

> 类 Spring Boot 风格部署：本地打包 → 上传 → 服务器一键运行

## 环境文件说明（三句话版）

| 文件 | 在哪里 | 提交 Git |
|------|--------|----------|
| `.env.example` | 本地 + 服务器（包里自带） | ✅ 是（模板，无真实值） |
| `.env.local` | 本地开发机 | ❌ 否 |
| `.env.production` | 服务器 `/opt/ai-newline-center/` | ❌ 否 |

**规则：**
- 本地开发：在项目根目录创建 `.env.local`，填入本地数据库/Redis 地址，运行 `pnpm dev`
- 生产服务器：在服务器上创建 `.env.production`，填入生产值，永远不上传到 Git 或打包里

---

## 本地开发

```bash
# 1. 复制模板
cp .env.example .env.local

# 2. 编辑 .env.local，填入本地 MySQL / Redis 地址
vi .env.local  # 或用 VS Code 打开

# 3. 初始化数据库
pnpm db:migrate    # 运行迁移
pnpm db:seed       # 初始数据（管理员账号）

# 4. 启动开发服务器
pnpm dev           # http://localhost:3000
```

---

## 打包（Windows 和 Mac 通用）

```bash
pnpm deploy:pack
```

输出文件：`dist/app-v0.x.x.tar.gz`（约 30-60 MB）

**打包做了什么：**
1. 运行 `next build`，生成 `.next/standalone/`（自包含 Node.js 服务）
2. 将前端静态资源、prisma 迁移文件、PM2 配置、部署脚本一并打包
3. **不包含** `.env.production`（安全）和 `public/storage/`（用户数据）

> Windows 10+ 自带 `tar.exe`，无需安装额外工具

---

## 首次部署（在阿里云服务器上）

### 前置条件（服务器只需装一次）

```bash
# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 安装 PM2 (进程守护)
npm install -g pm2
```

### 部署步骤

**第一步：上传包**
```bash
# 本地执行
scp dist/app-v0.3.1.tar.gz root@47.96.227.116:/tmp/
```

**第二步：SSH 登录服务器，解压**
```bash
ssh root@47.96.227.116

mkdir -p /opt/ai-newline-center
tar -xzf /tmp/app-v0.3.1.tar.gz -C /opt/ai-newline-center/
```

**第三步：创建 .env.production（首次只做一次）**
```bash
cp /opt/ai-newline-center/.env.example /opt/ai-newline-center/.env.production
vi /opt/ai-newline-center/.env.production
```

填入以下必填项（其余可按需填写）：
```env
DATABASE_URL="mysql://ai_newline:你的数据库密码@127.0.0.1:3306/ai_newline?charset=utf8mb4"
REDIS_URL="redis://:你的Redis密码@localhost:6379"
NEXTAUTH_SECRET="用openssl rand -base64 32生成的32位密钥"
NEXTAUTH_URL="http://47.96.227.116:3000"
AUTH_TRUST_HOST="true"
CRAWLER_API_URL="http://localhost:8011"
```

**第四步：初始化并启动**
```bash
bash /opt/ai-newline-center/scripts/setup.sh
```

setup.sh 会自动：在临时目录补齐 Prisma 工具链 → 回填 runtime → 生成 Prisma Client → 运行数据库迁移 → 启动 PM2

**第五步：设置开机自启（服务器重启后自动恢复）**
```bash
pm2 startup
# 按提示复制并执行输出的那条命令（通常是 sudo env PATH=... pm2 startup systemd）
pm2 save
```

---

## 版本更新（日常操作）

```bash
# 本地打包
pnpm deploy:pack

# 上传
scp dist/app-v0.3.2.tar.gz root@47.96.227.116:/tmp/

# 服务器一键更新（零停机热重载）
ssh root@47.96.227.116 "bash /opt/ai-newline-center/scripts/update.sh /tmp/app-v0.3.2.tar.gz"
```

update.sh 会自动：解压 → 运行迁移 → PM2 热重载（不丢失在线连接）

> ⚠️ 更新不会覆盖 `.env.production` 和 `public/storage/`（用户数据安全）

更新脚本会自动：在临时目录补齐 Prisma 工具链 → 回填 runtime → 生成 Prisma Client → 运行数据库迁移 → PM2 热重载

---

## 常用运维命令

```bash
# 查看运行状态
pm2 status

# 实时查看日志
pm2 logs ai-newline-center

# 查看最近 100 行日志
pm2 logs ai-newline-center --lines 100

# 重启
pm2 restart ai-newline-center

# 停止
pm2 stop ai-newline-center

# 修改了 .env.production 后重新加载
bash /opt/ai-newline-center/scripts/start.sh
```

---

## 服务器目录结构

```
/opt/ai-newline-center/
├── server.js               ← Next.js 启动文件（由 PM2 运行）
├── .next/                  ← 编译后的应用代码
├── public/
│   └── storage/            ← 用户上传文件（更新时保留）
├── node_modules/           ← 仅生产依赖（约 200-300 MB）
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── ecosystem.config.cjs    ← PM2 配置
├── scripts/
│   ├── setup.sh            ← 首次部署
│   ├── start.sh            ← 启动/重载
│   └── update.sh           ← 版本更新
├── logs/
│   ├── app.log
│   └── error.log
└── .env.production         ← 生产环境变量（手动创建，永不打包）
```

---

## 常见问题

**Q: 打包后文件多大？**  
A: 约 40-80 MB（含所有依赖，无需服务器安装 node_modules）

**Q: 服务器需要安装 pnpm 吗？**  
A: 不需要。standalone 包已包含所有依赖，服务器只需要 Node.js 20+ 和 PM2。

**Q: 数据库密码含特殊字符怎么办？**  
A: 在 DATABASE_URL 的密码部分做 URL 编码，例如 `@` 编码为 `%40`。

**Q: 想用 80/443 端口怎么配？**  
A: 推荐 Nginx 反代：
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Q: 修改了环境变量需要重新打包吗？**  
A: 不需要。直接在服务器上编辑 `.env.production`，然后运行 `bash /opt/ai-newline-center/scripts/start.sh` 重载即可。
