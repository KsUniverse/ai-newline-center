# v0.3.0 技术设计方案

> 版本: v0.3.0  
> 功能: F-003-1 视频转录（AI 转文字）  
> 创建日期: 2026-04-04

---

## 摘要

| 项目 | 内容 |
|------|------|
| 涉及模块 | M-003（AI 拆解）— 新模块 |
| 新增模型 | `Transcription`（1 个） |
| 新增枚举 | `TranscriptionStatus` |
| 新增 API | 4 个端点（`/api/transcriptions*`） |
| 新增页面/组件 | 0 个新页面，3 个新业务组件，1 个已有页面扩展 |
| 新增依赖 | `bullmq`、`ioredis`、`ai`、`@ai-sdk/openai` |
| 架构变更 | **[ARCH-CHANGE]** — 引入 BullMQ Worker 初始化模式 + SSE 端点模式（首次落库） |

---

## 新增依赖

```json
{
  "bullmq": "^5.x",
  "ioredis": "^5.x",
  "ai": "^4.x",
  "@ai-sdk/openai": "^1.x"
}
```

> **说明**：
> - `bullmq` — 任务队列，使用 Redis 作后端。
> - `ioredis` — BullMQ 依赖的 Redis 客户端，同时用于 Pub/Sub SSE 通道。
> - `ai` — Vercel AI SDK 统一网关（架构中已指定，本版本首次安装）。
> - `@ai-sdk/openai` — OpenAI 语音识别 Provider（`ai` 的 Provider 插件）。

---

## 数据模型变更

### 新增枚举：`TranscriptionStatus`

```prisma
enum TranscriptionStatus {
  PENDING      // 已入队，等待 Worker
  PROCESSING   // Worker 正在处理
  COMPLETED    // 转录成功
  FAILED       // 转录失败（重试耗尽）
}
```

### 新增模型：`Transcription`

```prisma
model Transcription {
  id           String              @id @default(cuid())
  videoId      String              @unique
  video        BenchmarkVideo      @relation(fields: [videoId], references: [id])
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

### `BenchmarkVideo` 模型变更（添加反向关系）

```prisma
model BenchmarkVideo {
  // ...（原有字段不变）
  transcription Transcription?   // ← 新增反向关系字段
}
```

### 设计说明

| 决策 | 理由 |
|------|------|
| `videoId @unique` | 单视频只允许一条转录记录；重新转录时更新同一条记录，不新增 |
| 无独立 `organizationId` | 权限隔离通过 `BenchmarkVideo → BenchmarkAccount.organizationId` 传递，与对标视频链路保持一致 |
| `originalText` + `editedText` 双字段 | 保证 AI 原始结果不被人工校对覆盖，"恢复 AI 原文"通过清空 `editedText` 实现 |
| `aiModel` 持久化 | 记录生成时使用的模型，便于后续审计 |

---

## API 契约

### 通用规则

- 所有接口需 `auth()` session
- 权限隔离：通过 `BenchmarkVideo.account.organizationId` 验证调用方 `organizationId`
- 响应格式：`{ success: boolean, data?: T, error?: { code, message } }`

---

### POST /api/transcriptions

**功能**: 提交转录任务（如已有记录则重置并重新入队）

```typescript
// 请求体 Zod schema
const createTranscriptionSchema = z.object({
  videoId: z.string().cuid(),
});

// 成功响应: 201 + TranscriptionDTO
// 业务错误码:
//   VIDEO_NOT_FOUND (404)        — 视频不存在或不属于当前 organizationId
//   VIDEO_NOT_DOWNLOADED (400)   — videoStoragePath 为 null，视频尚未下载
//   TRANSCRIPTION_IN_PROGRESS (409) — 已存在 PENDING 或 PROCESSING 状态记录
```

**Service 层逻辑**（顺序执行）：
1. 通过 `videoId` 查询 `BenchmarkVideo`（含 `account`），验证 `account.organizationId === caller.organizationId`
2. 检查 `video.videoStoragePath !== null`，否则抛 `VIDEO_NOT_DOWNLOADED`
3. 查询已有 `Transcription`：若存在且 `status` 为 `PENDING` 或 `PROCESSING`，抛 `TRANSCRIPTION_IN_PROGRESS`
4. Upsert `Transcription`（status=PENDING，清空 `originalText/editedText/errorMessage`，写入 `aiModel=env.TRANSCRIPTION_AI_MODEL`）
5. 将 BullMQ Job 入队（payload 见"BullMQ 设计"节）
6. 返回 `TranscriptionDTO`

---

### GET /api/transcriptions

**功能**: 按 `videoId` 查询当前视频的转录记录（供视频详情面板初始化使用）

```typescript
// Query Params Zod schema
const getTranscriptionByVideoSchema = z.object({
  videoId: z.string().cuid(),
});

// 成功响应: 200 + TranscriptionDTO
// 错误:
//   NOT_FOUND (404) — 该视频尚无转录记录
//   VIDEO_NOT_FOUND (404) — 视频不存在或越权
```

---

### GET /api/transcriptions/[id]

**功能**: 按 `transcriptionId` 查询转录记录（用于 SSE 断线重连后恢复状态）

```typescript
// 无请求体/Query Params
// 成功响应: 200 + TranscriptionDTO
// 错误:
//   NOT_FOUND (404) — 记录不存在或越权
```

---

### PATCH /api/transcriptions/[id]

**功能**: 人工编辑转录文案

```typescript
// 请求体 Zod schema
const updateTranscriptionSchema = z.object({
  editedText: z.string().nullable(),
});
// editedText = null → 恢复 AI 原文（清空人工编辑）

// 成功响应: 200 + TranscriptionDTO
// 错误:
//   NOT_FOUND (404)                 — 记录不存在或越权
//   TRANSCRIPTION_NOT_COMPLETED (400) — 只有 COMPLETED 状态才允许人工编辑
```

---

### GET /api/transcriptions/[id]/sse

**功能**: SSE 长连接，推送转录状态变更

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**SSE 事件规范**（遵循 api-conventions.md [ARCH-CHANGE]）：

| 事件名 | data 格式 | 说明 |
|--------|-----------|------|
| `status` | `{ transcriptionId: string, status: "PROCESSING" }` | Worker 开始处理 |
| `done` | `{ transcriptionId: string, status: "COMPLETED", originalText: string }` | 转录成功 |
| `error` | `{ transcriptionId: string, status: "FAILED", errorMessage: string \| null }` | 转录失败 |

**实现方式**：Worker → Redis Pub/Sub channel `transcription:{id}` → SSE 端点订阅 → 推送到客户端。  
连接建立时先查询一次当前 DB 状态（防止连接建立前任务已完成），若已终态（`COMPLETED`/`FAILED`）则立即推送 `done`/`error` 并关闭连接。

**超时**：连接 30 秒无事件推送心跳（`: keepalive\n\n`），防止代理断线。  
**鉴权**：与其他接口相同，`auth()` 验证 session + organizationId。

---

## 共享类型定义

新增文件：`src/types/transcription.ts`

```typescript
export type TranscriptionStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface TranscriptionDTO {
  id: string;
  videoId: string;
  status: TranscriptionStatus;
  aiModel: string;
  originalText: string | null;
  editedText: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

// SSE 事件 payload 类型（前端 EventSource 解析用）
export type TranscriptionSSEEvent =
  | { event: "status"; data: { transcriptionId: string; status: "PROCESSING" } }
  | { event: "done"; data: { transcriptionId: string; status: "COMPLETED"; originalText: string } }
  | { event: "error"; data: { transcriptionId: string; status: "FAILED"; errorMessage: string | null } };
```

---

## BullMQ 队列 / Job 设计

### 队列配置

| 项目 | 值 |
|------|----|
| 队列名 | `transcription` |
| Redis 连接 | `env.REDIS_URL` |
| Job 并发 | 2（可通过配置扩展） |

### Job 数据结构

```typescript
interface TranscriptionJobData {
  transcriptionId: string;
  videoStoragePath: string; // 本地视频文件路径（绝对路径）
  aiModel: string;          // 模型标识，如 "openai/whisper-1"
  organizationId: string;   // 用于日志追踪
}
```

### Job 配置

```typescript
{
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 }, // 第 1 次: 5s, 第 2 次: 10s
  removeOnComplete: { age: 86400 }, // 完成后保留 24h 记录
  removeOnFail: false,              // 失败记录不自动删除，便于排查
}
```

### Worker 处理流程

```
[Job 出队]
  ↓
更新 Transcription.status = PROCESSING
  ↓  
Redis Pub/Sub 发布: { event: "status", status: "PROCESSING" }
  ↓
调用 aiGatewayService.transcribe(videoStoragePath, aiModel)
  ├── 成功
  │     ↓
  │   更新 Transcription: { status: COMPLETED, originalText: result }
  │     ↓
  │   Redis Pub/Sub 发布: { event: "done", status: "COMPLETED", originalText }
  ↓
  └── 失败（抛出异常）
        ↓ (BullMQ 自动重试，最多 3 次)
        ↓ (重试耗尽后 BullMQ 触发 failed 事件)
        ↓
      更新 Transcription: { status: FAILED, errorMessage }
        ↓
      Redis Pub/Sub 发布: { event: "error", status: "FAILED", errorMessage }
```

### Worker 初始化

文件：`src/lib/transcription-worker.ts`

```typescript
// 遵循 src/lib/scheduler.ts 的 initialized 防重入模式
export function startTranscriptionWorker(): void {
  if (initialized) return;
  if (!env.REDIS_URL) {
    console.warn("[TranscriptionWorker] REDIS_URL not set, worker skipped.");
    return;
  }
  initialized = true;
  // 初始化 BullMQ Worker 实例
}
```

在 `instrumentation.ts` 中注册（`process.env.NEXT_RUNTIME === 'nodejs'` 分支内）：

```typescript
// instrumentation.ts (新增一行)
if (process.env.NEXT_RUNTIME === "nodejs") {
  startScheduler();
  startTranscriptionWorker(); // ← 新增
}
```

### Redis Pub/Sub 设计

- **发布频道**: `transcription:{transcriptionId}`
- 每条消息为 JSON 字符串，反序列化后遵循 `TranscriptionSSEEvent` 类型
- Worker 使用独立的 `ioredis` 客户端 Publisher；SSE 端点为每个连接创建独立 Subscriber 实例，连接关闭时 `.quit()`

---

## AiGateway Service

文件：`src/server/services/ai-gateway.service.ts`（新建）

```typescript
class AiGateway {
  /**
   * 将本地视频文件转录为文字
   * @param videoStoragePath 视频文件绝对路径（由爬虫 v0.2.1.1 写入）
   * @param model 模型标识，如 "openai/whisper-1"
   * @returns 转录文本字符串（为空时返回空字符串，不抛出）
   */
  async transcribe(videoStoragePath: string, model: string): Promise<string>;
}

export const aiGateway = new AiGateway();
```

**实现说明**：
- 读取本地文件 → 调用 Vercel AI SDK `experimental_transcribe()` 或 OpenAI Files API
- 模型 ID 格式为 `openai/whisper-1`（`{provider}/{modelId}`）
- AI 返回空文本时不视为失败，返回 `""`
- 调用超时 120s（视频转录时间与文件大小相关）

---

## 环境变量新增

在 `src/lib/env.ts` 的 `envSchema` 中新增：

```typescript
TRANSCRIPTION_AI_MODEL: z.string().default("openai/whisper-1"),
OPENAI_API_KEY: z.string().optional(),
```

> `OPENAI_API_KEY` 为 optional（测试环境可缺省），但生产环境若 `TRANSCRIPTION_AI_MODEL` 使用 OpenAI 模型则必须配置。

---

## 前端组件设计

### 入口：`BenchmarkVideoList` 中点击视频卡片

目前 `BenchmarkVideoGridCard` 的 `onClick` 传入空函数，本版本起：
- `BenchmarkVideoList` 新增 `onVideoClick?: (video: DouyinVideoDTO) => void` prop
- 点击触发 `BenchmarkVideoDetailPanel` Slide Panel 弹出

### 新增组件树

```
benchmark-detail-page.tsx（已有，扩展状态管理）
  └── BenchmarkVideoDetailPanel（新增 Slide Panel）
        ├── 视频元信息区（标题、封面/播放器、发布时间、数据指标）
        └── VideoTranscriptionPanel（新增）
              ├── 无转录记录状态  → [AI 转录] 按钮
              ├── PENDING 状态   → Loading indicator
              ├── PROCESSING 状态 → Loading indicator + SSE 订阅
              ├── COMPLETED 状态 → 文案展示 + 编辑区
              │     └── VideoTranscriptionEditor（新增，内联编辑）
              └── FAILED 状态    → 错误提示 + [重试] 按钮
```

### 新增文件

| 文件路径 | 说明 |
|----------|------|
| `src/types/transcription.ts` | 共享 DTO 类型 |
| `src/components/features/benchmarks/benchmark-video-detail-panel.tsx` | 视频详情 Slide Panel |
| `src/components/features/benchmarks/video-transcription-panel.tsx` | 转录状态展示与操作 |
| `src/components/features/benchmarks/video-transcription-editor.tsx` | 内联文案编辑组件 |

### 修改文件

| 文件路径 | 变更说明 |
|----------|----------|
| `src/components/features/benchmarks/benchmark-video-list.tsx` | 新增 `onVideoClick` prop，传递给 `BenchmarkVideoGridCard` |
| `src/components/features/benchmarks/benchmark-detail-page.tsx` | 新增 `selectedVideo` 状态，挂载 `BenchmarkVideoDetailPanel` |
| `src/components/features/benchmarks/index.ts` | barrel export 新增三个组件 |

---

## 跨模块依赖

| 类型 | 内容 |
|------|------|
| 前后端共享类型 | `src/types/transcription.ts`（两端均 import） |
| 后端 → Prisma | `Transcription` 模型 + `BenchmarkVideo.transcription` 关系 |
| Worker → AiGateway | `aiGateway.transcribe(path, model)` |
| Worker → Redis | Pub/Sub client（`src/lib/redis.ts`） |
| SSE endpoint → Redis | Pub/Sub subscriber client |

---

## 建议开发顺序

```
BE-001  Prisma schema 变更（Transcription 模型）
BE-002  环境变量（env.ts）新增
BE-003  Redis 客户端（lib/redis.ts）
BE-004  BullMQ 工厂（lib/bullmq.ts）
BE-005  Transcription Repository
BE-006  AiGateway Service（transcribe 方法）
BE-007  Transcription Service
BE-008  POST /api/transcriptions + GET /api/transcriptions
BE-009  GET + PATCH /api/transcriptions/[id]
BE-010  GET /api/transcriptions/[id]/sse（SSE 端点）
BE-011  TranscriptionWorker 初始化（lib/transcription-worker.ts）
BE-012  instrumentation.ts 注册 Worker

FE-001  src/types/transcription.ts 共享类型
FE-002  VideoTranscriptionEditor 内联编辑组件
FE-003  VideoTranscriptionPanel 转录状态面板（含 SSE 订阅）
FE-004  BenchmarkVideoDetailPanel Slide Panel
FE-005  BenchmarkVideoList 新增 onVideoClick prop
FE-006  BenchmarkDetailPageView 集成 BenchmarkVideoDetailPanel
FE-007  index.ts barrel export
```

---

## 架构变更记录 [ARCH-CHANGE]

### 1. BullMQ Worker 初始化模式（首次落库）

**模式**：Worker 在 `instrumentation.ts` 的 `nodejs` 运行时分支中初始化，遵循 `scheduler.ts` 的 `initialized` 防重入 flag 模式。每类任务对应独立的 Worker 模块文件（`src/lib/{domain}-worker.ts`）。

**规范更新位置**：`docs/architecture/backend.md` 新增"BullMQ 任务队列"节。

### 2. SSE 端点模式（首次落库）

**模式**：`GET /api/{resource}/[id]/sse`，通过 Redis Pub/Sub 桥接 Worker 和前端，使用 Web Streams API `ReadableStream` + `text/event-stream` 响应。心跳保活机制防代理断线。

**规范更新位置**：`docs/architecture/api-conventions.md` 更新"SSE 规范"节，补充 Redis Pub/Sub 桥接模式文档。

### 3. AiGateway Service（骨架首次落库）

`src/server/services/ai-gateway.service.ts` 为 v0.3.0 起的 AI 能力统一入口，后续所有 AI 功能（划句批注、仿写等）均通过此 Service 调用，禁止在 Worker 或 Route Handler 中直接调用 SDK。
