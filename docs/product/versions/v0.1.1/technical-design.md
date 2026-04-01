# v0.1.1 技术设计方案 — 组织管理 + 用户管理

> 需求来源: [requirements.md](requirements.md)
> 架构参照: [docs/architecture/OVERVIEW.md](../../../architecture/OVERVIEW.md)

## 摘要

- **涉及模块**: F-000-2 组织管理、F-000-3 用户管理
- **Schema 变更**: `Organization` 新增 `status` 字段 + `OrganizationStatus` 枚举
- **新增 API**: 6 个端点（organizations × 3, users × 3）
- **新增页面**: `/organizations`（SUPER_ADMIN 可见）, `/users`（SUPER_ADMIN + BRANCH_MANAGER 可见）
- **新增组件**: OrganizationDrawer, UserDrawer, ConfirmDialog, 列表组件
- **Sidebar 变更**: 新增「组织管理」和「用户管理」两个入口
- **权限变更**: 新增 Route Handler 层 `requireRole()` 权限守卫

---

## 一、数据模型

### Schema 变更（增量）

```prisma
// 新增枚举
enum OrganizationStatus {
  ACTIVE
  DISABLED
}

// Organization 模型新增字段
model Organization {
  // ... 现有字段不变 ...
  status    OrganizationStatus @default(ACTIVE)  // 新增
}
```

> **迁移策略**: `pnpm db:migrate` 新建迁移，`status` 默认值 `ACTIVE`，不影响存量数据。

### 无需新增模型

User 模型已包含所有必要字段（`status`, `role`, `organizationId`），无需修改。

---

## 二、后端 API

### 2.1 组织管理 API（仅 SUPER_ADMIN 可访问）

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/organizations` | 分公司列表 | — | `{ items, total }` |
| POST | `/api/organizations` | 创建分公司 | `{ name }` | Organization |
| GET | `/api/organizations/[id]` | 分公司详情 | — | Organization |
| PUT | `/api/organizations/[id]` | 更新名称 | `{ name }` | Organization |
| PATCH | `/api/organizations/[id]/status` | 切换状态 | `{ status: "ACTIVE" \| "DISABLED" }` | Organization |

### 2.2 用户管理 API（SUPER_ADMIN + BRANCH_MANAGER，数据按权限隔离）

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/users` | 用户列表 | query: `?page&limit&organizationId` | `{ items, total }` |
| POST | `/api/users` | 创建用户 | `{ account, password, name, role, organizationId }` | User |
| GET | `/api/users/[id]` | 用户详情 | — | User |
| PUT | `/api/users/[id]` | 更新用户 | `{ name, role }` | User |
| PATCH | `/api/users/[id]/status` | 切换状态 | `{ status: "ACTIVE" \| "DISABLED" }` | User |

### 2.3 Zod Schema

```typescript
// 组织相关
const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(100),
});

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"]),
});

// 用户相关
const createUserSchema = z.object({
  account: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(50),
  role: z.enum(["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"]),
  organizationId: z.string().cuid(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  role: z.enum(["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"]).optional(),
});
```

---

## 三、服务层设计

### 3.1 OrganizationService 方法

```typescript
class OrganizationService {
  // 列出所有分公司（排除集团本身）
  async listBranches(): Promise<Organization[]>

  // 创建分公司（检查名称唯一性）
  async createBranch(name: string, groupId: string): Promise<Organization>

  // 更新名称（检查名称唯一性）
  async updateBranch(id: string, name: string): Promise<Organization>

  // 切换状态（禁用时级联禁用用户，启用时仅启用组织不恢复用户）
  async setStatus(id: string, status: OrganizationStatus): Promise<{ org, affectedUserCount }>
}
```

### 3.2 UserService 新增方法

```typescript
class UserService {
  // 列出用户（SUPER_ADMIN 可按组织过滤，BRANCH_MANAGER 只能查本组织）
  async listUsers(caller: SessionUser, params: ListUsersParams): Promise<PaginatedResult<User>>

  // 创建用户（权限检查 + 密码哈希 + 账号唯一性校验）
  async createUser(caller: SessionUser, data: CreateUserData): Promise<User>

  // 更新用户（name/role，不可修改 account/organizationId）
  async updateUser(caller: SessionUser, id: string, data: UpdateUserData): Promise<User>

  // 切换用户状态（不可禁用自己）
  async setUserStatus(caller: SessionUser, id: string, status: UserStatus): Promise<User>
}
```

### 3.3 级联禁用逻辑（事务）

```typescript
// OrganizationService.setStatus — 禁用分公司时
async setStatus(id, status) {
  if (status === 'DISABLED') {
    return prisma.$transaction(async (tx) => {
      // 1. 统计受影响的 ACTIVE 用户数
      const count = await tx.user.count({ where: { organizationId: id, status: 'ACTIVE' } });
      // 2. 批量禁用用户
      await tx.user.updateMany({ where: { organizationId: id, status: 'ACTIVE' }, data: { status: 'DISABLED' } });
      // 3. 更新组织状态
      const org = await tx.organization.update({ where: { id }, data: { status: 'DISABLED' } });
      return { org, affectedUserCount: count };
    });
  }
  // 启用时仅更新组织，不自动恢复用户
  return { org: await updateOrg(id, { status: 'ACTIVE' }), affectedUserCount: 0 };
}
```

### 3.4 权限守卫

```typescript
// src/lib/auth-guard.ts
export function requireRole(session: Session | null, ...roles: UserRole[]) {
  if (!session) throw new AppError('UNAUTHORIZED', '请先登录', 401);
  if (!roles.includes(session.user.role)) {
    throw new AppError('FORBIDDEN', '无操作权限', 403);
  }
}

// 用于 BRANCH_MANAGER 数据隔离
export function requireSameOrg(session: Session, targetOrgId: string) {
  if (session.user.role === UserRole.SUPER_ADMIN) return;
  if (session.user.organizationId !== targetOrgId) {
    throw new AppError('FORBIDDEN', '无操作权限', 403);
  }
}
```

---

## 四、新增文件清单

### 后端

```
src/
├── app/api/
│   ├── organizations/
│   │   ├── route.ts                  # GET list / POST create
│   │   └── [id]/
│   │       ├── route.ts              # GET detail / PUT update
│   │       └── status/
│   │           └── route.ts          # PATCH status
│   └── users/
│       ├── route.ts                  # GET list / POST create
│       └── [id]/
│           ├── route.ts              # GET detail / PUT update
│           └── status/
│               └── route.ts          # PATCH status
├── lib/
│   └── auth-guard.ts                 # 新增权限守卫工具
└── server/
    ├── repositories/
    │   └── organization.repository.ts # 新增
    └── services/
        └── organization.service.ts    # 新增
        # user.service.ts             # 扩展（新增 listUsers/createUser/updateUser/setUserStatus）
        # user.repository.ts          # 扩展（新增 list/create/update/setStatus）
```

### 前端

```
src/
├── app/(dashboard)/
│   ├── organizations/
│   │   └── page.tsx                  # 组织管理页面（SUPER_ADMIN 专用）
│   └── users/
│       └── page.tsx                  # 用户管理页面
├── components/
│   ├── features/
│   │   ├── organizations/
│   │   │   ├── organization-list.tsx      # 分公司表格组件
│   │   │   └── organization-drawer.tsx    # 创建/编辑抽屉
│   │   └── users/
│   │       ├── user-list.tsx              # 用户表格组件
│   │       └── user-drawer.tsx            # 创建/编辑抽屉
│   └── shared/
│       └── common/
│           └── confirm-dialog.tsx         # 通用确认对话框（复用）
└── types/
    ├── organization.ts                    # 前后端共享类型（OrganizationDTO）
    └── user-management.ts                 # UserDTO（含 organization 关联）
```

---

## 五、前端交互规范

### 5.1 页面结构（以组织管理为例）

```
[Header] 组织管理 | [+ 新建分公司] 按钮

[Table]
  列：公司名称 | 状态 | 负责人 | 创建时间 | 操作
  操作列：DropdownMenu → 编辑 / 禁用(启用)

[OrganizationDrawer]（创建/编辑，右侧 Sheet）
  字段：公司名称
  按钮：取消 / 提交

[ConfirmDialog]（禁用确认）
  标题：确认禁用「XX 分公司」？
  内容：该分公司下 N 个用户账号将同时被禁用，是否继续？
  按钮：取消 / 确认禁用（destructive 样式）
```

### 5.2 Sidebar 更新

```typescript
const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘', roles: ['ALL'] },
  { href: '/organizations', icon: Building2, label: '组织管理', roles: ['SUPER_ADMIN'] },
  { href: '/users', icon: Users, label: '用户管理', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
];
// 根据 session.user.role 过滤展示
```

### 5.3 数据流（使用 Mock，等后端完成后联调）

前端开发阶段使用本地 mock 数据，mock 数据文件放置于：

```
src/components/features/organizations/__mocks__/organizations.ts
src/components/features/users/__mocks__/users.ts
```

---

## 六、Session 有效性验证

**问题背景**: 禁用用户后，该用户的现有 JWT session 仍有效，需要使其立即失效。

**方案**: 在 NextAuth `session` 回调 + `auth.ts` `authorized` 中增加数据库状态检查（每次请求验证一次）。

```typescript
// src/lib/auth.ts — session 回调扩展
callbacks: {
  async session({ session, token }) {
    // 从 DB 实时查询用户状态（低频，利用 Prisma 连接池）
    const dbUser = await userRepository.findById(token.sub!);
    if (!dbUser || dbUser.status === 'DISABLED') {
      // 返回空 session 触发前端登出
      return { ...session, user: undefined as any };
    }
    // ...
  }
}
```

> **注意**: 此方案每次请求查一次 DB。v0.1.1 规模下可接受；未来可加 Redis 缓存。

---

## 七、数据库迁移

```sql
-- 自动生成 migration SQL（概要）
ALTER TYPE "public"."OrganizationStatus" ...;  -- 新建枚举
ALTER TABLE "organizations" ADD COLUMN "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE';
```

执行命令：
```bash
pnpm db:migrate
# migration name: add_organization_status
```

---

## 八、任务拆分

### 后端任务（tasks-backend.md）

| # | 任务 | 文件 | 优先级 |
|---|------|------|--------|
| B1 | Prisma: 新增 OrganizationStatus 枚举 + status 字段 + 迁移 | `prisma/schema.prisma` | P0 |
| B2 | 权限守卫工具函数 | `src/lib/auth-guard.ts` | P0 |
| B3 | OrganizationRepository | `src/server/repositories/organization.repository.ts` | P0 |
| B4 | OrganizationService（含级联禁用事务） | `src/server/services/organization.service.ts` | P0 |
| B5 | 组织 API 路由（list/create/detail/update/status） | `src/app/api/organizations/...` | P0 |
| B6 | 扩展 UserRepository（list/create/update/setStatus） | `src/server/repositories/user.repository.ts` | P0 |
| B7 | 扩展 UserService（listUsers/createUser/updateUser/setUserStatus） | `src/server/services/user.service.ts` | P0 |
| B8 | 用户 API 路由（list/create/detail/update/status） | `src/app/api/users/...` | P0 |
| B9 | 扩展 Auth session 回调：禁用用户实时失效 | `src/lib/auth.ts` | P0 |

### 前端任务（tasks-frontend.md）

| # | 任务 | 文件 | 优先级 |
|---|------|------|--------|
| F1 | 共享类型定义 | `src/types/organization.ts`, `src/types/user-management.ts` | P0 |
| F2 | ConfirmDialog 通用组件 | `src/components/shared/common/confirm-dialog.tsx` | P0 |
| F3 | Sidebar 更新（新增菜单项，角色过滤） | `src/components/shared/layout/app-sidebar.tsx` | P0 |
| F4 | 组织管理列表组件 + Mock 数据 | `src/components/features/organizations/...` | P0 |
| F5 | 组织管理 Drawer（创建/编辑） | `src/components/features/organizations/organization-drawer.tsx` | P0 |
| F6 | 组织管理页面（组合以上组件） | `src/app/(dashboard)/organizations/page.tsx` | P0 |
| F7 | 用户管理列表组件 + Mock 数据 | `src/components/features/users/...` | P0 |
| F8 | 用户管理 Drawer（创建/编辑） | `src/components/features/users/user-drawer.tsx` | P0 |
| F9 | 用户管理页面（组合以上组件） | `src/app/(dashboard)/users/page.tsx` | P0 |

---

## 九、架构师自省

**本次设计决策说明**:

1. **不引入新的 Session 存储（Redis）**: 当前规模通过 DB 实时查询处理即可，避免过度工程化
2. **PATCH /status 独立端点**: 状态切换语义清晰，优于在 PUT body 中混合
3. **级联禁用用事务**: 保证数据一致性，防止组织禁用成功而用户未禁用的中间态
4. **启用组织不恢复用户**: 符合需求文档的明确要求，避免意外恢复
5. **账号格式限制 `^[a-zA-Z0-9_]+$`**: 需求文档未指定，此处做合理约束防止特殊字符注入

**待确认项（无阻塞项，可实现中确认）**:
- `status` 字段的接口响应中是否需要返回中文标签（如 { status: 'ACTIVE', statusLabel: '正常' }）？建议前端自行映射，接口只返回枚举值。
