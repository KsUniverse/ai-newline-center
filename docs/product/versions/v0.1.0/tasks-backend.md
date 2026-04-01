# v0.1.0 后端任务清单

> 版本: v0.1.0 — 基础框架 + 用户登录
> 技术方案参见: [technical-design.md](technical-design.md)

---

## 必读文档

在开始任何任务前，必须阅读以下文档：

| 文档 | 路径 | 说明 |
|------|------|------|
| 技术设计方案 | `docs/product/versions/v0.1.0/technical-design.md` | 本次迭代完整技术方案 |
| 需求文档 | `docs/product/versions/v0.1.0/requirements.md` | 功能需求与验收标准 |
| 后端架构规范 | `docs/architecture/backend.md` | 三层架构模板 |
| 数据库规范 | `docs/architecture/database.md` | Prisma Schema 约定 |
| API 规范 | `docs/architecture/api-conventions.md` | 响应格式与错误码 |
| 编码规范 | `docs/standards/coding-standards.md` | TypeScript / 命名 / 错误处理 |
| 项目结构 | `docs/architecture/project-structure.md` | 目录约定 |

---

## 摘要

- **任务总数**: 9
- **涉及文件**: `prisma/`, `src/lib/`, `src/server/`, `src/app/api/`, `src/middleware.ts`, `src/types/`

---

## 任务列表

### B-001: 初始化项目基础配置

**目标**: 搭建可运行的 Next.js 15 项目骨架

**任务步骤**:
- [ ] 执行 `pnpm create next-app@latest ai-newline-center --typescript --eslint --app --src-dir --import-alias "@/*"` （或确认已初始化）
- [ ] 在 `tsconfig.json` 中确认 strict 模式已开启，`noUncheckedIndexedAccess: true`
- [ ] 安装业务依赖: `bcryptjs`, `next-auth@beta`（Auth.js v5）, `@prisma/client`, `prisma`
- [ ] 安装 devDependencies: `@types/bcryptjs`
- [ ] 创建 `.env` 和 `.env.example`（内容见 technical-design.md 环境变量节）
- [ ] 确认 `.gitignore` 已包含 `.env`

**验收**: `pnpm dev` 启动不报错，默认页面可访问

---

### B-002: Prisma Schema 与数据库迁移

**目标**: 建立 Organization + User 数据模型

**任务步骤**:
- [ ] 创建 `prisma/schema.prisma`，内容按 technical-design.md（数据模型节）实现
- [ ] 运行 `pnpm db:push`（开发时快速同步）或 `pnpm db:migrate --name init`
- [ ] 运行 `pnpm db:generate` 生成 Prisma Client

**验收**: Prisma Studio 中可看到 organizations 和 users 表

---

### B-003: 基础工具库

**目标**: 实现 lib/ 下的基础工具，供后续所有层使用

**任务步骤**:

#### B-003-a: `src/lib/env.ts`

```typescript
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Seed 专用（仅 seed.ts 使用）
  SEED_ADMIN_ACCOUNT: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_ADMIN_NAME: z.string().optional(),
  SEED_ORG_NAME: z.string().optional(),
});

export const env = envSchema.parse(process.env);
```

#### B-003-b: `src/lib/prisma.ts`
- 实现 Prisma Client 单例（见 database.md 模板）

#### B-003-c: `src/lib/errors.ts`

```typescript
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}
```

#### B-003-d: `src/lib/api-response.ts`
- 实现 `successResponse<T>(data, status)` 和 `handleApiError(error)` 函数
- `handleApiError` 处理: `ZodError` → 400, `AppError` → statusCode, 其他 → 500

#### B-003-e: `src/lib/utils.ts`
- 实现 `cn(...inputs)` 工具函数（wraps `clsx` + `tailwind-merge`）
- 安装依赖: `clsx`, `tailwind-merge`

**验收**: 各文件无 TypeScript 错误

---

### B-004: 类型定义

**目标**: 定义前后端共享类型

**任务步骤**:
- [ ] 创建 `src/types/api.ts`，定义 `ApiResponse<T>`, `PaginatedData<T>`, `PaginationParams`（见 api-conventions.md 模板）
- [ ] 创建 `src/types/next-auth.d.ts`，扩展 `Session.user` 包含 `id`, `account`, `role`, `organizationId`

**验收**: 类型定义无报错，`session.user.role` 在 IDE 有类型提示

---

### B-005: User Repository

**目标**: 实现用户数据访问层

**文件**: `src/server/repositories/user.repository.ts`

**方法**:
- `findByAccount(account: string): Promise<User | null>` — 查询未软删除的用户
- `findById(id: string): Promise<User | null>` — 含 organization 关联

**要求**:
- 查询条件中加 `deletedAt: null` 过滤软删除用户
- 无需 `organizationId` 过滤（用于登录验证，登录前不知道 orgId）

**验收**: 方法有正确的返回类型标注

---

### B-006: User Service（认证验证）

**目标**: 实现登录密码验证业务逻辑

**文件**: `src/server/services/user.service.ts`

**方法**:
```typescript
verifyCredentials(account: string, password: string): Promise<SessionUser>
```

**逻辑**:
1. `userRepository.findByAccount(account)`
2. 若不存在或 `status === DISABLED` → 抛出 `AppError("INVALID_CREDENTIALS", "账号或密码错误", 401)`
3. `bcrypt.compare(password, user.passwordHash)` —— 失败 → 抛出同一错误（不区分账号/密码错误）
4. 返回 `SessionUser` 对象（不含 passwordHash）

**安全要求**:
- 必须使用同一错误消息，防止账号枚举攻击
- 不在日志中记录密码

**验收**: 密码正确返回用户对象，错误情况抛出 AppError

---

### B-007: NextAuth 配置

**目标**: 配置认证流程

**文件**: `src/lib/auth.ts` + `src/app/api/auth/[...nextauth]/route.ts`

**auth.ts 要点**:
- Provider: `Credentials`，字段 `account` + `password`
- `authorize` 回调调用 `userService.verifyCredentials`
- JWT 策略，`maxAge`: 30 天
- `jwt` callback: 将 `user.id`, `user.role`, `user.organizationId`, `user.account` 写入 token
- `session` callback: 将 token 字段映射到 `session.user`

**route.ts**:
```typescript
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

**验收**: 正确账号可通过 `signIn` 获得 session，session 含 role 和 organizationId

---

### B-008: 路由守卫 Middleware

**目标**: 保护 Dashboard 路由，未登录重定向到登录页

**文件**: `src/middleware.ts`

**逻辑**:
- 使用 `auth` 包装的 middleware（NextAuth v5 方式）
- `/login` + `/api/auth/**` 为公开路由
- 其他 `/(dashboard)/**` 路由：无 session → 重定向 `/login`
- 已登录访问 `/login` → 重定向 `/dashboard`

**验收**: 未登录访问 `/dashboard` 被重定向到 `/login`

---

### B-009: Seed 脚本

**目标**: 创建初始超级管理员和组织

**文件**: `prisma/seed.ts`

**逻辑**:
1. 从 env 读取 `SEED_ADMIN_ACCOUNT`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`, `SEED_ORG_NAME`
2. 用 `upsert` 创建默认 GROUP 类型组织（避免重复执行报错）
3. 用 `upsert` 创建 SUPER_ADMIN 用户，密码用 `bcrypt.hash(password, 12)`

**在 `package.json` 中配置**:
```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

**验收**: `pnpm db:seed` 执行成功，数据库中可查到管理员账号

---

## 自省报告

完成后在此处填写自省内容。参考格式见 `docs/workflow/PROCESS.md`。
