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
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const LINE = "─".repeat(54);

function getRootFromScriptUrl(scriptUrl) {
  const scriptDir = fileURLToPath(new URL(".", scriptUrl));
  return resolve(scriptDir, "..");
}

function readPackageJson(root) {
  return JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
}

function resolveVersion(root, versionArg) {
  const pkg = readPackageJson(root);
  return versionArg || pkg.version;
}

function resolveEnvTemplatePath(root) {
  const envExamplePath = join(root, ".env.example");
  if (existsSync(envExamplePath)) {
    return envExamplePath;
  }

  const envProductionExamplePath = join(root, ".env.production.example");
  if (existsSync(envProductionExamplePath)) {
    return envProductionExamplePath;
  }

  return null;
}

export function buildArchivePlan({
  outputDir,
  standaloneDir,
  target,
  version,
}) {
  if (target === "windows") {
    return {
      cwd: standaloneDir,
      outputFile: join(outputDir, `app-v${version}-windows.zip`),
      command: `zip -qry "${join(outputDir, `app-v${version}-windows.zip`)}" .`,
      toolName: "zip",
    };
  }

  return {
    cwd: undefined,
    outputFile: join(outputDir, `app-v${version}.tar.gz`),
    command: `tar -czf "${join(outputDir, `app-v${version}.tar.gz`)}" -C "${standaloneDir}" .`,
    toolName: "tar",
  };
}

export function buildDeployGuide({ archiveFileName, target }) {
  if (target === "windows") {
    return `🚀 部署步骤:
  ─── 首次部署（Windows Server + PowerShell） ─────────────────────
  1. 上传包:     将 dist/${archiveFileName} 上传到服务器，例如 C:\\deploy\\
  2. 解压:       Expand-Archive -LiteralPath C:\\deploy\\${archiveFileName} -DestinationPath D:\\ai-newline-center -Force
  3. 初始化:     powershell -ExecutionPolicy Bypass -File D:\\ai-newline-center\\scripts\\setup.ps1

  ─── 版本更新 ─────────────────────────────────────────
  1. 上传包:     将 dist/${archiveFileName} 上传到服务器，例如 C:\\deploy\\
  2. 一键更新:   powershell -ExecutionPolicy Bypass -File D:\\ai-newline-center\\scripts\\update.ps1 -ArchivePath C:\\deploy\\${archiveFileName}

  说明:
  - 首次执行前，请先安装 Node.js 20+，再运行 npm install -g pm2
  - 生产环境变量文件名仍为 .env.production，可由 .env.example 复制得到
  - 默认应用目录可放在任意盘符，示例使用 D:\\ai-newline-center
`;
  }

  return `🚀 部署步骤:
  ─── 首次部署 ─────────────────────────────────────────
  1. 上传包:     scp dist/${archiveFileName} root@<服务器IP>:/tmp/
  2. SSH 登录:   ssh root@<服务器IP>
  3. 解压:       mkdir -p /opt/ai-newline-center && tar -xzf /tmp/${archiveFileName} -C /opt/ai-newline-center/
  4. 初始化:     bash /opt/ai-newline-center/scripts/setup.sh

  ─── 版本更新 ─────────────────────────────────────────
  1. 上传包:     scp dist/${archiveFileName} root@<服务器IP>:/tmp/
  2. SSH 登录:   ssh root@<服务器IP>
  3. 一键更新:   bash /opt/ai-newline-center/scripts/update.sh /tmp/${archiveFileName}
`;
}

function copyStaticAssets(root, standaloneDir) {
  const staticSrc = join(root, ".next", "static");
  const staticDst = join(standaloneDir, ".next", "static");

  if (!existsSync(staticSrc)) {
    return;
  }

  if (existsSync(staticDst)) {
    rmSync(staticDst, { recursive: true, force: true });
  }

  cpSync(staticSrc, staticDst, { recursive: true });
  console.log("  ✓ .next/static (前端静态资源)");
}

function copyPublicAssets(root, standaloneDir) {
  const publicSrc = join(root, "public");
  const publicDst = join(standaloneDir, "public");

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

function copyPrismaAssets(root, standaloneDir) {
  const prismaSrc = join(root, "prisma");
  const prismaDst = join(standaloneDir, "prisma");

  if (!existsSync(prismaSrc)) {
    return;
  }

  if (existsSync(prismaDst)) {
    rmSync(prismaDst, { recursive: true, force: true });
  }

  cpSync(prismaSrc, prismaDst, { recursive: true });
  console.log("  ✓ prisma/ (数据库迁移文件)");

  const prismaPkgPath = join(root, "node_modules", "prisma", "package.json");
  if (existsSync(prismaPkgPath)) {
    const prismaVersion = JSON.parse(readFileSync(prismaPkgPath, "utf-8")).version;
    writeFileSync(join(prismaDst, ".prisma-version"), prismaVersion);
    console.log(`  ✓ prisma/.prisma-version (v${prismaVersion}，服务器安装匹配版本用)`);
  }
}

function copyPm2Config(root, standaloneDir) {
  const pm2Src = join(root, "ecosystem.config.cjs");

  if (!existsSync(pm2Src)) {
    return;
  }

  cpSync(pm2Src, join(standaloneDir, "ecosystem.config.cjs"));
  console.log("  ✓ ecosystem.config.cjs (PM2 配置)");
}

function copyPrismaRuntime(root, standaloneDir) {
  const prismaRuntimeSrc = join(root, "node_modules", "@prisma", "client", "runtime");
  const prismaClientLink = join(standaloneDir, "node_modules", "@prisma", "client");

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

function copyServerScripts(root, standaloneDir) {
  const serverScriptsSrc = join(root, "scripts", "server");
  const serverScriptsDst = join(standaloneDir, "scripts");

  if (!existsSync(serverScriptsSrc)) {
    return;
  }

  if (existsSync(serverScriptsDst)) {
    rmSync(serverScriptsDst, { recursive: true, force: true });
  }

  cpSync(serverScriptsSrc, serverScriptsDst, { recursive: true });

  for (const file of readdirSync(serverScriptsDst)) {
    if (file.endsWith(".sh")) {
      chmodSync(join(serverScriptsDst, file), 0o755);
    }
  }

  console.log("  ✓ scripts/ (Linux + Windows 服务器部署脚本)");
}

function copyEnvTemplate(root, standaloneDir) {
  const envTemplatePath = resolveEnvTemplatePath(root);

  if (!envTemplatePath) {
    return;
  }

  cpSync(envTemplatePath, join(standaloneDir, ".env.example"));
  console.log("  ✓ .env.example (环境变量模板，参考用)");
}

function assembleStandaloneBundle(root, standaloneDir) {
  copyStaticAssets(root, standaloneDir);
  copyPublicAssets(root, standaloneDir);
  copyPrismaAssets(root, standaloneDir);
  copyPm2Config(root, standaloneDir);
  copyPrismaRuntime(root, standaloneDir);
  copyServerScripts(root, standaloneDir);
  copyEnvTemplate(root, standaloneDir);
}

function runBuild(root) {
  console.log("\n[1/4] 执行 Next.js 生产构建...\n");

  try {
    execSync("pnpm build", {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    });
  } catch {
    console.error("\n构建失败，请查看上方错误信息");
    process.exit(1);
  }
}

function ensureStandaloneOutput(standaloneDir) {
  if (existsSync(standaloneDir)) {
    return;
  }

  console.error("\n.next/standalone 目录不存在");
  console.error("请确认 next.config.ts 中已设置 output: 'standalone'");
  process.exit(1);
}

function createArchive(plan) {
  if (!existsSync(resolve(plan.outputFile, ".."))) {
    mkdirSync(resolve(plan.outputFile, ".."), { recursive: true });
  }

  if (existsSync(plan.outputFile)) {
    rmSync(plan.outputFile, { force: true });
  }

  try {
    execSync(plan.command, {
      cwd: plan.cwd,
      stdio: "inherit",
    });
  } catch {
    console.error(`\n创建压缩包失败，请确认本机可用 ${plan.toolName}`);
    process.exit(1);
  }
}

export function runPack({ scriptUrl, target, versionArg }) {
  const root = getRootFromScriptUrl(scriptUrl);
  const version = resolveVersion(root, versionArg);
  const standaloneDir = join(root, ".next", "standalone");
  const outputDir = join(root, "dist");
  const archivePlan = buildArchivePlan({
    outputDir,
    standaloneDir,
    target,
    version,
  });

  console.log(`\n${LINE}`);
  console.log(` AI Newline Center — ${target === "windows" ? "Windows" : "Linux"} 打包 v${version}`);
  console.log(LINE);

  runBuild(root);
  ensureStandaloneOutput(standaloneDir);

  console.log("\n[2/4] 组装发布包...");
  assembleStandaloneBundle(root, standaloneDir);

  console.log("\n[3/4] 创建压缩包...");
  createArchive(archivePlan);

  const sizeBytes = statSync(archivePlan.outputFile).size;
  const sizeMB = (sizeBytes / 1024 / 1024).toFixed(1);
  const archiveFileName = archivePlan.outputFile.replace(`${outputDir}/`, "");

  console.log("\n[4/4] 打包完成");
  console.log(LINE);
  console.log(`输出文件: dist/${archiveFileName} (${sizeMB} MB)\n`);
  console.log(buildDeployGuide({ archiveFileName, target }));
}
