# Project Guidelines — AI Newline Center

## Overview

本项目采用文档驱动的多角色协作开发模式。所有 AI Agent 必须严格遵循本文件及 docs/ 下的规范文档。

**主入口**: 阅读 `docs/INDEX.md` 获取项目全局状态和导航。

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL 16 + Prisma 6 ORM
- **Cache/Queue**: Redis 7 + BullMQ 5
- **Auth**: Auth.js (NextAuth) 5 — Credentials Provider
- **AI**: Vercel AI SDK 4 (多模型网关)
- **UI**: Tailwind CSS 4 + shadcn/ui (Linear 风格暗色主题)
- **State**: Zustand 5
- **Validation**: Zod 3
- **Cron**: node-cron 3
- **Package Manager**: pnpm
- **Deploy**: 自托管 VPS (Docker)

## Architecture

采用分层架构，详见 `docs/architecture/OVERVIEW.md`。

- **后端**: Route Handler → Service → Repository (Prisma)
- **AI 网关**: AiGateway Service → Vercel AI SDK → 多模型 Provider
- **任务队列**: BullMQ (AI 任务 + 爬虫任务) → SSE 推送前端
- **爬虫**: CrawlerService 统一封装外部 REST API + 自动重试
- **前端**: Page → Layout (Linear 风格) → Feature Components → UI Components
- **交互**: 弹框/抽屉/Slide-over 优先，减少页面跳转
- **数据隔离**: Repository 层 organizationId 过滤
- **共享**: types/ 定义前后端共享类型，由 Zod schema 生成

## Code Style

- 使用 ESLint + Prettier，提交前自动格式化
- 文件命名: kebab-case (文件), PascalCase (组件), camelCase (函数/变量)
- 导入顺序: node_modules → @/ aliases → relative
- 禁止 `any` 类型，必须显式类型标注
- 组件使用函数式声明 + named export

## Build and Test

```bash
pnpm install          # 安装依赖
pnpm dev              # 开发服务器
pnpm build            # 生产构建
pnpm lint             # ESLint 检查
pnpm type-check       # TypeScript 类型检查
pnpm db:push          # Prisma schema 推送
pnpm db:generate      # Prisma client 生成
pnpm db:migrate       # Prisma 迁移
```

## Conventions

- API 路由统一返回 `{ success: boolean, data?: T, error?: { code: string, message: string } }` 格式
- 错误处理使用自定义 AppError 类，包含 code + message
- 环境变量通过 `src/lib/env.ts` 统一管理，使用 Zod 验证，代码中禁止直接 process.env
- 数据库操作必须通过 Service 层，禁止在 Route Handler 中直接调用 Prisma
- 前端组件禁止直接 fetch，统一通过 `src/lib/api-client.ts`
- AI 调用统一走 AiGateway Service，禁止直接调用 AI SDK
- 爬虫调用统一走 CrawlerService，禁止直接 fetch 爬虫 API
- 所有 Repository 列表查询必须接受 organizationId 进行数据隔离
- 需要认证的 API 必须先 `auth()` 获取 session

## Role System

本项目使用 7 个 AI 角色协作，详见 `docs/workflow/PROCESS.md`：
编排者 | 产品经理 | 技术架构师 | 后端开发 | 前端开发 | 代码评审 | 测试

**关键原则**：每个角色严格遵守职责边界，不越权操作。
