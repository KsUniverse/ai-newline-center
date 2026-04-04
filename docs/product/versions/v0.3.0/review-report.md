# 代码评审报告 — v0.3.0

**评审日期**: 2026-04-04  
**评审范围**: 后端 API + Worker + AI Gateway + 前端组件  
**审查文件数**: 14  
**`pnpm type-check`**: ✅ 零错误  
**`pnpm lint`**: ✅ 零错误

---

## 摘要

- 审查文件数: 14
- 问题总数: 7（🔴 阻塞: 2 / 🟡 建议: 3 / 🟢 提议: 2）
- 结论: 🔴 阻塞问题已就地修复 ✅ → 通过

---

## 问题列表

### 🔴 [B-001] SSE Route Handler 无 try-catch — 鉴权/404 错误返回 500（已修复）

- **文件**: [src/app/api/transcriptions/[id]/sse/route.ts](src/app/api/transcriptions/[id]/sse/route.ts)
- **描述**: `GET` 处理函数的 `requireRole()` 和 `transcriptionService.getById()` 调用均在 try-catch 之外。当请求携带无效或无权限 session 时（AppError 401/403）、或 transcriptionId 不存在/越权（AppError 404/403），异常将以 uncaught 方式冒泡，Next.js 回退返回 500，而非正确的 HTTP 状态码。其次，由于前端 `EventSource` 的 `onerror` 未关闭连接（见 [S-001]），400/500 系响应会触发 EventSource 自动重连，形成无限轮询服务端的资源泄露循环。
- **修复**: 已将整个函数体包裹在 `try/catch` 内，catch 分支调用 `handleApiError(error)`（返回 `NextResponse`，实现了 `Response` 接口，与函数签名兼容）。同时补充了 `handleApiError` 的 import。

**修复后代码片段**：
```typescript
export async function GET(...): Promise<Response> {
  try {
    const session = await auth();
    requireRole(session, ...);
    const { id } = await params;
    const transcription = await transcriptionService.getById(id, session.user);
    // ... SSE 逻辑
  } catch (error) {
    return handleApiError(error); // ← 正确返回 401/403/404
  }
}
```

---

### 🔴 [B-002] Worker `failed` 事件处理器无 try-catch — 状态机可卡死（已修复）

- **文件**: [src/lib/transcription-worker.ts](src/lib/transcription-worker.ts)
- **描述**: `worker.on("failed", async (job, error) => { ... })` 中的 `transcriptionRepository.updateStatus()` 和 `publisher.publish()` 均无错误处理。若 DB 连接中断或 Redis 不可用，这两行调用会抛出异常，形成 UnhandledPromiseRejection，导致：(1) Transcription 记录状态卡在 PROCESSING 而非 FAILED，状态机无法终止；(2) SSE 订阅方永远等不到 `error` 事件推送，前端 loading 状态不结束。
- **修复**: 已将 `failed` 处理器主体包裹在 `try/catch` 内，catch 分支记录 `console.error` 以便运维排查，保证 Node.js 进程不因 unhandled rejection 而崩溃。

**修复后代码片段**：
```typescript
worker.on("failed", async (job, error) => {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 3)) return;
  try {
    await transcriptionRepository.updateStatus(...);
    await publisher.publish(...);
  } catch (handlerError) {
    console.error("[TranscriptionWorker] Failed to persist FAILED state:", handlerError);
  }
});
```

---

### 🟡 [S-001] 前端 EventSource 连接错误不关闭 — 潜在无限重连

- **文件**: [src/components/features/benchmarks/video-transcription-panel.tsx](src/components/features/benchmarks/video-transcription-panel.tsx) — SSE useEffect
- **描述**: 代码中只监听自定义 SSE 事件（`status` / `done` / `error`），未监听 EventSource 连接层错误。当 SSE 端点返回非 2xx 状态时（例如网络抖动，或在 B-001 修复前返回的 500），`source.onerror` 以普通 `Event`（非 `MessageEvent`）触发，当前的 `if (e instanceof MessageEvent)` 判断直接跳过，`source.close()` 不被调用，EventSource 会按默认策略持续重连。B-001 已修复后此场景概率大幅降低，但 401/403（合法权限变更）仍会触发此路径。
- **修复建议**：在 SSE useEffect 中监听 `source.onerror` 并对连接级错误做关闭处理：
```typescript
source.onerror = (e: Event) => {
  // 仅当非 MessageEvent（即连接层错误，非自定义错误事件）
  if (!(e instanceof MessageEvent)) {
    source.close();
  }
};
```

---

### 🟡 [S-002] AiGateway.transcribe 缺少 120s 超时，Job 可能永久阻塞

- **文件**: [src/server/services/ai-gateway.service.ts](src/server/services/ai-gateway.service.ts)
- **描述**: 技术设计明确要求"调用超时 120s（视频转录时间与文件大小相关）"，但 `transcribe()` 里没有配置 `AbortSignal` 或超时参数。如果 OpenAI API 无响应，该 BullMQ Job 会无限期阻塞，占用一个 Worker 并发槽（共 2 个），并在 BullMQ `lockDuration` 超时后被强制重试，但状态写回逻辑不会触发，可能造成状态不一致。
- **修复建议**：使用 `AbortSignal.timeout(120_000)` 传入 `transcribe()` 的 `abortSignal` 参数：
```typescript
const result = await transcribe({
  model: openai.transcription(modelId),
  audio: fileData,
  maxRetries: 0,
  abortSignal: AbortSignal.timeout(120_000), // ← 技术设计要求 120s
});
```

---

### 🟡 [S-003] 技术设计与 api-conventions 心跳频率不一致（文档需同步）

- **文件**: [docs/product/versions/v0.3.0/technical-design.md](../../../product/versions/v0.3.0/technical-design.md) vs [docs/architecture/api-conventions.md](../../../architecture/api-conventions.md)
- **描述**: `technical-design.md` 写"连接 **60 秒**无事件推送心跳"，而 `api-conventions.md`（已更新的通用 SSE 规范）写"每 **30s** 发送 keepalive"，实现采用 30s（与 api-conventions 一致）。技术设计文档的 60s 描述属于遗留笔误，应更新为 30s 以消除后续版本疑惑。
- **修复建议**: 将 `technical-design.md` 中的"连接 60 秒无事件推送心跳"改为 30s（或删除该描述，以 `api-conventions.md` 为准）。

---

### 🟢 [P-001] toTranscriptionDTO 参数类型过于复杂，可用已有类型替代

- **文件**: [src/server/services/transcription.service.ts](src/server/services/transcription.service.ts) — `toTranscriptionDTO` 方法
- **描述**: 当前签名使用了条件类型推导：
  ```typescript
  private toTranscriptionDTO(
    record: Awaited<ReturnType<typeof transcriptionRepository.findById>> extends infer T
      ? NonNullable<T>
      : never,
  ): TranscriptionDTO
  ```
  Repository 文件中已导出 `TranscriptionWithOrg` 类型，直接使用即可：
  ```typescript
  private toTranscriptionDTO(record: TranscriptionWithOrg): TranscriptionDTO
  ```
  两者等价，但后者可读性更佳，且当 `findById` 签名变化时类型推导链更短。

---

### 🟢 [P-002] SSE 事件 data 字段 transcriptionId 与 api-conventions 通用约定 id 不一致

- **文件**: [src/types/transcription.ts](src/types/transcription.ts) — `TranscriptionSSEEvent`；[docs/architecture/api-conventions.md](../../../architecture/api-conventions.md) — SSE 消息格式表
- **描述**: `api-conventions.md` 的通用 SSE 约定使用 `{ id: string, status: ... }`，而 `transcription.ts` 的 `TranscriptionSSEEvent` 和实际 Worker/SSE 实现统一使用 `{ transcriptionId: string, ... }`。当前版本两侧一致（前后端均用 `transcriptionId`），无运行时问题，但与通用规范的字段名出现漂移。
- **建议**: 在 `api-conventions.md` 的 SSE 事件表中备注"领域特定实现可在 `id` 旁使用语义明确的字段名（如 `transcriptionId`），以前后端代码一致为准"，避免后续版本开发者遵循通用约定而破坏当前 API 契约。

---

## 逐文件审查结论

| 文件 | 结论 | 备注 |
|------|------|------|
| `prisma/schema.prisma` | ✅ | Transcription 模型字段完整，videoId @unique，@@map，反向关系字段均正确 |
| `src/lib/env.ts` | ✅ | TRANSCRIPTION_AI_MODEL + OPENAI_API_KEY 已按设计新增 |
| `src/lib/bullmq.ts` | ✅ | 队列配置与设计一致（attempts:3, exponential backoff, removeOnFail:false） |
| `src/lib/redis.ts` | ✅ | BullMQ 连接与 Pub/Sub 连接正确分离；maxRetriesPerRequest:null 仅用于 BullMQ |
| `src/lib/transcription-worker.ts` | ✅（已修复 B-002） | PROCESSING/COMPLETED 状态写入正确；failed handler 已补 try-catch |
| `instrumentation.ts` | ✅ | nodejs runtime 分支内正确注册 startTranscriptionWorker()；process.env 直接访问有注释说明 |
| `src/server/repositories/transcription.repository.ts` | ✅ | CRUD 方法语义清晰；updateStatus 支持 partial update；reset 正确清空三字段 |
| `src/server/services/ai-gateway.service.ts` | 🟡（S-002） | 功能正确；缺 120s 超时 |
| `src/server/services/transcription.service.ts` | ✅ | 鉴权、状态机检查、SUPER_ADMIN 豁免均正确；两次 findById 是必要的（带 include）|
| `src/app/api/transcriptions/route.ts` | ✅ | Zod 验证、auth()、successResponse 均符合规范 |
| `src/app/api/transcriptions/[id]/route.ts` | ✅ | GET + PATCH 均有 try-catch、Zod、auth() |
| `src/app/api/transcriptions/[id]/sse/route.ts` | ✅（已修复 B-001） | 终态立即推送 + 关闭，心跳 30s，abort 时 subscriber.quit() |
| `src/types/transcription.ts` | ✅ | DTO 与设计完全一致 |
| `src/components/features/benchmarks/video-transcription-editor.tsx` | ✅ | apiClient 调用、loading 状态、Badge 使用均正确 |
| `src/components/features/benchmarks/video-transcription-panel.tsx` | 🟡（S-001） | SSE 订阅依赖清理正确；初始 fetch 取消处理完整；连接错误不关闭 |
| `src/components/features/benchmarks/benchmark-video-detail-panel.tsx` | ✅ | SlidePanel + 元信息区 + VideoTranscriptionPanel 集成正确 |
| `src/components/shared/common/slide-panel.tsx` | ✅ | slide-in/out 动画、关闭按钮、overflow 滚动均正确 |
| `src/components/features/benchmarks/benchmark-video-list.tsx` | ✅ | onVideoClick prop 新增并正确传递给 BenchmarkVideoGridCard |
| `src/components/features/benchmarks/benchmark-detail-page.tsx` | ✅ | selectedVideo 状态 + BenchmarkVideoDetailPanel 集成正确 |
| `src/components/features/benchmarks/index.ts` | ✅ | 三个新组件均已 barrel export |

---

## 自省

### 1. 本次评审新发现

- **SSE 端点错误处理是首次落库的新模式**，`review-checklist.md` 和 `backend.md` 中未明确列出"SSE 端点也需要 try-catch 包裹鉴权前置逻辑"规则。建议补充。
- **Worker 事件处理器的错误捕获**也未被 checklist 覆盖。

### 2. 建议同步文档

| 文档 | 需补充内容 |
|------|-----------|
| `docs/standards/review-checklist.md` | 新增：SSE 端点 try-catch 覆盖率（鉴权段必须在 try 内）；Worker failed/completed 事件处理器 try-catch |
| `docs/architecture/backend.md` | 新增"BullMQ Worker"节：初始化模式（initialized 防重入）、Worker 事件处理器必须 try-catch、Publisher 生命周期 |
| `docs/architecture/api-conventions.md` | SSE 通用规范备注字段名可语义化（transcriptionId 优先于通用 id） |
| `docs/product/versions/v0.3.0/technical-design.md` | 将"60 秒心跳"改为"30 秒"，与 api-conventions 对齐（见 S-003） |

> 上述文档变更建议提交架构师确认后执行。
