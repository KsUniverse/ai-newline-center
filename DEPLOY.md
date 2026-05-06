# AI Newline Center - 宝塔 Windows 部署指南

> 适用方式: Windows Server + 宝塔面板 + Node 项目 / PM2 项目

## 推荐方案

这个项目是 Next.js 项目，推荐直接上传源码到服务器，再在服务器本机执行安装、迁移、构建和启动。

不推荐继续用 Mac 打包后上传 `node_modules` 或 `.next` 成品，原因是：
- Prisma 和部分依赖对运行平台敏感
- Windows Server 上重新安装依赖更稳
- 宝塔本身已经支持 Node 项目和 PM2 项目管理

---

## 目录约定

推荐部署目录：

```text
C:\wwwroot\ai-newline-center
```

---

## 第一步：准备服务器环境

在宝塔里先安装：

1. Node.js 20.x
2. PM2 管理器

然后在宝塔终端或 Windows PowerShell 里执行：

```powershell
npm install -g pnpm
```

检查版本：

```powershell
node -v
npm -v
pnpm -v
pm2 -v
```

---

## 第二步：上传项目源码

把项目源码上传到：

```text
C:\wwwroot\ai-newline-center
```

不要上传这些内容：
- `node_modules`
- `.next`
- `dist`

建议上传这些内容：
- `src`
- `public`
- `prisma`
- `scripts`
- `package.json`
- `pnpm-lock.yaml`
- `next.config.ts`
- `tsconfig*.json`
- `ecosystem.config.cjs`

---

## 第三步：创建生产环境文件

在服务器项目根目录创建：

```text
C:\wwwroot\ai-newline-center\.env.production
```

如果你已经有模板文件，可以执行：

```powershell
Copy-Item C:\wwwroot\ai-newline-center\.env.production.example C:\wwwroot\ai-newline-center\.env.production
```

至少需要确认这些变量正确：

```env
DATABASE_URL=
REDIS_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
AUTH_TRUST_HOST=true
CRAWLER_API_URL=
```

如果你有 OSS、OpenAI 或其他三方服务，也一起填好。

---

## 第四步：首次安装、迁移、构建

在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-build.ps1
```

这个脚本会自动执行：

1. 安装 `pnpm`（如果服务器还没有）
2. `pnpm install --frozen-lockfile`
3. `pnpm db:generate`
4. `pnpm exec prisma migrate deploy`
5. `pnpm build`

---

## 第五步：在宝塔中添加 Node 项目

按照你截图里的这个表单，推荐这样填：

### 默认项目

- `项目目录`：`C:/wwwroot/ai-newline-center`
- `项目名称`：`ai_newline_center`
- `Node版本`：`v20.x`
- `包管理器`：`npm`
- `启动选项`：`自定义启动命令`
- `启动命令`：`npm run start:bt`
- `负载实例数`：`1`
- `内存上限`：`1536`
- `自动重载`：`开启`

说明：

- `启动命令` 对应的是 [package.json](/Users/wxy/code/yewu/2026/ai-newline-center/package.json) 里的 `start:bt`
- 这个命令实际会执行：

```bash
next start -H 0.0.0.0 -p 3000
```

- 必须保持 `负载实例数 = 1`
  
原因：项目里有 BullMQ Worker 和 `node-cron` 定时任务，多实例会重复消费任务和重复执行定时任务

---

## 第六步：宝塔反向代理 / 站点访问

这个 Node 项目默认监听：

```text
http://127.0.0.1:3000
```

你有两种接法：

### 方案 A：用宝塔 Node 项目直接绑定域名

如果你当前 Node 项目页面支持直接配置域名或网站访问，直接绑定你的域名即可。

### 方案 B：用宝塔网站反向代理到 3000

如果你是单独建站点再反代，反向代理目标填：

```text
http://127.0.0.1:3000
```

---

## 更新流程

以后每次更新代码后，在服务器项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-reload.ps1
```

这个脚本会自动：

1. 安装或更新依赖
2. 生成 Prisma Client
3. 执行数据库迁移
4. 重新构建 Next.js
5. 尝试热重载 PM2 进程
6. 如果 PM2 进程还不存在，则自动启动 `ecosystem.config.cjs`

如果你只是改了少量代码，不想重新装依赖，可以执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-reload.ps1 -SkipInstall
```

---

## 备用方案：直接使用 PM2 项目

如果你更想用宝塔的 `PM2项目` 页签，而不是 `默认项目`，仓库里也已经准备好了：

- [ecosystem.config.cjs](/Users/wxy/code/yewu/2026/ai-newline-center/ecosystem.config.cjs)

它现在已经改成源码部署模式，会执行：

```text
./node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000
```

并且固定为单实例。

---

## 常用命令

首次构建：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-build.ps1
```

更新并重载：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-reload.ps1
```

查看 PM2：

```powershell
pm2 status
pm2 logs ai_newline_center
pm2 logs ai-newline-center
```

手动重启：

```powershell
pm2 restart ai_newline_center
```

如果你用的是 `ecosystem.config.cjs` 那套 PM2 项目：

```powershell
pm2 restart ai-newline-center
```

---

## 常见问题

### 1. 为什么不建议直接上传 `.next`？

因为 `.next` 是构建产物，和服务器环境、依赖版本、Prisma runtime 都有关系。Windows Server 上重新构建最稳。

### 2. 为什么包管理器选 `npm`，但服务器上还安装 `pnpm`？

因为宝塔这个表单里的“包管理器”主要影响面板自身的项目管理方式，但你的项目实际依赖锁定是 `pnpm-lock.yaml`。运行时我们用 `npm run start:bt`，安装和构建还是统一用 `pnpm`。

### 3. 为什么不能开多实例？

因为项目内部有：

- BullMQ Worker
- `node-cron` 定时任务

开多实例会导致重复执行。

### 4. 修改 `.env.production` 后怎么办？

重新执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-reload.ps1 -SkipInstall
```

这样会重新加载环境变量并重启进程。
