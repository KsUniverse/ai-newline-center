# v0.1.0 前端任务清单

> 版本: v0.1.0 — 基础框架 + 用户登录
> 技术方案参见: [technical-design.md](technical-design.md)

---

## 必读文档

在开始任何任务前，必须阅读以下文档：

| 文档 | 路径 | 说明 |
|------|------|------|
| 技术设计方案 | `docs/product/versions/v0.1.0/technical-design.md` | 本次迭代完整技术方案（含组件设计规范） |
| 需求文档 | `docs/product/versions/v0.1.0/requirements.md` | 功能需求与验收标准 |
| 前端架构规范 | `docs/architecture/frontend.md` | 布局体系 + 组件层次 + 交互模式 |
| UI/UX 设计系统 | `docs/standards/ui-ux-system.md` | 色彩/字体/间距/动效规范 |
| 项目结构 | `docs/architecture/project-structure.md` | 目录约定 |
| 编码规范 | `docs/standards/coding-standards.md` | TypeScript / 命名 / 注释 |

---

## 摘要

- **任务总数**: 8
- **涉及文件**: `src/app/`, `src/components/`, `src/lib/api-client.ts`, `src/hooks/`
- **依赖**: 后端任务 B-001 ~ B-003 完成（项目已初始化、shadcn/ui 已配置）

---

## 前置条件

前端开发开始前，确认以下已完成：
- [ ] shadcn/ui 已初始化（`pnpm dlx shadcn@latest init`）
- [ ] 已安装: `next-themes`, `react-hook-form`, `@hookform/resolvers`, `zod`, `lucide-react`, `zustand`
- [ ] 已添加所需 shadcn 组件: `button`, `input`, `label`, `form`, `toast`, `separator`, `avatar`, `dropdown-menu`, `tooltip`

---

## 任务列表

### F-001: 全局样式与主题配置

**目标**: 配置暗色/亮色 CSS 变量和字体

**文件**:
- `src/app/globals.css` — 定义 CSS 变量（见 ui-ux-system.md 色彩体系）
- `src/app/layout.tsx` — 根布局，包含 `ThemeProvider`（next-themes）、字体配置（Inter + JetBrains Mono）

**要求**:
- 默认使用暗色主题（`defaultTheme="dark"`）
- 支持系统主题跟随（`enableSystem`）
- CSS 变量按 ui-ux-system.md 中的色彩表定义，含 `:root` 亮色和 `.dark` 暗色两套

**验收**: 页面默认为暗色，浏览器 DevTools 中可看到 CSS 变量

---

### F-002: API 客户端

**目标**: 封装前端 API 请求，统一处理响应和错误

**文件**: `src/lib/api-client.ts`

**要求**:
- 封装 `get<T>`, `post<T>`, `put<T>`, `patch<T>`, `del<T>` 方法
- 基于 `ApiResponse<T>` 格式，自动在 `success === false` 时 throw error
- 包含请求拦截（自动添加 Content-Type）、响应错误处理

**验收**: 函数有完整类型标注，无 `any`

---

### F-003: 登录页面

**目标**: 实现用户登录界面

**文件**:
- `src/app/(auth)/login/page.tsx` — 登录页（Server Component，渲染 LoginForm）
- `src/app/(auth)/layout.tsx` — 认证布局（居中卡片，无 Sidebar）
- `src/components/features/auth/login-form.tsx` — 登录表单（Client Component）

**LoginForm 功能**:
- 字段: `account`（账号）+ `password`（密码，支持明文/密文切换）
- 使用 `react-hook-form` + Zod 客户端验证（账号非空，密码至少 6 位）
- 提交: 调用 NextAuth `signIn("credentials", { account, password, redirect: false })`
- 成功 → `router.push("/dashboard")`
- 失败 → 显示 Toast 错误提示 "账号或密码错误，请重试"
- 提交中: 按钮 disabled + spinner

**设计规范**:
- 卡片居中布局，`max-w-sm`
- 顶部显示产品名称 "AI Newline Center"（`text-2xl font-bold` + `text-muted-foreground` 副标题）
- 使用 shadcn Form + Input + Button 组件
- 密码输入框右侧 eye/eye-off 切换图标（Lucide Icons）

**验收**:
1. 输入正确账号密码 → 跳转 Dashboard
2. 错误密码 → Toast 错误提示
3. 空字段提交 → 表单级别错误提示
4. 提交中按钮禁用

---

### F-004: AppSidebar 组件

**目标**: 实现侧边导航栏（Linear 风格）

**文件**: `src/components/shared/layout/app-sidebar.tsx`

**状态**: 通过 Zustand store 管理收起/展开，持久化到 localStorage

**Store**: `src/hooks/use-sidebar-store.ts`（或 `src/lib/stores/sidebar.store.ts`）

```typescript
interface SidebarStore {
  collapsed: boolean;
  toggle: () => void;
}
```

**侧边栏结构**:

```
┌────────────────────────┐
│  [Logo] AI Newline (文字仅展开时显示) │
├────────────────────────┤
│  主导航                │
│   ■ 仪表盘 /dashboard  │
│   ■ 管理后台 (/admin)  │  // SUPER_ADMIN + BRANCH_MANAGER 可见
├────────────────────────┤
│  (底部)                │
│   ■ 用户头像/名字      │
│   ■ 退出登录           │
└────────────────────────┘
```

**要求**:
- 收起: `w-16`, 展开: `w-60`，transition `duration-200`
- 图标始终可见，展开时图标右侧显示文字
- 当前路由对应菜单项高亮: `bg-accent text-accent-foreground rounded-md`
- 使用 `next/link` 导航
- 根据 `session.user.role` 控制管理后台入口可见性（EMPLOYEE 不可见）
- 底部用户区：显示名字首字母 Avatar + 名字（展开时），点击显示退出登录 DropdownMenu

**验收**:
1. 点击收起按钮可切换宽度，刷新后状态保持
2. 当前页面对应菜单高亮
3. EMPLOYEE 角色不显示管理后台入口

---

### F-005: AppHeader 组件

**目标**: 实现顶部栏

**文件**: `src/components/shared/layout/app-header.tsx`

**内容**:
- 左侧: 当前页面标题（通过 props 传入）
- 右侧: 主题切换按钮（暗色/亮色 toggle）

**设计规范**:
- 高度 `h-14`
- 边框下分割线 `border-b border-border`
- 主题切换使用 `Moon` / `Sun` Lucide 图标，`Button variant="ghost" size="icon"`

**验收**: 页面标题正确，主题切换按钮可用

---

### F-006: Dashboard 布局组合

**目标**: 组合 Sidebar + Header + 主内容区

**文件**:
- `src/components/shared/layout/app-layout.tsx` — AppLayout 包裹组件
- `src/app/(dashboard)/layout.tsx` — Next.js 布局文件，使用 AppLayout

**AppLayout 结构**:
```tsx
<div className="flex h-screen overflow-hidden bg-background">
  <AppSidebar />
  <main className="flex-1 flex flex-col overflow-hidden">
    <AppHeader />
    <div className="flex-1 overflow-auto">
      {children}
    </div>
  </main>
</div>
```

**验收**: Dashboard 页面有完整的侧边栏 + 顶部栏布局

---

### F-007: Dashboard 首页

**目标**: 实现登录后的 Dashboard 欢迎页

**文件**:
- `src/app/page.tsx` — 根路由，重定向到 `/dashboard`
- `src/app/(dashboard)/page.tsx` — Dashboard 首页

**Dashboard 首页内容**:
- 欢迎语: "你好，{用户名} 👋"（`text-2xl font-semibold`）
- 副标题: "欢迎使用 AI Newline Center"（`text-muted-foreground`）
- 当前版本号: `v0.1.0`（右下角或页脚）

**要求**:
- Server Component，从 `auth()` 获取 session 展示用户名
- 无 session 则 middleware 已处理重定向，此处无需判断

**验收**: 登录后可看到带用户名的欢迎页

---

### F-008: 404 和错误页面

**目标**: 配置基础错误页

**文件**:
- `src/app/not-found.tsx` — 404 页面（简洁设计，含"返回首页"链接）
- `src/app/error.tsx` — 全局错误页（Client Component）

**验收**: 访问不存在路径显示 404 页面

---

## 自省报告

完成后在此处填写自省内容。参考格式见 `docs/workflow/PROCESS.md`。
