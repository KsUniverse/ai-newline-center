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
│   │   │   ├── dashboard/             # 仪表盘首页
│   │   │   ├── organizations/         # 组织管理
│   │   │   └── users/                 # 用户管理
│   │   └── api/                       # API 路由
│   │       ├── auth/[...nextauth]/    # NextAuth 路由
│   │       ├── benchmarks/            # 对标账号 API
│   │       ├── organizations/         # 组织管理 API
│   │       ├── douyin-accounts/       # 我的抖音账号 API
│   │       ├── proxy/                 # 代理接口
│   │       ├── users/                 # 用户管理 API
│   │       └── videos/                # 视频列表 API
│   ├── components/
│   │   ├── ui/                        # shadcn/ui 组件 (不手动修改)
│   │   ├── features/                  # 业务功能组件
│   │   │   ├── auth/                  # 登录相关
│   │   │   ├── organizations/         # 组织管理
│   │   │   ├── users/                 # 用户管理
│   │   │   ├── accounts/              # 我的账号
│   │   │   ├── benchmarks/            # 对标账号
│   │   └── shared/                    # 跨功能通用组件
│   │       ├── layout/                # 布局 (AppLayout, Sidebar, Header)
│   │       └── common/                # 通用 (SlidePanel, EmptyState, Loading)
│   ├── lib/                           # 工具库
│   │   ├── api-client.ts              # API 请求封装
│   │   ├── api-response.ts            # 统一响应工具
│   │   ├── auth.ts                    # NextAuth 配置
│   │   ├── auth-guard.ts              # API 角色校验
│   │   ├── env.ts                     # 环境变量验证 (Zod)
│   │   ├── errors.ts                  # AppError 类
│   │   ├── management-client.ts       # 管理端客户端
│   │   ├── middleware-auth.ts         # 中间件鉴权辅助
│   │   ├── prisma.ts                  # Prisma 客户端单例
│   │   ├── scheduler.ts               # 定时任务注册
│   │   ├── stores/                    # 客户端状态
│   │   ├── utils.ts                   # 通用工具函数
│   │   └── [helper].ts                # 其他工具函数
│   ├── server/                        # 服务端专用代码
│   │   ├── services/                  # 业务逻辑层
│   │   │   ├── benchmark-account.service.ts # 对标账号
│   │   │   ├── crawler.service.ts     # 爬虫封装
│   │   │   ├── douyin-account.service.ts # 我的账号
│   │   │   ├── organization.service.ts # 组织管理
│   │   │   ├── storage.service.ts     # 文件存储
│   │   │   ├── sync.service.ts        # 定时同步
│   │   │   ├── user.service.ts
│   │   │   ├── video.service.ts
│   │   │   └── [resource].service.ts
│   │   ├── repositories/             # 数据访问层
│   │   │   ├── douyin-account.repository.ts
│   │   │   ├── douyin-video.repository.ts
│   │   │   ├── organization.repository.ts
│   │   │   ├── user.repository.ts
│   │   │   ├── video-snapshot.repository.ts
│   │   │   └── [resource].repository.ts
│   ├── types/                         # 共享类型定义
│   │   ├── api.ts                     # API 请求/响应类型
│   │   ├── douyin-account.ts          # 抖音账号领域类型
│   │   ├── organization.ts            # 组织领域类型
│   │   ├── next-auth.d.ts             # NextAuth 类型扩展
│   │   ├── node-cron.d.ts             # 定时任务类型补充
│   │   ├── user-management.ts         # 用户管理类型
│   │   └── [domain].ts                # 其他领域类型
│   ├── middleware.ts                  # Next.js 中间件
│   └── instrumentation.ts             # 服务端启动初始化
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

## 目录设计原则

- **同领域聚合**：同一业务域的 Route、Service、Repository、Types 命名尽量一致
- **共享抽象优先**：同领域多视图若只差过滤条件或少量行为，应优先在 Repository / Service 内复用共享逻辑
- **文档跟实现同步**：目录结构调整后，必须同步更新本文件，避免 Agent 或 Copilot 依据过期路径生成代码
