# 数据库设计规范

> 摘要：PostgreSQL + Prisma ORM。模型命名 PascalCase，字段 camelCase。每个模型必须有 id/createdAt/updatedAt。软删除用 deletedAt。业务模型必须有 organizationId 用于数据隔离。

## Prisma Schema 约定

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ===== 组织与权限 =====

model Organization {
  id        String           @id @default(cuid())
  name      String
  type      OrganizationType
  parentId  String?
  parent    Organization?    @relation("OrgTree", fields: [parentId], references: [id])
  children  Organization[]   @relation("OrgTree")
  users     User[]
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt
  deletedAt DateTime?

  @@map("organizations")
}

enum OrganizationType {
  GROUP          // 集团
  BRANCH         // 分公司
}

model User {
  id             String       @id @default(cuid())
  account        String       @unique
  passwordHash   String
  name           String
  role           UserRole     @default(EMPLOYEE)
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  status         UserStatus   @default(ACTIVE)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  deletedAt      DateTime?

  @@map("users")
}

enum UserRole {
  SUPER_ADMIN
  BRANCH_MANAGER
  EMPLOYEE
}

enum UserStatus {
  ACTIVE
  DISABLED
}
```

## 数据隔离规则

**核心**: 所有业务模型必须包含 `organizationId` 字段，Repository 查询时作为 WHERE 条件。

```prisma
// 业务模型标准字段
model DouyinAccount {
  id             String   @id @default(cuid())
  organizationId String   // ← 必须有
  userId         String   // ← 归属员工
  // ... 业务字段
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?

  @@index([organizationId])   // ← 必须建索引
  @@map("douyin_accounts")
}
```

## 领域模型复用原则

当两个业务视图仅在 `type`、`status`、`deletedAt`、可见范围或少量行为差异上不同，
优先使用**单模型承载 + 字段区分语义**，避免拆出结构近似的新表。

典型场景：
- `MY_ACCOUNT` / `BENCHMARK_ACCOUNT`
- 主列表 / 归档列表
- 活跃记录 / 软删除记录

设计要求：
- 公共过滤字段命名保持标准化，如 `type`、`deletedAt`、`organizationId`
- 索引围绕共享查询模式设计，而不是只为单一路径临时补索引
- 若多个视图长期共用同一组 `where/orderBy` 条件，应优先在 Repository 层复用查询构建

## 命名规范

| 元素 | 规范 | 示例 |
|------|------|------|
| Model | PascalCase 单数 | `User`, `ProjectTask` |
| Field | camelCase | `createdAt`, `userId` |
| Table (@@map) | snake_case 复数 | `users`, `project_tasks` |
| Enum | PascalCase | `UserRole` |
| Enum Value | UPPER_SNAKE_CASE | `ADMIN`, `IN_PROGRESS` |

## 必备字段

每个模型必须包含：

```prisma
id        String   @id @default(cuid())
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```

需要软删除的模型添加：

```prisma
deletedAt DateTime?
```

## 关系规范

```prisma
// 一对多关系 — 显式定义外键
model Post {
  id       String @id @default(cuid())
  title    String
  author   User   @relation(fields: [authorId], references: [id])
  authorId String

  @@map("posts")
}
```

## 迁移流程

1. 修改 `prisma/schema.prisma`
2. 运行 `pnpm db:migrate --name <描述>` 创建迁移
3. 迁移文件自动生成在 `prisma/migrations/`
4. 运行 `pnpm db:generate` 更新 Prisma Client
5. **禁止手动修改已提交的迁移文件**

## Prisma Client 单例

```typescript
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

## 规则

1. 每个模型必须有 `id` (cuid), `createdAt`, `updatedAt`
2. 需要软删除的模型添加 `deletedAt DateTime?`
3. 业务模型必须有 `organizationId` + `@@index([organizationId])`
4. 外键关系必须显式定义 `@relation(fields: [...], references: [...])`
5. 表名 `@@map()` 使用 snake_case 复数
6. 禁止手动修改已提交的迁移文件
7. 枚举值使用 UPPER_SNAKE_CASE
8. 系统配置表 (AiProvider, PromptTemplate) 不需要 organizationId（全局共享）
9. 仅因 `type/status/archive` 区分的近似视图，优先单模型承载，避免复制式表结构

## 系统模型 (AI/任务)

```prisma
// AI 模型配置（管理员管理）
model AiProvider {
  id        String       @id @default(cuid())
  name      String       // 显示名称 (如 "GPT-4o", "Claude 3.5")
  provider  String       // 厂商标识 (如 "openai", "anthropic")
  modelId   String       // 模型ID (如 "gpt-4o", "claude-3-5-sonnet")
  apiKey    String       // 加密存储
  baseUrl   String       // API 地址
  step      AiStep       // 适用步骤
  isDefault Boolean      @default(false)
  isActive  Boolean      @default(true)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@map("ai_providers")
}

enum AiStep {
  TRANSCRIBE
  ANALYZE
  REWRITE
}

// Prompt 模板
model PromptTemplate {
  id        String   @id @default(cuid())
  name      String
  step      AiStep
  content   String   // 模板内容，支持 {{variable}} 占位符
  isDefault Boolean  @default(false)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("prompt_templates")
}

// 异步任务记录 (AI/爬虫)
model Task {
  id             String     @id @default(cuid())
  type           TaskType
  status         TaskStatus @default(PENDING)
  payload        Json       // 任务输入参数
  result         String?    // 任务结果文本
  error          String?    // 错误信息
  organizationId String
  userId         String
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  @@index([organizationId])
  @@index([status])
  @@map("tasks")
}

enum TaskType {
  AI_TRANSCRIBE
  AI_ANALYZE
  AI_REWRITE
  CRAWLER_SYNC_ACCOUNT
  CRAWLER_SYNC_FAVORITES
}

enum TaskStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

1. 所有数据库操作必须通过 Repository 层，禁止 Service/Route 直接调用 prisma
2. 使用 `cuid()` 作为主键类型，不使用自增 ID
3. 索引通过 `@@index` 显式声明，提前规划查询模式
4. 敏感数据（密码等）在 Service 层处理，Repository 不负责加密
5. 级联删除需显式配置，默认不级联
