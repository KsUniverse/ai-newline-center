# 技术架构总览

> 摘要：Next.js 15 App Router 全栈应用，分层架构，TypeScript strict，Prisma ORM，Tailwind + shadcn/ui。

## 架构图

```
┌─────────────────────────────────────────────────┐
│                   Client (Browser)               │
├─────────────────────────────────────────────────┤
│  Next.js App Router                              │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │  Pages/      │  │  Components/              │  │
│  │  Layouts     │  │  ├── ui/ (shadcn)        │  │
│  │              │  │  ├── features/ (业务组件)  │  │
│  │              │  │  └── shared/ (通用组件)    │  │
│  └──────┬──────┘  └──────────┬───────────────┘  │
│         │    Zustand Store    │                   │
│         └────────┬───────────┘                   │
│                  │ fetch (api-client.ts)          │
├─────────────────────────────────────────────────┤
│  API Layer (src/app/api/)                        │
│  Route Handler → Zod Validation                  │
│         │                                        │
│  Service Layer (src/server/services/)            │
│  Business Logic + Error Handling                 │
│         │                                        │
│  Repository Layer (src/server/repositories/)     │
│  Prisma Client Operations                        │
├─────────────────────────────────────────────────┤
│  PostgreSQL Database                             │
└─────────────────────────────────────────────────┘
```

## 核心原则

1. **分层隔离**: 每层只依赖下一层，禁止跨层调用
2. **类型驱动**: Zod schema → TypeScript 类型 → Prisma 类型，三者统一
3. **单一职责**: 每个文件/函数只做一件事
4. **约定优于配置**: 文件位置决定功能（Next.js 路由约定）

## 技术栈版本

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 15.x | 全栈框架 |
| TypeScript | 5.x | 类型系统 |
| Prisma | 6.x | ORM |
| PostgreSQL | 16.x | 数据库 |
| Tailwind CSS | 4.x | 样式 |
| shadcn/ui | latest | UI 组件库 |
| Zustand | 5.x | 状态管理 |
| Zod | 3.x | 运行时验证 |

## 详细文档导航

- 目录结构: [project-structure.md](project-structure.md)
- 后端规范: [backend.md](backend.md)
- 前端规范: [frontend.md](frontend.md)
- 数据库规范: [database.md](database.md)
- API 规范: [api-conventions.md](api-conventions.md)
