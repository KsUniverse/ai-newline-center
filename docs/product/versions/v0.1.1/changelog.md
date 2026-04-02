# v0.1.1 Changelog

> 发布日期: 2026-04-02
> 分支: feature/v0.1.1

## 新功能

### 组织管理 (F-000-2)
- 超级管理员可查看所有分公司列表（表格展示: 名称、用户数、状态、创建时间）
- 创建分公司（Dialog 弹窗，名称唯一性校验）
- 编辑分公司名称
- 禁用/启用分公司：禁用时级联禁用该分公司下所有 ACTIVE 用户（事务操作），返回受影响用户数
- 权限隔离：仅 SUPER_ADMIN 可见此页面

### 用户管理 (F-000-3)
- 超级管理员查看全部用户，支持按分公司筛选
- 分公司负责人只查看本公司用户（服务端强制隔离）
- 创建用户（姓名、账号、密码、角色、所属组织）
- 编辑用户（姓名、角色；账号不可修改）
- 禁用/启用用户（不能禁用当前登录账号）
- 分公司负责人只能创建 EMPLOYEE 角色

### 权限与安全
- 权限守卫工具 `requireRole` / `requireSameOrg`
- Session 实时失效：被禁用账号下次请求时自动登出
- 防账号枚举攻击：无论账号是否存在都执行 bcrypt 恒定时间比对
- 中间件路由保护扩展至 `/organizations` 和 `/users`

### 前端美学升级 (DISTILLED_AESTHETICS)
- 字体从 Inter 升级为 Outfit（几何人文主义无衬线）
- 品牌主色：电光青 `hsl(173 80% 37%)`（按钮、Logo 标记、焦点环）
- 登录页大气渐变背景 + 点阵纹理
- 页面入场交错动画 (`.animate-in-up-d0~d4`)
- 主内容区点阵纹理背景

## Bug 修复
- 修复 `BRANCH_MANAGER` 创建用户时所属组织下拉列表为空的问题
  - 根源: 组织列表仅对 SUPER_ADMIN 加载；BRANCH_MANAGER 没有获取自己组织信息的渠道
  - 修复: `GET /api/organizations/[id]` 开放给 BRANCH_MANAGER 访问自己组织的权限；用户管理页面对 BRANCH_MANAGER 加载其所属组织

## 架构变更
- Prisma: `Organization` 新增 `status` 字段 (`OrganizationStatus` 枚举)
- 新增迁移: `20260401150926_add_organization_status`
- 新增 Repository: `OrganizationRepository`
- 新增 Service: `OrganizationService`（含级联禁用事务）
- 扩展 `UserRepository`(list, create, update, setStatus)
- 扩展 `UserService`(listUsers, createUser, updateUser, setUserStatus)
- API 路由: `/api/organizations/**`, `/api/users/**`

## 测试
- 单元测试: 26 tests, 6 test files，全部通过
- TypeScript: 0 错误
- ESLint: 0 错误（2 preexisting warnings: unused import）
