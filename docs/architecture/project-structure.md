# 项目目录结构

> 摘要：基于 Next.js 15 App Router 的标准目录结构，src/ 下按职责分层。

## 目录树

```
ai-newline-center/
├── AGENTS.md                          # 全局 AI 指令
├── docs/                              # 项目文档 (不参与编译)
│   ├── INDEX.md                       # 文档主入口
│   ├── architecture/                  # 架构文档
│   ├── standards/                     # 规范文档
│   ├── product/                       # 产品文档
│   └── workflow/                      # 流程文档
├── .github/
│   ├── agents/                        # Copilot Agent 定义
│   └── instructions/                  # 文件级指令
├── prisma/
│   ├── schema.prisma                  # 数据模型
│   └── migrations/                    # 迁移文件
├── public/                            # 静态资源
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── layout.tsx                 # 根布局
│   │   ├── page.tsx                   # 首页
│   │   ├── globals.css                # 全局样式
│   │   ├── (auth)/                    # 认证相关路由组
│   │   ├── (dashboard)/               # 仪表盘路由组
│   │   └── api/                       # API 路由
│   │       └── [resource]/
│   │           └── route.ts
│   ├── components/
│   │   ├── ui/                        # shadcn/ui 组件 (不手动修改)
│   │   ├── features/                  # 业务功能组件
│   │   │   └── [feature-name]/
│   │   │       ├── [component].tsx
│   │   │       └── index.ts           # barrel export
│   │   └── shared/                    # 跨功能通用组件
│   │       ├── layout/                # 布局组件 (Header, Sidebar, Footer)
│   │       └── common/                # 通用组件 (Loading, ErrorBoundary)
│   ├── hooks/                         # 自定义 React Hooks
│   ├── lib/                           # 工具库
│   │   ├── api-client.ts              # API 请求封装
│   │   ├── env.ts                     # 环境变量验证
│   │   ├── prisma.ts                  # Prisma 客户端单例
│   │   ├── utils.ts                   # 通用工具函数
│   │   └── constants.ts               # 常量定义
│   ├── server/                        # 服务端专用代码
│   │   ├── services/                  # 业务逻辑层
│   │   │   └── [resource].service.ts
│   │   └── repositories/             # 数据访问层
│   │       └── [resource].repository.ts
│   ├── stores/                        # Zustand stores
│   │   └── [store-name].store.ts
│   └── types/                         # 共享类型定义
│       ├── api.ts                     # API 请求/响应类型
│       ├── database.ts                # 数据模型类型
│       └── [domain].ts                # 领域类型
├── .env.local                         # 环境变量 (不提交)
├── .env.example                       # 环境变量模板
├── next.config.ts                     # Next.js 配置
├── tailwind.config.ts                 # Tailwind 配置
├── tsconfig.json                      # TypeScript 配置
├── package.json
└── pnpm-lock.yaml
```

## 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 目录 | kebab-case | `user-profile/` |
| 页面文件 | Next.js 约定 | `page.tsx`, `layout.tsx`, `loading.tsx` |
| 组件文件 | kebab-case | `user-avatar.tsx` |
| 组件导出 | PascalCase | `export function UserAvatar()` |
| Hook 文件 | camelCase, use 前缀 | `useAuth.ts` |
| Service 文件 | kebab-case.service | `user.service.ts` |
| Repository | kebab-case.repository | `user.repository.ts` |
| Store 文件 | kebab-case.store | `auth.store.ts` |
| 类型文件 | kebab-case | `api.ts` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |

## 路径别名

```json
{
  "@/*": ["./src/*"]
}
```

统一使用 `@/` 前缀引用 src 下的模块，禁止使用相对路径跨层引用。
