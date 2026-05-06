#!/usr/bin/env node
/**
 * AI Newline Center - deployment packaging script
 *
 * Usage:
 *   pnpm deploy:pack
 *   pnpm deploy:pack:win
 *   node scripts/pack.mjs 0.4.0 --target=windows
 */

import { execSync } from "child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { join, resolve, extname } from "path";
import { fileURLToPath } from "url";

import { parsePackArgs } from "./pack-target.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
const packConfig = parsePackArgs(process.argv.slice(2), pkg.version);

const STANDALONE_DIR = join(ROOT, ".next", "standalone");
const OUT_DIR = join(ROOT, "dist");
const OUT_FILE = join(OUT_DIR, packConfig.archiveFileName);

const LINE = "─".repeat(54);

console.log(`\n${LINE}`);
console.log(` AI Newline Center - 打包 v${packConfig.version} (${packConfig.target})`);
console.log(LINE);

function run(command, options = {}) {
  execSync(command, {
    cwd: ROOT,
    stdio: "inherit",
    ...options,
  });
}

function copyPublicAssets() {
  const publicSrc = join(ROOT, "public");
  const publicDst = join(STANDALONE_DIR, "public");

  if (!existsSync(publicSrc)) {
    mkdirSync(publicDst, { recursive: true });
    return;
  }

  if (existsSync(publicDst)) {
    rmSync(publicDst, { recursive: true, force: true });
  }

  mkdirSync(publicDst, { recursive: true });
  for (const entry of readdirSync(publicSrc)) {
    if (entry === "storage") {
      continue;
    }

    cpSync(join(publicSrc, entry), join(publicDst, entry), { recursive: true });
  }

  console.log("  ✓ public/ (已跳过 storage/ 用户数据)");
}

function copyPrismaAssets() {
  const prismaSrc = join(ROOT, "prisma");
  const prismaDst = join(STANDALONE_DIR, "prisma");

  if (!existsSync(prismaSrc)) {
    return;
  }

  if (existsSync(prismaDst)) {
    rmSync(prismaDst, { recursive: true, force: true });
  }

  cpSync(prismaSrc, prismaDst, { recursive: true });
  console.log("  ✓ prisma/ (数据库迁移文件)");

  const prismaPkgPath = join(ROOT, "node_modules", "prisma", "package.json");
  if (!existsSync(prismaPkgPath)) {
    return;
  }

  const prismaVersion = JSON.parse(readFileSync(prismaPkgPath, "utf-8")).version;
  writeFileSync(join(prismaDst, ".prisma-version"), prismaVersion);
  console.log(`  ✓ prisma/.prisma-version (v${prismaVersion})`);
}

function copyPrismaRuntime() {
  const prismaRuntimeSrc = join(ROOT, "node_modules", "@prisma", "client", "runtime");
  const prismaClientLink = join(STANDALONE_DIR, "node_modules", "@prisma", "client");

  if (!existsSync(prismaRuntimeSrc) || !existsSync(prismaClientLink)) {
    return;
  }

  const prismaClientDst = realpathSync(prismaClientLink);
  const prismaRuntimeDst = join(prismaClientDst, "runtime");

  if (existsSync(prismaRuntimeDst)) {
    rmSync(prismaRuntimeDst, { recursive: true, force: true });
  }

  cpSync(prismaRuntimeSrc, prismaRuntimeDst, { recursive: true });
  console.log("  ✓ @prisma/client/runtime (完整运行时资源)");
}

function copyServerScripts() {
  const serverScriptsSrc = join(ROOT, "scripts", "server");
  const serverScriptsDst = join(STANDALONE_DIR, "scripts");

  if (!existsSync(serverScriptsSrc)) {
    return;
  }

  if (existsSync(serverScriptsDst)) {
    rmSync(serverScriptsDst, { recursive: true, force: true });
  }

  cpSync(serverScriptsSrc, serverScriptsDst, { recursive: true });

  const chmodTree = (dirPath) => {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      const entryPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        chmodTree(entryPath);
        continue;
      }

      if (entry.name.endsWith(".sh")) {
        chmodSync(entryPath, 0o755);
      }
    }
  };

  chmodTree(serverScriptsDst);
  console.log("  ✓ scripts/ (部署脚本)");
}

function copyEnvironmentTemplates() {
  const envTemplateSrc = join(ROOT, ".env.production.example");
  if (!existsSync(envTemplateSrc)) {
    return;
  }

  cpSync(envTemplateSrc, join(STANDALONE_DIR, ".env.production.example"));
  cpSync(envTemplateSrc, join(STANDALONE_DIR, ".env.example"));
  console.log("  ✓ .env.production.example / .env.example");
}

/**
 * PowerShell 5.1（Windows Server 默认）要求 .ps1 文件必须是
 * UTF-8 with BOM + CRLF，否则会把无 BOM 的 UTF-8 文件当作系统
 * ANSI 编码读取，中文字节序列中的某些字节恰好匹配 " } 等控制字符，
 * 导致解析错误。此函数在打包时将 scripts/windows/ 下所有 .ps1
 * 文件转换为正确格式。
 */
function fixPowerShellFiles() {
  const windowsScriptsDir = join(STANDALONE_DIR, "scripts", "windows");
  if (!existsSync(windowsScriptsDir)) {
    return;
  }

  const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
  let count = 0;

  const processDir = (dirPath) => {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      const entryPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        processDir(entryPath);
        continue;
      }
      if (extname(entry.name).toLowerCase() !== ".ps1") {
        continue;
      }

      const original = readFileSync(entryPath);

      // Strip existing BOM if present
      const content = original.slice(0, 3).equals(UTF8_BOM) ? original.slice(3) : original;

      // LF → CRLF (skip bytes that are already CRLF to avoid double-converting)
      const lines = content.toString("utf8").split("\n");
      const crlf = lines.map((line) => (line.endsWith("\r") ? line : line + "\r")).join("\n");

      writeFileSync(entryPath, Buffer.concat([UTF8_BOM, Buffer.from(crlf, "utf8")]));
      count++;
    }
  };

  processDir(windowsScriptsDir);
  console.log(`  ✓ scripts/windows/*.ps1 → UTF-8 BOM + CRLF (${count} 个文件)`);
}

function createArchive() {
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  if (existsSync(OUT_FILE)) {
    rmSync(OUT_FILE, { force: true });
  }

  if (packConfig.target === "windows") {
    execSync(`zip -rq "${OUT_FILE}" .`, {
      cwd: STANDALONE_DIR,
      stdio: "inherit",
    });
    return;
  }

  execSync(`tar -czf "${OUT_FILE}" -C "${STANDALONE_DIR}" .`, {
    stdio: "inherit",
  });
}

function printDeployGuide(sizeMB) {
  if (packConfig.target === "windows") {
    console.log(`\n[4/4] 打包完成`);
    console.log(LINE);
    console.log(`✅ 输出文件: dist/${packConfig.archiveFileName} (${sizeMB} MB)\n`);
    console.log(`🚀 Windows Server 部署步骤:
  ─── 首次部署 ─────────────────────────────────────────
  1. 上传包:     将 dist/${packConfig.archiveFileName} 上传到服务器（如 C:\\wwwroot\\）
  2. 解压目录:   右键 → 解压到 C:\\wwwroot\\ai-newline-center
                 或 PowerShell: Expand-Archive app-xxx-windows.zip C:\\wwwroot\\ai-newline-center
  3. 配置环境:   cd C:\\wwwroot\\ai-newline-center
                 copy .env.production.example .env.production
                 用编辑器填写 DATABASE_URL / NEXTAUTH_SECRET / NEXTAUTH_URL 等必填项
  4. 初始化:     ⚠ 以管理员身份运行 PowerShell，然后:
                 cd C:\\wwwroot\\ai-newline-center
                 PowerShell -ExecutionPolicy Bypass -File .\\scripts\\windows\\setup.ps1

  ─── 版本更新 ─────────────────────────────────────────
  1. 上传新包:   将 dist/${packConfig.archiveFileName} 上传到服务器（如 C:\\wwwroot\\）
  2. 一键更新:   cd C:\\wwwroot\\ai-newline-center
                 PowerShell -ExecutionPolicy Bypass -File .\\scripts\\windows\\update.ps1 -ArchivePath C:\\wwwroot\\${packConfig.archiveFileName}
`);
    return;
  }

  console.log(`\n[4/4] 打包完成`);
  console.log(LINE);
  console.log(`✅ 输出文件: dist/${packConfig.archiveFileName} (${sizeMB} MB)\n`);
  console.log(`🚀 部署步骤:
  ─── 首次部署 ─────────────────────────────────────────
  1. 上传包:     scp dist/${packConfig.archiveFileName} root@<服务器IP>:/tmp/
  2. SSH 登录:   ssh root@<服务器IP>
  3. 解压:       mkdir -p /opt/ai-newline-center && tar -xzf /tmp/${packConfig.archiveFileName} -C /opt/ai-newline-center/
  4. 初始化:     bash /opt/ai-newline-center/scripts/setup.sh

  ─── 版本更新 ─────────────────────────────────────────
  1. 上传包:     scp dist/${packConfig.archiveFileName} root@<服务器IP>:/tmp/
  2. SSH 登录:   ssh root@<服务器IP>
  3. 一键更新:   bash /opt/ai-newline-center/scripts/update.sh /tmp/${packConfig.archiveFileName}
`);
}

console.log("\n[1/4] 执行 Next.js 生产构建...\n");
try {
  run("pnpm build", {
    env: { ...process.env, NODE_ENV: "production" },
  });
} catch {
  console.error("\n❌ 构建失败，请查看上方错误信息");
  process.exit(1);
}

if (!existsSync(STANDALONE_DIR)) {
  console.error("\n❌ .next/standalone 目录不存在");
  console.error("   请确认 next.config.ts 中已设置 output: 'standalone'");
  process.exit(1);
}

console.log("\n[2/4] 组装发布包...");

const staticSrc = join(ROOT, ".next", "static");
const staticDst = join(STANDALONE_DIR, ".next", "static");
if (existsSync(staticSrc)) {
  if (existsSync(staticDst)) {
    rmSync(staticDst, { recursive: true, force: true });
  }
  cpSync(staticSrc, staticDst, { recursive: true });
  console.log("  ✓ .next/static (前端静态资源)");
}

copyPublicAssets();
copyPrismaAssets();

const pm2Src = join(ROOT, "ecosystem.config.cjs");
if (existsSync(pm2Src)) {
  cpSync(pm2Src, join(STANDALONE_DIR, "ecosystem.config.cjs"));
  console.log("  ✓ ecosystem.config.cjs (PM2 配置)");
}

copyPrismaRuntime();
copyServerScripts();
copyEnvironmentTemplates();
if (packConfig.target === "windows") {
  fixPowerShellFiles();
}

console.log("\n[3/4] 创建压缩包...");
try {
  createArchive();
} catch {
  console.error("\n❌ 创建压缩包失败");
  if (packConfig.target === "windows") {
    console.error("   当前打包依赖系统 zip 命令，请确认构建机已安装 zip");
  } else {
    console.error("   请确认系统 tar 命令可用");
  }
  process.exit(1);
}

const sizeBytes = statSync(OUT_FILE).size;
const sizeMB = (sizeBytes / 1024 / 1024).toFixed(1);
printDeployGuide(sizeMB);
