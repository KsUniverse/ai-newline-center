# v0.3.0 前端任务清单

> 版本: v0.3.0  
> 创建日期: 2026-04-04  
> 任务总数: 7

---

## 必读文档

> 开始开发前必须阅读以下文档：

- `docs/product/versions/v0.3.0/requirements.md` — 本版本需求（理解交互细节与状态机）
- `docs/product/versions/v0.3.0/technical-design.md` — 本版本技术设计（API 契约、SSE 事件格式、组件树）
- `docs/architecture/frontend.md` — 前端架构规范（组件层次、Slide Panel 模板、交互模式）
- `docs/standards/ui-ux-system.md` — UI/UX 设计系统（色彩体系、字号规范、圆角、间距）
- `docs/standards/coding-standards.md` — 编码规范（禁止 any，显式类型标注）

**前置条件**：后端 BE-001 ～ BE-010 完成（Prisma 迁移、类型文件、API 端点就绪）后可开始前端开发。  
FE-001（类型文件）可与 BE 并行。

---

## 摘要

| 项目 | 内容 |
|------|------|
| 任务总数 | 7 |
| 新增组件 | 3 个（`BenchmarkVideoDetailPanel`、`VideoTranscriptionPanel`、`VideoTranscriptionEditor`） |
| 修改文件 | 3 个（`BenchmarkVideoList`、`BenchmarkDetailPageView`、`index.ts`） |
| 新增类型文件 | 1 个（`src/types/transcription.ts`） |

---

## 任务列表

---

### FE-001 (P0) 共享类型定义

**文件**: `src/types/transcription.ts`（新建）

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
```

---

### FE-002 (P0) VideoTranscriptionEditor — 内联编辑组件

**文件**: `src/components/features/benchmarks/video-transcription-editor.tsx`（新建）

**Props 接口**：

```typescript
interface VideoTranscriptionEditorProps {
  transcriptionId: string;
  initialText: string;           // editedText 非空则传 editedText，否则传 originalText
  hasEditedText: boolean;        // 是否存在 editedText（用于显示"已手工校对"标签）
  onSaved: (updated: TranscriptionDTO) => void;
  onCancel: () => void;
}
```

**实现要求**：

1. 内部状态：`text`（当前编辑内容）、`saving`（保存中）
2. 展示一个 `<textarea>` + "保存" / "取消" 按钮
3. 点击"保存" → `apiClient.patch<TranscriptionDTO>(`/transcriptions/${transcriptionId}`, { editedText: text })` → 成功后调用 `onSaved`，失败时 `toast.error`
4. "保存"按钮 `disabled={saving}`，显示 loading 状态
5. 字数统计（右下角 `text-xs text-muted-foreground`，如 `128 字`）

---

### FE-003 (P0) VideoTranscriptionPanel — 转录状态面板

**文件**: `src/components/features/benchmarks/video-transcription-panel.tsx`（新建）

**Props 接口**：

```typescript
interface VideoTranscriptionPanelProps {
  videoId: string;
  videoStoragePath: string | null; // null 时提示"视频文件尚未下载"
}
```

**内部状态**：

```typescript
const [transcription, setTranscription] = useState<TranscriptionDTO | null>(null);
const [loading, setLoading] = useState(true);           // 初始加载
const [submitting, setSubmitting] = useState(false);     // 提交转录中
const [editing, setEditing] = useState(false);           // 是否进入内联编辑
```

**初始化**（`useEffect` 依赖 `videoId`）：
```typescript
// GET /api/transcriptions?videoId={videoId}
// 404 → transcription = null（正常，非错误状态）
// 其他错误 → toast.error
```

**SSE 订阅**（`useEffect` 依赖 `transcription?.id` 和 `transcription?.status`）：
- 仅在 `status === "PENDING" || status === "PROCESSING"` 时订阅
- `const source = new EventSource(`/api/transcriptions/${transcription.id}/sse`)`
- 监听 `status` / `done` / `error` 事件，更新 `transcription` 状态
- 组件卸载或状态变为终态时 `source.close()`

**各状态 UI**：

| 状态 | UI |
|------|----|
| `loading=true` | `<div className="animate-pulse h-32 rounded-lg bg-muted" />`（骨架屏） |
| `videoStoragePath=null` | 信息提示卡片：「视频文件尚未下载，请等待同步完成后再试」（`text-muted-foreground text-sm`） |
| `transcription=null`（无记录） | 「AI 转录」主按钮（`variant="default"`），点击调用 `handleSubmit` |
| `PENDING` | 禁用按钮 + Loader2 icon + 「转录中…」文字（`text-muted-foreground text-sm`） |
| `PROCESSING` | 同上，文字改为「AI 处理中，请稍候…」 |
| `COMPLETED` | 文案区域（见下方）+ 「重新转录」文字链（`variant="link" size="sm"`） |
| `FAILED` | 红色错误提示（`text-destructive text-sm`）+ 错误信息 + 「重试」按钮（`variant="outline"`） |

**COMPLETED 状态文案区域**：
```
[若有 editedText] 徽章：「已手工校对」（Badge variant="secondary"）
                  文字：显示 editedText
[若无 editedText] 文字：显示 originalText
[originalText 为 ""] 文字：「未识别到有效语音内容，可手动输入文案」（muted 色）

[操作行]
  [editing=false]: [编辑] 按钮 (variant="outline" size="sm")
  [editing=true]: <VideoTranscriptionEditor .../>

[若有 editedText 且 editing=false]: 「恢复 AI 原文」文字链（variant="link" size="sm"）
  点击 → apiClient.patch(..., { editedText: null }) → setTranscription(updated)
```

**`handleSubmit`**（提交转录）：
```typescript
const handleSubmit = async () => {
  setSubmitting(true);
  try {
    const result = await apiClient.post<TranscriptionDTO>("/transcriptions", { videoId });
    setTranscription(result);
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : "提交失败，请稍后重试");
  } finally {
    setSubmitting(false);
  }
};
```

**文案区域样式**（`COMPLETED`）：
```tsx
<div className="rounded-lg border border-border bg-card p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
  {displayText}
</div>
```

---

### FE-004 (P0) BenchmarkVideoDetailPanel — 视频详情 Slide Panel

**文件**: `src/components/features/benchmarks/benchmark-video-detail-panel.tsx`（新建）

**Props 接口**：

```typescript
interface BenchmarkVideoDetailPanelProps {
  video: DouyinVideoDTO | null; // null 时面板关闭
  onClose: () => void;
}
```

**实现要求**：

1. 使用 `SlidePanel`（`src/components/shared/common/slide-panel.tsx`）作为容器，`width="lg"`
2. `open={video !== null}`，`onClose={onClose}`，`title={video?.title ?? "视频详情"}`

**面板内容布局**（从上至下）：

**① 视频元信息区**：
- 封面图（若有 `coverUrl`，使用 `proxyImageUrl()` 处理）或 Film icon 占位
- 标题（`text-base font-semibold`）
- 发布时间（`text-sm text-muted-foreground`，`formatDateTime(video.publishedAt)`）
- 数据指标行：播放量、点赞、评论、分享（使用 `formatNumber()`，图标 + 数字，`text-sm`）
- 标签（`video.tags`，`Badge variant="secondary" text-xs`）

**② 分隔线** (`<Separator />`，来自 shadcn/ui)

**③ 转录区**：
- 区域标题：`<h3 className="text-sm font-medium mb-3">AI 转录</h3>`
- `<VideoTranscriptionPanel videoId={video.id} videoStoragePath={video.videoStoragePath} />`

**关闭时清理**：`onClose` 时由父组件将 `selectedVideo` 置 `null`（自然 unmount 清理 SSE）。

---

### FE-005 (P0) BenchmarkVideoList — 新增 onVideoClick prop

**文件**: `src/components/features/benchmarks/benchmark-video-list.tsx`（修改）

**变更内容**：

1. `BenchmarkVideoListProps` 接口新增：
```typescript
onVideoClick?: (video: DouyinVideoDTO) => void;
```

2. 组件内部解构新增 `onVideoClick`

3. 将 `BenchmarkVideoGridCard` 的 `onClick={() => {}}` 改为：
```typescript
onClick={() => onVideoClick?.(video)}
```

**不改动其他内容**。

---

### FE-006 (P0) BenchmarkDetailPageView — 集成 Slide Panel

**文件**: `src/components/features/benchmarks/benchmark-detail-page.tsx`（修改）

**变更内容**：

1. 新增状态：
```typescript
const [selectedVideo, setSelectedVideo] = useState<DouyinVideoDTO | null>(null);
```

2. 在 `BenchmarkVideoList` 组件上新增 prop：
```tsx
<BenchmarkVideoList
  // ...（原有 props 不变）
  onVideoClick={(video) => setSelectedVideo(video)}
/>
```

3. 在返回的 JSX 中追加（位于最外层 `<div>` 内的末尾）：
```tsx
<BenchmarkVideoDetailPanel
  video={selectedVideo}
  onClose={() => setSelectedVideo(null)}
/>
```

4. 新增 import：
```typescript
import { BenchmarkVideoDetailPanel } from "./benchmark-video-detail-panel";
```

**不修改现有组件的其他逻辑**。

---

### FE-007 (P0) index.ts — barrel export

**文件**: `src/components/features/benchmarks/index.ts`（修改）

在现有 exports 末尾追加：

```typescript
export { BenchmarkVideoDetailPanel } from "./benchmark-video-detail-panel";
export { VideoTranscriptionPanel } from "./video-transcription-panel";
export { VideoTranscriptionEditor } from "./video-transcription-editor";
```

---

## 状态机速查

```
（无转录记录）
  btn: [AI 转录]  → 点击 → POST /api/transcriptions → transcription.status = PENDING

PENDING
  UI: 禁用按钮 + "转录中…"
  SSE: 订阅中（等待 status/done/error 事件）

PROCESSING
  UI: 禁用按钮 + "AI 处理中…"
  SSE: 订阅中

COMPLETED
  UI: 文案区域 + [编辑] + 「恢复 AI 原文」 + 「重新转录」链接
  SSE: 关闭

FAILED
  UI: 错误信息 + [重试]
  SSE: 关闭
```

## 关键 API 调用速查

| 操作 | 调用 |
|------|------|
| 初始化查询转录 | `GET /api/transcriptions?videoId={videoId}` |
| 提交转录 | `POST /api/transcriptions` `{ videoId }` |
| 订阅状态 | `EventSource /api/transcriptions/{id}/sse` |
| 保存编辑 | `PATCH /api/transcriptions/{id}` `{ editedText: string }` |
| 恢复 AI 原文 | `PATCH /api/transcriptions/{id}` `{ editedText: null }` |

---

## 自省报告（前端开发）

**完成时间**: 2026-04-04

### 完成情况
- [x] FE-001: `src/types/transcription.ts` — 已由后端阶段预先创建，含 `TranscriptionSSEEvent` 联合类型
- [x] FE-002: `video-transcription-editor.tsx` — 含 textarea、字数统计、保存/取消、`hasEditedText` 徽章
- [x] FE-003: `video-transcription-panel.tsx` — 完整状态机（null/PENDING/PROCESSING/COMPLETED/FAILED）、SSE 订阅、内联编辑、恢复 AI 原文
- [x] FE-004: `benchmark-video-detail-panel.tsx` — 使用新建的 `SlidePanel`，含视频元信息 + Separator + VideoTranscriptionPanel
- [x] FE-005: `benchmark-video-list.tsx` — 新增可选 `onVideoClick` prop，透传到 `BenchmarkVideoGridCard`
- [x] FE-006: `benchmark-detail-page.tsx` — 新增 `selectedVideo` 状态、`onVideoClick` prop、`BenchmarkVideoDetailPanel` 集成
- [x] FE-007: `index.ts` — 新增 3 个 barrel export

### 技术决策记录

1. **SlidePanel 新建**：`src/components/shared/common/slide-panel.tsx` 不存在，按 `docs/architecture/frontend.md` 模板创建，与规范完全一致。
2. **SSE `error` 事件区分**：用 `e instanceof MessageEvent` 区分自定义 SSE `event: error` 消息与 EventSource 连接错误（后者为裸 `Event` 实例无 `data`）。
3. **`restoring` 额外状态**：规范仅定义 4 个内部状态，额外增加 `restoring` 用于「恢复 AI 原文」PATCH 操作的 loading 状态，避免与 `submitting`（POST 专用）语义混淆。
4. **PENDING/PROCESSING UI 布局**：将 Loader2 spinner 独立为一个迷你禁用按钮，「转录中…」文字单独使用 `text-sm text-muted-foreground`，符合规范中"+"分隔三元素的描述。
5. **封面图 aspect-video**：详情面板封面使用 `aspect-video`（16:9）替代 `aspect-3/4`（原卡片比例）以适应宽面板布局，信息密度更好。

### 问题与提议

- `pnpm type-check` 和 `pnpm lint` 均通过，无类型错误或 lint 警告。
- **提议**：`SlidePanel` 现在是共享组件，建议在 `docs/architecture/frontend.md` 的「已有共享组件」列表中补充说明（原文档中有模板但未注明是否已创建）。
- **提议**：`src/components/shared/common/` 目录目前只有 `confirm-dialog.tsx` 和新建的 `slide-panel.tsx`，其余文档中提到的 `loading-spinner.tsx`、`error-boundary.tsx`、`empty-state.tsx` 尚未创建，可在后续迭代补充。
