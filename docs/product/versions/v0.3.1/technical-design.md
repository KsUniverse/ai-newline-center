# v0.3.1 技术设计方案

> 版本: v0.3.1
> 创建日期: 2026-04-06
> 最后更新: 2026-04-06
> 功能范围: 系统配置（AI 配置）+ 统一 AI 工作台
> 架构变更: [ARCH-CHANGE] benchmark video 的 AI 交互从“视频详情弹框 + 单一转录记录”升级为“员工级 AI 工作台 + 结构化拆解”

---

## 摘要

| 项目 | 内容 |
|------|------|
| 涉及模块 | M-000（系统配置）、M-003（AI 工作台）、M-002（benchmark video） |
| 新增模型 | `AiStepBinding`、`AiWorkspace`、`AiWorkspaceTranscript`、`AiTranscriptSegment`、`AiDecompositionAnnotation`、`AiRewriteDraft` |
| 修改模型 | `BenchmarkVideo`、`DouyinVideo`、`Transcription` |
| 新增 API | `/api/system-settings/ai`、`/api/ai-workspaces*` |
| 复用能力 | 现有转录队列、SSE、benchmark video 数据链路、共享 Slide/Sheet/Dialog 原语 |
| 关键目标 | 转录真实可用；拆解结构化落库；仿写进入统一工作台主战场 |

---

## 技术对齐结论

以下结论以已确认的需求边界为准：

| 维度 | 已确认结论 | 设计落点 |
|------|------------|----------|
| AI 配置 | 系统级默认绑定仍保留 | 继续使用 `AiStepBinding` |
| 工作台模式 | 点击视频后直接进入统一 AI 工作台 | 替换旧 benchmark 详情弹框入口 |
| 前端视觉语言 | 保留项目现有品牌化工作台视觉语言，只提升动效连续性与工作台切换质感 | 继续复用 `ui/*`、`shared/*`、token、Slide/Sheet 原语，不另起一套 Apple 风格皮肤 |
| 转录输入 | 固定 Prompt + `shareUrl` | 复用异步转录队列，但 UI 与数据模型转向工作台 |
| 转录确认 | 拆解前必须确认转录稿 | `AiWorkspaceTranscript.isConfirmed` |
| 解锁编辑 | 解锁编辑会提示并清空已有拆解/仿写 | 服务端提供原子操作端点 |
| 拆解粒度 | 任意文本范围 | `startOffset/endOffset + tags + 结构化字段` |
| 数据归属 | 转录/拆解/仿写按员工归属 | `AiWorkspace(videoId, userId)` 唯一 |
| 仿写 | 是统一工作台中的独立主工作区 | 仿写草稿单独存储；本版不强制 AI 自动生成 |

---

## 现状评估

### 可复用部分

| 现有实现 | 复用方式 | 本版调整 |
|---------|---------|----------|
| `ai-gateway.service.ts` | 继续作为实现注册表入口 | 从文件转录改为步骤路由 + 文本生成 |
| BullMQ + SSE | 继续承接异步转录 | 转录状态映射到工作台 |
| benchmark video 列表与详情数据 | 继续作为工作台入口数据 | 改成点击即进 AI 工作台 |
| `shareUrl` 链路 | 继续沿用本版已确认设计 | 同步写入视频表 |

### 必须纠偏的旧实现假设

1. 旧设计默认“一个视频只有一条转录记录”，与员工级工作台冲突。
2. 旧前端默认“视频详情弹框内附带转录区”，与统一 AI 工作台冲突。
3. 旧设计没有结构化拆解模型，无法支持后续 AI 学习。
4. 旧设计把仿写当附属结果区，不符合本次已确认的产品边界。

---

## 数据模型设计

### 1. 系统级 AI 配置

保留 `AiStepBinding`，用于系统级步骤绑定：

```prisma
enum AiStep {
  TRANSCRIBE
  DECOMPOSE
  REWRITE
}

model AiStepBinding {
  id                String   @id @default(cuid())
  step              AiStep   @unique
  implementationKey String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("ai_step_bindings")
}
```

### 2. 员工级 AI 工作台

```prisma
enum AiWorkspaceStatus {
  IDLE
  TRANSCRIBING
  TRANSCRIPT_DRAFT
  TRANSCRIPT_CONFIRMED
  DECOMPOSING
  DECOMPOSED
  REWRITING
}

model AiWorkspace {
  id               String            @id @default(cuid())
  videoId          String
  userId           String
  organizationId   String
  status           AiWorkspaceStatus @default(IDLE)
  enteredRewriteAt DateTime?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  video            BenchmarkVideo    @relation(fields: [videoId], references: [id])
  user             User              @relation(fields: [userId], references: [id])
  transcript       AiWorkspaceTranscript?
  segments         AiTranscriptSegment[]
  annotations      AiDecompositionAnnotation[]
  rewriteDraft     AiRewriteDraft?

  @@unique([videoId, userId])
  @@index([organizationId])
  @@map("ai_workspaces")
}
```

### 3. 主文档模型

```prisma
model AiWorkspaceTranscript {
  id            String      @id @default(cuid())
  workspaceId   String      @unique
  originalText  String?
  currentText   String?
  isConfirmed   Boolean     @default(false)
  confirmedAt   DateTime?
  lastEditedAt  DateTime?
  aiProviderKey String?
  aiModel       String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  workspace     AiWorkspace @relation(fields: [workspaceId], references: [id])

  @@map("ai_workspace_transcripts")
}
```

说明：

- `originalText` 保存 AI 首次生成原稿
- `currentText` 保存当前主文档
- 不采用版本快照模型
- 通过“解锁编辑”端点原子清空拆解与仿写草稿

### 4. 内部段落模型

```prisma
model AiTranscriptSegment {
  id          String      @id @default(cuid())
  workspaceId String
  sortOrder   Int
  text        String
  summary     String?
  purpose     String?
  startOffset Int
  endOffset   Int
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  workspace   AiWorkspace @relation(fields: [workspaceId], references: [id])

  @@index([workspaceId, sortOrder])
  @@map("ai_transcript_segments")
}
```

### 5. 结构化拆解模型

```prisma
model AiDecompositionAnnotation {
  id             String      @id @default(cuid())
  workspaceId     String
  segmentId       String?
  startOffset     Int
  endOffset       Int
  quotedText      String
  function        String?
  argumentRole    String?
  technique       String?
  purpose         String?
  effectiveness   String?
  note            String?
  createdByUserId String
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  workspace       AiWorkspace @relation(fields: [workspaceId], references: [id])
  segment         AiTranscriptSegment? @relation(fields: [segmentId], references: [id])

  @@index([workspaceId])
  @@index([workspaceId, startOffset, endOffset])
  @@map("ai_decomposition_annotations")
}


```

### 6. 仿写草稿模型

```prisma
model AiRewriteDraft {
  id                          String      @id @default(cuid())
  workspaceId                 String      @unique
  sourceTranscriptText        String?
  sourceDecompositionSnapshot Json?
  currentDraft                String?
  createdAt                   DateTime    @default(now())
  updatedAt                   DateTime    @updatedAt

  workspace                   AiWorkspace @relation(fields: [workspaceId], references: [id])

  @@map("ai_rewrite_drafts")
}
```

### 7. 视频表补充字段

继续保留 `BenchmarkVideo.shareUrl` 与 `DouyinVideo.shareUrl`，作为转录主链路前提。

---

## 后端主线设计

### 1. 转录工作流

```text
点击 AI 转录
  -> 查找/创建 AiWorkspace(videoId, userId)
  -> 读取 TRANSCRIBE 步骤绑定
  -> 校验 shareUrl
  -> 创建异步转录任务
  -> AI 返回 originalText
  -> 初始化 AiWorkspaceTranscript
  -> 进入 TRANSCRIPT_DRAFT
```

### 2. 确认与解锁编辑

#### 确认转录稿

- 保存当前 `currentText`
- 保存当前 `segments`
- `isConfirmed = true`
- `workspace.status = TRANSCRIPT_CONFIRMED`

#### 解锁编辑

服务端单个事务执行：

1. `isConfirmed = false`
2. 删除当前 `AiDecompositionAnnotation`
3. 清空 `AiRewriteDraft`
4. `workspace.status = TRANSCRIPT_DRAFT`

说明：

- `AiTranscriptSegment` 只作为内部保存结构，用于稳定记录当前文档块和后续样本消费
- 它不再作为前端拆解入口，也不代表业务语义标签

### 3. 拆解工作流

```text
选中文本范围
  -> 新增/编辑结构化拆解
  -> workspace.status 进入 DECOMPOSING / DECOMPOSED
```

### 4. 仿写工作流

```text
点击进入仿写
  -> workspace.enteredRewriteAt = now
  -> 前端切换工作台布局
  -> 右侧仿写栏编辑
  -> PATCH 保存草稿
```

本版不强制 AI 自动生成仿写，但数据模型与 API 预留生成入口。

---

## API 契约设计

### 1. AI 配置

- `GET /api/system-settings/ai`
- `PUT /api/system-settings/ai`

### 2. 工作台查询

#### `GET /api/ai-workspaces?videoId=...`

返回：

```ts
interface AiWorkspaceDTO {
  id: string;
  videoId: string;
  userId: string;
  status: string;
  enteredRewriteAt: string | null;
  videoSummary: {
    id: string;
    title: string;
    coverUrl: string | null;
    shareUrl: string | null;
    publishedAt: string | null;
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
  };
  transcript: {
    originalText: string | null;
    currentText: string | null;
    isConfirmed: boolean;
    confirmedAt: string | null;
    aiProviderKey: string | null;
    aiModel: string | null;
  } | null;
  segments: AiTranscriptSegmentDTO[];
  annotations: AiDecompositionAnnotationDTO[];
  rewriteDraft: {
    currentDraft: string | null;
  } | null;
}
```

### 3. 发起转录

#### `POST /api/ai-workspaces/transcribe`

请求体：

```ts
{ videoId: string }
```

### 4. 保存转录稿

#### `PATCH /api/ai-workspaces/:id/transcript`

请求体：

```ts
{
  currentText: string;
  segments: Array<{
    sortOrder: number;
    text: string;
    summary?: string | null;
    purpose?: string | null;
    startOffset: number;
    endOffset: number;
  }>;
}
```

### 5. 确认转录稿

#### `POST /api/ai-workspaces/:id/transcript/confirm`

### 6. 解锁编辑

#### `POST /api/ai-workspaces/:id/transcript/unlock`

### 7. 拆解接口

#### `POST /api/ai-workspaces/:id/annotations`
#### `PATCH /api/ai-workspaces/:id/annotations/:annotationId`
#### `DELETE /api/ai-workspaces/:id/annotations/:annotationId`

请求体示例：

```ts
{
  segmentId?: string | null;
  startOffset: number;
  endOffset: number;
  quotedText: string;
  function?: string | null;
  argumentRole?: string | null;
  technique?: string | null;
  purpose?: string | null;
  effectiveness?: string | null;
  note?: string | null;
}
```

### 8. 仿写草稿接口

#### `PATCH /api/ai-workspaces/:id/rewrite-draft`

请求体：

```ts
{
  currentDraft: string;
}
```

#### 预留

- `POST /api/ai-workspaces/:id/rewrite/generate`

---

## 前端交互与后端状态映射

### 前端视觉约束

- 继续遵循 `docs/architecture/frontend.md` 和 `docs/standards/ui-ux-system.md`
- 保留现有品牌化工作台视觉语言，不单独引入另一套“苹果式”配色、字体或控件皮肤
- 主文档高亮采用固定的 4 类颜色语义：`悬念钩子`、`强势论点`、`弱势论点`、`引流`，并在主文档附近用轻量 legend 做说明
- 允许借鉴的只有：
  - 连续形变式栏位过渡
  - 丝滑的透明度 / 宽度 / 位移动画
  - 明确的视觉锚点保持
- 不允许：
  - 脱离现有 token 的新配色体系
  - 新建一套独立 dialog / sheet / card 视觉语言
  - 让动效抢过业务内容本身

### 初始态

- 第一栏：视频详情
- 第二栏：转录主文档
- 第三栏：拆解栏

### 仿写态

- 第一栏：拆解
- 第二栏：转录（顶部有小封面缩略卡）
- 第三栏：仿写

进入仿写时：

- `workspace.enteredRewriteAt = now`
- 前端根据 `enteredRewriteAt !== null` 切换动画布局

---

## 渐进迁移策略

1. 保留旧转录基础设施，但 UI 和领域语义切换到 `AiWorkspace`
2. 先交付真实转录与结构化拆解，再补强 AI 自动拆解/仿写
3. 旧 benchmark 详情弹框可在实现阶段保留为视频播放层，不再作为主入口

---

## 风险与非目标

### 风险

1. 任意文本范围标注依赖前端提供稳定 offset；编辑后需要前端正确重算范围。
2. 统一 AI 工作台的三栏动画复杂度较高，前端需谨慎处理宽度和过渡。
3. 后续若拆解标签体系快速扩张，需要补充标签字典或配置来源。

### 非目标

1. 本版不做富文本级多层 mark 编辑器。
2. 本版不做 AI 自动拆解。
3. 本版不做 AI 自动仿写闭环。

---

## 架构变更记录 [ARCH-CHANGE]

### 变更点 1

- **原约定**: 一个视频只有一条转录记录。
- **新约定**: 转录、拆解、仿写数据按 `员工 + 视频` 的 AI 工作台归属。
- **原因**: 工作台是员工个人学习与创作空间，不是组织共享结果。

### 变更点 2

- **原约定**: benchmark video 的 AI 交互挂在视频详情弹框内。
- **新约定**: 点击视频后直接进入统一 AI 工作台弹框。
- **原因**: 当前业务目标已经从“查看详情”转为“理解素材并创作”。

### 变更点 3

- **原约定**: 转录与拆解松耦合，仿写弱化。
- **新约定**: 转录稿是主文档，拆解是解释层，仿写是独立主工作区。
- **原因**: 交互和数据都要围绕学习型工作流收敛。

