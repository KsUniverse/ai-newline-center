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
| 关键目标 | 转录真实可用；拆解结构化落库；仿写进入统一工作台主战场；shareUrl 可同步入库并按需补拉 |

---

## 技术对齐结论

以下结论以已确认的需求边界为准：

| 维度 | 已确认结论 | 设计落点 |
|------|------------|----------|
| AI 配置 | 系统级默认绑定仍保留，采用模型池 + 三步固定绑定 | 继续使用 `AiStepBinding` + 实现注册表 |
| 工作台模式 | 点击视频后直接进入统一 AI 工作台 | 替换旧 benchmark 详情弹框入口 |
| 前端视觉语言 | 保留项目现有品牌化工作台视觉语言，只提升动效连续性与工作台切换质感 | 继续复用 `ui/*`、`shared/*`、token、Slide/Sheet 原语，不另起一套 Apple 风格皮肤 |
| 转录输入 | 固定 Prompt + `shareUrl` | 复用异步转录队列，但支持缺链时按需补拉并回写视频表 |
| 转录确认 | 拆解前必须确认转录稿 | `AiWorkspaceTranscript.isConfirmed` |
| 解锁编辑 | 解锁编辑会提示并清空已有拆解/仿写 | 服务端提供原子操作端点 |
| 重转录 | `转录 / 拆解` 阶段允许重转录，`仿写` 阶段禁止回退 | 服务端统一 reset transcript/decomposition/rewrite 依赖 |
| 拆解粒度 | 任意文本范围 | `startOffset/endOffset + tags + 结构化字段` |
| 数据归属 | 转录/拆解/仿写按员工归属 | `AiWorkspace(videoId, userId)` 唯一 |
| 仿写 | 是统一工作台中的独立主工作区 | 仿写草稿单独存储；本版不强制 AI 自动生成 |

---

## 现状评估

### 可复用部分

| 现有实现 | 复用方式 | 本版调整 |
|---------|---------|----------|
| `ai-gateway.service.ts` | 继续作为实现注册表入口 | 改为模型池 + 步骤路由；转录走独立 REST chat，拆解/仿写走 Ark SDK |
| BullMQ + SSE | 继续承接异步转录 | 转录状态映射到工作台 |
| benchmark video 列表与详情数据 | 继续作为工作台入口数据 | 改成点击即进 AI 工作台 |
| `shareUrl` 链路 | 沿用分享链接主链路，但纠偏历史缺链问题 | 同步写入视频表，并在转录前按需补拉回写 |

### 必须纠偏的旧实现假设

1. 旧设计默认“一个视频只有一条转录记录”，与员工级工作台冲突。
2. 旧前端默认“视频详情弹框内附带转录区”，与统一 AI 工作台冲突。
3. 旧设计没有结构化拆解模型，无法支持后续 AI 学习。
4. 旧设计把仿写当附属结果区，不符合本次已确认的产品边界。

---

## 数据模型设计

### 1. 系统级 AI 配置

保留 `AiStepBinding`，用于系统级步骤绑定：

- `AiStepBinding` 只保存步骤 -> 默认实现的绑定关系。
- 具体实现由 `ai-gateway.service.ts` 中的模型池注册表提供，包含 `key / provider / supportedSteps / requiredEnvKeys / requestMode`。
- 当前默认实现建议值：`volcengine-transcribe`、`ark-decompose`、`ark-rewrite`。

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

- 存储层允许保留 `originalText/currentText` 字段，便于后续内部演进
- v0.3.1 前端交互只呈现并编辑一份“转录主文档”，不做 AI 稿 / 人工稿双视图
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

继续保留 `BenchmarkVideo.shareUrl` 与 `DouyinVideo.shareUrl`。

补充约束：

- 同步链路优先把爬虫响应中的 `share_info.share_link_desc` 写入 `shareUrl`。
- 若 benchmark 视频历史数据缺少 `shareUrl`，AI 工作台在发起转录前会调用爬虫详情接口尝试补拉并立即回写数据库。

---

## 后端主线设计

### 1. 转录工作流

```text
点击 AI 转录
  -> 查找/创建 AiWorkspace(videoId, userId)
  -> 读取 TRANSCRIBE 步骤绑定
  -> 校验 shareUrl；缺失时按 `video.videoId` 补拉并回写
  -> 创建异步转录任务
  -> AI 返回转录正文
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
2. 删除当前 `AiTranscriptSegment`
3. 删除当前 `AiDecompositionAnnotation`
4. 清空 `AiRewriteDraft`
5. `workspace.status = TRANSCRIPT_DRAFT`

说明：

- `AiTranscriptSegment` 只作为内部保存结构，用于稳定记录当前文档块和后续样本消费
- 它不再作为前端拆解入口，也不代表业务语义标签

### 3. 拆解工作流

```text
选中文本范围
  -> 新增/编辑结构化拆解
  -> workspace.status 进入 DECOMPOSING / DECOMPOSED
```

### 4. 重转录工作流

```text
在转录/拆解阶段点击 AI 转录
  -> 校验当前不在 REWRITING
  -> resetTranscriptToDraft(workspace)
  -> 删除 segments / annotations / rewriteDraft
  -> 重置 transcript.confirmed 状态
  -> 重新入队转录
```

### 5. 仿写工作流

```text
点击进入仿写
  -> workspace.enteredRewriteAt = now
  -> 前端切换工作台布局
  -> 右侧仿写栏编辑
  -> PATCH 保存草稿
```

补充约束：

- 一旦进入仿写阶段，不允许再回到转录或拆解阶段。
- 一旦进入仿写阶段，不允许再次触发 AI 转录。

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
  organizationId: string;
  status: string;
  enteredRewriteAt: string | null;
  createdAt: string;
  updatedAt: string;
  video: {
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
    lastEditedAt: string | null;
    aiProviderKey: string | null;
    aiModel: string | null;
  } | null;
  segments: AiTranscriptSegmentDTO[];
  annotations: AiDecompositionAnnotationDTO[];
  rewriteDraft: {
    currentDraft: string | null;
    sourceTranscriptText: string | null;
    sourceDecompositionSnapshot: unknown;
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

补充说明：

- 尽管 DTO 保留 `originalText/currentText` 字段，v0.3.1 页面只把 `currentText ?? originalText` 作为唯一转录稿呈现与编辑。
- 拆解稿不是第二份正文，而是附着在该转录稿上的 `annotations` 批注层。

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

### 业务说明

统一 AI 工作台的真实业务目标，不是“把视频详情弹框换个皮肤”，而是把
`看素材 -> 转录整理 -> 拆解学习 -> 进入仿写` 收敛成一条连续工作流。

从业务视角，这个工作台解决的是 4 件事：

1. 员工点击一条视频后，不再先看详情说明，而是直接进入转录/拆解现场。
2. 转录主文档是学习中轴，拆解是挂在主文档上的解释层。
3. 仿写是拆解之后进入的第三阶段，不再反向干扰默认转录/拆解阶段。
4. 同一条视频上的工作成果归属于员工自己，而不是组织共享结果。

因此，前端的默认主目标必须是“先转录、再拆解、最后仿写”，不是“创作优先”。

### 前端视觉约束

- 继续遵循 `docs/architecture/frontend.md` 和 `docs/standards/ui-ux-system.md`
- 保留现有品牌化工作台视觉语言，不单独引入另一套“苹果式”配色、字体或控件皮肤
- 允许借鉴的只有：
  - 连续形变式栏位过渡
  - 丝滑的透明度 / 宽度 / 位移动画
  - 明确的视觉锚点保持
- 不允许：
  - 脱离现有 token 的新配色体系
  - 新建一套独立 dialog / sheet / card 视觉语言
  - 让动效抢过业务内容本身

补充说明：

- 当前实现已经取消“颜色语义标签驱动的正文解释”，正文只表达两件事：
  - 这里有拆解
  - 当前正在聚焦哪一条拆解
- 重叠拆解不再靠叠色表达，而是靠“默认全局态 + 单条聚焦态”切换。

### 前端状态机

前端工作台不再允许接口返回值直接改写 UI 模式，而是通过“阶段状态 + 聚焦状态”两层状态机驱动。

#### 阶段状态

```text
transcribe
  -> 默认进入
  -> 支持 AI 转录、编辑、锁定

decompose
  -> 确认转录稿后进入
  -> 支持结构化拆解
  -> 仍允许再次发起 AI 转录，但会清空当前工作台已有正文与拆解

rewrite
  -> 点击进入仿写后进入
  -> 不允许回退到 transcribe / decompose
  -> 不允许再次发起 AI 转录
```

#### 聚焦状态

```text
browsing
  -> 默认浏览态
  -> 正文显示已有拆解区域
  -> 右侧显示拆解明细列表

selecting
  -> 用户在正文里手动划词
  -> 右侧进入单条拆解输入态

focused
  -> 用户点击右侧某条拆解明细
  -> 正文只高亮这一条拆解对应范围

rewriting
  -> 用户点击右上角进入仿写阶段
  -> 工作台从转录/拆解布局切到仿写布局
```

交互规则：

- 只有左侧手动划词能进入 `selecting`
- 只有点击右侧拆解明细能进入 `focused`
- 再点同一条拆解，返回 `browsing`
- 只有右上角主按钮能进入 `rewrite`
- 清除选区后，从 `selecting` 回到 `browsing`

补充说明：

- `browsing / selecting / focused` 是拆解区内部的聚焦状态，不代表工作台大阶段。
- 工作台大阶段由 `transcribe / decompose / rewrite` 驱动，并由后端状态和 `enteredRewriteAt` 共同推导。

### 转录/拆解阶段

- 第一栏：视频详情
- 第二栏：转录主文档
- 第三栏：拆解栏

### 仿写阶段

- 第一栏：拆解
- 第二栏：转录（顶部有小封面缩略卡）
- 第三栏：仿写

### 共享转场

统一 AI 工作台采用“视频卡片扩展成工作台”的共享元素转场：

1. 用户点击 benchmark 视频卡片
2. 视频卡片被记录为起始矩形
3. 工作台弹框打开时，镜像卡片放大并移动到左栏视频区
4. 同时正文区与拆解区淡入铺开
5. 关闭时反向回收，尽量保持“同一个对象在变形”的感知

当前锚点选择：

- 列表视频卡片 -> 工作台左栏视频区

理由：

- 与用户点击视频进入分析现场的直觉一致
- 能在不破坏项目现有 Dialog 体系的前提下，提供连续展开感

### 当前前端实现结构

为解决交互牵连与卡顿问题，工作台前端已重构为新的内核结构：

```text
AiWorkspaceShell
├── useAiWorkspaceController
├── AiWorkspaceVideoPane
├── AiWorkspaceTranscriptCanvas
├── AiWorkspaceDecompositionPanel
└── AiWorkspaceRewriteStage
```

说明：

- `AiWorkspaceShell` 负责弹框壳、共享转场、列布局、打开/关闭主流程
- `useAiWorkspaceController` 负责请求、状态机、数据同步、解锁与草稿保存
- `AiWorkspaceTranscriptCanvas` 只负责正文、划词、锚点高亮
- `AiWorkspaceDecompositionPanel` 只负责“输入态 / 明细态”
- `AiWorkspaceRewriteStage` 只在仿写阶段挂载，避免拖慢默认转录/拆解阶段

### 当前启动链路

```text
BenchmarkVideoGridCard
  -> BenchmarkVideoList
  -> BenchmarkDetailPage launcher state
  -> AiWorkspaceShell
```

说明：

- 页面层只保留一份 launcher state，用于维护 `video / originRect / hiddenVideoId`
- 工作台已不再通过中转 wrapper 组件进入，列表来源和壳层之间是直接链路
- workspace 首次创建改为显式 ensure 动作，避免 GET 接口带副作用

### 性能约束

性能不是局部优化项，而是这次重构的全局约束：

1. 锁定/编辑切换时，不允许整块工作台无关重渲染。
2. 正文高亮计算必须收口到纯函数，不能散在多个组件 render 中。
3. 仿写区必须按需挂载，不得默认参与转录/拆解阶段的细粒度更新。
4. 接口返回只更新数据，不直接覆盖前端状态机。

---

## 渐进迁移策略

1. 保留旧转录基础设施，但 UI 和领域语义切换到 `AiWorkspace`
2. 先交付真实转录与结构化拆解，再补强 AI 自动拆解/仿写
3. 旧 benchmark 详情弹框可在实现阶段保留为视频播放层，不再作为主入口

---

## 风险与非目标

### 风险

1. 任意文本范围标注依赖前端提供稳定 offset；编辑后需要前端正确重算范围。
2. 共享元素转场需要保持打开/关闭方向一致，否则会出现“开门顺，关门跳”的割裂感。
3. 自定义全屏工作台壳目前仍需要补齐打开/关闭与反向回收的自动化测试，才能升级为全局复用原语。

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

