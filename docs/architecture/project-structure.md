# 项目目录结构

> 摘要：基于 Next.js 15 App Router 的标准目录结构，src/ 下按职责分层。新增 AI Gateway、BullMQ 队列、定时任务模块。

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
│   ├── migrations/                    # 迁移文件
│   └── seed.ts                        # 种子数据 (初始管理员等)
├── public/                            # 静态资源
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── layout.tsx                 # 根布局 (ThemeProvider)
│   │   ├── page.tsx                   # 首页 (重定向到 dashboard)
│   │   ├── globals.css                # 全局样式 (暗色+亮色CSS变量)
│   │   ├── (auth)/                    # 认证路由组
│   │   │   └── login/page.tsx         # 登录页
│   │   ├── (dashboard)/               # 仪表盘路由组
│   │   │   ├── layout.tsx             # 仪表盘布局 (Sidebar + Header)
│   │   │   ├── accounts/              # 我的账号
│   │   │   ├── benchmarks/            # 对标账号
│   │   │   ├── analysis/              # AI 拆解
│   │   │   ├── fragments/             # 碎片观点
│   │   │   ├── rewrite/               # AI 仿写
│   │   │   ├── publish/               # 发布复盘
│   │   │   └── admin/                 # 管理后台
│   │   │       ├── organizations/     # 组织管理
│   │   │       ├── users/             # 用户管理
│   │   │       ├── ai-providers/      # AI 模型配置
│   │   │       └── prompts/           # Prompt 模板
│   │   └── api/                       # API 路由
│   │       ├── auth/[...nextauth]/    # NextAuth 路由
│   │       ├── organizations/         # 组织管理 API
│   │       ├── users/                 # 用户管理 API
│   │       ├── douyin-accounts/       # 抖音账号 API
│   │       ├── tasks/                 # 异步任务 API
│   │       │   ├── route.ts           # POST 创建任务
│   │       │   └── [id]/
│   │       │       ├── route.ts       # GET 任务状态
│   │       │       └── stream/
│   │       │           └── route.ts   # GET SSE 流
│   │       └── admin/
│   │           ├── ai-providers/      # AI 配置 API
│   │           └── prompts/           # Prompt 模板 API
│   ├── components/
│   │   ├── ui/                        # shadcn/ui 组件 (不手动修改)
│   │   ├── features/                  # 业务功能组件
│   │   │   ├── auth/                  # 登录相关
│   │   │   ├── organization/          # 组织管理
│   │   │   ├── user/                  # 用户管理
│   │   │   ├── douyin-account/        # 抖音账号
│   │   │   ├── analysis/              # AI 拆解
│   │   │   ├── fragment/              # 碎片观点
│   │   │   ├── rewrite/               # AI 仿写
│   │   │   └── publish/               # 发布复盘
│   │   └── shared/                    # 跨功能通用组件
│   │       ├── layout/                # 布局 (AppLayout, Sidebar, Header)
│   │       └── common/                # 通用 (SlidePanel, EmptyState, Loading)
│   ├── hooks/                         # 自定义 React Hooks
│   │   ├── use-sse.ts                 # SSE 订阅 Hook
│   │   └── use-confirm.ts            # 确认弹框 Hook
│   ├── lib/                           # 工具库
│   │   ├── api-client.ts              # API 请求封装
│   │   ├── sse-client.ts              # SSE 客户端
│   │   ├── auth.ts                    # NextAuth 配置
│   │   ├── env.ts                     # 环境变量验证 (Zod)
│   │   ├── prisma.ts                  # Prisma 客户端单例
│   │   ├── redis.ts                   # Redis 连接
│   │   ├── errors.ts                  # AppError 类
│   │   ├── api-response.ts            # 统一响应工具
│   │   ├── utils.ts                   # 通用工具函数
│   │   └── constants.ts               # 常量定义
│   ├── server/                        # 服务端专用代码
│   │   ├── services/                  # 业务逻辑层
│   │   │   ├── ai-gateway.service.ts  # AI 统一网关
│   │   │   ├── crawler.service.ts     # 爬虫封装
│   │   │   ├── user.service.ts
│   │   │   └── [resource].service.ts
│   │   ├── repositories/             # 数据访问层
│   │   │   ├── ai-provider.repository.ts
│   │   │   ├── prompt-template.repository.ts
│   │   │   ├── user.repository.ts
│   │   │   └── [resource].repository.ts
│   │   ├── queue/                     # BullMQ 任务队列
│   │   │   ├── index.ts               # 队列定义
│   │   │   ├── ai.worker.ts           # AI 任务处理器
│   │   │   └── crawler.worker.ts      # 爬虫任务处理器
│   │   └── cron/                      # 定时任务
│   │       └── index.ts               # cron 注册
│   ├── stores/                        # Zustand stores
│   │   ├── auth.store.ts
│   │   └── [store-name].store.ts
│   └── types/                         # 共享类型定义
│       ├── api.ts                     # API 请求/响应类型
│       ├── database.ts                # 数据模型类型
│       ├── next-auth.d.ts             # NextAuth 类型扩展
│       └── [domain].ts                # 领域类型
├── .env.local                         # 环境变量 (不提交)
├── .env.example                       # 环境变量模板
├── docker-compose.yml                 # Docker 编排 (PostgreSQL + Redis)
├── Dockerfile                         # 应用容器
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
