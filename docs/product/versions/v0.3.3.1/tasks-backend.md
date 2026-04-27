# v0.3.3.1 后端任务

> 版本: v0.3.3.1
> 角色: 后端开发
> 参考: technical-design.md

## 必读文档

1. `docs/product/versions/v0.3.3.1/requirements.md`
2. `docs/product/versions/v0.3.3.1/technical-design.md`
3. `docs/architecture/backend.md`
4. `docs/architecture/api-conventions.md`

---

## 任务清单

### T-BE-001: Prisma Schema 变更 + 迁移

- [x] `prisma/schema.prisma`：
  - 新增 `RewriteMode` 枚举（`WORKSPACE` / `DIRECT`）
  - `Rewrite.workspaceId` 改为 `String?`（nullable）
  - `Rewrite.workspace` 关联改为 `AiWorkspace?`（optional）
  - 新增 `Rewrite.mode RewriteMode @default(WORKSPACE)`
  - 新增 `Rewrite.topic String? @db.Text`
  - 新增 `@@index([mode, userId])`
- [x] 新增迁移文件（`pnpm db:migrate` 受 shadow database 权限限制未能在当前环境执行）
- [x] 运行 `pnpm db:generate`，更新 Prisma Client

### T-BE-002: bullmq.ts — RewriteJobData 扩展

- [x] `src/lib/bullmq.ts`：`RewriteJobData` 新增字段 `mode: "workspace" | "direct"`
- [x] `src/lib/bullmq.ts`：`RewriteJobData.workspaceId` 改为可选（direct 模式无 workspace）

### T-BE-003: RewriteWorker — 直接创作 Prompt 分支

- [x] `src/lib/rewrite-worker.ts`：
  - 新增 `buildDirectRewriteUserPrompt(params)` 函数
  - Worker 主逻辑根据 `jobData.mode` 分支处理：
    - `workspace` 模式：保持现有逻辑不变
    - `direct` 模式：跳过 workspace 查询，跳过 annotations 查询，跳过 transcript 查询；通过 `rewriteVersion.rewriteId` 获取 `rewrite.topic`、`rewrite.targetAccountId`，并使用 `rewriteVersion.usedFragmentIds`

### T-BE-004: Repository 层 — rewrite.repository.ts

- [x] 新增 `createDirect(data: CreateDirectRewriteData)` 方法（创建 mode=DIRECT 的 Rewrite）
- [x] 新增 `updateDirectTaskContext(id, data, db)` 或等价方法（更新 DIRECT 任务的 `topic` / `targetAccountId`）
- [x] 新增 `findByIdAndUser(id: string, userId: string, organizationId: string, mode?: "DIRECT" | "WORKSPACE")` 方法（个人数据隔离查询）
- [x] DTO 转换兼容 `workspaceId: null`、`mode`、`topic`

### T-BE-005: Service 层 — rewrite.service.ts

- [x] 新增 `generateDirect(input: DirectGenerateRewriteInput, caller: SessionUser)` 方法：
  1. 验证 targetAccount 属于 caller（复用 `findOwnedMyAccount`）
  2. 验证 modelConfig 存在
  3. 若 `input.rewriteId` 为空：事务内 `createDirect` + `createVersion`（版本号从 1 开始）
  4. 若 `input.rewriteId` 存在：事务内校验 DIRECT 任务归属，更新任务级 `topic` / `targetAccountId`，再 `createNextVersion`
  5. 入队 REWRITE_QUEUE，jobData.mode = "direct"，不传 workspaceId
- [x] 新增 `getDirectRewrite(rewriteId: string, caller: SessionUser)` 方法：
  1. 调用 `findByIdAndUser(..., mode="DIRECT")`，未找到时抛 `REWRITE_NOT_FOUND` 404
- [x] 新增 `saveDirectVersionEdit(rewriteId: string, versionId: string, input: SaveRewriteEditInput, caller: SessionUser)` 方法

### T-BE-006: API 路由

- [x] `src/app/api/rewrites/direct/generate/route.ts`（POST）：
  - `auth()` + EMPLOYEE 及以上
  - Zod 校验请求体（`DirectGenerateSchema`，含可选 `rewriteId`）
  - 调用 `rewriteService.generateDirect`
- [x] `src/app/api/rewrites/direct/[rewriteId]/route.ts`（GET）：
  - `auth()` + EMPLOYEE 及以上
  - 调用 `rewriteService.getDirectRewrite`
- [x] `src/app/api/rewrites/direct/[rewriteId]/versions/[versionId]/route.ts`（PATCH）：
  - `auth()` + EMPLOYEE 及以上
  - Zod 校验 `{ editedContent: z.string() }`
  - 调用 `rewriteService.saveDirectVersionEdit`

### T-BE-007: 类型扩展

- [x] `src/types/ai-workspace.ts`：新增 `DirectGenerateRewriteInput` 接口（含可选 `rewriteId` 与 `topic` 字段）
- [x] `src/types/ai-workspace.ts`：`RewriteDTO.workspaceId` 改为 `string | null`，并新增 `mode`、`topic`

---

## 完成标准

- `pnpm type-check` 无错误
- `pnpm lint` 无警告
- 相关单元测试补充（重点：`rewrite.service.ts` 中 `generateDirect` 首次创建任务、同任务追加版本、权限验证）
