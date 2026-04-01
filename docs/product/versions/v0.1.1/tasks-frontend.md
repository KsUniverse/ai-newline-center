# v0.1.1 前端任务清单

> 版本: v0.1.1
> 责任角色: @frontend
> 技术方案: [technical-design.md](technical-design.md)

## 必读文档

开始前按序阅读：
1. [docs/INDEX.md](../../../INDEX.md) — 项目状态
2. [docs/architecture/OVERVIEW.md](../../../architecture/OVERVIEW.md) — 架构总览
3. [docs/architecture/frontend.md](../../../architecture/frontend.md) — 前端规范
4. [docs/standards/ui-ux-system.md](../../../standards/ui-ux-system.md) — 设计系统（严格遵循）
5. [docs/product/versions/v0.1.1/requirements.md](requirements.md) — 本版本需求
6. [docs/product/versions/v0.1.1/technical-design.md](technical-design.md) — 本版本技术方案

---

## 任务清单

### F1 — 共享类型定义

**新建文件**:
- `src/types/organization.ts`
- `src/types/user-management.ts`

`organization.ts` 内容：
```typescript
export interface OrganizationDTO {
  id: string;
  name: string;
  type: 'GROUP' | 'BRANCH';
  status: 'ACTIVE' | 'DISABLED';
  parentId: string | null;
  createdAt: string;
  _count?: { users: number };
}
```

`user-management.ts` 内容：
```typescript
export interface UserDTO {
  id: string;
  account: string;
  name: string;
  role: 'SUPER_ADMIN' | 'BRANCH_MANAGER' | 'EMPLOYEE';
  status: 'ACTIVE' | 'DISABLED';
  organizationId: string;
  organization: { id: string; name: string };
  createdAt: string;
}
```

---

### F2 — ConfirmDialog 通用组件

**新建文件**: `src/components/shared/common/confirm-dialog.tsx`

功能：
- 基于 shadcn `AlertDialog`
- Props: `open`, `onOpenChange`, `title`, `description`, `confirmLabel`（默认"确认"）, `onConfirm`, `destructive`（可选，destructive 样式）, `loading`（可选，提交中状态）
- 用于「禁用分公司」和「禁用用户」场景

---

### F3 — Sidebar 更新（角色过滤菜单）

**文件**: `src/components/shared/layout/app-sidebar.tsx`（修改）

- 新增「组织管理」菜单项（图标: `Building2`），仅 `SUPER_ADMIN` 可见，href: `/organizations`
- 新增「用户管理」菜单项（图标: `Users`），`SUPER_ADMIN` 和 `BRANCH_MANAGER` 可见，href: `/users`
- 从 session 读取 `user.role`，过滤菜单项
- 遵循现有 Linear 风格（收起图标/展开图标+文字）

---

### F4 — 组织管理列表组件 + Mock 数据

**新建文件**:
- `src/components/features/organizations/__mocks__/organizations.ts` — Mock 数据（5-8 条分公司，含不同状态）
- `src/components/features/organizations/organization-list.tsx` — 表格组件

`organization-list.tsx` 功能：
- 展示分公司表格（列：公司名称 | 用户数 | 状态 Badge | 创建时间 | 操作）
- 状态 Badge：ACTIVE = 绿色，DISABLED = 灰色
- 操作列：`DropdownMenu` → 编辑 / 禁用（若 DISABLED 则显示"启用"）
- Props: `organizations`, `onEdit(org)`, `onToggleStatus(org)`, `loading`

---

### F5 — 组织管理 Drawer（创建/编辑）

**新建文件**: `src/components/features/organizations/organization-drawer.tsx`

功能：
- 基于 shadcn `Sheet`（右侧抽屉）
- 模式：创建（无初始值）/ 编辑（有初始值）
- 表单字段：公司名称（必填，最多 100 字符）
- 提交时校验非空，loading 状态按钮
- Props: `mode: 'create' | 'edit'`, `defaultValues?`, `open`, `onOpenChange`, `onSubmit(data)`, `loading`

---

### F6 — 组织管理页面

**新建文件**: `src/app/(dashboard)/organizations/page.tsx`

功能：
- 页面标题：「组织管理」，右上角「+ 新建分公司」按钮
- 使用 Mock 数据（导入 `__mocks__/organizations.ts`）
- 组合 `OrganizationList` + `OrganizationDrawer` + `ConfirmDialog`
- 状态管理（useState）：`selectedOrg`, `drawerOpen`, `drawerMode`, `confirmOpen`, `pendingStatusOrg`
- 禁用弹窗描述：「该分公司下 N 个用户账号将同时被禁用，是否继续？」（N 来自 `_count.users`）
- **权限守卫**（客户端）：若 session.user.role !== 'SUPER_ADMIN'，重定向到 `/dashboard`

---

### F7 — 用户管理列表组件 + Mock 数据

**新建文件**:
- `src/components/features/users/__mocks__/users.ts` — Mock 数据（10-15 条用户，覆盖不同角色/状态/组织）
- `src/components/features/users/user-list.tsx` — 表格组件

`user-list.tsx` 功能：
- 展示用户表格（列：姓名 | 账号 | 角色 | 所属分公司 | 状态 Badge | 创建时间 | 操作）
- 角色标签：SUPER_ADMIN = 超级管理员，BRANCH_MANAGER = 分公司负责人，EMPLOYEE = 员工
- 操作列：`DropdownMenu` → 编辑 / 禁用（若 DISABLED 则显示"启用"）
- SUPER_ADMIN 时显示分公司筛选器（下拉），BRANCH_MANAGER 时不显示
- Props: `users`, `onEdit(user)`, `onToggleStatus(user)`, `organizations?`, `loading`

---

### F8 — 用户管理 Drawer（创建/编辑）

**新建文件**: `src/components/features/users/user-drawer.tsx`

功能：
- 基于 shadcn `Sheet`（右侧抽屉）
- 模式：创建 / 编辑
- 创建表单字段：姓名(必填) | 账号(必填，只读不可修改提示) | 密码(必填，最少6位) | 角色(Select) | 所属分公司(Select)
- 编辑表单字段：姓名(必填) | 角色(Select)（账号/密码/组织不可修改，展示为只读）
- BRANCH_MANAGER 时角色 Select 只含 EMPLOYEE 选项（禁用其他）
- Props: `mode: 'create' | 'edit'`, `defaultValues?`, `open`, `onOpenChange`, `onSubmit(data)`, `loading`, `organizations`, `callerRole`

---

### F9 — 用户管理页面

**新建文件**: `src/app/(dashboard)/users/page.tsx`

功能：
- 页面标题：「用户管理」，右上角「+ 新建用户」按钮
- 使用 Mock 数据
- SUPER_ADMIN：展示分公司筛选下拉；BRANCH_MANAGER：不展示筛选
- 组合 `UserList` + `UserDrawer` + `ConfirmDialog`
- 状态管理（useState）：`selectedUser`, `drawerOpen`, `drawerMode`, `confirmOpen`, `pendingStatusUser`

---

## 完成标准

- [ ] 所有 F1-F9 任务完成
- [ ] `pnpm type-check` 无错误
- [ ] `pnpm lint` 无错误
- [ ] `pnpm dev` 可正常启动，两个新页面可访问
- [ ] 组织管理页面：创建/编辑/禁用/启用流程可在 Mock 数据层面操作（UI 完整）
- [ ] 用户管理页面：同上
- [ ] Sidebar 根据角色正确显示/隐藏菜单项

---

## 自省报告（前端开发完成后填写）

<!-- 完成后在此填写：遇到的问题、偏离技术方案的决策、对下个版本的改进提议 -->
