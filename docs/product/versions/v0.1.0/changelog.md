# v0.1.0 变更记录

> 发布日期: 2026-04-01

## 变更摘要

首次迭代，搭建基础框架并实现用户登录功能。

## 新增功能

### 基础框架
- Next.js 15 + TypeScript + Tailwind CSS v4 项目初始化
- Prisma 6 数据模型：`Organization`、`User`（含枚举 `OrganizationType`、`UserRole`、`UserStatus`）
- 环境变量统一管理（`src/lib/env.ts`，Zod 验证）
- 全局错误类 `AppError` + 统一 API 响应工具 `api-response.ts`
- 三层后端架构：`UserRepository` → `UserService` → Route Handler
- Prisma Seed 脚本：初始化集团组织 + 超级管理员账号

### 用户认证
- NextAuth v5 Credentials Provider + JWT（30天有效期）
- `bcryptjs` 密码哈希（salt rounds = 12）
- 恒定时间 bcrypt 比对（防止时序枚举攻击）
- Next.js Middleware 路由守卫：`/dashboard/**` 需登录，`/login` 已登录跳转

### 前端 UI
- Linear 风格暗色主题（默认），支持亮色切换（`next-themes`）
- 完整 shadcn/ui 组件库（Button、Input、Label、Form、Avatar、DropdownMenu、Tooltip、Sonner）
- 登录页（`/login`）：账号/密码表单 + 眼睛图标明文切换 + Zod 验证 + Toast 错误提示
- AppLayout：左侧 Sidebar（收起 w-16/展开 w-60，Zustand 持久化）+ 右侧 Header + 主内容区
- AppSidebar：动态导航（SUPER_ADMIN/BRANCH_MANAGER 可见管理后台入口）+ 用户 Avatar + 退出登录
- AppHeader：页面标题 + 主题切换按钮
- Dashboard 首页（`/dashboard`）：显示登录用户名欢迎语
- 404 页面 + 全局 Error 页面

## 修复（评审 & 测试阶段）

- **[Security]** 登录接口恒定时间比对，防止 Username Enumeration Timing Attack
- **[Bug]** `/dashboard` 路由映射修正（从路由组根移至正确子目录）
- **[Bug]** `sonner.tsx` 缺少 `"use client"` 导致 SSR 报错
- **[Bug]** 主题切换按钮 Moon 图标缺少 `relative` 父容器
- **[Refactor]** `api-client.ts` 加入 `BASE_URL = "/api"`，调用方只传资源路径
- **[Refactor]** 侧边栏使用 `status === "authenticated"` 防止加载中闪烁
