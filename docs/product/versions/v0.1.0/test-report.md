# 测试报告 — v0.1.0

**测试日期**: 2026-04-01  
**测试角色**: Tester  
**测试分支**: feature/v0.1.0

---

## 摘要

| 指标 | 结果 |
|------|------|
| 测试功能数 | 1 (F-000-1) + 基础框架 |
| 通过 | 1 |
| 失败 | 1 |
| UI 问题 | 2 |
| 构建检查 (`pnpm build`) | ✅ 通过 |
| 单元测试 (`pnpm test`) | ✅ 通过 (8/8) |
| 类型检查 (`pnpm type-check`) | ✅ 通过 |
| Lint (`pnpm lint`) | ✅ 通过 |
| **总体结论** | ❌ **需修复** |

---

## 构建检查

### pnpm build ✅

```
✓ Compiled successfully in 3.0s
✓ Linting and checking validity of types
✓ Generating static pages (5/5)
```

路由表：
```
Route (app)
├ ○ /
├ ○ /_not-found
├ ƒ /api/auth/[...nextauth]
└ ○ /login
```

> ⚠️ 注意：`/dashboard` 未出现在路由表中（详见 T-001）

### pnpm test ✅

```
✓ src/server/services/user.service.test.ts (4 tests) 4ms
✓ src/lib/api-response.test.ts (4 tests) 6ms
Test Files  2 passed (2)
Tests       8 passed (8)
```

---

## 功能验收

### F-000-1: 用户登录 — ❌ 部分失败

| # | 验收标准 | 结果 | 说明 |
|---|---------|------|------|
| 1 | 管理员创建的账号可正常登录 | ❌ | 登录成功但跳转的 `/dashboard` 路由不存在，用户看到 404 |
| 2 | 不同角色登录后看到对应权限的界面 | ❌ | 依赖 `/dashboard` 可访问，路由缺失导致无法验证 |
| 3 | 密码错误时有明确提示 | ✅ | Toast 提示"账号或密码错误，请重试"，不泄露账号是否存在 |

**登录表单逐项验收**（代码层面）：

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 账号字段存在 | ✅ | `account` input，autoComplete="username" |
| 密码字段存在 | ✅ | `password` input，密码显隐切换 |
| Zod 表单验证 | ✅ | 账号非空、密码 ≥6 位 |
| 提交逻辑 (`signIn`) | ✅ | `signIn("credentials", { redirect: false })` |
| 错误提示 | ✅ | `toast.error(...)` |
| 按钮 disabled 状态 | ✅ | `disabled={isSubmitting}`，提交中显示 Loader2 图标 |

### 基础框架验收

| 检查项 | 结果 | 说明 |
|--------|------|------|
| Next.js 15 App Router | ✅ | — |
| PostgreSQL + Prisma 6 | ✅ | schema.prisma 配置正确，含 Organization/User 模型 |
| 基础布局框架（侧边栏+主内容）| ✅ | AppLayout + AppSidebar + AppHeader 均已实现 |
| 认证中间件 (JWT) | ✅ | middleware.ts 正确拦截 `/dashboard/*`，未登录跳转 `/login` |
| Seed 数据脚本 | ✅ | prisma/seed.ts 创建超级管理员，upsert 幂等安全 |
| **Dashboard 路由可访问** | ❌ | `/dashboard` 路由未注册（见 T-001） |
| 侧边栏收起/展开持久化 | ✅ | Zustand + `persist` 中间件，key `sidebar-state` |
| ThemeProvider 配置 | ✅ | `defaultTheme="dark"`, `attribute="class"`, `enableSystem` |

---

## UI 一致性检查

### globals.css — CSS 变量对照

| 变量 | 规范值 (暗色) | 实现值 | 结果 |
|------|-------------|--------|------|
| `--background` | `hsl(240 10% 3.9%)` | `240 10% 3.9%` | ✅ |
| `--foreground` | `hsl(0 0% 98%)` | `0 0% 98%` | ✅ |
| `--primary` | `hsl(0 0% 98%)` | `0 0% 98%` | ✅ |
| `--secondary` | `hsl(240 3.7% 15.9%)` | `240 3.7% 15.9%` | ✅ |
| `--muted` | `hsl(240 3.7% 15.9%)` | `240 3.7% 15.9%` | ✅ |
| `--accent` | `hsl(240 3.7% 15.9%)` | `240 3.7% 15.9%` | ✅ |
| `--destructive` | `hsl(0 62.8% 30.6%)` | `0 62.8% 30.6%` | ✅ |
| `--border` | `hsl(240 3.7% 15.9%)` | `240 3.7% 15.9%` | ✅ |
| `--sidebar` | `hsl(240 10% 5.9%)` | `240 10% 5.9%` | ✅ |
| `--success` / `--warning` / `--info` | 规范值 | 已定义 | ✅ |
| `--font-sans` | Inter | Inter | ✅ |
| `--font-mono` | JetBrains Mono | JetBrains Mono | ✅ |

### UI 一致性总表

| 检查项 | 文件 | 结果 | 备注 |
|--------|------|------|------|
| CSS 变量与规范一致 | globals.css | ✅ | 亮色/暗色均符合 |
| 侧边栏收起宽度 `w-16` | app-sidebar.tsx | ✅ | `collapsed ? "w-16" : "w-60"` |
| 侧边栏展开宽度 `w-60` | app-sidebar.tsx | ✅ | — |
| 侧边栏背景 `bg-sidebar` | app-sidebar.tsx | ✅ | — |
| 当前项高亮 `bg-accent text-accent-foreground rounded-md` | app-sidebar.tsx | ✅ | — |
| 顶部栏高度 `h-14` | app-header.tsx | ✅ | — |
| 顶部栏 `border-b border-border` | app-header.tsx | ✅ | — |
| 登录卡片 `rounded-xl border border-border` | login-form.tsx | ✅ | — |
| 登录表单间距 `space-y-4` | login-form.tsx | ✅ | — |
| 主题切换按钮 Moon 图标定位 | app-header.tsx | ❌ | `absolute` 但父 Button 无 `relative`（见 T-002） |
| 页面 H1 字号规范 (`text-3xl font-bold`) | dashboard/page.tsx, login/page.tsx | ⚠️ | 两处均用 `text-2xl`，与规范不符，但在 B 端后台可接受 |

---

## 问题列表

### [T-001] 🔴 Critical — `/dashboard` 路由不存在

- **严重度**: Critical（核心功能不可用）
- **位置**: `src/app/(dashboard)/page.tsx`
- **描述**: `(dashboard)` 是 Next.js 路由组（括号命名），不会添加到 URL 路径。`(dashboard)/page.tsx` 实际映射到 `/`（与 `app/page.tsx` 冲突），而非 `/dashboard`。  
  构建后的 `routes-manifest.json` 验证了 `/dashboard` 路由未注册。
- **预期**: 登录成功后 `router.push("/dashboard")` 能访问到仪表盘页面
- **实际**: 跳转到 `/dashboard` 后返回 404（not-found 页面）
- **修复方向**: 在 `(dashboard)` 目录下新建 `dashboard/` 子目录，将 `page.tsx` 移入其中，即：
  ```
  src/app/(dashboard)/dashboard/page.tsx  → 路由 /dashboard
  ```
  或者，将 `app/page.tsx` 的重定向目标改为 `/`，并去掉 `app/page.tsx`，让路由组的 `/` 作为主入口。

---

### [T-002] 🟡 Medium — 主题切换按钮 Moon 图标 `absolute` 定位缺少 `relative` 父容器

- **严重度**: Medium（暗色模式下 UI 异常）
- **位置**: `src/components/shared/layout/app-header.tsx`
- **描述**: `<Moon>` 使用 `absolute` 定位，但父元素 `Button` 组件未设置 `relative`。`absolute` 元素会相对于最近的已定位祖先定位，将脱离按钮范围，导致暗色模式下月亮图标位置错误。
- **预期**: 月亮图标叠加在太阳图标位置，随主题切换渐隐渐现
- **实际**: 暗色模式下月亮图标可能偏移至 header 或页面其他位置
- **修复方向**: 在两个图标外包裹一个 `relative` 容器，或在 `Button` 上加 `relative` class：
  ```tsx
  <Button variant="ghost" size="icon" className="relative" ...>
    <Sun ... />
    <Moon className="absolute ..." />
  </Button>
  ```

---

## 自省

### 回顾
- `requirements.md` 的验收标准较为高层（3条），缺乏具体的技术验收点（如路由注册、登录跳转目标等）。建议下一版本补充"登录后跳转路径可访问"作为独立验收标准。
- `ui-ux-system.md` 对"主题切换组件"未提供参考实现，建议补充 ThemeToggle 组件的标准用法。

### 检查
- 路由注册验证（通过构建产物的 routes-manifest.json 核查）是一个有效的验收维度，建议补充到 `review-checklist.md` 的后端检查项中。

### 提议（待架构师/编排者确认后执行）

| 文档 | 建议修改内容 |
|------|------------|
| `docs/standards/review-checklist.md` | 新增检查项：「路由注册验证 — 确认所有 `router.push` 目标路径在 routes-manifest.json 中存在」 |
| `docs/standards/ui-ux-system.md` | 在「主题切换」部分补充标准 ThemeToggle 组件实现（需要 `relative` 父容器包裹 Sun/Moon 图标） |
