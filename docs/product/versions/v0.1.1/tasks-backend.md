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

- [x] 新增枚举 `OrganizationStatus { ACTIVE DISABLED }` ✅
- [x] `Organization` 模型新增字段: `status OrganizationStatus @default(ACTIVE)` ✅
- [x] 执行 `pnpm db:generate` 更新 Prisma Client ✅
- [x] 执行 `pnpm db:migrate` 创建迁移（migration name: `add_organization_status`）✅

**验收**: `prisma/migrations/` 下新增迁移文件，Prisma Client 类型包含 `OrganizationStatus`

---

### B2 — 权限守卫工具

**文件**: `src/lib/auth-guard.ts`（新建）

实现两个函数：
- [x] `requireRole(session, ...roles)` — 未登录抛 UNAUTHORIZED(401)，角色不符抛 FORBIDDEN(403) ✅
- [x] `requireSameOrg(session, targetOrgId)` — SUPER_ADMIN 跳过，其他角色如果 orgId 不匹配抛 FORBIDDEN(403) ✅

---

### B3 — OrganizationRepository

**文件**: `src/server/repositories/organization.repository.ts`（新建）

实现方法：
- [x] `findGroupOrg()` — 查询集团组织（type = GROUP）✅
- [x] `findAllBranches()` — 查询所有分公司（type = BRANCH, deletedAt = null），含 user count ✅
- [x] `findById(id)` — 按 ID 查询（含 children users 数量）✅
- [x] `create(data: { name, parentId })` — 创建分公司（type = BRANCH）✅
- [x] `update(id, data: { name?, status? })` — 更新 ✅
- [x] `findByName(name, excludeId?)` — 检查名称重复 ✅

---

### B4 — OrganizationService

**文件**: `src/server/services/organization.service.ts`（新建）

实现方法：
- [x] `listBranches()` — 调用 repo 并附加每个分公司的用户数量 ✅
- [x] `createBranch(name)` — 检查名称唯一性 → 获取集团 ID → 创建 ✅
- [x] `updateBranch(id, name)` — 检查名称唯一性（排除自身）→ 更新 ✅
- [x] `setStatus(id, status)` — 详见技术方案「级联禁用逻辑」章节 ✅：
  - DISABLED: 事务中统计 ACTIVE 用户数 → 批量禁用用户 → 更新组织状态 → 返回 `{ org, affectedUserCount }`
  - ACTIVE: 仅更新组织状态，不恢复用户

**边界检查**:
- [x] 不允许操作 GROUP 类型的组织（抛 FORBIDDEN）✅
- [x] 创建时集团不存在则抛 AppError ✅

---

### B5 — 组织 API 路由

**新建文件**:
- `src/app/api/organizations/route.ts` — `GET` (list) + `POST` (create)
- `src/app/api/organizations/[id]/route.ts` — `GET` (detail) + `PUT` (update)
- `src/app/api/organizations/[id]/status/route.ts` — `PATCH` (status)

**所有端点均需**: `auth()` 获取 session → `requireRole(session, 'SUPER_ADMIN')` → 调用 service ✅

**Zod schema**（参见技术方案 2.3 节）:
- [x] POST body: `{ name: string(1-100) }` ✅
- [x] PUT body: `{ name: string(1-100) }` ✅
- [x] PATCH body: `{ status: 'ACTIVE' | 'DISABLED' }` ✅

---

### B6 — 扩展 UserRepository

**文件**: `src/server/repositories/user.repository.ts`（扩展现有）

新增方法：
- [x] `list(params: { organizationId?: string, page, limit })` — 分页查询，含 organization 关联，软删除过滤 ✅
- [x] `create(data: { account, passwordHash, name, role, organizationId })` — 创建用户 ✅
- [x] `update(id, data: { name?, role? })` — 更新用户 ✅
- [x] `setStatus(id, status)` — 更新状态 ✅
- [x] `findByAccount(account)` — 已存在，保留 ✅

---

### B7 — 扩展 UserService

**文件**: `src/server/services/user.service.ts`（扩展现有）

新增方法（保留现有 `verifyCredentials`）：
- [x] `listUsers(caller, params)` — SUPER_ADMIN 可传 `organizationId` 过滤；BRANCH_MANAGER 强制使用自己的 `organizationId` ✅
- [x] `createUser(caller, data)` — 权限检查（BRANCH_MANAGER 只能创建 EMPLOYEE）→ 账号唯一性检查 → bcrypt hash password → 调用 repo.create ✅
- [x] `updateUser(caller, id, data)` — 查用户 → 跨公司权限检查 → 更新 ✅
- [x] `setUserStatus(caller, id, status)` — 不可禁用自己（caller.id === id 时抛错）→ 权限检查 → 更新 ✅

---

### B8 — 用户 API 路由

**新建文件**:
- `src/app/api/users/route.ts` — `GET` (list) + `POST` (create)
- `src/app/api/users/[id]/route.ts` — `GET` (detail) + `PUT` (update)
- `src/app/api/users/[id]/status/route.ts` — `PATCH` (status)

**权限**:
- [x] `GET /api/users`, `POST /api/users`: `requireRole(session, 'SUPER_ADMIN', 'BRANCH_MANAGER')` ✅
- [x] `GET /api/users/[id]`, `PUT /api/users/[id]`, `PATCH /api/users/[id]/status`: 同上 ✅

**Zod schema（参见技术方案 2.3 节）** ✅

---

### B9 — Session 实时失效

**文件**: `src/lib/auth.ts`（扩展）

在 NextAuth `callbacks.session` 中添加：
- [x] 从 DB 查询用户当前状态 ✅
- [x] 若用户不存在或 status = DISABLED，返回空 user（触发前端登出）✅
- [x] 若正常，将 `role`, `organizationId` 注入 session ✅

**注意**: 仅在 `session` callback 中处理，不在 `jwt` callback 中缓存 status（确保实时性）

---

## 完成标准

- [x] 所有 B1-B9 任务完成 ✅
- [x] `pnpm type-check` 无错误 ✅
- [x] `pnpm lint` 无错误 ✅
- [ ] API 端点可通过 curl/Postman 手动测试

---

## 自省报告（后端开发完成后填写）

<!-- 完成后在此填写：遇到的问题、偏离技术方案的决策、以及对下个版本的改进提议 -->

### 已完成自省

1. 实现中发现 `technical-design.md` 的 `createUserSchema.organizationId = z.string().cuid()` 与现有 seed 集团组织 ID `seed_default_group` 不一致。
2. 为避免阻塞当前后端实现，API 实际放宽为 `z.string().min(1)`，兼容当前真实数据。
3. 该差异属于版本文档问题，建议由架构师在 `technical-design.md` 中修正组织 ID 约束，或统一将 seed 组织 ID 改为 cuid。

### 建议更新的文档

1. `docs/product/versions/v0.1.1/technical-design.md`
   - **修改**: 将 `createUserSchema.organizationId` 的约束从 `z.string().cuid()` 调整为与真实组织 ID 策略一致的约束
   - **原因**: 当前 seed 数据使用固定字符串 ID，不满足 cuid 约束，文档与实现不一致

### 当前未覆盖

1. API 端点尚未做 curl/Postman 手动联调验证
2. `session` 实时失效逻辑已在代码中实现，但仍建议前端集成阶段补一轮真实登录态回归
