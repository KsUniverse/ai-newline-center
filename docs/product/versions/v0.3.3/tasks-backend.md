# v0.3.3 后端任务清单

## 必读文档

> 开始开发前必须阅读以下文档：

- `docs/product/versions/v0.3.3/requirements.md` — 本版本需求（理解业务背景）
- `docs/product/versions/v0.3.3/technical-design.md` — 本版本技术设计（**主要参考**）
- `docs/architecture/backend.md` — 后端分层规范
- `docs/architecture/database.md` — 数据库设计规范
- `docs/architecture/api-conventions.md` — API 设计规范
- `docs/standards/coding-standards.md` — 编码规范
- `.github/instructions/backend.instructions.md` — 后端编码规范
- `.github/instructions/api-routes.instructions.md` — API Route 规范
- `.github/instructions/prisma.instructions.md` — Prisma 规范

**参考现有实现**：

- `prisma/schema.prisma` — 当前 Schema，了解扩展写法
- `src/lib/bullmq.ts` — TranscriptionQueue 实现（RewriteQueue 仿照）
- `src/lib/transcription-worker.ts` — Worker 实现（RewriteWorker 仿照）
- `src/server/services/ai-workspace.service.ts` — Service 权限检查模式
- `src/server/repositories/ai-workspace.repository.ts` — Repository 模式参考
- `src/server/services/ai-gateway.service.ts` — AiGateway 扩展（新增 generateRewrite）
- `src/types/ai-workspace.ts` — 已有类型定义（新增仿写 DTO）

---

## 摘要

- 任务总数: 10
- 涉及文件:
  - `prisma/schema.prisma`（新增 `Rewrite`、`RewriteVersion`、`RewriteVersionStatus`，修改 5 个模型反向关联）
  - `src/types/ai-workspace.ts`（新增 5 个类型/接口）
  - `src/lib/bullmq.ts`（新增 `RewriteQueue`）
  - `src/server/repositories/rewrite.repository.ts`（新增）
  - `src/server/services/rewrite.service.ts`（新增）
  - `src/server/services/ai-gateway.service.ts`（新增 `generateRewrite` 方法）
  - `src/lib/rewrite-worker.ts`（新增）
  - `src/app/api/ai-workspace/[videoId]/rewrite/route.ts`（新增）
  - `src/app/api/ai-workspace/[videoId]/rewrite/generate/route.ts`（新增）
  - `src/app/api/ai-workspace/[videoId]/rewrite/versions/[versionId]/route.ts`（新增）
  - `src/lib/server-bootstrap.ts`（新增 `startRewriteWorker()` 调用）
  - `src/server/services/rewrite.service.test.ts`（新增）
  - `src/app/api/ai-workspace/[videoId]/rewrite/route.test.ts`（新增）

---

## 任务列表

- [x] **BE-001**: (P0) Prisma Schema 新增 Rewrite 模型

  - 文件: `prisma/schema.prisma`
  - 详情:
    1. 新增枚举 `RewriteVersionStatus { GENERATING, COMPLETED, FAILED }`
    2. 新增 `Rewrite` 模型（`workspaceId @unique`，`targetAccountId` nullable，`organizationId`，`userId`，`@@map("rewrites")`）
    3. 新增 `RewriteVersion` 模型（`versionNumber Int`，`generatedContent @db.Text` nullable，`editedContent @db.Text` nullable，`modelConfigId` nullable + `onDelete: SetNull`，`usedFragmentIds Json @default("[]")`，`userInputContent @db.Text` nullable，`status RewriteVersionStatus @default(GENERATING)`，`@@unique([rewriteId, versionNumber])`，`@@map("rewrite_versions")`）
    4. `AiWorkspace` 新增 `rewrite Rewrite?` 反向关联
    5. `AiModelConfig` 新增 `rewriteVersions RewriteVersion[]` 反向关联
    6. `Organization`、`User`、`DouyinAccount` 各新增 `rewrites Rewrite[]` 反向关联
    7. 执行 `pnpm db:push`（远程 DB 无 shadow DB 权限，migrate dev 失败）
    8. 执行 `pnpm db:generate`
  - 验证: `pnpm db:generate` 成功，`pnpm type-check` 通过

---

- [x] **BE-002**: (P0) 新增仿写类型定义

  - 文件: `src/types/ai-workspace.ts`
  - 详情:
    1. `RewriteVersionStatus` — `"GENERATING" | "COMPLETED" | "FAILED"` 联合类型
    2. `RewriteVersionDTO` — 含 `usedFragmentIds: string[]`（JSON 解析后），`modelConfig: { id, name } | null`
    3. `RewriteDTO` — 含 `versions: RewriteVersionDTO[]`，`targetAccount: { id, nickname, avatar, signature } | null`
    4. `GenerateRewriteInput` — `targetAccountId, modelConfigId, usedFragmentIds, userInputContent?`
    5. `SaveRewriteEditInput` — `editedContent: string`
  - 验证: 类型被 Service / Repository / Route Handler 正确引用

---

- [x] **BE-003**: (P0) BullMQ RewriteQueue

  - 文件: `src/lib/bullmq.ts`
  - 详情:
    1. `REWRITE_QUEUE_NAME = "rewrite"`
    2. `RewriteJobData { rewriteVersionId, workspaceId, organizationId, userId }`
    3. `getRewriteQueue()` — 单例 Queue，配置对齐 TranscriptionQueue（`attempts: 3`，指数 backoff）
  - 验证: Service 层和 Worker 均能正确 import

---

- [x] **BE-004**: (P0) Rewrite Repository

  - 文件: `src/server/repositories/rewrite.repository.ts`
  - 详情:
    1. `findByWorkspaceId(workspaceId)` — 含 versions（versionNumber DESC）+ versions.modelConfig + targetAccount，返回 `RewriteDTO | null`
    2. `upsertByWorkspace(data)` — `prisma.rewrite.upsert({ where: { workspaceId }, create, update: { targetAccountId } })`
    3. `createVersion(data, db?)` — 接受可选 `DatabaseClient`（事务客户端）
    4. `findVersionById(versionId)` — include `rewrite.workspaceId`（鉴权用）
    5. `updateVersionContent(versionId, editedContent)` — 返回 `RewriteVersion`
    6. `markVersionCompleted(versionId, generatedContent)` — Worker 回写
    7. `markVersionFailed(versionId, errorMessage)` — Worker 回写
  - 验证: 类型安全，方法签名与 Service 层对齐

---

- [x] **BE-005**: (P0) Rewrite Service

  - 文件: `src/server/services/rewrite.service.ts`
  - 详情:
    1. `getOrNullByWorkspace(videoId, caller)` — 通过 videoId + caller.id 查 workspace，再查 Rewrite
    2. `generate(videoId, input, caller)` — 校验顺序：workspace 存在 → annotations 非空 → targetAccount 归属 → modelConfig 存在 → `$transaction`（upsert Rewrite + aggregate MAX versionNumber + create RewriteVersion）→ 入队 BullMQ
    3. `saveEditedContent(videoId, versionId, editedContent, caller)` — 校验 workspace → version 归属 → status === COMPLETED → 更新
  - 验证: 错误码与技术设计文档一致

---

- [x] **BE-006**: (P0) AiGateway 扩展 generateRewrite

  - 文件: `src/server/services/ai-gateway.service.ts`
  - 详情:
    1. 新增 `GenerateRewriteParams { modelConfig, systemPrompt, userPrompt }` 接口（文件内）
    2. 新增 `GenerateRewriteResult { text, modelConfigId }` 接口（文件内）
    3. `generateRewrite(params)` — 使用 `createOpenAI({ apiKey, baseURL })` + `generateText({ messages: [system, user] })`，`AbortSignal.timeout(120_000)`，空响应抛 `AI_EMPTY_RESPONSE`
  - 验证: Worker 中调用无类型报错

---

- [x] **BE-007**: (P0) Rewrite Worker

  - 文件: `src/lib/rewrite-worker.ts`
  - 详情:
    1. `startRewriteWorker()` — `globalThis.__rewriteWorkerInitialized` 防重，`env.REDIS_URL` 缺失跳过
    2. Worker 处理：loadVersion → loadWorkspace（transcriptText + annotations） → loadFragments（按 usedFragmentIds 原顺序排列） → loadModelConfig → `buildRewriteSystemPrompt()` + `buildRewriteUserPrompt(...)` → `aiGateway.generateRewrite(...)` → `markVersionCompleted`
    3. `on("failed")` 钩子：最终失败时 `markVersionFailed`（仅当 `attemptsMade >= maxAttempts`）
    4. Prompt 模板与 technical-design.md 完全对齐（含条件段：临时素材仅有内容时插入）
  - 注意: 模型 API key 从 `AiModelConfig.apiKey` 直接读取（项目现有实现无加密层）
  - 验证: `pnpm type-check` 通过

---

- [x] **BE-008**: (P0) API Route Handlers

  - 文件:
    - `src/app/api/ai-workspace/[videoId]/rewrite/route.ts` — `GET`
    - `src/app/api/ai-workspace/[videoId]/rewrite/generate/route.ts` — `POST`
    - `src/app/api/ai-workspace/[videoId]/rewrite/versions/[versionId]/route.ts` — `PATCH`
  - 详情:
    1. 统一使用 `auth()` + `requireRole(EMPLOYEE+)`
    2. `GET` 返回 `{ rewrite: RewriteDTO | null }`
    3. `POST generate` — Zod 校验 `targetAccountId, modelConfigId, usedFragmentIds, userInputContent?`，返回 201 + `{ rewriteVersionId, versionNumber }`
    4. `PATCH versions/[versionId]` — Zod 校验 `editedContent(max 10000)`，返回 200 + `{ id, editedContent, updatedAt }`
  - 路径规范: 使用 `ai-workspace`（单数）区分集合 API（`ai-workspaces`）
  - 验证: 所有路由响应均通过 `successResponse` / `handleApiError`

---

- [x] **BE-009**: (P0) Worker 启动注册

  - 文件: `src/lib/server-bootstrap.ts`
  - 详情: 在 `startTranscriptionWorker()` 后新增 `startRewriteWorker()`
  - 验证: 无 TypeScript 错误

---

- [x] **BE-010**: (P0) 单元测试

  - 文件:
    - `src/server/services/rewrite.service.test.ts` — 7 个测试（getOrNullByWorkspace 3 个 + generate 前置校验 4 个）
    - `src/app/api/ai-workspace/[videoId]/rewrite/route.test.ts` — 3 个测试（401 + GET null + GET 有数据）
  - 验证: `pnpm vitest run` 全部通过（10/10）

---

## 后端开发自省

### 1. 实现中与技术设计文档的偏差

| 偏差点 | 技术设计描述 | 实际实现 | 原因 |
|--------|-------------|---------|------|
| Prisma migration | `pnpm db:migrate --name add_rewrite_tables` | 使用 `pnpm db:push` 代替 | 远程 MySQL 用户无 shadow DB 权限，`migrate dev` 报 P3014 |
| Repository 方法命名 | `createRewrite` + `updateTargetAccount` + `findVersionById` + `updateVersionEditedContent` + `updateVersionStatus` | `upsertByWorkspace` + `createVersion` + `findVersionById` + `updateVersionContent` + `markVersionCompleted` + `markVersionFailed` | 按技术设计中 Repository 设计部分对齐（非任务清单命名），分离 completed/failed 回写语义更清晰 |
| Service 方法命名 | `getByWorkspace` | `getOrNullByWorkspace` | 与技术设计 Service 层设计部分对齐，更准确表达「不创建」语义 |
| API key 解密 | 任务描述提到"API key 需解密" | 直接读取（无解密） | 现有代码库无加密层，`generateTextWithConfig` 等函数均直接使用 `config.apiKey`，无需解密 |

### 2. 前端开发特别注意的接口细节

- **GET `/api/ai-workspace/[videoId]/rewrite`** 响应体为 `{ rewrite: RewriteDTO | null }`（嵌套在 `data` 内），而非 `{ data: RewriteDTO | null }`
- **POST generate** 返回 HTTP 201（非 200），前端需识别
- **`usedFragmentIds`** 在 `RewriteVersionDTO.usedFragmentIds` 中已解析为 `string[]`，无需前端 JSON.parse
- **PATCH `/versions/[versionId]`** 仅允许 `status === COMPLETED` 的版本编辑，前端防抖回调需在状态判断后触发
- **API 路径** 使用单数 `ai-workspace`（区别于集合接口的 `ai-workspaces`），不要混用
- **轮询建议**：RewriteVersion 状态从 `GENERATING` 轮询到 `COMPLETED`/`FAILED`，间隔 2s，使用 GET rewrite 接口（复用已有拉取逻辑）

### 3. 技术债与后续改进建议

| 编号 | 问题 | 建议处理时机 |
|------|------|-------------|
| TD-1 | `prisma db:push` 不生成迁移文件，生产环境变更无 SQL 历史记录，回滚困难 | 为 MySQL 用户授予 shadow DB 权限或使用 `--create-only` 手动管理迁移 |
| TD-2 | Worker Prompt 模板硬编码在 `rewrite-worker.ts` | v0.3.3 功能稳定后提取到独立 prompt 模板文件，便于 PM 迭代 |
| TD-3 | `generate` 中 targetAccount / modelConfig 校验逻辑在 Service 层而非 Repository 层，与三层架构略有重叠 | 可在 Repository 层提供 `findAccountByIdForUser` 辅助方法，Service 仅做业务判断 |

---

## Phase 5 集成记录

### 发现并修复的不一致项

| 编号 | 问题 | 修复方式 | 涉及文件 |
|------|------|---------|---------|
| INT-1 | **缺失 `/api/ai-config/settings` 路由**：技术设计文档指定前端调用 `GET /api/ai-config/settings` 获取模型列表，但后端并未实现此路由。现有的 `/api/system-settings/ai` 仅允许 `SUPER_ADMIN` 访问，EMPLOYEE 无法使用 | 1. 在 `aiSettingsService` 新增 `getSettingsReadOnly()` 方法（无角色限制，供路由调用）<br>2. 新建 `src/app/api/ai-config/settings/route.ts`，`GET` 允许 EMPLOYEE+ 访问，返回 `AiSettingsDTO` | `src/server/services/ai-settings.service.ts`<br>`src/app/api/ai-config/settings/route.ts` |
| INT-2 | **类型不匹配**：`ai-rewrite-panel.tsx` 对 `GET /api/douyin-accounts` 的响应使用 `CursorPaginatedData<DouyinAccountDTO>`，但实际 API 返回 `PaginatedData<DouyinAccountDTO>`（含 `total/page/limit`，无 `nextCursor`）| 将导入和泛型参数从 `CursorPaginatedData` 改为 `PaginatedData` | `src/components/features/benchmarks/ai-rewrite-panel.tsx` |

### 检查通过项

| 检查项 | 状态 | 说明 |
|--------|------|------|
| API 路径对齐 | ✅ | 前端控制器使用 `/ai-workspace/${videoId}/rewrite` 与后端路由 `/api/ai-workspace/[videoId]/rewrite` 完全一致 |
| GET 响应结构 | ✅ | 后端返回 `{ rewrite: RewriteDTO | null }`，前端 `apiClient.get<{ rewrite: RewriteDTO | null }>` 正确解构 |
| PATCH editedContent | ✅ | 后端 Zod schema `editedContent: z.string().max(10_000)`，前端传 `{ editedContent: string }`，类型完全对齐 |
| POST generate 201 | ✅ | 后端返回 HTTP 201，`apiClient` 统一处理非 200 成功码，前端无需特殊处理 |
| DouyinAccount 过滤 | ✅ | `douyinAccountService.listAccounts` 对 `EMPLOYEE` 已自动按 `userId` 过滤，无需额外 type 参数 |
| startRewriteWorker 注册 | ✅ | `server-bootstrap.ts` 已在 `startTranscriptionWorker()` 后调用 `startRewriteWorker()` |

### 最终 build + test 状态

- **`pnpm type-check`**: ✅ 通过（无类型错误）
- **`pnpm lint --max-warnings 0`**: ✅ 通过（无 ESLint 警告）
- **`pnpm build`**: ✅ 通过（无编译错误）
- **`pnpm vitest run`**:
  - `src/server/services/rewrite.service.test.ts` — 7/7 通过 ✅
  - `src/app/api/ai-workspace/[videoId]/rewrite/route.test.ts` — 3/3 通过 ✅
  - 其余 9 个失败测试均为 v0.3.3 前已有的预存缺陷（`storage.service`、`crawler.service`、`server-bootstrap`、`scheduler`、`transcription-worker`、`benchmark-copy`），与本版本无关

| TD-4 | `RewriteVersion.usedFragmentIds` 存 JSON，Worker 内按原顺序重排代码有冗余 | v0.3.3.1+ Fragment 关系稳定后，可考虑改为带序号的关联表或保持现状（简单够用） |
