# v0.1.0 技术设计方案 — 基础框架 + 用户登录

> 需求来源: [requirements.md](requirements.md)
> 架构参照: [docs/architecture/OVERVIEW.md](../../../architecture/OVERVIEW.md)

## 摘要

- **涉及模块**: 基础框架 + 认证 (F-000-1)
- **新增模型**: `Organization`, `User`（含枚举 `OrganizationType`, `UserRole`, `UserStatus`）
- **新增 API**: NextAuth 内建路由 `/api/auth/[...nextauth]`
- **新增页面**: 登录页 `/login`, Dashboard 首页 `/`
- **新增组件**: AppLayout, AppSidebar, AppHeader, LoginForm
- **架构变更**: 无（首次搭建，无历史约定可破坏）

---

## 一、数据模型

### Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Organization {
  id        String           @id @default(cuid())
  name      String
  type      OrganizationType
  parentId  String?
  parent    Organization?    @relation("OrgTree", fields: [parentId], references: [id])
  children  Organization[]   @relation("OrgTree")
  users     User[]
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt
  deletedAt DateTime?

  @@map("organizations")
}

enum OrganizationType {
  GROUP   // 集团
  BRANCH  // 分公司
}

model User {
  id             String       @id @default(cuid())
  account        String       @unique
  passwordHash   String
  name           String
  role           UserRole     @default(EMPLOYEE)
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  status         UserStatus   @default(ACTIVE)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  deletedAt      DateTime?

  @@map("users")
}

enum UserRole {
  SUPER_ADMIN      // 超级管理员（平台级）
  BRANCH_MANAGER   // 分公司负责人
  EMPLOYEE         // 普通员工
}

enum UserStatus {
  ACTIVE
  DISABLED
}
```

### Seed 数据

Seed 脚本创建一条初始数据：
1. 默认集团组织（`GROUP` 类型）
2. 超级管理员账号（`SUPER_ADMIN` 角色，归属该组织）

账号信息从环境变量读取（见环境变量节）。

---

## 二、API 契约

### 2.1 认证

v0.1.0 的认证完全通过 **NextAuth Credentials Provider** 处理，无需自定义认证 API。

| 路由 | 方法 | 处理方 | 说明 |
|------|------|--------|------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth 内建 | 登录 / 登出 / 会话 |

**认证流程**:
1. 用户提交 `account` + `password`
2. NextAuth `authorize` 回调调用 `userService.verifyCredentials(account, password)`
3. 验证成功 → 返回用户对象（id, name, role, organizationId）→ 生成 JWT
4. 失败 → 返回 null → NextAuth 返回 401

**JWT Payload**（存储在 session.user）:

```typescript
interface SessionUser {
  id: string;
  name: string;
  account: string;
  role: UserRole;
  organizationId: string;
}
```

### 2.2 受保护路由规则

由 `src/middleware.ts` 实现：
- `/` → 重定向到 `/(dashboard)` 主页
- `/(dashboard)/**` → 需要登录，未登录重定向到 `/login`
- `/login` → 已登录则重定向到 `/(dashboard)`

---

## 三、后端代码结构

```
src/
├── lib/
│   ├── auth.ts              # NextAuth 配置（Credentials Provider）
│   ├── env.ts               # 环境变量验证（Zod）
│   ├── prisma.ts            # Prisma 单例
│   ├── errors.ts            # AppError 类
│   ├── api-response.ts      # 统一响应工具
│   └── utils.ts             # cn() 等通用工具
├── server/
│   ├── repositories/
│   │   └── user.repository.ts    # findByAccount, findById
│   └── services/
│       └── user.service.ts       # verifyCredentials
├── app/
│   └── api/
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts      # NextAuth 路由导出
├── middleware.ts                   # 路由守卫
└── types/
    ├── api.ts                      # ApiResponse, PaginatedData
    └── next-auth.d.ts              # Session 类型扩展
prisma/
├── schema.prisma
└── seed.ts
```

---

## 四、前端页面与组件设计

### 4.1 路由结构

| 路径 | 文件 | 说明 |
|------|------|------|
| `/` | `src/app/page.tsx` | 重定向到 `/dashboard` |
| `/login` | `src/app/(auth)/login/page.tsx` | 登录页 |
| `/dashboard` | `src/app/(dashboard)/page.tsx` | 仪表盘首页（欢迎页） |
| dashboard 布局 | `src/app/(dashboard)/layout.tsx` | AppLayout 包裹 |

### 4.2 侧边栏导航项（v0.1.0 仅展示结构，其余模块占位）

| 图标 | 标签 | 路径 | 可见角色 |
|------|------|------|---------|
| LayoutDashboard | 仪表盘 | `/dashboard` | 所有 |
| Users | 管理后台 | `/dashboard/admin/users` | SUPER_ADMIN / BRANCH_MANAGER |

### 4.3 组件清单

| 组件 | 路径 | 职责 |
|------|------|------|
| `AppLayout` | `src/components/shared/layout/app-layout.tsx` | 整体布局壳（Sidebar + 主内容） |
| `AppSidebar` | `src/components/shared/layout/app-sidebar.tsx` | 侧边导航，支持收起/展开 |
| `AppHeader` | `src/components/shared/layout/app-header.tsx` | 顶部栏（面包屑 + 用户菜单） |
| `LoginForm` | `src/components/features/auth/login-form.tsx` | 登录表单（account + password + 提交） |

### 4.4 LoginForm 交互规范

- 使用 `react-hook-form` + Zod 客户端验证
- 提交调用 NextAuth `signIn("credentials", { account, password, redirect: false })`
- 成功 → `router.push("/dashboard")`
- 失败 → 显示 "账号或密码错误" Toast 提示（shadcn `useToast`）
- 加载状态：提交按钮显示 spinner + disabled
- 密码字段支持明文/密文切换（眼睛图标）

### 4.5 侧边栏收起状态

| 状态 | 宽度 | 显示内容 |
|------|------|---------|
| 收起（默认） | `w-16` (64px) | 仅图标 |
| 展开 | `w-60` (240px) | 图标 + 文字 |

收起状态通过 Zustand store 持久化（`localStorage`）。

---

## 五、环境变量

```env
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/ai_newline"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."   # openssl rand -base64 32

# Seed 初始管理员（仅用于 seed.ts）
SEED_ADMIN_ACCOUNT="admin"
SEED_ADMIN_PASSWORD="..."
SEED_ADMIN_NAME="超级管理员"
SEED_ORG_NAME="总部"
```

所有变量通过 `src/lib/env.ts` 统一用 Zod 验证。

---

## 六、安全设计

| 要点 | 实现方式 |
|------|---------|
| 密码存储 | `bcryptjs` hash，salt rounds = 12 |
| 错误提示 | 不区分"账号不存在"和"密码错误"，统一返回同一错误消息 |
| Session | JWT 策略，有效期 30 天，signed by NEXTAUTH_SECRET |
| 路由守卫 | Next.js Middleware 检查 session token |
| 环境变量 | 所有敏感值通过 .env，禁止 hardcode |

---

## 七、参考文档清单（供评审和测试使用）

### 评审参考
- `docs/architecture/backend.md` — 三层架构规范
- `docs/architecture/database.md` — Prisma Schema 约定
- `docs/architecture/api-conventions.md` — API 设计规范
- `docs/standards/coding-standards.md` — 编码规范
- `docs/standards/review-checklist.md` — 评审检查清单

### 测试参考
- `docs/product/versions/v0.1.0/requirements.md` — 验收标准
- `docs/standards/ui-ux-system.md` — UI 一致性检查

---

## 自省报告

### 需要更新的文档

无需更新全局架构文档。v0.1.0 是第一次实现，全部架构约定均已在现有规范中覆盖。`database.md` 中已有完整的 User/Organization Schema 示例，本设计直接遵循。
