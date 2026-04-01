# Bug 记录 — v0.1.0

---

## BUG-001: 缺少 .env.local 导致 middleware 崩溃 + /dashboard 404

- **严重度**: Critical
- **状态**: In Fix
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
