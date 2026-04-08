#!/usr/bin/env node
/**
 * AI Newline Center — 跨平台打包脚本
 * 适用平台: Windows 10+ / macOS / Linux (Node.js 20+)
 *
 * 用法:
 *   pnpm deploy:pack            # 使用 package.json 中的版本号
 *   node scripts/pack.mjs 0.4.0 # 指定版本号
 */

import { execSync } from "child_process";
import {
  cpSync,
  rmSync,
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  statSync,
  chmodSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

// ─── 路径常量 ───────────────────────────────────────────────────────
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
const version = process.argv[2] || pkg.version;

const STANDALONE_DIR = join(ROOT, ".next", "standalone");
const OUT_DIR = join(ROOT, "dist");
const OUT_FILE = join(OUT_DIR, `app-v${version}.tar.gz`);

const LINE = "─".repeat(54);

console.log(`\n${LINE}`);
console.log(` AI Newline Center — 打包 v${version}`);
console.log(LINE);

// ─── Step 1: 构建 ──────────────────────────────────────────────────
console.log("\n[1/4] 执行 Next.js 生产构建...\n");
try {
  execSync("pnpm build", {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });
} catch {
  console.error("\n❌ 构建失败，请查看上方错误信息");
  process.exit(1);
}

// 验证 standalone 输出
if (!existsSync(STANDALONE_DIR)) {
  console.error("\n❌ .next/standalone 目录不存在");
  console.error("   请确认 next.config.ts 中已设置 output: 'standalone'");
  process.exit(1);
}

// ─── Step 2: 组装发布包 ────────────────────────────────────────────
console.log("\n[2/4] 组装发布包...");

// .next/static → standalone/.next/static (前端静态资源)
const staticSrc = join(ROOT, ".next", "static");
const staticDst = join(STANDALONE_DIR, ".next", "static");
if (existsSync(staticSrc)) {
  if (existsSync(staticDst)) rmSync(staticDst, { recursive: true, force: true });
  cpSync(staticSrc, staticDst, { recursive: true });
  console.log("  ✓ .next/static (前端静态资源)");
}

// public/ → standalone/public/ (排除 public/storage/ 用户上传文件)
const publicSrc = join(ROOT, "public");
const publicDst = join(STANDALONE_DIR, "public");
if (existsSync(publicSrc)) {
  if (existsSync(publicDst)) rmSync(publicDst, { recursive: true, force: true });
  mkdirSync(publicDst, { recursive: true });
  for (const entry of readdirSync(publicSrc)) {
    if (entry === "storage") continue; // 用户上传文件，服务器独立保存
    cpSync(join(publicSrc, entry), join(publicDst, entry), { recursive: true });
  }
  console.log("  ✓ public/ (已跳过 storage/ 用户数据)");
} else {
  // 确保 public 目录存在
  mkdirSync(publicDst, { recursive: true });
}

// prisma/ → standalone/prisma/ (数据库 schema + 迁移文件，服务器执行迁移用)
const prismaSrc = join(ROOT, "prisma");
const prismaDst = join(STANDALONE_DIR, "prisma");
if (existsSync(prismaSrc)) {
  if (existsSync(prismaDst)) rmSync(prismaDst, { recursive: true, force: true });
  cpSync(prismaSrc, prismaDst, { recursive: true });
  console.log("  ✓ prisma/ (数据库迁移文件)");
}

// 注意: prisma CLI 不打包！
// 原因: prisma CLI 依赖 @prisma/engines 平台原生二进制。
//       Mac 打包的是 macOS 版，无法在 Linux 服务器运行。
//       setup.sh 会在服务器上安装 Linux 版 prisma（一次性）。

// 将 prisma 版本号写入 prisma/.prisma-version，供 setup.sh 安装匹配版本
const prismaPkgPath = join(ROOT, "node_modules", "prisma", "package.json");
if (existsSync(prismaPkgPath)) {
  const prismaVersion = JSON.parse(readFileSync(prismaPkgPath, "utf-8")).version;
  writeFileSync(join(STANDALONE_DIR, "prisma", ".prisma-version"), prismaVersion);
  console.log(`  ✓ prisma/.prisma-version (v${prismaVersion}，服务器安装匹配版本用)`);
}

// ecosystem.config.cjs → standalone/ (PM2 进程配置)
const pm2Src = join(ROOT, "ecosystem.config.cjs");
if (existsSync(pm2Src)) {
  cpSync(pm2Src, join(STANDALONE_DIR, "ecosystem.config.cjs"));
  console.log("  ✓ ecosystem.config.cjs (PM2 配置)");
}

// Prisma runtime → standalone/node_modules/@prisma/client/runtime
// Next standalone 会裁剪 runtime 中未追踪到的文件，但服务器侧 prisma generate
// 需要完整 runtime（如 query_engine_bg.mysql.wasm-base64.js）。
const prismaRuntimeSrc = join(ROOT, "node_modules", "@prisma", "client", "runtime");
const prismaClientLink = join(STANDALONE_DIR, "node_modules", "@prisma", "client");
if (existsSync(prismaRuntimeSrc) && existsSync(prismaClientLink)) {
  const prismaClientDst = realpathSync(prismaClientLink);
  const prismaRuntimeDst = join(prismaClientDst, "runtime");
  if (existsSync(prismaRuntimeDst)) rmSync(prismaRuntimeDst, { recursive: true, force: true });
  cpSync(prismaRuntimeSrc, prismaRuntimeDst, { recursive: true });
  console.log("  ✓ @prisma/client/runtime (完整运行时资源)");
}

// scripts/server/ → standalone/scripts/ (服务器部署脚本)
const serverScriptsSrc = join(ROOT, "scripts", "server");
const serverScriptsDst = join(STANDALONE_DIR, "scripts");
if (existsSync(serverScriptsSrc)) {
  if (existsSync(serverScriptsDst)) rmSync(serverScriptsDst, { recursive: true, force: true });
  cpSync(serverScriptsSrc, serverScriptsDst, { recursive: true });
  // 设置 .sh 脚本为可执行 (Linux/macOS 需要)
  for (const file of readdirSync(serverScriptsDst)) {
    if (file.endsWith(".sh")) {
      chmodSync(join(serverScriptsDst, file), 0o755);
    }
  }
  console.log("  ✓ scripts/ (服务器部署脚本)");
}

// .env.example → standalone/.env.example (环境变量配置模板)
const envExampleSrc = join(ROOT, ".env.example");
if (existsSync(envExampleSrc)) {
  cpSync(envExampleSrc, join(STANDALONE_DIR, ".env.example"));
  console.log("  ✓ .env.example (环境变量模板，参考用)");
}

// ─── Step 3: 打包压缩 ──────────────────────────────────────────────
console.log("\n[3/4] 创建压缩包...");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
if (existsSync(OUT_FILE)) rmSync(OUT_FILE, { force: true });

try {
  // tar 在 Windows 10+、macOS、Linux 均可用
  execSync(`tar -czf "${OUT_FILE}" -C "${STANDALONE_DIR}" .`, {
    stdio: "inherit",
  });
} catch {
  console.error("\n❌ 创建压缩包失败");
  console.error("   Windows 用户请确保系统版本 >= Windows 10 (内置 tar.exe)");
  process.exit(1);
}

// ─── Step 4: 完成摘要 ──────────────────────────────────────────────
const sizeBytes = statSync(OUT_FILE).size;
const sizeMB = (sizeBytes / 1024 / 1024).toFixed(1);

console.log(`\n[4/4] 打包完成`);
console.log(LINE);
console.log(`✅ 输出文件: dist/app-v${version}.tar.gz  (${sizeMB} MB)\n`);
console.log(`🚀 部署步骤:
  ─── 首次部署 ─────────────────────────────────────────
  1. 上传包:     scp dist/app-v${version}.tar.gz root@<服务器IP>:/tmp/
  2. SSH 登录:   ssh root@<服务器IP>
  3. 解压:       mkdir -p /opt/ai-newline-center && tar -xzf /tmp/app-v${version}.tar.gz -C /opt/ai-newline-center/
  4. 初始化:     bash /opt/ai-newline-center/scripts/setup.sh

  ─── 版本更新 ─────────────────────────────────────────
  1. 上传包:     scp dist/app-v${version}.tar.gz root@<服务器IP>:/tmp/
  2. SSH 登录:   ssh root@<服务器IP>
  3. 一键更新:   bash /opt/ai-newline-center/scripts/update.sh /tmp/app-v${version}.tar.gz
`);
