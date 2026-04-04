# v0.3.0 后端任务清单

> 版本: v0.3.0  
> 创建日期: 2026-04-04  
> 任务总数: 12

---

## 必读文档

> 开始开发前必须阅读以下文档：

- `docs/product/versions/v0.3.0/requirements.md` — 本版本需求（理解业务背景）
- `docs/product/versions/v0.3.0/technical-design.md` — 本版本技术设计（字段/API/Worker 完整规范）
- `docs/architecture/backend.md` — 后端分层规范（Route Handler → Service → Repository）
- `docs/architecture/database.md` — 数据库设计规范（字段命名、隔离规则）
- `docs/architecture/api-conventions.md` — API 设计规范（响应格式、错误码、SSE 规范）
- `docs/standards/coding-standards.md` — 编码规范（禁止 any，显式返回类型）

---

## 摘要

| 项目 | 内容 |
|------|------|
| 任务总数 | 12 |
| 新增依赖 | `bullmq`、`ioredis`、`ai`、`@ai-sdk/openai` |
| 涉及文件 | 见下方各任务 |

---

## 任务列表

---

### BE-001 (P0) 安装新依赖 + Prisma Schema 变更

**文件**: `package.json`、`prisma/schema.prisma`

**依赖安装**（在终端执行）：
```bash
pnpm add bullmq ioredis ai @ai-sdk/openai
```

**Prisma schema 变更**（追加在 `VideoSnapshot` 模型之后）：

1. 新增枚举 `TranscriptionStatus`：
```prisma
enum TranscriptionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

2. 新增模型 `Transcription`：
```prisma
model Transcription {
  id           String              @id @default(cuid())
  videoId      String              @unique
  video        DouyinVideo         @relation(fields: [videoId], references: [id])
  status       TranscriptionStatus @default(PENDING)
  aiModel      String
  originalText String?
  editedText   String?
  errorMessage String?
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt

  @@map("transcriptions")
}
```

3. 在 `DouyinVideo` 模型中新增反向关系字段（追加在 `snapshots` 字段之后）：
```prisma
  transcription Transcription?
```

**执行迁移**：
```bash
pnpm db:migrate
```
迁移名称建议：`add_transcription_model`

---

### BE-002 (P0) 环境变量新增

**文件**: `src/lib/env.ts`

在 `envSchema` 的 `z.object({...})` 中新增两个字段：

```typescript
TRANSCRIPTION_AI_MODEL: z.string().default("openai/whisper-1"),
OPENAI_API_KEY: z.string().optional(),
```

放置位置：`COLLECTION_SYNC_CRON` 字段之后，`SEED_ADMIN_ACCOUNT` 字段之前。

---

### BE-003 (P0) Redis 客户端

**文件**: `src/lib/redis.ts`（新建）

创建 ioredis 客户端单例，用于 BullMQ 连接和 Pub/Sub 通道。

```typescript
import IORedis from "ioredis";
import { env } from "@/lib/env";

// BullMQ 专用连接（不用于 pub/sub）
export function createBullMQRedisConnection(): IORedis {
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is not configured");
  }
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // BullMQ 要求
  });
}

// Pub/Sub 专用连接（每次调用新建，SSE 端点和 Worker 分别创建）
export function createPubSubRedisClient(): IORedis {
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is not configured");
  }
  return new IORedis(env.REDIS_URL);
}

export const TRANSCRIPTION_CHANNEL_PREFIX = "transcription:";
```

---

### BE-004 (P0) BullMQ 工厂

**文件**: `src/lib/bullmq.ts`（新建）

封装队列创建逻辑，供 Service 层入队、Worker 层消费使用。

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

**类型定义**（在同文件内）：
```typescript
export interface TranscriptionJobData {
  transcriptionId: string;
  videoStoragePath: string;
  aiModel: string;
  organizationId: string;
}
```

---

### BE-005 (P0) Transcription Repository

**文件**: `src/server/repositories/transcription.repository.ts`（新建）

职责：Prisma CRUD，无业务逻辑。

需实现的方法（均标注显式返回类型）：

```typescript
class TranscriptionRepository {
  // 按 videoId 查询（含 video.account 以获取 organizationId）
  async findByVideoId(videoId: string): Promise<TranscriptionWithOrg | null>;

  // 按 transcriptionId 查询（含 video.account）
  async findById(id: string): Promise<TranscriptionWithOrg | null>;

  // 创建新记录
  async create(data: CreateTranscriptionData): Promise<Transcription>;

  // 更新状态（用于 PENDING → PROCESSING → COMPLETED/FAILED）
  async updateStatus(
    id: string,
    data: UpdateTranscriptionStatusData,
  ): Promise<Transcription>;

  // 更新 editedText（人工编辑，含 null 以支持"恢复 AI 原文"）
  async updateEditedText(id: string, editedText: string | null): Promise<Transcription>;

  // 重置（重新转录时用）：清空 originalText/editedText/errorMessage，置 PENDING
  async reset(id: string, aiModel: string): Promise<Transcription>;
}

export const transcriptionRepository = new TranscriptionRepository();
```

**辅助类型**（在同文件顶部定义）：
```typescript
type TranscriptionWithOrg = Prisma.TranscriptionGetPayload<{
  include: { video: { include: { account: true } } };
}>;

interface CreateTranscriptionData {
  videoId: string;
  aiModel: string;
}

interface UpdateTranscriptionStatusData {
  status: TranscriptionStatus;
  originalText?: string;
  errorMessage?: string;
}
```

---

### BE-006 (P0) AiGateway Service

**文件**: `src/server/services/ai-gateway.service.ts`（新建）

统一 AI 调用入口，v0.3.0 只需实现 `transcribe` 方法。

```typescript
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@/lib/env";

class AiGateway {
  /**
   * 将本地视频文件转录为文字
   * @param videoStoragePath 视频文件绝对路径
   * @param model 模型标识，格式为 "{provider}/{modelId}"，如 "openai/whisper-1"
   * @returns 转录文本字符串（空音频返回 ""，不抛出）
   */
  async transcribe(videoStoragePath: string, model: string): Promise<string>;
}

export const aiGateway = new AiGateway();
```

**实现要点**：
- 使用 Node.js `fs.readFileSync` 或 `fs.createReadStream` 读取 `videoStoragePath`
- 模型 ID 解析：`provider/modelId` 格式，目前只支持 `openai` provider
- 调用 `@ai-sdk/openai` 的 `openai.transcription(modelId)` 方法（或等效 API）
- AI 返回空字符串时视为正常，不抛出异常
- 文件不存在时抛 `AppError("VIDEO_FILE_NOT_FOUND", "视频文件不存在", 500)`
- AI 调用超时或错误时直接重新抛出，由 BullMQ Worker 重试机制处理

---

### BE-007 (P0) Transcription Service

**文件**: `src/server/services/transcription.service.ts`（新建）

```typescript
class TranscriptionService {
  // 提交转录任务（含入队逻辑）
  async createTranscription(
    videoId: string,
    caller: SessionUser, // { id, organizationId, role }
  ): Promise<TranscriptionDTO>;

  // 按 videoId 查询（供 GET /api/transcriptions?videoId=xxx）
  async getByVideoId(
    videoId: string,
    caller: SessionUser,
  ): Promise<TranscriptionDTO>;

  // 按 transcriptionId 查询
  async getById(
    transcriptionId: string,
    caller: SessionUser,
  ): Promise<TranscriptionDTO>;

  // 人工编辑
  async updateEditedText(
    transcriptionId: string,
    editedText: string | null,
    caller: SessionUser,
  ): Promise<TranscriptionDTO>;
}

export const transcriptionService = new TranscriptionService();
```

**`createTranscription` 逻辑**（严格按顺序）：
1. 查询 `DouyinVideo`（`include: { account: true }`），`organizationId` 验证
2. 检查 `video.videoStoragePath !== null`
3. 查询已有 `Transcription`：`PENDING`/`PROCESSING` → 抛 `TRANSCRIPTION_IN_PROGRESS`
4. Upsert：`transcriptionRepository.reset()` 或 `transcriptionRepository.create()`
5. `getTranscriptionQueue().add(TRANSCRIPTION_QUEUE_NAME, jobData)`
6. 返回 `toTranscriptionDTO(record)`

**`updateEditedText` 权限约束**：
- 查询记录，验证 `organizationId`
- `status !== COMPLETED` → 抛 `TRANSCRIPTION_NOT_COMPLETED`
- 调用 `transcriptionRepository.updateEditedText()`

**`toTranscriptionDTO` 私有映射**（Date → ISO string）。

---

### BE-008 (P0) API 路由 — POST + GET /api/transcriptions

**文件**: `src/app/api/transcriptions/route.ts`（新建）

```typescript
// POST handler
const createTranscriptionSchema = z.object({
  videoId: z.string().cuid(),
});

export async function POST(request: NextRequest): Promise<NextResponse>;

// GET handler（?videoId=xxx）
const getTranscriptionByVideoSchema = z.object({
  videoId: z.string().cuid(),
});

export async function GET(request: NextRequest): Promise<NextResponse>;
```

- 两个 handler 均以 `auth()` 开头，`requireRole(session, EMPLOYEE, BRANCH_MANAGER, SUPER_ADMIN)`
- `POST` 成功响应 `201`
- `GET` 无记录时 `handleApiError` 返回 404

---

### BE-009 (P0) API 路由 — GET + PATCH /api/transcriptions/[id]

**文件**: `src/app/api/transcriptions/[id]/route.ts`（新建）

```typescript
// GET handler
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse>;

// PATCH handler
const updateTranscriptionSchema = z.object({
  editedText: z.string().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse>;
```

- `params` 使用 `await params` 解包（Next.js 15 App Router 约定）
- 均以 `auth()` 鉴权

---

### BE-010 (P0) SSE 端点 — GET /api/transcriptions/[id]/sse

**文件**: `src/app/api/transcriptions/[id]/sse/route.ts`（新建）

**实现要点**：

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // 1. auth() 鉴权 + organizationId 验证
  // 2. 检查当前 DB 状态：若已是 COMPLETED/FAILED，直接推送结果并返回
  // 3. 创建 ReadableStream，在 start(controller) 中：
  //    a. 创建 ioredis subscriber (createPubSubRedisClient())
  //    b. subscriber.subscribe(`${TRANSCRIPTION_CHANNEL_PREFIX}${id}`)
  //    c. subscriber.on("message", (channel, message) => {
  //         解析 JSON, 发送 SSE 事件, 若 done/error 则 controller.close() + subscriber.quit()
  //    })
  //    d. 心跳定时器：每 30s 发送 ": keepalive\n\n"
  //    e. request.signal.addEventListener("abort", () => { 
  //         clearInterval(heartbeat); subscriber.quit(); controller.close(); 
  //    })
  // 4. 返回 new Response(stream, { headers: { "Content-Type": "text/event-stream", ... } })
}
```

**SSE 消息格式**（每次发送）：
```
event: {eventName}\n
data: {JSON.stringify(payload)}\n
\n
```

> ⚠️ **注意**：Next.js App Router 的 Route Handler 在 Vercel 部署时 SSE 有长连接限制，但本项目自托管 VPS（Docker），无此问题。

---

### BE-011 (P0) TranscriptionWorker 初始化

**文件**: `src/lib/transcription-worker.ts`（新建）

核心逻辑：

```typescript
import { Worker } from "bullmq";
import { createBullMQRedisConnection, createPubSubRedisClient, TRANSCRIPTION_CHANNEL_PREFIX } from "@/lib/redis";
import { TRANSCRIPTION_QUEUE_NAME, type TranscriptionJobData } from "@/lib/bullmq";
import { transcriptionRepository } from "@/server/repositories/transcription.repository";
import { aiGateway } from "@/server/services/ai-gateway.service";
import { env } from "@/lib/env";

let initialized = false;

export function startTranscriptionWorker(): void {
  if (initialized) return;
  if (!env.REDIS_URL) {
    console.warn("[TranscriptionWorker] REDIS_URL not set, worker skipped.");
    return;
  }
  initialized = true;

  const publisher = createPubSubRedisClient();

  const worker = new Worker<TranscriptionJobData>(
    TRANSCRIPTION_QUEUE_NAME,
    async (job) => {
      const { transcriptionId, videoStoragePath, aiModel, organizationId } = job.data;

      // 1. 更新状态 → PROCESSING
      await transcriptionRepository.updateStatus(transcriptionId, { status: "PROCESSING" });
      await publisher.publish(
        `${TRANSCRIPTION_CHANNEL_PREFIX}${transcriptionId}`,
        JSON.stringify({ event: "status", data: { transcriptionId, status: "PROCESSING" } }),
      );

      // 2. 调用 AiGateway
      const originalText = await aiGateway.transcribe(videoStoragePath, aiModel);

      // 3. 成功 → COMPLETED
      await transcriptionRepository.updateStatus(transcriptionId, {
        status: "COMPLETED",
        originalText,
      });
      await publisher.publish(
        `${TRANSCRIPTION_CHANNEL_PREFIX}${transcriptionId}`,
        JSON.stringify({ event: "done", data: { transcriptionId, status: "COMPLETED", originalText } }),
      );
    },
    {
      connection: createBullMQRedisConnection(),
      concurrency: 2,
    },
  );

  // 重试耗尽后的 failed 事件处理
  worker.on("failed", async (job, error) => {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 3)) return; // 还有重试机会
    const transcriptionId = (job.data as TranscriptionJobData).transcriptionId;
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    await transcriptionRepository.updateStatus(transcriptionId, {
      status: "FAILED",
      errorMessage,
    });
    await publisher.publish(
      `${TRANSCRIPTION_CHANNEL_PREFIX}${transcriptionId}`,
      JSON.stringify({ event: "error", data: { transcriptionId, status: "FAILED", errorMessage } }),
    );
  });

  console.log("[TranscriptionWorker] Worker started.");
}
```

---

### BE-012 (P0) instrumentation.ts 注册 Worker

**文件**: `instrumentation.ts`（已有，追加一行）

现有文件结构：
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "test") {
    const { startScheduler } = await import("./src/lib/scheduler");
    startScheduler();
  }
}
```

在 `startScheduler()` 之后追加：
```typescript
    const { startTranscriptionWorker } = await import("./src/lib/transcription-worker");
    startTranscriptionWorker();
```

完整结果：
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "test") {
    const { startScheduler } = await import("./src/lib/scheduler");
    const { startTranscriptionWorker } = await import("./src/lib/transcription-worker");
    startScheduler();
    startTranscriptionWorker();
  }
}
```

---

## 错误码速查表

| 错误码 | HTTP | 场景 |
|--------|------|------|
| `VIDEO_NOT_FOUND` | 404 | 视频不存在或不属于当前组织 |
| `VIDEO_NOT_DOWNLOADED` | 400 | `videoStoragePath` 为 null |
| `TRANSCRIPTION_IN_PROGRESS` | 409 | 已有 PENDING/PROCESSING 记录 |
| `TRANSCRIPTION_NOT_COMPLETED` | 400 | 非 COMPLETED 状态下尝试人工编辑 |
| `NOT_FOUND` | 404 | 转录记录不存在或越权 |
| `VIDEO_FILE_NOT_FOUND` | 500 | 本地视频文件路径无效（AiGateway 内部） |

---

## 集成联调报告（Phase 5）

**完成时间**: 2026-04-04

### 检查结果
- type-check: ✅
- lint: ✅

### 发现并修复的问题

无。全链路类型、API 路径、SSE 事件格式均与设计文档一致，无需修复。

**验证项逐一确认**：

1. **类型一致性** — `src/types/transcription.ts` 的 `TranscriptionDTO` 字段与后端 `toTranscriptionDTO()` 映射完全吻合（含 `createdAt`/`updatedAt` ISO 字符串转换）；`TranscriptionSSEEvent` 联合类型与 Worker 发布格式一致。

2. **API 路径一致性**：
   - `POST /api/transcriptions` — 前端 `apiClient.post("/transcriptions", ...)` → `BASE_URL="/api"` 拼接后匹配 ✅
   - `GET /api/transcriptions?videoId={id}` — 前端 `apiClient.get(`/transcriptions?videoId=${videoId}`)` 拼接后匹配 ✅
   - `PATCH /api/transcriptions/[id]` — 前端 `apiClient.patch(`/transcriptions/${id}`, ...)` 拼接后匹配 ✅
   - `GET /api/transcriptions/[id]/sse` — 前端 `new EventSource(`/api/transcriptions/${id}/sse`)` 直接使用完整路径匹配 ✅

3. **SSE 事件格式**：
   - 后端（Worker + SSE 路由）发布 `event: status` / `event: done` / `event: error`
   - 前端 `addEventListener("status" / "done" / "error")` 完全对应 ✅
   - `error` 事件通过 `e instanceof MessageEvent` 区分自定义命名事件与连接错误，处理正确 ✅
   - 已终态（`COMPLETED`/`FAILED`）时 SSE 端点立即推送并关闭，前端无需等待 ✅

4. **无 `[INTEGRATE]` 残留** — 代码库中未发现任何 `TODO: [INTEGRATE]` 注释。

### 未修复问题

无。
