# v0.1.1 后端任务清单

> 版本: v0.1.1
> 责任角色: @backend
> 技术方案: [technical-design.md](technical-design.md)

## 必读文档

开始前按序阅读：
1. [docs/INDEX.md](../../../INDEX.md) — 项目状态
2. [docs/architecture/OVERVIEW.md](../../../architecture/OVERVIEW.md) — 架构总览
3. [docs/architecture/backend.md](../../../architecture/backend.md) — 后端规范
4. [docs/architecture/database.md](../../../architecture/database.md) — 数据库规范
5. [docs/architecture/api-conventions.md](../../../architecture/api-conventions.md) — API 规范
6. [docs/product/versions/v0.1.1/requirements.md](requirements.md) — 本版本需求
7. [docs/product/versions/v0.1.1/technical-design.md](technical-design.md) — 本版本技术方案

---

## 任务清单

### B1 — Prisma Schema 变更 + 迁移

**文件**: `prisma/schema.prisma`

- [ ] 新增枚举 `OrganizationStatus { ACTIVE DISABLED }`
- [ ] `Organization` 模型新增字段: `status OrganizationStatus @default(ACTIVE)`
- [ ] 执行 `pnpm db:generate` 更新 Prisma Client
- [ ] 执行 `pnpm db:migrate` 创建迁移（migration name: `add_organization_status`）

**验收**: `prisma/migrations/` 下新增迁移文件，Prisma Client 类型包含 `OrganizationStatus`

---

### B2 — 权限守卫工具

**文件**: `src/lib/auth-guard.ts`（新建）

实现两个函数：
- `requireRole(session, ...roles)` — 未登录抛 UNAUTHORIZED(401)，角色不符抛 FORBIDDEN(403)
- `requireSameOrg(session, targetOrgId)` — SUPER_ADMIN 跳过，其他角色如果 orgId 不匹配抛 FORBIDDEN(403)

---

### B3 — OrganizationRepository

**文件**: `src/server/repositories/organization.repository.ts`（新建）

实现方法：
- `findGroupOrg()` — 查询集团组织（type = GROUP）
- `findAllBranches()` — 查询所有分公司（type = BRANCH, deletedAt = null），含 user count
- `findById(id)` — 按 ID 查询（含 children users 数量）
- `create(data: { name, parentId })` — 创建分公司（type = BRANCH）
- `update(id, data: { name?, status? })` — 更新
- `findByName(name, excludeId?)` — 检查名称重复

---

### B4 — OrganizationService

**文件**: `src/server/services/organization.service.ts`（新建）

实现方法：
- `listBranches()` — 调用 repo 并附加每个分公司的用户数量
- `createBranch(name)` — 检查名称唯一性 → 获取集团 ID → 创建
- `updateBranch(id, name)` — 检查名称唯一性（排除自身）→ 更新
- `setStatus(id, status)` — 详见技术方案「级联禁用逻辑」章节：
  - DISABLED: 事务中统计 ACTIVE 用户数 → 批量禁用用户 → 更新组织状态 → 返回 `{ org, affectedUserCount }`
  - ACTIVE: 仅更新组织状态，不恢复用户

**边界检查**:
- 不允许操作 GROUP 类型的组织（抛 FORBIDDEN）
- 创建时集团不存在则抛 AppError

---

### B5 — 组织 API 路由

**新建文件**:
- `src/app/api/organizations/route.ts` — `GET` (list) + `POST` (create)
- `src/app/api/organizations/[id]/route.ts` — `GET` (detail) + `PUT` (update)
- `src/app/api/organizations/[id]/status/route.ts` — `PATCH` (status)

**所有端点均需**: `auth()` 获取 session → `requireRole(session, 'SUPER_ADMIN')` → 调用 service

**Zod schema**（参见技术方案 2.3 节）:
- POST body: `{ name: string(1-100) }`
- PUT body: `{ name: string(1-100) }`
- PATCH body: `{ status: 'ACTIVE' | 'DISABLED' }`

---

### B6 — 扩展 UserRepository

**文件**: `src/server/repositories/user.repository.ts`（扩展现有）

新增方法：
- `list(params: { organizationId?: string, page, limit })` — 分页查询，含 organization 关联，软删除过滤
- `create(data: { account, passwordHash, name, role, organizationId })` — 创建用户
- `update(id, data: { name?, role? })` — 更新用户
- `setStatus(id, status)` — 更新状态
- `findByAccount(account)` — 已存在，保留

---

### B7 — 扩展 UserService

**文件**: `src/server/services/user.service.ts`（扩展现有）

新增方法（保留现有 `verifyCredentials`）：
- `listUsers(caller, params)` — SUPER_ADMIN 可传 `organizationId` 过滤；BRANCH_MANAGER 强制使用自己的 `organizationId`
- `createUser(caller, data)` — 权限检查（BRANCH_MANAGER 只能创建 EMPLOYEE）→ 账号唯一性检查 → bcrypt hash password → 调用 repo.create
- `updateUser(caller, id, data)` — 查用户 → 跨公司权限检查 → 更新
- `setUserStatus(caller, id, status)` — 不可禁用自己（caller.id === id 时抛错）→ 权限检查 → 更新

---

### B8 — 用户 API 路由

**新建文件**:
- `src/app/api/users/route.ts` — `GET` (list) + `POST` (create)
- `src/app/api/users/[id]/route.ts` — `GET` (detail) + `PUT` (update)
- `src/app/api/users/[id]/status/route.ts` — `PATCH` (status)

**权限**:
- `GET /api/users`, `POST /api/users`: `requireRole(session, 'SUPER_ADMIN', 'BRANCH_MANAGER')`
- `GET /api/users/[id]`, `PUT /api/users/[id]`, `PATCH /api/users/[id]/status`: 同上

**Zod schema（参见技术方案 2.3 节）**

---

### B9 — Session 实时失效

**文件**: `src/lib/auth.ts`（扩展）

在 NextAuth `callbacks.session` 中添加：
- 从 DB 查询用户当前状态
- 若用户不存在或 status = DISABLED，返回空 user（触发前端登出）
- 若正常，将 `role`, `organizationId` 注入 session

**注意**: 仅在 `session` callback 中处理，不在 `jwt` callback 中缓存 status（确保实时性）

---

## 完成标准

- [ ] 所有 B1-B9 任务完成
- [ ] `pnpm type-check` 无错误
- [ ] `pnpm lint` 无错误
- [ ] API 端点可通过 curl/Postman 手动测试

---

## 自省报告（后端开发完成后填写）

<!-- 完成后在此填写：遇到的问题、偏离技术方案的决策、以及对下个版本的改进提议 -->
