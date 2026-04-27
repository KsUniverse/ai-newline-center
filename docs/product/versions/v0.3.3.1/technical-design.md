# v0.3.3.1 技术设计方案

> 版本: v0.3.3.1
> 创建日期: 2026-04-26
> 功能范围: AI 直接创作入口（不依赖拆解视频，纯观点+主题创作）

---

## 摘要

| 项目 | 内容 |
|------|------|
| 涉及模块 | 扩展：仿写生成（rewrite）；新增：直接创作页 |
| 数据库变更 | `Rewrite.workspaceId` 改为 `String?`（nullable，保留 `@unique`）；新增 `Rewrite.topic` 字段（String?）；新增 `Rewrite.mode` 枚举字段（WORKSPACE / DIRECT）；新增数据库索引 |
| 新增 API | `POST /api/rewrites/direct/generate`（创建任务或追加版本）、`GET /api/rewrites/direct/[rewriteId]`、`PATCH /api/rewrites/direct/[rewriteId]/versions/[versionId]` |
| 复用服务 | `RewriteService`（新增 `generateDirect` 方法）；`RewriteRepository`（新增查询方法）；`RewriteWorker`（新增直接创作 Prompt 分支） |
| 新增前端组件 | `DirectCreatePage`（路由 `/rewrites/new`）；`DirectCreatePanel`（两栏布局）；复用 `ViewpointPicker`、版本切换逻辑 |
| 新增 Hook | `useDirectCreateLocalState()`（localStorage 持久化） |
| 扩展 bullmq | `RewriteJobData` 新增 `mode: "workspace" \| "direct"` 字段 |
| 架构变更 | `Rewrite.workspaceId` nullable；新增独立 API 路由前缀 `/api/rewrites/direct/` |

---

## 技术对齐结论

| 维度 | 结论 | 落点 |
|------|------|------|
| **任务/版本语义** | `Rewrite` 表示一次 AI 创作任务；`RewriteVersion` 表示该任务内的一次生成结果。首次直接创作创建 DIRECT Rewrite，后续同任务再生成只追加 RewriteVersion | `RewriteService.generateDirect` |
| **Rewrite 模型扩展** | `workspaceId` 改为可空，保留 `@unique`（MySQL 允许多个 NULL），同一用户可有多个 DIRECT 创作任务。新增 `mode` 枚举字段区分创作来源 | `prisma/schema.prisma` + 迁移 |
| **topic 字段** | 新增 `Rewrite.topic String?`，存储直接创作时的主题/指令文本。Workspace 模式下此字段为 null | `Rewrite` 模型 |
| **API 路由隔离** | 直接创作 API 使用独立路由前缀 `/api/rewrites/direct/`，与工作台路由 `/api/ai-workspace/[videoId]/rewrite/` 保持隔离，避免参数混用 | `src/app/api/rewrites/direct/` |
| **Service 扩展** | `RewriteService` 新增 `generateDirect` 方法：无 `rewriteId` 时创建任务 + 版本 1；有 `rewriteId` 时校验 DIRECT 任务归属，更新任务级 topic/targetAccountId 为本次输入，再追加新版本。跳过 workspace + annotation 检查，其余（targetAccount 验权、modelConfig 校验、版本号事务自增）逻辑复用 | `rewrite.service.ts` |
| **Worker 复用** | `RewriteWorker` 根据 `mode` 字段选择 Prompt 分支：`direct` 模式时跳过 workspace 查询，使用 `buildDirectRewriteUserPrompt(topic, fragments, account)` | `src/lib/rewrite-worker.ts` |
| **前端路由** | 直接创作作为独立页面 `/rewrites/new`，而不是嵌入工作台，避免三栏布局的复杂性 | `src/app/(dashboard)/rewrites/new/page.tsx` |
| **UI 布局** | 两栏：左侧输入区（观点选择 + 主题 + 账号 + 模型），右侧结果区（版本切换 + 编辑区）。复用 `ViewpointPicker`、版本 Badge、自动保存逻辑 | `DirectCreatePanel` |
| **localStorage** | 独立 key `ai_direct_create_state`（不按 videoId 分组），存储 currentRewriteId、fragmentIds、userInputContent、topic、modelConfigId、targetAccountId | `use-direct-create-local-state.ts` |
| **导航入口** | 侧边栏"AI 工作区"分区新增"直接创作"导航项；导航配置落在 `app-navigation.ts`，由 `AppSidebar` 渲染 | `app-navigation.ts` |

---

## 数据模型变更

### Prisma Schema

```prisma
// 新增枚举
enum RewriteMode {
  WORKSPACE  // 来自 AI 工作台（对标视频拆解）
  DIRECT     // 直接创作（无对标视频）
}

// 修改 Rewrite 模型
model Rewrite {
  id              String       @id @default(cuid())
  workspaceId     String?                          // nullable（直接创作时为 null）
  mode            RewriteMode  @default(WORKSPACE)  // 新增，区分创作来源
  topic           String?      @db.Text             // 新增，直接创作时的主题/指令
  targetAccountId String?
  organizationId  String
  userId          String
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  workspace     AiWorkspace?     @relation(fields: [workspaceId], references: [id])
  targetAccount DouyinAccount?   @relation(fields: [targetAccountId], references: [id], onDelete: SetNull)
  organization  Organization     @relation(fields: [organizationId], references: [id])
  user          User             @relation(fields: [userId], references: [id])
  versions      RewriteVersion[]

  @@unique([workspaceId])     // 保留约束，仅对非 null workspaceId 生效（partial unique）
  @@index([organizationId])
  @@index([userId])
  @@index([mode, userId])     // 新增，支持按 mode 过滤
  @@map("rewrites")
}
```

> **注意**：MySQL 中 `@unique` 对 nullable 字段的行为是允许多个 NULL 值（NULL != NULL），因此 `workspaceId` 改为 nullable 后，`@unique` 约束仍可保留，直接创作记录（workspaceId=null）不会触发唯一约束冲突。**无需额外 partial unique index**，现有 `@unique` 约束语义已满足需求。

### 迁移策略

1. 新建迁移：`workspaceId` 改为 nullable，添加 `mode` 枚举字段（默认 WORKSPACE），添加 `topic` 字段
2. 现有 WORKSPACE 模式记录自动继承 `mode=WORKSPACE`，无数据兼容性问题

---

## API 设计

### POST /api/rewrites/direct/generate

**请求体**（Zod schema）：

```ts
const DirectGenerateSchema = z.object({
  rewriteId: z.string().cuid().optional(),
  targetAccountId: z.string().cuid(),
  modelConfigId:   z.string().cuid(),
  usedFragmentIds: z.array(z.string()).default([]),
  userInputContent: z.string().max(2000).optional(),
  topic:           z.string().min(1).max(500),
});
```

**响应**：`{ rewriteId, rewriteVersionId, versionNumber }`

**语义**：
- `rewriteId` 为空：创建新的 DIRECT 创作任务，并创建版本 1
- `rewriteId` 有值：校验该 DIRECT 创作任务属于当前用户，更新任务级 topic/targetAccountId 为本次输入，并在同一任务下追加新版本

**权限**：`auth()` + EMPLOYEE 及以上角色

### GET /api/rewrites/direct/[rewriteId]

返回 `RewriteDTO`（含 versions），复用现有 DTO 结构。

**权限**：`auth()` + 仅 `rewrite.userId === caller.id`（个人数据隔离）

### PATCH /api/rewrites/direct/[rewriteId]/versions/[versionId]

**请求体**：`{ editedContent: string }`

复用工作台版本的编辑保存逻辑。

---

## 服务层设计

### RewriteService.generateDirect

```ts
async generateDirect(
  input: DirectGenerateRewriteInput,  // 含 topic 字段
  caller: SessionUser,
): Promise<{ rewriteId: string; rewriteVersionId: string; versionNumber: number }>
```

逻辑：
1. 验证 `targetAccount` 属于 caller（复用现有 `findOwnedMyAccount`）
2. 验证 `modelConfig` 存在
3. 根据 `input.rewriteId` 分支：
   - 无 `rewriteId`：事务内 `create Rewrite`（mode=DIRECT, workspaceId=null, topic=...）+ `createVersion`（版本号从 1 开始）
   - 有 `rewriteId`：事务内校验 `findByIdAndUser(mode=DIRECT)`，更新 `Rewrite.topic` / `targetAccountId`，再 `createNextVersion`
4. 入队 `REWRITE_QUEUE_NAME`，jobData 新增 `mode: "direct"`，`workspaceId` 为空

### RewriteWorker 直接创作分支

```ts
if (jobData.mode === "direct") {
  // 不查 workspace，不查 annotations，不查 transcript
  // 只需 rewrite.topic + fragments + targetAccount
  const prompt = buildDirectRewriteUserPrompt({ topic, fragments, targetAccount });
} else {
  // 原有 workspace 路径
}
```

新增 `buildDirectRewriteUserPrompt`：

```
【目标账号风格】
账号名称：${nickname}
账号简介：${signature}

【创作主题/指令】
${topic}

【本次创作使用的观点素材】
${fragments}

【临时素材】（可选）
${userInputContent}

【创作要求】
请基于上述主题和观点素材，为「${nickname}」这个账号创作一篇完整的短视频文案...
```

---

## 前端组件设计

### 路由

```
src/app/(dashboard)/rewrites/
  new/
    page.tsx          ← DirectCreatePage
```

### DirectCreatePanel（两栏布局）

```tsx
<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
  {/* 左栏：输入区 */}
  <div className="flex flex-col gap-4">
    {/* 观点选择 */}
    {/* 临时素材 */}
    {/* 创作主题/指令 */}
    {/* 目标账号 */}
    {/* AI 模型 */}
    {/* 「创作」按钮 */}
    {/* 「新建任务」按钮 */}
  </div>

  {/* 右栏：结果区 */}
  <div className="flex flex-col gap-4">
    {/* 版本 Badge / 下拉 */}
    {/* 生成结果编辑区 */}
  </div>
</div>
```

复用组件：
- `ViewpointPicker`（完全复用）
- 版本切换逻辑（从 `AiRewritePanel` 抽离或复用）
- `AlertDialog` 确认重新生成
- 防抖自动保存（与 v0.3.3 保持一致）
- 生成期间禁用输入区和「创作」按钮，避免同一任务内并发生成时上下文错配

### useDirectCreateLocalState

```ts
const STORAGE_KEY = "ai_direct_create_state";
// 存储: { currentRewriteId, fragmentIds, userInputContent, topic, modelConfigId, targetAccountId }
```

### 导航入口

`app-navigation.ts` 在"工作区"分区添加"直接创作"导航项，使用 `PenLine` 图标，指向 `/rewrites/new`，由 `AppSidebar` 统一渲染。

---

## 类型扩展

```ts
// src/types/ai-workspace.ts 新增
export interface DirectGenerateRewriteInput {
  rewriteId?: string;
  targetAccountId: string;
  modelConfigId: string;
  usedFragmentIds: string[];
  userInputContent?: string;
  topic: string;
}
```

---

## 文件变更清单

### 后端

| 文件 | 变更 |
|------|------|
| `prisma/schema.prisma` | `Rewrite.workspaceId` nullable；新增 `mode`、`topic` 字段 |
| `prisma/migrations/...` | 新建迁移文件 |
| `src/lib/bullmq.ts` | `RewriteJobData` 新增 `mode: "workspace" \| "direct"`，`workspaceId` 改为可选 |
| `src/lib/rewrite-worker.ts` | 新增直接创作 Prompt 分支 |
| `src/server/repositories/rewrite.repository.ts` | 新增 `createDirect`、`findByIdAndUser` 方法 |
| `src/server/services/rewrite.service.ts` | 新增 `generateDirect`、`getDirectRewrite`、`saveDirectVersionEdit` 方法 |
| `src/app/api/rewrites/direct/generate/route.ts` | 新建 |
| `src/app/api/rewrites/direct/[rewriteId]/route.ts` | 新建 |
| `src/app/api/rewrites/direct/[rewriteId]/versions/[versionId]/route.ts` | 新建 |
| `src/types/ai-workspace.ts` | 新增 `DirectGenerateRewriteInput`、`RewriteMode` 类型 |

### 前端

| 文件 | 变更 |
|------|------|
| `src/app/(dashboard)/rewrites/new/page.tsx` | 新建 |
| `src/components/features/rewrites/direct-create-panel.tsx` | 新建 |
| `src/components/features/rewrites/direct-create-page.tsx` | 新建 |
| `src/lib/hooks/use-direct-create-local-state.ts` | 新建 |
| `src/components/shared/layout/app-navigation.ts` | 新增"直接创作"导航项 |

---

## 架构合规性检查

| 约束 | 状态 |
|------|------|
| API 路由 → Service → Repository 三层架构 | ✅ |
| 禁止在 Route Handler 直接调用 Prisma | ✅ |
| 认证通过 `auth()` 获取 session | ✅ |
| 环境变量通过 `env.ts` 管理 | ✅ |
| 统一返回格式 `{ success, data?, error? }` | ✅ |
| AI 调用统一走 AiGateway | ✅ |
| organizationId 数据隔离 | ✅ |
| Rewrite 直接创作个人数据隔离（userId 校验） | ✅ |
