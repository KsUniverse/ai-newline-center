# Changelog — v0.1.1

> 发布日期: 2026-04-02
> 分支: feature/v0.1.1 → main

## 新增功能

### 组织管理 (F-000-2)

- **组织列表页** `/organizations`：分页展示所有 Branch 组织，支持状态过滤
- **创建组织**：Dialog 表单，名称唯一性校验，状态默认 ACTIVE
- **编辑组织**：修改组织名称
- **启用/禁用组织**：禁用时事务级联禁用组织下所有用户；启用组织不自动恢复用户
- **仅 SUPER_ADMIN** 可访问，菜单项按角色过滤

### 用户管理 (F-000-3)

- **用户列表页** `/users`：分页展示，SUPER_ADMIN 可跨组织筛选，BRANCH_MANAGER 仅见本组织
- **创建用户**：Dialog 表单，账号全局唯一，密码 bcrypt hash cost=12
- **编辑用户**：支持修改姓名和角色，BRANCH_MANAGER 不能超越自身权限
- **启用/禁用用户**：不能操作自身账号（前端置灰 + 后端拦截）
- **SUPER_ADMIN + BRANCH_MANAGER** 可访问

## 新增 API

| Method | 路径 | 权限 | 说明 |
|--------|------|------|------|
| GET | `/api/organizations` | SUPER_ADMIN | 列表（分页） |
| POST | `/api/organizations` | SUPER_ADMIN | 创建 |
| PUT | `/api/organizations/[id]` | SUPER_ADMIN | 编辑 |
| PATCH | `/api/organizations/[id]/status` | SUPER_ADMIN | 切换状态 |
| GET | `/api/users` | SA + BM | 列表（分页 + 组织过滤） |
| POST | `/api/users` | SA + BM | 创建 |
| PUT | `/api/users/[id]` | SA + BM | 编辑 |
| PATCH | `/api/users/[id]/status` | SA + BM | 切换状态 |

## 新增组件

- `OrganizationDialog` — 创建/编辑组织 Sheet 表单
- `OrganizationList` — 组织表格，含状态 Badge 和操作菜单
- `UserDialog` — 创建/编辑用户 Sheet 表单，角色感知
- `UserList` — 用户表格，含组织过滤和当前用户保护
- `ConfirmDialog` — 通用确认 AlertDialog
- UI: `Sheet`, `AlertDialog`, `Select`, `Badge`

## 技术亮点

- 数据隔离：BRANCH_MANAGER 所有查询自动绑定 `organizationId`，无法越权访问其他组织数据
- 原子性：禁用组织使用 `prisma.$transaction` 级联禁用用户
- 类型安全：Zod schema 前后端契约统一，`coerce` 处理 URL 查询参数类型
- 恒定时间防枚举：用户不存在时仍执行 bcrypt.compare（DUMMY_HASH）

## 评审发现并修复

| ID | 类型 | 描述 |
|----|------|------|
| M-001 | Minor | API 路由 import 顺序规范化 |
| M-002/M-003 | Minor | Service 公共方法补全显式返回类型 |
| M-004 | Minor | 类型断言添加注释说明 |
| M-006 | Minor | `UpdateUserPayload` 字段改为可选（与后端契约对齐） |
| T-001 | Low | 用户列表"禁用"按钮操作自身时前端置灰 |
