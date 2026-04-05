# 技术架构总览

> 摘要：Next.js 15 全栈应用。后端三层架构 + AI Gateway + BullMQ 任务队列。前端 Linear 风格 + 弹框/抽屉交互，暗色主题为主。自托管部署。

## 架构图

```
┌──────────────────────────────────────────────────────────────┐
│                      Client (Browser)                         │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Next.js App Router (Linear风格布局)                   │    │
│  │  ┌──────────┐ ┌─────────────────────────────────┐    │    │
│  │  │ Pages/   │ │ Components/                      │    │    │
│  │  │ Layouts  │ │ ├── ui/ (shadcn)                 │    │    │
│  │  │          │ │ ├── features/ (业务组件)           │    │    │
│  │  │          │ │ └── shared/ (布局/弹框/抽屉/通用)  │    │    │
│  │  └────┬─────┘ └──────────┬──────────────────────┘    │    │
│  │       │   Zustand Store   │                           │    │
│  │       └───────┬───────────┘                           │    │
│  │               │ apiClient + SSE 订阅                   │    │
│  └───────────────┼──────────────────────────────────────┘    │
│                  │                                            │
├──────────────────┼───────────────────────────────────────────┤
│  API Layer       │  (src/app/api/)                            │
│  Route Handler → Zod Validation → Auth (NextAuth)             │
│         │                                                     │
│  Service Layer (src/server/services/)                         │
│  ├── Business Logic + Organization Isolation                  │
│  ├── CrawlerService (爬虫封装+重试)                            │
│  └── AiGateway (AI 统一网关)                                   │
│         │              │                                      │
│  Repository Layer      │  Task Queue                          │
│  (Prisma CRUD)         │  (BullMQ + Redis)                    │
│         │              │  ├── AI 任务(拆解/仿写)               │
│         │              │  └── 爬虫任务(同步/采集)               │
│         │              │                                      │
├─────────┴──────────────┴──────────────────────────────────────┤
│  PostgreSQL              Redis           External APIs         │
│  (数据持久化)            (队列后端)       ├── AI Providers      │
│                                          └── Crawler API       │
└───────────────────────────────────────────────────────────────┘
```

## 核心原则

1. **分层隔离**: 每层只依赖下一层，禁止跨层调用
2. **类型驱动**: Zod schema → TypeScript 类型 → Prisma 类型，三者统一
3. **单一职责**: 每个文件/函数只做一件事
4. **约定优于配置**: 文件位置决定功能（Next.js 路由约定）
5. **弹框优先**: 交互操作优先使用弹框/抽屉/Slide-over，减少页面跳转
6. **异步可靠**: AI/爬虫等耗时操作通过 BullMQ 异步处理，前端 SSE 订阅结果
7. **抽象优先**: 同领域出现第二套近似实现时，优先提炼共享查询构建、映射和校验逻辑，再落具体语义方法
8. **统一风格优先**: 版本设计与全局规范、既有实现冲突时，优先向统一风格收敛，并同步回写文档

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **框架** | | |
| Next.js | 15.x | 全栈框架 (App Router) |
| TypeScript | 5.x | 类型系统 (strict mode) |
| **数据层** | | |
| PostgreSQL | 16.x | 主数据库 |
| Prisma | 6.x | ORM |
| Redis | 7.x | BullMQ 队列后端 |
| BullMQ | 5.x | 任务队列 (AI/爬虫) |
| **认证** | | |
| Auth.js (NextAuth) | 5.x | 认证 (Credentials Provider) |
| **前端** | | |
| Tailwind CSS | 4.x | 样式 |
| shadcn/ui | latest | UI 组件库 |
| Zustand | 5.x | 客户端状态管理 |
| **后端服务** | | |
| Vercel AI SDK | 4.x | AI Provider 统一接口 |
| node-cron | 3.x | 定时任务 |
| **验证** | | |
| Zod | 3.x | 运行时输入验证 |

## 关键架构决策

| 决策 | 方案 | 原因 |
|------|------|------|
| 认证 | NextAuth Credentials | 账号密码登录，管理员创建账号 |
| 数据隔离 | Repository 层手动过滤 orgId | 每个查询显式传入 organizationId |
| 领域复用 | Repository 共享 where/include 构建 + Service 暴露语义方法 | 避免同领域 `type` 分支复制近似实现 |
| AI 调用 | AI Gateway + BullMQ + SSE | 异步可靠 + 流式体验 |
| 爬虫 | Service 层封装 + 自动重试 | 统一错误处理和日志 |
| 定时任务 | node-cron + instrumentation.ts | 自托管环境，简单可靠；服务启动时由 `instrumentation.ts` 调用 `startScheduler()`；多个独立定时器（当前 4 个，见 Scheduler 模块）；`globalThis.__schedulerInitialized` 防热重载重复注册 |
| 部署 | 自托管 VPS (Docker) | 完全可控 |
| 前端布局 | Linear 风格分栏 | 紧凑侧边栏 + 列表/详情分栏 |
| 交互模式 | 弹框/抽屉/Slide-over | 减少页面跳转，保持上下文 |
| 主题 | 暗色为主 + 亮色可切 | 双套 CSS 变量 |

## 详细文档导航

- 目录结构: [project-structure.md](project-structure.md)
- 后端规范: [backend.md](backend.md)
- 前端规范: [frontend.md](frontend.md)
- 数据库规范: [database.md](database.md)
- API 规范: [api-conventions.md](api-conventions.md)
- UI/UX 设计系统: [../standards/ui-ux-system.md](../standards/ui-ux-system.md)
