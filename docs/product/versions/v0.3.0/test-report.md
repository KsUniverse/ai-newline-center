# 测试报告 — v0.3.0

**测试日期**: 2026-04-04  
**测试范围**: 视频转录功能（F-003-1）+ 评审建议修复（S-001 / S-002 / S-003）  
**`pnpm type-check`**: ✅ 零错误  
**`pnpm lint`**: ✅ 零错误

---

## 摘要

- 测试功能数: 1（F-003-1）
- 通过: 1 / 失败: 0
- UI 问题: 0
- 构建检查: ✅ 通过
- 结论: **✅ 通过**

---

## 修复记录（评审建议）

| 问题 # | 严重度 | 状态 | 修复说明 |
|--------|--------|------|---------|
| S-001 | 🟡 建议 | ✅ 已修复 | `video-transcription-panel.tsx` SSE useEffect 新增 `source.onerror` 处理器：当连接层错误（非 `MessageEvent`，如 401/403/网络抖动）时调用 `source.close()` 并 `toast.error` 提示，防止无限重连 |
| S-002 | 🟡 建议 | ✅ 已修复 | `ai-gateway.service.ts` `transcribe()` 增加 `abortSignal: AbortSignal.timeout(120_000)`，防止 API 无响应时 BullMQ Job 无限期阻塞 |
| S-003 | 🟡 建议 | ✅ 已修复 | `technical-design.md` 心跳间隔描述由 "60 秒" 修正为 "30 秒"，与 `api-conventions.md` 和实现一致 |

---

## 功能验收

### F-003-1: 视频转录 — ✅ 通过

#### 数据模型

| 检查项 | 结果 | 位置 |
|--------|------|------|
| `prisma/schema.prisma` 包含 `Transcription` 模型 | ✅ | `prisma/schema.prisma:L161` |
| `TranscriptionStatus` 枚举包含 `PENDING` / `PROCESSING` / `COMPLETED` / `FAILED` | ✅ | `prisma/schema.prisma:L154-159` |
| `videoId` 唯一约束（一视频一条记录）| ✅ | `prisma/schema.prisma:L163` — `@unique` |
| `originalText` / `editedText` 双字段分离 | ✅ | `prisma/schema.prisma:L167-168` |

#### API 端点

| 端点 | 结果 | 位置 |
|------|------|------|
| `POST /api/transcriptions` | ✅ | `src/app/api/transcriptions/route.ts` |
| `GET /api/transcriptions?videoId=` | ✅ | `src/app/api/transcriptions/route.ts` — query param 过滤 |
| `PATCH /api/transcriptions/[id]` | ✅ | `src/app/api/transcriptions/[id]/route.ts` |
| `GET /api/transcriptions/[id]/sse` | ✅ | `src/app/api/transcriptions/[id]/sse/route.ts` |
| 所有端点有 `requireRole` 鉴权 | ✅ | 4 个 handler 均含 `requireRole` 调用 |
| 统一响应格式 `{ success, data?, error? }` | ✅ | `handleApiError` / `successResponse` 封装 |
| SSE 端点有完整 try/catch（B-001 已修复）| ✅ | `sse/route.ts` — 整体包裹在 `try/catch` 内 |

#### Worker 与队列

| 检查项 | 结果 | 位置 |
|--------|------|------|
| BullMQ Worker 初始化存在（`TRANSCRIPTION_QUEUE_NAME`）| ✅ | `src/lib/transcription-worker.ts:L28` |
| Worker `failed` 事件处理器有 try/catch（B-002 已修复）| ✅ | `transcription-worker.ts:L71-88` — `try/catch` 内 |
| Worker 并发数 = 2 | ✅ | `transcription-worker.ts:L60` — `concurrency: 2` |
| 防重复初始化 `initialized` flag | ✅ | `transcription-worker.ts:L12,L16` |
| AI Gateway 调用有 120s 超时（S-002 已修复）| ✅ | `ai-gateway.service.ts:L38` — `AbortSignal.timeout(120_000)` |
| BullMQ 最多重试 3 次逻辑 | ✅ | `failed` handler — `job.attemptsMade < (job.opts.attempts ?? 3)` |

#### 前端组件

| 检查项 | 结果 | 位置 |
|--------|------|------|
| `VideoTranscriptionEditor` 存在且可导入 | ✅ | `benchmark/video-transcription-editor.tsx` + `index.ts` 导出 |
| `VideoTranscriptionPanel` 存在，含 SSE 订阅和清理 | ✅ | `benchmark/video-transcription-panel.tsx` — `useEffect` cleanup `source.close()` |
| `VideoTranscriptionPanel` SSE onerror 处理（S-001 已修复）| ✅ | `video-transcription-panel.tsx:L96-100` |
| `BenchmarkVideoDetailPanel` 存在，使用 `SlidePanel` | ✅ | `benchmark-video-detail-panel.tsx:L27` — `<SlidePanel>` |
| `BenchmarkVideoDetailPanel` 集成 `VideoTranscriptionPanel` | ✅ | `benchmark-video-detail-panel.tsx:L10` import + JSX 使用 |
| `BenchmarkVideoList` 含 `onVideoClick` prop | ✅ | `benchmark-video-list.tsx:L18,L77` |
| `BenchmarkDetailPageView` 集成 `BenchmarkVideoDetailPanel` | ✅ | `benchmark-detail-page.tsx:L181,L206` |
| 所有组件在 `index.ts` 导出 | ✅ | `benchmarks/index.ts` — 13 个组件全部导出 |

#### 状态机逻辑

| 检查项 | 结果 | 备注 |
|--------|------|------|
| 无记录 → 显示「AI 转录」按钮 | ✅ | `transcription === null` 分支 |
| `PENDING/PROCESSING` → 禁用按钮 + SSE 订阅 | ✅ | SSE useEffect 在 `PENDING/PROCESSING` 时激活 |
| `COMPLETED` → 展示文案区 + 「重新转录」链接 | ✅ | `COMPLETED` 分支 `VideoTranscriptionEditor` |
| `FAILED` → 错误提示 + 「重试」按钮 | ✅ | `FAILED` 分支 |
| `videoStoragePath === null` → 按钮 disabled + 提示 | ✅ | 前置判断返回提示组件 |
| SSE 完成后调用 `source.close()` | ✅ | `done` 事件 handler 末尾 |

#### 权限隔离

| 检查项 | 结果 | 备注 |
|--------|------|------|
| 发起转录验证 `organizationId` 一致 | ✅ | `transcription.service.ts` 内 `organizationId` 校验 |
| 超级管理员跨组织豁免 | ✅ | `requireRole` + service 层 `SUPER_ADMIN` 豁免 |
| 查询结果按 `organizationId` 隔离 | ✅ | Repository 层通过 `DouyinAccount.organizationId` 关联过滤 |

---

## UI 一致性

| 检查项 | 结果 | 备注 |
|--------|------|------|
| 使用 CSS 变量（无硬编码色值）| ✅ | 新增组件均使用 `bg-muted`、`text-muted-foreground` 等语义 token |
| shadcn/ui 组件使用 | ✅ | `Button`、`Badge`、`Separator`、`SlidePanel` 等正确使用 |
| 暗色主题 | ✅ | 继承 shadcn dark token，无自定义覆盖 |
| 加载状态 | ✅ | `animate-pulse` skeleton 占位 |
| 错误状态 | ✅ | `FAILED` 分支有错误提示 + 重试按钮 |
| 空状态 | ✅ | `videoStoragePath === null` 有友好提示文字 |

---

## 构建检查

| 检查项 | 结果 | 备注 |
|--------|------|------|
| `pnpm type-check` | ✅ | 零错误，exit code 0 |
| `pnpm lint` | ✅ | 零错误，exit code 0 |

---

## 问题列表

本次验收未发现阻塞性问题。S-001/S-002/S-003 三个建议项均已在测试前完成修复。

---

## 文档一致性说明

| 问题 | 详情 |
|------|------|
| `requirements.md` 与实现的轻微偏差 | `requirements.md` API 表格写 `GET /api/transcriptions/by-video/[videoId]`，实际实现为 `GET /api/transcriptions?videoId=…`（query param 方式）。前端调用（`/transcriptions?videoId=${videoId}`）与实现一致，功能正常。建议后续版本更新 `requirements.md` 中该端点描述为 `GET /api/transcriptions?videoId={videoId}`。 |

---

## 总体结论

✅ **通过** — F-003-1 视频转录功能全部验收项通过，评审 3 个建议项已修复，构建检查零错误。

---

## 自省

### 回顾

- `requirements.md` 中 API 路径描述（`/by-video/[videoId]`）与实际实现（`?videoId=...`）不一致，后续版本的需求文档应与架构师对齐 API 路径设计决策后再写入文档，避免歧义。
- 验收清单 "BenchmarkDetailPageView 集成 BenchmarkVideoDetailPanel" 使用了 `BenchmarkDetailPageView` 而非文件中实际导出名，建议验收清单与组件导出名保持一致。

### 检查

- `review-checklist.md` 可补充：SSE 端点需要检查"连接层 onerror 是否调用 close()" 和 "AI 调用是否有超时保护"两项，防止后续迭代遗漏。

### 提议

以下文档修改供架构师 / 编排者确认后执行：

1. **`docs/product/versions/v0.3.0/requirements.md`** — API 端点表格中 `GET /api/transcriptions/by-video/[videoId]` 应更新为 `GET /api/transcriptions?videoId={videoId}`。
2. **`docs/standards/review-checklist.md`** — 在 SSE 相关检查项中新增：(a) EventSource `onerror` 是否关闭连接；(b) AI 调用是否配置 AbortSignal 超时。
