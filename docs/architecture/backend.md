# 后端架构规范

> 摘要：三层架构 Route Handler → Service → Repository。AI Gateway 统一管理多模型调用。BullMQ 处理异步任务。爬虫 Service 层封装。数据隔离在 Repository 层实现。

## 分层职责

```
Route Handler (src/app/api/)
  ├── 解析请求参数
  ├── Zod schema 验证
  ├── NextAuth session 获取
  ├── 调用 Service (传入 userId / organizationId)
  └── 返回统一响应格式

Service (src/server/services/)
  ├── 业务逻辑
  ├── 权限检查 (角色+组织)
  ├── 跨实体协调
  ├── AI Gateway 调用
  ├── Crawler Service 调用
  └── 抛出 AppError

Repository (src/server/repositories/)
  ├── Prisma CRUD 操作
  ├── 查询构建 (organizationId 过滤)
  ├── 同领域共享查询条件/Include 片段复用
  └── 数据转换
```

## Route Handler 模板

```typescript
// src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { userService } from "@/server/services/user.service";
import { handleApiError, successResponse } from "@/lib/api-response";

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createUserSchema.parse(body);
    const user = await userService.create(data);
    return successResponse(user, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "20");
    const result = await userService.list({ page, limit });
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

## Service 模板

```typescript
// src/server/services/user.service.ts
import { userRepository } from "@/server/repositories/user.repository";
import { AppError } from "@/lib/errors";

class UserService {
  async create(data: { name: string; email: string }) {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw new AppError("EMAIL_EXISTS", "邮箱已被注册", 409);
    }
    return userRepository.create(data);
  }

  async list(params: { page: number; limit: number }) {
    return userRepository.findMany(params);
  }
}

export const userService = new UserService();
```

## Repository 模板

```typescript
// src/server/repositories/user.repository.ts
import { prisma } from "@/lib/prisma";

class UserRepository {
  async create(data: { name: string; email: string }) {
    return prisma.user.create({ data });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findMany(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count(),
    ]);
    return { items, total, page, limit };
  }
}

export const userRepository = new UserRepository();
```

## Repository 抽象复用模式

当同一个 Prisma Model 仅通过 `deletedAt`、可见范围或少量 include/orderBy 差异承载多个业务视图时，
Repository 层应优先抽取**共享查询构建函数**，而不是复制一套近似查询。

```typescript
type ArchiveFilter = "active" | "archived" | "all";

interface BuildAccountWhereParams {
  userId?: string;
  organizationId?: string;
  archiveFilter?: ArchiveFilter;
}

class DouyinAccountRepository {
  private buildWhere(params: BuildAccountWhereParams): Prisma.DouyinAccountWhereInput {
    const { userId, organizationId, archiveFilter = "active" } = params;

    return {
      ...(userId ? { userId } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(archiveFilter === "active" ? { deletedAt: null } : {}),
      ...(archiveFilter === "archived" ? { deletedAt: { not: null } } : {}),
    };
  }
}
```

**适用场景**：
- 主列表 / 归档列表仅在 `deletedAt` 条件上不同
- 查询主体一致，仅 include / 排序 / archiveFilter 略有差异

**不适用场景**：
- 领域所有权、权限模型、定时同步链路已经实质分叉，例如 `DouyinAccount` / `BenchmarkAccount`
- 下游视频、快照、转录链路已拆为独立模型，例如 `DouyinVideo` / `BenchmarkVideo`

**规则**：
- 共享逻辑放在 Repository 私有 helper 中，不上浮到 Route Handler
- 已拆分领域仍保留业务语义方法，例如 `findAllMyAccountsForCollection()`、`findByOrganizationAndSecUserIdIncludingDeleted()`
- Service 依赖“语义方法”，不直接拼装 Prisma where 条件
- `include` 片段如 `user: { select: { id, name } }` 可抽成常量复用，避免多处漂移
- 同领域归档筛选优先统一为 `archiveFilter` 语义，历史兼容路由也应委托同一套 Service / Repository 逻辑

## 统一响应格式

```typescript
// src/lib/api-response.ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>(
    { success: true, data },
    { status }
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: "VALIDATION_ERROR", message: error.errors[0].message } },
      { status: 400 }
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  console.error("Unhandled error:", error);
  return NextResponse.json<ApiResponse<never>>(
    { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
    { status: 500 }
  );
}
```

## 错误处理

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}
```

## 规则

1. Route Handler 只做：解析参数 → 验证 → 调用 Service → 返回响应
2. Service 包含所有业务逻辑，可调用多个 Repository
3. Repository 只做数据库操作，不含业务逻辑
4. 所有输入通过 Zod schema 验证，Schema 定义在 Route Handler 文件顶部
5. 错误通过 AppError 抛出，Route Handler 统一捕获
6. 禁止在 Route Handler 中直接使用 Prisma client
7. 所有列表查询必须传入 organizationId 进行数据隔离
8. AI 调用统一走 AiGateway，禁止直接调用 AI SDK
9. 爬虫调用统一走 CrawlerService，禁止直接 fetch 爬虫 API
10. 当同一模型服务多个业务类型时，优先抽取 Repository 共享查询构建函数，避免复制近似查询
11. 代理类或适配类接口（如图片代理、同步代理）也必须遵循三层职责，Route Handler 不直接调用外部资源

---

## 认证与授权

### NextAuth 配置

```typescript
// src/lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        account: { label: "账号" },
        password: { label: "密码", type: "password" },
      },
      authorize: async (credentials) => {
        // 验证逻辑：查询用户 → 校验密码 → 返回用户信息
      },
    }),
  ],
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub,
        role: token.role,
        organizationId: token.organizationId,
      },
    }),
    jwt: ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
      }
      return token;
    },
  },
});
```

### Route Handler 中获取身份

```typescript
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) throw new AppError("UNAUTHORIZED", "请先登录", 401);

    const { id: userId, role, organizationId } = session.user;
    const result = await someService.list({ organizationId });
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## 数据隔离 (Organization Isolation)

在 Repository 层，**所有列表/查询方法必须接受 organizationId 参数**并用作过滤条件：

```typescript
class UserRepository {
  async findMany(params: { organizationId: string; page: number; limit: number }) {
    const { organizationId, page, limit } = params;
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId, deletedAt: null },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where: { organizationId, deletedAt: null } }),
    ]);
    return { items, total, page, limit };
  }
}
```

**规则**：
- 超级管理员查询可传 `organizationId = undefined` 跳过过滤
- 分公司负责人 和 员工 必须传入 organizationId
- Service 层负责从 session 中提取 organizationId 并传给 Repository

---

## AI Gateway

统一的 AI 调用网关，基于 Vercel AI SDK 封装，从数据库读取模型配置。

```typescript
// src/server/services/ai-gateway.service.ts
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { aiProviderRepository } from "@/server/repositories/ai-provider.repository";
import { promptTemplateRepository } from "@/server/repositories/prompt-template.repository";

type AiStep = "TRANSCRIBE" | "ANALYZE" | "REWRITE";

class AiGatewayService {
  /** 获取指定步骤的 Provider 实例 */
  private async getProvider(step: AiStep) {
    const config = await aiProviderRepository.findActiveByStep(step);
    if (!config) throw new AppError("AI_NOT_CONFIGURED", `${step} 步骤未配置 AI 模型`);
    return createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  /** 同步生成 (适合转录等短任务) */
  async generate(step: AiStep, variables: Record<string, string>): Promise<string> {
    const provider = await this.getProvider(step);
    const template = await promptTemplateRepository.findByStep(step);
    const prompt = this.interpolate(template.content, variables);
    const { text } = await generateText({
      model: provider(template.modelId),
      prompt,
    });
    return text;
  }

  /** 流式生成 (适合拆解/仿写等长任务) */
  async stream(step: AiStep, variables: Record<string, string>) {
    const provider = await this.getProvider(step);
    const template = await promptTemplateRepository.findByStep(step);
    const prompt = this.interpolate(template.content, variables);
    return streamText({
      model: provider(template.modelId),
      prompt,
    });
  }

  private interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
  }
}

export const aiGateway = new AiGatewayService();
```

---

## BullMQ 任务队列

处理 AI 任务（转录/拆解/仿写）和爬虫任务（同步/采集）。

### 目录结构与文件职责

```
src/lib/
  redis.ts                  # ioredis 连接工厂（BullMQ 专用 + Pub/Sub 专用）
  bullmq.ts                 # 队列工厂函数 + Job 数据类型（每个 domain 在此注册队列）
  transcription-worker.ts   # 转录任务 Worker 初始化（initialized 防重入）
  # {domain}-worker.ts      # 后续 domain Worker 同此模式
instrumentation.ts          # Node.js 运行时启动时注册 Scheduler + 所有 Worker
```

### Redis 客户端（src/lib/redis.ts）

```typescript
import IORedis from "ioredis";
import { env } from "@/lib/env";

// BullMQ 专用连接（不用于 Pub/Sub）
export function createBullMQRedisConnection(): IORedis {
  return new IORedis(env.REDIS_URL!, { maxRetriesPerRequest: null });
}

// Pub/Sub 专用连接（每个 Worker 和 SSE 端点独立创建）
export function createPubSubRedisClient(): IORedis {
  return new IORedis(env.REDIS_URL!);
}
```

> **注意**：BullMQ 要求 `maxRetriesPerRequest: null`，Pub/Sub 客户端不能复用 BullMQ 连接。

### 队列工厂（src/lib/bullmq.ts）

每个任务域在此文件注册队列名称、Job 数据类型和工厂函数：

```typescript
import { Queue } from "bullmq";
import { createBullMQRedisConnection } from "@/lib/redis";

export const TRANSCRIPTION_QUEUE_NAME = "transcription";

let transcriptionQueue: Queue | null = null;

export function getTranscriptionQueue(): Queue {
  if (!transcriptionQueue) {
    transcriptionQueue = new Queue(TRANSCRIPTION_QUEUE_NAME, {
      connection: createBullMQRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: false,
      },
    });
  }
  return transcriptionQueue;
}
```

### Worker 初始化规范（src/lib/{domain}-worker.ts）

```typescript
import { Worker } from "bullmq";
import { createBullMQRedisConnection } from "@/lib/redis";
import { QUEUE_NAME } from "@/lib/bullmq";

let initialized = false; // ← 必须，防止 Next.js 热重载重复初始化

export function startXxxWorker(): void {
  if (initialized) return;
  if (!env.REDIS_URL) {
    console.warn("[XxxWorker] REDIS_URL not set, worker skipped.");
    return;
  }
  initialized = true;

  const worker = new Worker(QUEUE_NAME, async (job) => {
    // 1. 更新状态 → PROCESSING，Pub/Sub 推送
    // 2. 调用 AiGateway 或 CrawlerService
    // 3. 成功 → 更新状态 → COMPLETED，Pub/Sub 推送
  }, { connection: createBullMQRedisConnection(), concurrency: 2 });

  // 重试耗尽后的终态处理
  worker.on("failed", async (job, error) => {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 3)) return;
    // 更新状态 → FAILED，Pub/Sub 推送
  });

  console.log(`[XxxWorker] Worker started.`);
}
```

### 在 instrumentation.ts 中注册

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "test") {
    const { startScheduler } = await import("./src/lib/scheduler");
    const { startXxxWorker } = await import("./src/lib/xxx-worker");
    startScheduler();
    startXxxWorker();
  }
}
```

> **约束**：所有 Worker 必须在 `instrumentation.ts` 的 `nodejs` 分支内注册，不能在 Route Handler 或 Service 中延迟初始化。

### 任务状态机

```
PENDING → PROCESSING → COMPLETED
                     ↓ (失败，BullMQ 自动重试)
                     FAILED（重试耗尽）
```

### SSE 推送（通过 Redis Pub/Sub 桥接）

Worker 在状态变更时 **发布** 到 `{domain}:{id}` 频道；SSE 端点为每个连接创建独立 Subscriber **订阅**该频道。

```typescript
// Worker 内（发布方）
const publisher = createPubSubRedisClient();
await publisher.publish(
  `transcription:${transcriptionId}`,
  JSON.stringify({ event: "done", data: { transcriptionId, status: "COMPLETED", originalText } }),
);

// SSE 端点（订阅方）
const subscriber = createPubSubRedisClient();
await subscriber.subscribe(`transcription:${id}`);
subscriber.on("message", (_channel, message) => {
  const parsed = JSON.parse(message);
  controller.enqueue(encoder.encode(`event: ${parsed.event}\ndata: ${JSON.stringify(parsed.data)}\n\n`));
});
// 连接关闭时：clearInterval(heartbeat); subscriber.quit();
```

SSE 端点模板（完整规范见 `api-conventions.md`）：

```typescript
// src/app/api/{resource}/[id]/sse/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const session = await auth();
  // 鉴权 + organizationId 验证

  // 连接建立时先查一次终态，避免 race condition
  const record = await someService.getById(id, session.user);
  if (record.status === "COMPLETED" || record.status === "FAILED") {
    // 直接返回结果并结束
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const subscriber = createPubSubRedisClient();
      void subscriber.subscribe(`{domain}:${id}`);

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 30_000);

      subscriber.on("message", (_ch, msg) => {
        const parsed = JSON.parse(msg) as { event: string; data: unknown };
        controller.enqueue(
          encoder.encode(`event: ${parsed.event}\ndata: ${JSON.stringify(parsed.data)}\n\n`),
        );
        if (parsed.event === "done" || parsed.event === "error") {
          clearInterval(heartbeat);
          void subscriber.quit();
          controller.close();
        }
      });

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        void subscriber.quit();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

---

## Crawler Service

统一封装外部爬虫 REST API 调用。

```typescript
// src/server/services/crawler.service.ts
import { AppError } from "@/lib/errors";

interface CrawlerResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class CrawlerService {
  private baseUrl = process.env.CRAWLER_API_URL!;
  private maxRetries = 3;
  private timeout = 30_000; // 30s

  async fetchAccountInfo(profileUrl: string) {
    return this.request<AccountInfo>("/account/info", { profileUrl });
  }

  async fetchVideoList(accountId: string) {
    return this.request<VideoInfo[]>("/account/videos", { accountId });
  }

  async fetchFavorites(accountId: string) {
    return this.request<VideoInfo[]>("/account/favorites", { accountId });
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeout),
        });
        const json: CrawlerResponse<T> = await response.json();
        if (!json.success) throw new AppError("CRAWLER_ERROR", json.error ?? "爬虫请求失败");
        return json.data!;
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries) await this.delay(attempt * 1000);
      }
    }
    throw new AppError("CRAWLER_FAILED", `爬虫请求失败(${this.maxRetries}次重试): ${lastError?.message}`, 502);
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const crawlerService = new CrawlerService();
```

---

## 定时任务模式

定时任务通过 `node-cron` 实现，调度器在 Next.js 服务启动时由 `instrumentation.ts` 自动激活。

### 启动入口

`instrumentation.ts`（项目根目录，与 `src/` 同级）是 Next.js 15 原生支持的服务端初始化钩子，无需额外配置：

```typescript
// instrumentation.ts
export async function register() {
  // 仅在 Node.js 运行时执行（避免 Edge Runtime / 测试环境）
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "test") {
    const { startScheduler } = await import("./src/lib/scheduler");
    startScheduler();
  }
}
```

### 调度器文件

调度器统一定义在 `src/lib/scheduler.ts`，使用模块级 `initialized` 标志防止 Next.js 热重载时重复注册：

```typescript
// src/lib/scheduler.ts
import cron from "node-cron";
import { env } from "@/lib/env";
import { syncService } from "@/server/services/sync.service";

let initialized = false;

export function startScheduler(): void {
  if (initialized) return;
  initialized = true;

  // 账号基础信息同步（默认每 6 小时，可通过环境变量覆盖）
  const accountSyncCron = env.ACCOUNT_SYNC_CRON ?? "0 */6 * * *";
  let accountSyncRunning = false;
  cron.schedule(accountSyncCron, () => {
    if (accountSyncRunning) return;
    accountSyncRunning = true;
    void syncService.runAccountInfoBatchSync().finally(() => {
      accountSyncRunning = false;
    });
  });

  // 视频增量同步（默认每 1 小时，可通过环境变量覆盖）
  const videoSyncCron = env.VIDEO_SYNC_CRON ?? "0 * * * *";
  let videoSyncRunning = false;
  cron.schedule(videoSyncCron, () => {
    if (videoSyncRunning) return;
    videoSyncRunning = true;
    void syncService.runVideoBatchSync().finally(() => {
      videoSyncRunning = false;
    });
  });
}
```

### 规则

1. **启动入口唯一**: 所有 cron 注册必须通过 `startScheduler()` 集中管理，不可在其他位置散落注册
2. **防重复注册**: `initialized` 标志确保 `startScheduler()` 幂等，热重载不会叠加注册
3. **调用 Service 批量方法**: cron 任务只调用 Service 层的批量方法（如 `runXxxBatchSync()`），不直接操作 Repository 或 Prisma
4. **容错继续**: 批量方法内部逐条处理，单条失败记录日志后跳过，不中断整个批次
5. **环境变量覆盖**: cron 表达式优先从 `env.*_CRON` 读取，提供默认值作为兜底

### 防重入规范

**防重入规范**：每个定时任务若执行时间可能超过触发间隔，必须在 `startScheduler()` 内为该任务声明独立的 `let xRunning = false` flag。当前项目中的账号同步、视频同步、视频快照采集、收藏同步都应各自持有独立 flag。任务开始前检查 flag，若为 true 则跳过本次执行；任务结束时（包括异常）在 `finally` 块中将 flag 重置为 false。

```typescript
let accountSyncRunning = false;
cron.schedule(accountSyncCron, async () => {
  if (accountSyncRunning) return;
  accountSyncRunning = true;
  try {
    await syncService.runAccountInfoBatchSync();
  } finally {
    accountSyncRunning = false;
  }
});
```
