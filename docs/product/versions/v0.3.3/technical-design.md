# v0.3.3 技术设计方案

> 版本: v0.3.3
> 创建日期: 2026-04-11
> 功能范围: AI 仿写生成（F-005-1：三栏布局 + Rewrite/RewriteVersion 模型 + BullMQ RewriteWorker + 多版本管理）

---

## 摘要

| 项目 | 内容 |
|------|------|
| 涉及模块 | 新增：仿写生成（rewrite）；扩展：AI 工作台仿写阶段 |
| 新增模型 | `Rewrite`、`RewriteVersion`；新增枚举 `RewriteVersionStatus` |
| 修改模型 | `AiWorkspace`（添加 `rewrite` 反向关联）；`AiModelConfig`（添加 `rewriteVersions` 反向关联）；`Organization`、`User`、`DouyinAccount`（添加 `rewrites` 反向关联） |
| 新增 API | `GET /api/ai-workspace/[videoId]/rewrite`、`POST /api/ai-workspace/[videoId]/rewrite/generate`、`PATCH /api/ai-workspace/[videoId]/rewrite/versions/[versionId]` |
| 复用 API | `GET /api/douyin-accounts`（使用 EMPLOYEE 身份时已按 userId 过滤，可直接复用）；`GET /api/ai-config/settings`（获取全量 AiModelConfig） |
| 新增后台服务 | `RewriteWorker`（BullMQ）；`AiGateway.generateRewrite`（新增方法） |
| 新增前端组件 | `AiWorkspaceRewriteStageV2`、`RewriteViewpointPicker`、`RewriteRightPanel`（含子组件）；替换现有 `AiWorkspaceRewriteStageModern` |
| 新增 Hook | `useRewriteLocalState(videoId)` |
| 扩展 Controller | `useAiWorkspaceController` 新增仿写状态与方法 |
| 架构变更 | 无（Worker 模式、三层架构、AI Gateway 均复用现有模式）|

---

## 技术对齐结论

| 维度 | 结论 | 落点 |
|------|------|------|
| **"我的账号"过滤** | `DouyinAccount` 无 `type` 字段，"我的账号" = `userId = caller.id`。EMPLOYEE 调用 `GET /api/douyin-accounts` 时 Service 层已自动按 `userId` 过滤。前端以 `limit=100` 拉取全量，无需新增专属接口 | `douyinAccountService.listAccounts` 现有逻辑 |
| **API 路径** | 新路由使用 `ai-workspace`（单数，与 `ai-workspaces` 集合 API 区分），以 `videoId` 作为路径参数，对齐需求文档定义 | `src/app/api/ai-workspace/[videoId]/rewrite/` 新目录 |
| **Rewrite 懒创建** | `Rewrite` 记录在首次调用 `generate` 时创建（upsert），`GET` 时不自动创建。保持与 `AiRewriteDraft` 类似的懒创建语义 | `RewriteService.generate` |
| **版本号自增** | Service 层在事务内：`SELECT MAX(versionNumber) + 1 FROM rewrite_versions WHERE rewriteId = ?` 生成版本号，保障并发安全 | `RewriteRepository.createVersion` |
| **轮询方式** | 沿用转录阶段的 setTimeout 轮询（2s 间隔），不引入 SSE。生成时间预期 5-30s，轮询成本可接受 | `useAiWorkspaceController` 扩展 |
| **Worker 注册** | 在 `server-bootstrap.ts` 新增 `startRewriteWorker()`，与现有 `startTranscriptionWorker` 并列 | `src/lib/server-bootstrap.ts` |
| **AI 调用** | 新增 `aiGateway.generateRewrite(params)` 方法，接收已解析的模型配置和 Prompt 组件，内部调用 Vercel AI SDK `generateText`（非流式） | `src/server/services/ai-gateway.service.ts` |
| **Fragment 查询** | Worker 内直接通过 `prisma.fragment.findMany({ where: { id: { in: usedFragmentIds } } })` 批量读取，不引入新的 Repository 方法 | `src/lib/rewrite-worker.ts` |

---

## 数据模型变更

### 新增枚举

```prisma
enum RewriteVersionStatus {
  GENERATING
  COMPLETED
  FAILED
}
```

### 新增模型

```prisma
model Rewrite {
  id              String           @id @default(cuid())
  workspaceId     String           @unique        // v0.3.3 一工作台一仿写任务
  targetAccountId String?                         // 目标发布账号（nullable：账号被删时保留记录）
  organizationId  String
  userId          String
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  workspace     AiWorkspace      @relation(fields: [workspaceId], references: [id])
  targetAccount DouyinAccount?   @relation(fields: [targetAccountId], references: [id])
  organization  Organization     @relation(fields: [organizationId], references: [id])
  user          User             @relation(fields: [userId], references: [id])
  versions      RewriteVersion[]

  @@index([organizationId])
  @@index([userId])
  @@map("rewrites")
}

model RewriteVersion {
  id               String               @id @default(cuid())
  rewriteId        String
  versionNumber    Int                              // 每个 Rewrite 内自增（从 1 开始），Service 层事务保证
  generatedContent String?              @db.Text   // AI 生成原文
  editedContent    String?              @db.Text   // 用户编辑稿（优先展示）
  modelConfigId    String?                         // nullable：模型被删除时降级展示
  usedFragmentIds  Json                 @default("[]")  // string[]，存今日已选观点 IDs，无 FK
  userInputContent String?              @db.Text   // 临时素材
  status           RewriteVersionStatus @default(GENERATING)
  errorMessage     String?              @db.Text
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  rewrite     Rewrite        @relation(fields: [rewriteId], references: [id])
  modelConfig AiModelConfig? @relation(fields: [modelConfigId], references: [id], onDelete: SetNull)

  @@unique([rewriteId, versionNumber])
  @@index([rewriteId])
  @@map("rewrite_versions")
}
```

### 修改现有模型（反向关联补全）

```prisma
// AiWorkspace 新增（1:1 反向关联）
model AiWorkspace {
  // ...现有字段不变...
  rewrite Rewrite?           // 新增
}

// AiModelConfig 新增反向关联
model AiModelConfig {
  // ...现有字段不变...
  rewriteVersions RewriteVersion[]   // 新增
}

// Organization 新增反向关联
model Organization {
  // ...现有字段不变...
  rewrites Rewrite[]    // 新增
}

// User 新增反向关联
model User {
  // ...现有字段不变...
  rewrites Rewrite[]    // 新增
}

// DouyinAccount 新增反向关联
model DouyinAccount {
  // ...现有字段不变...
  rewrites Rewrite[]    // 新增
}
```

### 关系说明

- `AiWorkspace` 1:1 → `Rewrite`（`@unique workspaceId`，v0.3.3 限制；v0.3.3.1 可放开）
- `Rewrite` 1:N → `RewriteVersion`（每次点击「仿写」新增一版本）
- `Rewrite.targetAccountId` → `DouyinAccount`（nullable，账号被删后 Rewrite 仍保留）
- `RewriteVersion.modelConfigId` → `AiModelConfig`（nullable + `onDelete: SetNull`，模型被删后版本记录保留，模型名通过版本快照或前端兜底处理）
- `RewriteVersion.usedFragmentIds: Json`（存 `string[]`，不设外键，Fragment 被删后不影响版本记录）

---

## BullMQ 扩展

### `src/lib/bullmq.ts` 追加

```typescript
export const REWRITE_QUEUE_NAME = "rewrite";

export interface RewriteJobData {
  rewriteVersionId: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
}

let rewriteQueue: Queue<RewriteJobData> | null = null;

export function getRewriteQueue(): Queue<RewriteJobData> {
  if (!rewriteQueue) {
    rewriteQueue = new Queue<RewriteJobData>(REWRITE_QUEUE_NAME, {
      connection: createBullMQRedisConnection(),
      defaultJobOptions: {
        attempts: 3,           // 最多 3 次（含首次），重试 2 次
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 86_400 },  // 24h 后清理成功任务
        removeOnFail: false,                 // 失败任务保留便于排查
      },
    });
  }
  return rewriteQueue;
}
```

> 注：`attempts: 3` 与 TranscriptionQueue 对齐（TranscriptionQueue 设置 `attempts: 3`），实际重试 2 次。需求文档描述为"最多 2 次"（指重试次数），口径不同但行为一致。

### `src/lib/rewrite-worker.ts`（新建）

**Worker 执行流程（伪代码）**：

```
1. 从 job.data 取 rewriteVersionId、workspaceId、organizationId
2. prisma.rewriteVersion.findUnique(rewriteVersionId, { include: { rewrite: { include: { targetAccount } } } })
   → 若不存在则 throw（Job 会标记为失败，不重试）
3. prisma.aiWorkspace.findUnique(workspaceId, { include: { transcript, annotations(orderBy: createdAt asc) } })
4. const transcriptText = transcript.currentText ?? transcript.originalText ?? ""
5. const annotations = workspace.annotations
6. const fragments = usedFragmentIds.length > 0
     ? prisma.fragment.findMany({ where: { id: { in: usedFragmentIds } } })
     : []
7. const modelConfig = prisma.aiModelConfig.findUnique(version.modelConfigId!)
   → 若为 null（模型已删），throw AppError("AI_MODEL_NOT_FOUND", ..., 409)
8. const prompt = buildRewritePrompt({ targetAccount, annotations, transcriptText, fragments, userInputContent })
9. result = await aiGateway.generateRewrite({ modelConfig, systemPrompt, userPrompt })
10. 成功：prisma.rewriteVersion.update → { generatedContent: result.text, status: COMPLETED }
11. 失败（on failed 钩子，仅在 job.attemptsMade >= maxAttempts）：
    prisma.rewriteVersion.update → { status: FAILED, errorMessage }
```

**`globalThis.__rewriteWorkerInitialized`**（同 TranscriptionWorker 防重复启动）

---

## AI Prompt 设计

### 数据来源映射

| Prompt 变量 | 数据来源 |
|-------------|----------|
| `{targetAccount.nickname}` | `Rewrite.targetAccount.nickname`（DouyinAccount） |
| `{targetAccount.signature}` | `Rewrite.targetAccount.signature`（nullable，默认 "暂无"） |
| `{annotations}` | `AiWorkspace.annotations`（按 `createdAt ASC` 排序，来自 Worker 查询） |
| `{transcriptText}` | `AiWorkspaceTranscript.currentText ?? originalText` |
| `{usedFragments}` | `Fragment.content`，按 `usedFragmentIds` 批量查询（保持原顺序） |
| `{userInputContent}` | `RewriteVersion.userInputContent`（Worker 创建时已写入 DB） |

### System Prompt

```
你是一位短视频文案创作专家，擅长基于对标视频的内容框架，结合观点素材，创作适合特定账号风格的短视频文案。
```

### User Prompt 模板

```
【目标账号风格】
账号名称：{targetAccount.nickname}
账号简介：{targetAccount.signature ?? "暂无"}

【对标视频拆解框架】
以下是对标视频的拆解批注，每条批注说明了原文对应的写作手法或内容角色：
{annotations.map(a => `• "${a.quotedText}"：${a.note ?? a.function ?? "（无说明）"}`).join('\n')}

【对标视频原文案】
{transcriptText}

【本次仿写使用的观点素材】
{usedFragments.length > 0
  ? usedFragments.map(f => `• ${f.content}`).join('\n')
  : "（未选择观点，请基于框架结构自由创作）"}

{userInputContent?.trim() ? `【创作者补充的临时素材】\n${userInputContent.trim()}` : ""}

【创作要求】
请基于以上对标视频的框架结构，融入上述观点素材，为「{targetAccount.nickname}」这个账号创作一篇新的短视频文案。
要求：
1. 遵循对标视频的整体结构节奏，但内容不能重复原文
2. 将观点素材自然融入对应的框架位置
3. 语言风格贴合账号定位
4. 直接输出文案正文，不需要解释或说明
```

> **v0.3.3 边界**：目标账号仅注入 nickname + signature。历史仿写经验数据（待 M-006 复盘完成后）在后续版本追加注入。

---

## API 契约

### 通用约定

- 所有接口均需 `auth()` 鉴权，未登录返回 401
- 所有接口通过 `videoId` 解析 workspace（`findByVideoIdAndUserId(videoId, caller.id)`），workspace 不存在或无权限则返回 404/403
- 响应格式遵循 `{ success: boolean, data?, error? }`

---

### `GET /api/ai-workspace/[videoId]/rewrite`

**目的**：获取当前工作台的 Rewrite + 所有 RewriteVersion，供前端初始化仿写阶段状态

**鉴权**：`auth()` → EMPLOYEE+

**响应 200**：

```typescript
{
  success: true,
  data: {
    rewrite: RewriteDTO | null  // 若不存在则 null，前端据此判断"首次使用"
  }
}
```

```typescript
interface RewriteDTO {
  id: string;
  workspaceId: string;
  targetAccountId: string | null;
  organizationId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  versions: RewriteVersionDTO[];  // 按 versionNumber DESC
  targetAccount: {
    id: string;
    nickname: string;
    avatar: string;
    signature: string | null;
  } | null;
}

interface RewriteVersionDTO {
  id: string;
  rewriteId: string;
  versionNumber: number;
  generatedContent: string | null;
  editedContent: string | null;
  usedFragmentIds: string[];       // JSON 解析后的 string[]
  userInputContent: string | null;
  status: "GENERATING" | "COMPLETED" | "FAILED";
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  modelConfig: {
    id: string;
    name: string;
  } | null;                        // modelConfig 可为 null（模型已删）
}
```

**主要逻辑**：

1. `auth()` 获取 caller
2. 通过 `videoId + caller.id` 查 AiWorkspace（不存在返回 404）
3. `rewriteRepository.findByWorkspaceId(workspace.id)` → 含 versions（versionNumber DESC）+ targetAccount
4. 返回 `{ rewrite: dto | null }`

**错误码**：

| 状态码 | code | 场景 |
|--------|------|------|
| 401 | `UNAUTHORIZED` | 未登录 |
| 404 | `WORKSPACE_NOT_FOUND` | workspace 不存在 |
| 403 | `FORBIDDEN` | workspace 属于其他用户 |

---

### `POST /api/ai-workspace/[videoId]/rewrite/generate`

**目的**：发起一次仿写生成，创建新 RewriteVersion 并入队 BullMQ

**鉴权**：`auth()` → EMPLOYEE+

**请求体 Zod Schema**：

```typescript
const generateRewriteSchema = z.object({
  targetAccountId: z.string().cuid(),
  modelConfigId:   z.string().cuid(),
  usedFragmentIds: z.array(z.string().cuid()).default([]),
  userInputContent: z.string().max(500).optional(),
});
```

**响应 201**：

```typescript
{
  success: true,
  data: {
    rewriteVersionId: string;
    versionNumber: number;
  }
}
```

**主要逻辑**：

1. `auth()` 获取 caller
2. 解析并验证请求体
3. 通过 `videoId + caller.id` 查 AiWorkspace（不存在返回 404）
4. 检查 `workspace.annotations.length > 0`，否则返回 400（`ANNOTATIONS_REQUIRED`）
5. 检查 `targetAccountId` 归属：`douyinAccountRepository.findById(targetAccountId)` 验证 `account.userId === caller.id`，否则 403
6. 检查 `modelConfigId` 合法：`aiModelConfigRepository.findByIdRaw(modelConfigId)` 不存在返回 400
7. `rewriteService.generate(workspace.id, input, caller)` [见 Service 层设计]
8. 返回 `{ rewriteVersionId, versionNumber }`

**错误码**：

| 状态码 | code | 场景 |
|--------|------|------|
| 400 | `ANNOTATIONS_REQUIRED` | 工作台无拆解批注 |
| 400 | `MODEL_NOT_FOUND` | modelConfigId 不存在 |
| 403 | `ACCOUNT_ACCESS_DENIED` | targetAccountId 不属于调用者 |
| 404 | `WORKSPACE_NOT_FOUND` | workspace 不存在 |

---

### `PATCH /api/ai-workspace/[videoId]/rewrite/versions/[versionId]`

**目的**：保存用户对版本的编辑内容（防抖 1s 后自动调用）

**鉴权**：`auth()` → EMPLOYEE+

**请求体 Zod Schema**：

```typescript
const saveEditedContentSchema = z.object({
  editedContent: z.string().max(10_000),
});
```

**响应 200**：

```typescript
{
  success: true,
  data: {
    id: string;
    editedContent: string;
    updatedAt: string;
  }
}
```

**主要逻辑**：

1. `auth()` 获取 caller
2. 通过 `videoId + caller.id` 查 AiWorkspace（权限验证）
3. 查 `RewriteVersion(versionId)`，验证 `version.rewrite.workspaceId === workspace.id`，否则 404/403
4. 验证 version.status === `COMPLETED`（GENERATING 状态不允许编辑）
5. `prisma.rewriteVersion.update({ editedContent })`
6. 返回更新后的字段

**错误码**：

| 状态码 | code | 场景 |
|--------|------|------|
| 400 | `VERSION_NOT_EDITABLE` | version 处于 GENERATING 或 FAILED 状态 |
| 404 | `VERSION_NOT_FOUND` | versionId 不存在或不属于此 workspace |

---

## Service 层设计

### 新建 `src/server/services/rewrite.service.ts`

```typescript
class RewriteService {
  /**
   * 获取工作台的 Rewrite（含 versions + targetAccount）
   * - 不存在则返回 null（不自动创建）
   */
  async getOrNullByWorkspace(
    workspaceId: string,
    caller: SessionUser,
  ): Promise<RewriteDTO | null>

  /**
   * 发起仿写生成：
   * 1. upsert Rewrite（设 targetAccountId = input.targetAccountId）
   * 2. 事务内创建 RewriteVersion（versionNumber = MAX+1）
   * 3. 入队 BullMQ RewriteJob
   * 返回 { rewriteVersionId, versionNumber }
   */
  async generate(
    workspaceId: string,
    input: GenerateRewriteInput,
    caller: SessionUser,
  ): Promise<{ rewriteVersionId: string; versionNumber: number }>

  /**
   * 保存编辑内容（防抖调用）
   * - 验证 version 属于 caller 的 workspace
   * - 仅允许 COMPLETED 状态的版本编辑
   */
  async saveEditedContent(
    workspaceId: string,
    versionId: string,
    editedContent: string,
    caller: SessionUser,
  ): Promise<{ id: string; editedContent: string; updatedAt: string }>
}

export const rewriteService = new RewriteService();
```

**`GenerateRewriteInput`**：

```typescript
interface GenerateRewriteInput {
  targetAccountId: string;
  modelConfigId: string;
  usedFragmentIds: string[];
  userInputContent?: string;
}
```

**事务策略（`generate` 内）**：

```typescript
// 在单个 prisma.$transaction 内完成：
const rewrite = await prisma.rewrite.upsert({
  where: { workspaceId },
  create: { workspaceId, targetAccountId, organizationId, userId },
  update: { targetAccountId },  // 每次生成时更新目标账号
});

// 计算 versionNumber（在同一事务内，避免并发竞争）
const maxVersion = await prisma.rewriteVersion.aggregate({
  where: { rewriteId: rewrite.id },
  _max: { versionNumber: true },
});
const versionNumber = (maxVersion._max.versionNumber ?? 0) + 1;

const version = await prisma.rewriteVersion.create({
  data: {
    rewriteId: rewrite.id,
    versionNumber,
    modelConfigId,
    usedFragmentIds: usedFragmentIds,
    userInputContent,
    status: "GENERATING",
  },
});
```

---

### 新建 `src/server/repositories/rewrite.repository.ts`

```typescript
class RewriteRepository {
  async findByWorkspaceId(workspaceId: string): Promise<RewriteWithVersions | null>
    // include: versions(orderBy: versionNumber DESC) + targetAccount(select: id,nickname,avatar,signature)
    // include: versions.modelConfig(select: id,name)

  async upsertByWorkspace(data: UpsertRewriteData): Promise<Rewrite>
    // prisma.rewrite.upsert({ where: { workspaceId }, ... })

  async createVersion(data: CreateRewriteVersionData, tx: Prisma.TransactionClient): Promise<RewriteVersion>
    // 在事务内执行，版本号由 Service 层计算后传入

  async findVersionById(versionId: string): Promise<RewriteVersionWithRewrite | null>
    // include: rewrite(select: workspaceId)

  async updateVersionContent(versionId: string, editedContent: string): Promise<RewriteVersion>

  async markVersionCompleted(versionId: string, generatedContent: string): Promise<void>

  async markVersionFailed(versionId: string, errorMessage: string): Promise<void>
}

export const rewriteRepository = new RewriteRepository();
```

---

### 扩展 `src/server/services/ai-gateway.service.ts`

新增方法 `generateRewrite`：

```typescript
interface GenerateRewriteParams {
  modelConfig: AiModelConfig;
  systemPrompt: string;
  userPrompt: string;
}

interface GenerateRewriteResult {
  text: string;
  modelConfigId: string;
}

// 类内新增
async generateRewrite(params: GenerateRewriteParams): Promise<GenerateRewriteResult>
  // 使用 createOpenAI({ baseURL, apiKey }) + generateText({ model, messages })
  // messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
  // 超时：AbortSignal.timeout(120_000)（2 分钟）
```

---

## 前端组件设计

### 新建 `src/components/features/benchmarks/ai-workspace-rewrite-stage-v2.tsx`

**职责**：仿写阶段三栏布局容器，替换 `AiWorkspaceRewriteStageModern`。

```typescript
interface AiWorkspaceRewriteStageV2Props {
  // 左栏、中栏数据
  transcriptText: string;
  annotations: DecompositionAnnotation[];
  activeAnnotationId: string | null;
  onAnnotationSelect: (annotationId: string) => void;

  // 右栏数据（来自 controller + localState）
  rewrite: RewriteDTO | null;
  loadingRewrite: boolean;
  currentVersionId: string | null;
  isGenerating: boolean;       // 是否有版本处于 GENERATING

  // 右栏操作回调
  onVersionSwitch: (versionId: string) => void;
  onGenerateRewrite: (input: GenerateRewriteInput) => Promise<void>;
  onSaveEditedContent: (versionId: string, content: string) => void;  // debounce 在内部处理

  // 来自 localState hook（外部持久化）
  localState: RewriteLocalState;
  onLocalStateChange: (patch: Partial<RewriteLocalState>) => void;
}
```

**布局**：

```
┌──────────────────────────────────────────────────────┐
│  AiWorkspaceRewriteStageV2 (flex h-full)             │
│  ┌──────────┐  ┌────────────────┐  ┌──────────────┐ │
│  │ 左栏     │  │ 中栏           │  │ 右栏         │ │
│  │ ~25%     │  │ ~35%           │  │ ~40%         │ │
│  │ 批注列表 │  │ 转录文案全文   │  │ RewriteRight │ │
│  │ (只读)   │  │ (只读+高亮)   │  │ Panel        │ │
│  └──────────┘  └────────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────┘
```

- 左栏复用 `AiWorkspaceDecompositionPanel` 的批注列表渲染逻辑（只读模式）
- 中栏复用 `AiWorkspaceTranscriptCanvas` 的高亮渲染逻辑（只读模式）
- 右栏委托给 `RewriteRightPanel`

---

### 新建 `src/components/features/benchmarks/rewrite-viewpoint-picker.tsx`

**职责**：今日观点多选弹框（Dialog 形式）。

```typescript
interface RewriteViewpointPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;  // 关闭弹框时回传最终选中 IDs
}
```

**内部状态**：

- `localSelectedIds: string[]` — 弹框内临时选中（关闭后才同步到外部）
- `query: string` — 搜索词（debounce 300ms → 调 `/viewpoints?limit=50&scope=today&q=...`）
- `fragments: FragmentDTO[]` — 列表数据

**交互**：

- 打开时以 `selectedIds` 初始化 `localSelectedIds`
- 每条显示 checkbox + 观点前 100 字 + 创建者
- 底部「确认」按钮调 `onConfirm(localSelectedIds)` 并关闭

---

### 新建 `src/components/features/benchmarks/rewrite-right-panel.tsx`

**职责**：右栏整体操作区，从上至下包含 7 个区块。可进一步拆分为以下子组件（同文件或同目录）:

```typescript
interface RewriteRightPanelProps {
  annotations: DecompositionAnnotation[];     // 用于检查 annotations.length > 0
  rewrite: RewriteDTO | null;
  currentVersionId: string | null;
  isGenerating: boolean;
  localState: RewriteLocalState;
  onLocalStateChange: (patch: Partial<RewriteLocalState>) => void;
  onVersionSwitch: (versionId: string) => void;
  onGenerateRewrite: (input: GenerateRewriteInput) => Promise<void>;
  onSaveEditedContent: (versionId: string, content: string) => void;
}
```

**内部负责的 API 调用**（与 localState 配合）：

- 账号列表：`GET /api/douyin-accounts?limit=100` — 初始化时单次请求
- 模型列表：`GET /api/ai-config/settings` — 初始化时单次请求（取 `.modelConfigs`）
- 默认模型：从 `settings.bindings` 找 `step === 'REWRITE'` 的 `modelConfigId`

**「仿写」按钮禁用条件**（任一满足即禁用）：

```typescript
const isDisabled =
  annotations.length === 0 ||                             // 未完成拆解
  !localState.selectedAccountId ||                         // 未选目标账号
  !localState.selectedModelConfigId ||                     // 未选模型
  isGenerating;                                            // 有版本处于 GENERATING
```

**编辑区防抖保存**：内部持有 `debounceRef`，1s 防抖后调 `onSaveEditedContent`

---

### 修改 `src/components/features/benchmarks/ai-workspace-shell.tsx`

- 将 `AiWorkspaceRewriteStageModern` 替换为 `AiWorkspaceRewriteStageV2`
- 向 V2 传入 controller 提供的新 props（`rewrite`、`loadingRewrite`、`currentVersionId`、`isGenerating` 等）

---

## 本地状态持久化

### 新建 `src/lib/hooks/use-rewrite-local-state.ts`

**存储 key**：`rewrite:${videoId}`

**持久化内容**：

```typescript
interface RewriteLocalState {
  selectedFragmentIds: string[];   // 已选观点 IDs
  userInputContent: string;        // 临时素材文本
  selectedModelConfigId: string | null;
  selectedAccountId: string | null;
}
```

**Hook 接口**：

```typescript
function useRewriteLocalState(videoId: string | null): {
  localState: RewriteLocalState;
  setLocalState: (patch: Partial<RewriteLocalState>) => void;
  resetLocalState: () => void;
}
```

**实现要点**：

- 使用 `useEffect` 监听 `videoId` 变化，切换视频时从 localStorage 读取对应 key（无记录则返回默认值）
- `setLocalState(patch)` 合并更新并写入 localStorage
- `resetLocalState()` 清除当前 key 并还原默认值
- 默认值：`{ selectedFragmentIds: [], userInputContent: "", selectedModelConfigId: null, selectedAccountId: null }`
- SSR 安全：`typeof window === 'undefined'` 时返回默认值，跳过 localStorage 读写

---

## Controller 层扩展

### 修改 `src/components/features/benchmarks/ai-workspace-controller.ts`

**新增 state**：

```typescript
const [rewrite, setRewrite] = useState<RewriteDTO | null>(null);
const [loadingRewrite, setLoadingRewrite] = useState(false);
const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
const rewritePollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**新增派生值**：

```typescript
const isGenerating = useMemo(
  () => rewrite?.versions.some((v) => v.status === "GENERATING") ?? false,
  [rewrite],
);

const currentVersion = useMemo(
  () => rewrite?.versions.find((v) => v.id === currentVersionId) ?? rewrite?.versions[0] ?? null,
  [rewrite, currentVersionId],
);
```

**新增方法**：

```typescript
// 加载仿写数据（进入 rewrite 阶段时调用，或轮询刷新时调用）
const loadRewrite = useCallback(async (videoId: string) => {
  setLoadingRewrite(true);
  const { rewrite } = await apiClient.get(`/ai-workspace/${videoId}/rewrite`);
  setRewrite(rewrite);
  // 若 currentVersionId 已失效（版本被清），重置为最新
  if (!rewrite?.versions.find(v => v.id === currentVersionId)) {
    setCurrentVersionId(rewrite?.versions[0]?.id ?? null);
  }
  setLoadingRewrite(false);
}, [currentVersionId]);

// 切换版本
const handleVersionSwitch = useCallback((versionId: string) => {
  setCurrentVersionId(versionId);
}, []);

// 触发生成
const handleGenerateRewrite = useCallback(async (input: GenerateRewriteInput) => {
  const { rewriteVersionId, versionNumber } = await apiClient.post(
    `/ai-workspace/${video!.id}/rewrite/generate`, input
  );
  // 乐观更新：插入一个 GENERATING 状态的占位版本
  setRewrite(prev => prev ? {
    ...prev,
    versions: [
      { id: rewriteVersionId, versionNumber, status: "GENERATING", ... },
      ...prev.versions,
    ],
  } : null);
  setCurrentVersionId(rewriteVersionId);
}, [video]);

// 保存编辑（debounce 由 RewriteRightPanel 内部处理，这里只做 API 调用）
const handleSaveEditedContent = useCallback(async (versionId: string, content: string) => {
  await apiClient.patch(
    `/ai-workspace/${video!.id}/rewrite/versions/${versionId}`,
    { editedContent: content }
  );
}, [video]);
```

**轮询逻辑**：

```typescript
useEffect(() => {
  // 当 stage === 'rewrite' 且 isGenerating 时，启动轮询
  if (!video || stage !== "rewrite" || !isGenerating) {
    if (rewritePollTimerRef.current) {
      clearTimeout(rewritePollTimerRef.current);
      rewritePollTimerRef.current = null;
    }
    return;
  }

  let cancelled = false;
  const poll = async () => {
    await loadRewrite(video.id);
    if (!cancelled && isGenerating) {
      rewritePollTimerRef.current = setTimeout(poll, 2000);
    }
  };
  rewritePollTimerRef.current = setTimeout(poll, 2000);

  return () => {
    cancelled = true;
    if (rewritePollTimerRef.current) {
      clearTimeout(rewritePollTimerRef.current);
      rewritePollTimerRef.current = null;
    }
  };
}, [video, stage, isGenerating, loadRewrite]);
```

**在 `resetToInitialWorkspace` 中清空**：

```typescript
setRewrite(null);
setLoadingRewrite(false);
setCurrentVersionId(null);
```

**在切换到 rewrite stage 时加载**：在 `applyWorkspace` 或 stage 变为 `"rewrite"` 时调用 `loadRewrite(video.id)`。

---

## 新增 `src/types/rewrite.ts`

```typescript
export type RewriteVersionStatus = "GENERATING" | "COMPLETED" | "FAILED";

export interface RewriteVersionDTO {
  id: string;
  rewriteId: string;
  versionNumber: number;
  generatedContent: string | null;
  editedContent: string | null;
  usedFragmentIds: string[];
  userInputContent: string | null;
  status: RewriteVersionStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  modelConfig: { id: string; name: string } | null;
}

export interface RewriteDTO {
  id: string;
  workspaceId: string;
  targetAccountId: string | null;
  organizationId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  versions: RewriteVersionDTO[];
  targetAccount: {
    id: string;
    nickname: string;
    avatar: string;
    signature: string | null;
  } | null;
}

export interface GenerateRewriteInput {
  targetAccountId: string;
  modelConfigId: string;
  usedFragmentIds: string[];
  userInputContent?: string;
}
```

---

## 文件结构

### 后端（新建/修改）

```
prisma/
  schema.prisma                              【修改】新增 Rewrite、RewriteVersion 模型及关联
  migrations/
    YYYYMMDD_add_rewrite_models/             【新建】Prisma 迁移
      migration.sql

src/
  lib/
    bullmq.ts                                【修改】新增 REWRITE_QUEUE_NAME、RewriteJobData、getRewriteQueue
    rewrite-worker.ts                        【新建】RewriteWorker 实现
    server-bootstrap.ts                      【修改】新增 startRewriteWorker() 调用
  server/
    repositories/
      rewrite.repository.ts                  【新建】RewriteRepository
    services/
      rewrite.service.ts                     【新建】RewriteService
      ai-gateway.service.ts                  【修改】新增 generateRewrite 方法
  app/
    api/
      ai-workspace/
        [videoId]/
          rewrite/
            route.ts                         【新建】GET
            generate/
              route.ts                       【新建】POST
            versions/
              [versionId]/
                route.ts                     【新建】PATCH
  types/
    rewrite.ts                               【新建】RewriteDTO、RewriteVersionDTO、GenerateRewriteInput
```

### 前端（新建/修改）

```
src/
  lib/
    hooks/
      use-rewrite-local-state.ts             【新建】localStorage 持久化 hook
  components/
    features/
      benchmarks/
        ai-workspace-rewrite-stage-v2.tsx    【新建】三栏布局容器（替换 Modern）
        rewrite-viewpoint-picker.tsx         【新建】观点多选弹框
        rewrite-right-panel.tsx              【新建】右栏操作区（含账号/模型/版本/编辑区）
        ai-workspace-controller.ts           【修改】新增 rewrite 状态、generate/switch/save 方法、轮询逻辑
        ai-workspace-shell.tsx               【修改】替换 AiWorkspaceRewriteStageModern → V2，传入新 props
```

---

## 风险与边界

### 实现风险

| 风险 | 描述 | 缓解措施 |
|------|------|----------|
| **版本号并发** | 两个请求同时创建版本可能产生同一 versionNumber | 通过 Prisma 事务 + `@@unique([rewriteId, versionNumber])` 保障，冲突时事务回滚；极端场景报错提示用户重试 |
| **AI 生成超时** | generateText 无限等待 | 设置 `AbortSignal.timeout(120_000)`，超时按失败处理，Worker 重试策略兜底 |
| **Rewrite.targetAccountId 外键漂移** | 用户删除账号后 targetAccountId 对应记录消失 | `@relation(onDelete: SetNull)` 仅适用于可选字段；此处 `targetAccountId` 可 null + 不设 onDelete（MySQL InnoDB 默认 RESTRICT），实际操作是管理员删账号时需先清除关联或接受 soft-delete 保护 |
| **modelConfigId 外键漂移** | 模型配置被删，`RewriteVersion.modelConfigId` 对应记录消失 | `@relation(onDelete: SetNull)` 已处理，删除后 `modelConfigId → null`，前端按 "模型已删除" 降级展示 |
| **Worker 进程崩溃** | 版本状态卡在 GENERATING | BullMQ `removeOnFail: false` 保留失败 Job，但进程崩溃时 BullMQ Stalled 机制会在超时后将 Job 状态设为 stalled 并触发失败回调 |
| **前端轮询竞争** | 多个 effect 同时轮询 | 通过单一 `rewritePollTimerRef` + `cancelled` flag 保障，与现有转录轮询模式一致 |

### 非目标（本版明确不做）

- 不依赖拆解视频的直接创作入口（→ v0.3.3.1）
- 一个工作台多个 Rewrite 实体（→ v0.3.3.1 可放开 `@unique`）
- 历史仿写经验注入 Prompt（→ M-006 发布复盘完成后）
- 「标记最终稿」标记（→ 未来版本按需加入）
- 版本数量上限限制（本版无限制）
- Prompt 模板管理（→ F-005-3）
- 仿写结果与我的账号发布视频关联（→ M-006 F-006-1）
- `AiWorkspaceRewriteStageModern` 文件删除（本版仅停止引用，文件保留待确认后清理）

---

## 架构师自省

### 1. 设计决策值得后续版本回顾

**① `workspaceId @unique` 的弃用时机**

v0.3.3 的 `Rewrite.workspaceId @unique` 约束在 v0.3.3.1 需要放开（支持不依赖拆解的独立创作）。放开时需：(a) 删除 `@unique` 约束并迁移，(b) 相关 API 的"懒创建（upsert by workspaceId）"逻辑需重构为"显式创建"。建议届时同步设计 Rewrite 的创建/列表 API。

**② `targetAccountId` 的 onDelete 策略**

当前设计在 MySQL + Prisma 下 DouyinAccount 删除时会受到外键 RESTRICT 限制，无法直接删号（会有外键冲突）。这一 Schema 约束需在删号逻辑中明确处理（先清除 `Rewrite.targetAccountId`，或将 DouyinAccount 改为软删除）。建议 v0.3.4 之前明确删号业务逻辑。

**③ 轮询 vs Server-Sent Events**

当前选择简单轮询（同转录阶段），适合当前并发量。若后续生成量增大，建议引入 SSE 或 WebSocket 推送，按需迭代。

**④ `AiWorkspaceRewriteStageModern` 的清理时机**

本版仅停止引用旧组件但不删除文件，建议在测试确认 V2 稳定后（预计 v0.3.4 或 v0.3.3.1 完成后）统一清理旧文件，并关闭对应技术债任务。

**⑤ `userInputContent` 的存储位置**

当前 `userInputContent` 同时存 localStorage（快速读写）和 DB（随版本持久化）。两处不同步是预期行为（localStorage 是"当前编辑中的草稿"，DB 是"生成时快照"）。若未来需要跨设备同步临时素材，需重新设计。

---

### 2. 需求文档边界建议（供 PM 参考）

| 序号 | 位置 | 问题描述 | 建议补充 |
|------|------|----------|----------|
| 1 | F-005-1-B §4 | 「仅 MY_ACCOUNT 类型」的描述 - 当前 Schema 无 `type` 字段，所有 DouyinAccount 均属于 `userId` 对应的员工，不存在"类型"区分 | 建议修改为「仅当前员工自己添加的抖音账号（userId = 当前用户）」，避免歧义 |
| 2 | F-005-1-D | 「重试策略：最多 2 次，指数退避」- 歧义：是总执行 2 次（1次+1重试）还是重试 2 次（共3次）？ | 建议明确为「总计最多 3 次尝试（首次 + 重试 2 次）」，与转录队列策略对齐 |
| 3 | F-005-1-F §PATCH | 「保存编辑内容」接口目前未规定字数上限 | 建议明确 `editedContent` 的最大长度（推荐与生成内容同级：10,000 字） |
| 4 | F-005-1-A/B | 「左栏和中栏仅展示」- 未说明当工作台 `annotations.length === 0` 时左栏/中栏的空状态展示 | 建议在 F-005-1-A 中补充：左栏无批注时展示"暂无拆解批注"空状态；中栏无转录文案时展示对应提示 |
| 5 | F-005-1-B §5 | 版本面板「版本 N + 创建时间 + 所用模型名」- 当模型已被删除（modelConfig = null）时显示什么 | 建议补充：模型已删除时显示「已删除模型」灰色文本 |
| 6 | F-005-1-B §6 | 「已有编辑内容时再次点击「仿写」弹出确认对话框」- 触发条件不够精确：是"当前版本的 editedContent 非空"还是"任意版本有编辑内容" | 建议明确：仅当**当前展示版本**的 `editedContent` 非空时才弹确认（其他版本不影响） |
| 7 | 通用 | 仿写版本的「当前激活版本」语义未在需求中明确定义 - 当前设计默认取 `versionNumber` 最大的版本，但有没有其他语义（如用户最后切换到的版本）？ | 建议 PM 明确「当前版本」的定义：默认为最新创建，切换后跟随用户选中 |
