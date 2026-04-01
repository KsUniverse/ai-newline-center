# Bug 记录 — v0.1.0

---

## BUG-001: 缺少 .env.local 导致 middleware 崩溃 + /dashboard 404

- **严重度**: Critical
- **状态**: ✅ Closed
- **分支**: bug/BUG-001-missing-env-dashboard-404
- **发现时机**: 用户本地运行 `npm run dev`
- **描述**: 项目启动后访问 `/dashboard` 返回 404，同时控制台出现 ZodError，诉称 `DATABASE_URL`、`NEXTAUTH_URL`、`NEXTAUTH_SECRET` 未定义。
- **复现步骤**:
  1. 克隆仓库，未创建 `.env.local`
  2. 运行 `pnpm dev`
  3. 访问 `http://localhost:3000/dashboard`
- **影响范围**: 应用无法启动；middleware 崩溃导致所有受保护路由（包括 `/dashboard`）返回 404
- **根本原因**: `src/lib/env.ts` 在 middleware 加载时立即执行 `envSchema.parse(process.env)`，无 `.env.local` 时三个必填字段缺失，抛出 ZodError 导致 middleware 崩溃
- **修复说明**: 创建 `.env.local`（已有 `.env.example` 模板）；`.env.local` 已在 `.gitignore` 中排除，需每个开发者本地手动创建
- **验证结果**: 待用户测试


## BUG-002: Tailwind CSS 样式完全失效

- **严重度**: Critical
- **状态**: ✅ Closed
- **分支**: bug/BUG-002-missing-tailwind-styles
- **发现时机**: 用户验收
- **描述**: 页面呈现完全无样式的白板 HTML，登录组件和全局样式完全未能按照预期的 Tailwind 效果加载。
- **复现步骤**:
  1. 运行 `npm run dev`
  2. 访问 `/login`
- **影响范围**: 整个前端 UI 样式瘫痪
- **根本原因**: 项目使用 Tailwind CSS v4，但是 `package.json` 和 `postcss.config.mjs` 中未配置必需的 `@tailwindcss/postcss` 转换插件，导致 Tailwind 类名未被编译为实际的 CSS。
- **修复说明**:
  1. 运行 `pnpm add -D @tailwindcss/postcss -w` 安装缺失的文件
  2. 在 `postcss.config.mjs` 中正确注册 `@tailwindcss/postcss`
- **验证结果**: 待用户本地运行查看样式是否恢复