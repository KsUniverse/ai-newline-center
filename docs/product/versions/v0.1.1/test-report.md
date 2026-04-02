# 测试报告 — v0.1.1

> 测试日期: 2026-04-02  
> 测试角色: @tester  
> 测试范围: F-000-2 组织管理、F-000-3 用户管理

---

## 摘要

| 项目 | 结果 |
|------|------|
| 测试功能数 | 2 (F-000-2, F-000-3) |
| 功能验收 | 通过 ✅ |
| UI 问题 | 1 处（已修复）|
| 构建检查 | 通过 ✅ |
| **结论** | **可以 Release ✅** |

---

## 1. 单元测试

```
Test Files  7 passed (7)
     Tests  33 passed (33)
  Duration  449ms
```

✅ 全部通过，无失败用例。

---

## 2. 构建检查

```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (10/10)
```

### 路由注册确认

| 路由 | 状态 |
|------|------|
| `/organizations` | ✅ 已注册 (Dynamic) |
| `/users` | ✅ 已注册 (Dynamic) |
| `/api/organizations` | ✅ 已注册 |
| `/api/organizations/[id]` | ✅ 已注册 |
| `/api/organizations/[id]/status` | ✅ 已注册 |
| `/api/users` | ✅ 已注册 |
| `/api/users/[id]` | ✅ 已注册 |
| `/api/users/[id]/status` | ✅ 已注册 |

> 说明：DELETE 端点未在需求文档（requirements.md）及技术设计（technical-design.md）中定义，系统采用「禁用」而非「删除」模式，属于设计正确行为。

---

## 3. API 设计验收

### F-000-2 组织管理 API（仅 SUPER_ADMIN）

| 端点 | auth() | requireRole | 响应格式 | 分页 |
|------|--------|-------------|---------|------|
| GET `/api/organizations` | ✅ | ✅ SUPER_ADMIN | ✅ | N/A |
| POST `/api/organizations` | ✅ | ✅ SUPER_ADMIN | ✅ 201 | N/A |
| GET `/api/organizations/[id]` | ✅ | ✅ SUPER_ADMIN | ✅ | N/A |
| PUT `/api/organizations/[id]` | ✅ | ✅ SUPER_ADMIN | ✅ | N/A |
| PATCH `/api/organizations/[id]/status` | ✅ | ✅ SUPER_ADMIN | ✅ | N/A |

Zod 校验：
- POST/PUT body: `name z.string().min(1).max(100)` ✅
- PATCH body: `status z.nativeEnum(OrganizationStatus)` ✅

### F-000-3 用户管理 API（SUPER_ADMIN + BRANCH_MANAGER）

| 端点 | auth() | requireRole | 响应格式 | 分页 |
|------|--------|-------------|---------|------|
| GET `/api/users` | ✅ | ✅ SA+BM | ✅ | ✅ page/limit |
| POST `/api/users` | ✅ | ✅ SA+BM | ✅ 201 | N/A |
| GET `/api/users/[id]` | ✅ | ✅ SA+BM | ✅ | N/A |
| PUT `/api/users/[id]` | ✅ | ✅ SA+BM | ✅ | N/A |
| PATCH `/api/users/[id]/status` | ✅ | ✅ SA+BM | ✅ | N/A |

Zod 校验：
- POST body: account/password/name/role/organizationId 完整校验 ✅
- PUT body: `updateUserSchema` `.refine` 至少一个字段校验 ✅
- PATCH body: `status z.nativeEnum(UserStatus)` ✅

---

## 4. 组件静态审查

### organization-list.tsx — ✅ 通过

- [x] 表格渲染：5 列（公司名称、用户数、状态、创建时间、操作）
- [x] 状态 Badge：ACTIVE = 绿点"正常"，DISABLED = 灰点"已禁用"
- [x] 操作按钮：编辑 + 禁用/启用（hover 时显示）
- [x] 页面级权限守卫：非 SUPER_ADMIN 重定向至 `/dashboard`
- [x] 空状态处理：`暂无分公司数据`
- [x] 加载状态：`加载中...`

### user-list.tsx — ✅ 通过（修复后）

- [x] 表格渲染：7 列（姓名、账号、角色、所属分公司、状态、创建时间、操作）
- [x] 状态列：同组织表格，绿/灰点区分
- [x] SUPER_ADMIN 分公司筛选器：仅传入 `showOrgFilter=true` 时显示
- [x] 「不能操作自己」逻辑：**已修复** — 新增 `currentUserId` prop，自己行的"禁用/启用"按钮 disabled
- [x] 空状态、加载状态处理

### organization-dialog.tsx — ✅ 通过

- [x] 创建模式（无默认值）/ 编辑模式（有默认值）切换正确
- [x] 表单重置：`useEffect` 监听 `open` + `defaultValues` 重置 `name`、`error`
- [x] 校验：trim 后非空、最长 100 字符
- [x] loading 状态按钮禁用 + 「提交中...」文字

### user-dialog.tsx — ✅ 通过

- [x] 创建/编辑模式切换：账号/组织创建模式可填，编辑模式只读（`readOnly`）
- [x] 密码字段仅创建时显示
- [x] BRANCH_MANAGER 角色限制：`availableRoles` 过滤仅 EMPLOYEE
- [x] SUPER_ADMIN 可选全部角色
- [x] 组织下拉：创建时 Select 可选，编辑时只读 Input
- [x] 归属组织提示：「用户归属组织创建后不可修改」

---

## 5. 数据隔离验收

### organization.service.ts — ✅ 通过

- [x] `GROUP` 类型组织禁止所有操作（`getBranchById` 抛 FORBIDDEN）
- [x] `setStatus` DISABLED 时：事务中统计 ACTIVE 用户数 → 批量禁用 → 更新组织（级联禁用正确）
- [x] `setStatus` ACTIVE 时：仅更新组织状态，不恢复用户（符合需求）
- [x] `createBranch`：检查名称唯一性 → 获取集团 ID → 创建

### user.service.ts — ✅ 通过

- [x] `listUsers`：BRANCH_MANAGER 强制使用 `caller.organizationId`，忽略请求中 `organizationId` 参数
- [x] `createUser`：BRANCH_MANAGER 只能创建 EMPLOYEE 且只能在本组织
- [x] `updateUser`：BRANCH_MANAGER 不能将用户角色改为 EMPLOYEE 以外
- [x] `setUserStatus`：`caller.id === id` 禁止禁用自己（403）
- [x] `getUserById` / `updateUser` / `setUserStatus`：跨组织访问抛 FORBIDDEN

---

## 问题列表

### [T-001] user-list.tsx 自己行「禁用」按钮可点击 — **已修复**

- **严重度**: Low（功能可用，仅 UX 问题，后端亦有兜底拦截）
- **位置**: `src/components/features/users/user-list.tsx`
- **描述**: `UserList` 组件未接收 `currentUserId`，当前登录用户行的"禁用"按钮可见且可点击，点击后触发 toast 错误。
- **修复**: 新增 `currentUserId?: string` prop；当 `user.id === currentUserId` 时，状态切换 `DropdownMenuItem` 设为 `disabled`
- **修复后**: 按钮置灰不可点击，`destructive` 颜色样式同步修正

---

## 自省

### 回顾
- requirements.md 的验收标准较充分，边界条件（不能禁用自己、BRANCH_MANAGER 只能创 EMPLOYEE）均有明确描述。
- ui-ux-system.md 未在本次验收中发现遗漏检查项。

### 检查
- T-001 的"禁用按钮应对当前用户 disabled"可补充至 `review-checklist.md` 的「用户操作权限」章节，作为通用检查项。

### 提议
建议由架构师或编排者在 `docs/standards/review-checklist.md` 中补充：

> **用户操作权限 UI**: 列表中涉及「禁用/删除」等危险操作时，若当前登录用户自身在列表中，对应行操作按钮需置灰（disabled），不仅靠后端拦截。
