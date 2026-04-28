# v0.4.0 技术设计方案

> 版本: v0.4.0
> 创建日期: 2026-04-28
> 功能范围: AI 仿写完善（F-005-1 对齐 + F-005-2 标记最终稿）

---

## 摘要

| 项目 | 内容 |
|------|------|
| 涉及模块 | 仿写生成（rewrite）— WORKSPACE + DIRECT 两种模式 |
| 新增模型 | 无新增模型 |
| 修改模型 | `RewriteVersion`（新增 `isFinalVersion` 字段） |
| 新增 API | `PATCH /api/ai-workspace/[videoId]/rewrite/versions/[versionId]/final`（WORKSPACE 模式）<br>`PATCH /api/rewrites/direct/[rewriteId]/versions/[versionId]/final`（DIRECT 模式） |
| 修改 API | 无（现有 GET 接口通过 DTO 自动携带新字段） |
| 新增 Repository 方法 | `rewriteRepository.markVersionAsFinal(versionId, rewriteId, db?)` |
| 修改 Repository 方法 | `versionToDTO()`（新增 `isFinalVersion` 字段映射） |
| 新增 Service 方法 | `rewriteService.setFinalVersion({ rewriteId, versionId, caller })` |
| 修改 DTO | `RewriteVersionDTO` 新增 `isFinalVersion: boolean` |
| 前端变更 | `ai-workspace-controller.ts` 新增 `setFinalVersion` action；版本列表 UI（WORKSPACE + DIRECT）新增 badge + 按钮 |
| 架构变更 | 无 |

---

## 技术对齐结论

| 维度 | 结论 |
|------|------|
| **最终稿唯一性** | 同一 `Rewrite` 下最多只有一个 `isFinalVersion=true`，由 Repository 层事务保证（批量 reset + 单条 set） |
| **Service 统一接口** | WORKSPACE 和 DIRECT 模式共用同一个 `rewriteService.setFinalVersion()` 方法；API 路由层分别解析 `videoId` 或 `rewriteId` 以查找 `rewriteId`，再调用统一 Service |
| **权限校验位置** | Service 层内检查 `rewrite.userId === caller.id && rewrite.organizationId === caller.organizationId`，与已有 `saveDirectVersionEdit` / `saveEditedContent` 保持一致 |
| **乐观更新** | 前端调用 API 前先更新本地 `rewrite` 状态（把所有版本 `isFinalVersion` 设为 `false`，目标版本设为 `true`），失败后回滚至调用前快照 |
| **DTO 兼容性** | 现有所有返回版本列表的接口均通过 `versionToDTO()` 映射，只需在此函数补上 `isFinalVersion` 即可全量覆盖 |
| **F-005-1 决策** | 框架状态校验以「有批注即可」（`annotations.length > 0`）对齐现有实现，无需改代码，本版仅作文档确认，不引入 DECOMPOSED 状态 |

---

## 1. 数据库变更（Prisma Schema）

### 1.1 变更描述

在 `RewriteVersion` 模型中新增 `isFinalVersion` 字段：

```diff
 model RewriteVersion {
   id               String               @id @default(cuid())
   rewriteId        String
   versionNumber    Int
   generatedContent String?              @db.Text
   editedContent    String?              @db.Text
   modelConfigId    String?
   usedFragmentIds  Json                 @default("[]")
   userInputContent String?              @db.Text
   status           RewriteVersionStatus @default(GENERATING)
   errorMessage     String?              @db.Text
+  isFinalVersion   Boolean              @default(false)
   createdAt        DateTime             @default(now())
   updatedAt        DateTime             @updatedAt

   rewrite     Rewrite        @relation(fields: [rewriteId], references: [id])
   modelConfig AiModelConfig? @relation(fields: [modelConfigId], references: [id], onDelete: SetNull)

   @@unique([rewriteId, versionNumber])
   @@index([rewriteId])
   @@map("rewrite_versions")
 }
```

### 1.2 迁移文件

参照现有命名格式（`YYYYMMDDHHMMSS_snake_case_description`），迁移文件命名为：

```
prisma/migrations/20260428000000_add_is_final_version/migration.sql
```

迁移内容：在 `rewrite_versions` 表新增 `isFinalVersion BOOLEAN NOT NULL DEFAULT false` 列。

---

## 2. Repository 层设计

**文件**：`src/server/repositories/rewrite.repository.ts`

### 2.1 新增方法：`markVersionAsFinal`

**方法签名**：

```typescript
async markVersionAsFinal(
  versionId: string,
  rewriteId: string,
  db: DatabaseClient = prisma,
): Promise<void>
```

**实现方案**：

该方法在 Prisma 事务内完成两步原子操作（调用者可传入外部 `tx`，若不传则自行开启事务）：

1. **归零**：`UPDATE rewrite_versions SET isFinalVersion = false WHERE rewriteId = :rewriteId`（覆盖该 Rewrite 下所有版本）
2. **置位**：`UPDATE rewrite_versions SET isFinalVersion = true WHERE id = :versionId AND rewriteId = :rewriteId`

第二步的 `WHERE id = :versionId AND rewriteId = :rewriteId` 隐式验证 `versionId` 属于该 `rewriteId`——若 `versionId` 不属于 `rewriteId`，Prisma `updateMany` 命中行数为 0，此时抛出 `AppError("VERSION_NOT_FOUND", ..., 404)`（由 Service 层校验，见下节）。

> **选型说明**：使用 Prisma `updateMany` 批量归零再 `update` 单条置位，无需引入数据库层面的唯一索引（`isFinalVersion` 的「最多一个」约束由事务语义保证，而非 schema 约束），简化 schema 复杂度。

### 2.2 修改 `versionToDTO`

在现有的 `versionToDTO()` 函数返回值中新增 `isFinalVersion` 字段映射：

```typescript
isFinalVersion: v.isFinalVersion,
```

**影响范围**：所有调用 `versionToDTO()` 的查询路径（`findByWorkspaceId`、`findByIdAndUser`）均自动包含该字段，无需逐一修改。

---

## 3. Service 层设计

**文件**：`src/server/services/rewrite.service.ts`

### 3.1 新增方法：`setFinalVersion`

**方法签名**：

```typescript
async setFinalVersion(params: {
  rewriteId: string;
  versionId: string;
  caller: SessionUser;
}): Promise<{ versionId: string; isFinalVersion: boolean }>
```

**实现流程**：

1. 调用 `rewriteRepository.findVersionById(versionId)` 获取版本及关联 Rewrite 信息。
2. 校验：
   - 版本存在：`version !== null`，否则抛 `AppError("VERSION_NOT_FOUND", ..., 404)`
   - rewriteId 匹配：`version.rewrite.id === params.rewriteId`，否则抛 `AppError("VERSION_NOT_FOUND", ..., 404)`
   - 归属校验：`version.rewrite.userId === caller.id && version.rewrite.organizationId === caller.organizationId`，否则抛 `AppError("ACCESS_DENIED", ..., 403)`
3. 调用 `rewriteRepository.markVersionAsFinal(versionId, rewriteId)` 执行事务操作。
4. 返回 `{ versionId, isFinalVersion: true }`。

**设计说明**：该方法对 WORKSPACE 和 DIRECT 两种模式统一，API 路由层负责将模式特定的路径参数（`videoId` 或 `rewriteId`）转化为 `rewriteId` 后调用此方法。

---

## 4. API 路由设计

### 4.1 WORKSPACE 模式新增路由

**文件**：`src/app/api/ai-workspace/[videoId]/rewrite/versions/[versionId]/final/route.ts`

**方法**：`PATCH`

**路径参数**：`videoId`、`versionId`

**请求体**：无（操作语义明确，无需 body）

**响应**：`{ versionId: string, isFinalVersion: boolean }`

**实现要点**：
1. `auth()` + `requireRole(EMPLOYEE | BRANCH_MANAGER | SUPER_ADMIN)`
2. 通过 `rewriteService.getOrNullByWorkspace(videoId, caller)` 获取 Rewrite，若为 null 则抛 404
3. 调用 `rewriteService.setFinalVersion({ rewriteId: rewrite.id, versionId, caller })`
4. 返回 `successResponse(result)`

**参考文件**：`src/app/api/ai-workspace/[videoId]/rewrite/versions/[versionId]/route.ts`（PATCH 方法）

### 4.2 DIRECT 模式新增路由

**文件**：`src/app/api/rewrites/direct/[rewriteId]/versions/[versionId]/final/route.ts`

**方法**：`PATCH`

**路径参数**：`rewriteId`、`versionId`

**请求体**：无

**响应**：`{ versionId: string, isFinalVersion: boolean }`

**实现要点**：
1. `auth()` + `requireRole(EMPLOYEE | BRANCH_MANAGER | SUPER_ADMIN)`
2. 直接从 URL 取 `rewriteId`，调用 `rewriteService.setFinalVersion({ rewriteId, versionId, caller })`
3. 返回 `successResponse(result)`

**参考文件**：`src/app/api/rewrites/direct/[rewriteId]/versions/[versionId]/route.ts`（PATCH 方法）

---

## 5. DTO / 类型变更

**文件**：`src/types/ai-workspace.ts`

### 5.1 `RewriteVersionDTO` 新增字段

```typescript
export interface RewriteVersionDTO {
  // ... 现有字段不变 ...
  isFinalVersion: boolean;  // 新增
}
```

---

## 6. 前端设计

### 6.1 WORKSPACE 模式（`ai-workspace-controller.ts`）

**文件**：`src/components/features/benchmarks/ai-workspace-controller.ts`

**新增 `setFinalVersion` 方法**，挂载在 `// ─── Rewrite Methods ───` 区块（与 `generateRewrite`、`saveVersionEdit` 并列）：

**方法签名**：

```typescript
const setFinalVersion = useCallback(async function setFinalVersion(versionId: string) {
  // ...
}, [video, rewrite]);
```

**乐观更新逻辑**：
1. 保存当前 `rewrite` 状态快照（用于回滚）
2. 立即更新本地 `rewrite` 状态：将所有版本 `isFinalVersion` 设为 `false`，目标版本设为 `true`
3. 调用 `apiClient.patch<{ versionId: string; isFinalVersion: boolean }>(`/ai-workspace/${video.id}/rewrite/versions/${versionId}/final`)`
4. 成功：无需额外操作（乐观更新已反映正确状态）
5. 失败：回滚至快照，`toast.error(...)` 提示用户

**控制器返回值**：在 `useAiWorkspaceController` 返回对象中新增 `setFinalVersion`。

### 6.2 WORKSPACE 模式版本列表 UI

**影响文件**：版本列表所在组件（`AiWorkspaceRewriteStageV2` 或 `RewriteRightPanel`，具体由前端开发者扫描确认）

**版本条目变更**：
- 新增「最终稿」`Badge`：当 `version.isFinalVersion === true` 时显示（使用 `BRAND_INSET_SURFACE_CLASS_NAME` 风格或与版本号并列的 badge）
- 新增「设为最终稿」按钮：
  - 当 `version.isFinalVersion === false` 时显示
  - 当 `version.isFinalVersion === true` 时显示禁用态（文字为「已是最终稿」）
  - 点击时调用 `onSetFinalVersion(version.id)`（由控制器的 `setFinalVersion` 提供）
  - 生成中（`version.status === "GENERATING"`）的版本禁用此按钮

### 6.3 DIRECT 模式（`DirectCreatePanel` + 页面层）

**涉及文件**：
- `src/components/features/rewrites/direct-create-panel.tsx`（面板组件）
- 调用 `DirectCreatePanel` 的页面组件（前端开发者扫描确认，路径约为 `src/app/(dashboard)/rewrites/[rewriteId]/page.tsx` 或 `direct-create-page.tsx`）

**`DirectCreatePanel` 新增 prop**：

```typescript
interface DirectCreatePanelProps {
  // ... 现有 props 不变 ...
  onSetFinalVersion: (versionId: string) => void;  // 新增
}
```

**版本下拉菜单（`DropdownMenu`）条目变更**（位于「生成结果」区块）：

在每个版本的 `DropdownMenuItem` 中新增：
- 「最终稿」`Badge`：当 `version.isFinalVersion === true` 时显示在版本号旁
- 「设为最终稿」操作项（可在同一 `DropdownMenuItem` 内或作为独立条目）：
  - `version.isFinalVersion === false` 时可点击，调用 `onSetFinalVersion(version.id)`
  - `version.isFinalVersion === true` 时显示「已是最终稿」禁用态

**页面层新增 `handleSetFinalVersion` 回调**（乐观更新逻辑同 WORKSPACE 模式）：
1. 保存当前 `rewrite` 状态快照
2. 更新本地 `rewrite`：所有版本 `isFinalVersion = false`，目标版本 `isFinalVersion = true`
3. 调用 `apiClient.patch(`/rewrites/direct/${rewriteId}/versions/${versionId}/final`)`
4. 失败时回滚，`toast.error(...)` 提示

---

## 7. 任务分解

### 后端任务

```
- [ ] T-BE-001: 修改 Prisma schema，新增 isFinalVersion 字段（0.5h）
  - 文件：prisma/schema.prisma
  - 说明：在 RewriteVersion 模型中新增 isFinalVersion Boolean @default(false)

- [ ] T-BE-002: 创建 Prisma 迁移文件（0.5h）
  - 文件：prisma/migrations/20260428000000_add_is_final_version/migration.sql
  - 说明：执行 pnpm db:migrate，生成并确认迁移 SQL

- [ ] T-BE-003: 更新 versionToDTO 映射（0.5h）
  - 文件：src/server/repositories/rewrite.repository.ts
  - 说明：在 versionToDTO() 返回值中新增 isFinalVersion: v.isFinalVersion

- [ ] T-BE-004: 实现 rewriteRepository.markVersionAsFinal（1h）
  - 文件：src/server/repositories/rewrite.repository.ts
  - 说明：事务内批量归零 + 单条置位，含 rewriteId 归属验证

- [ ] T-BE-005: 更新 RewriteVersionDTO 类型（0.5h）
  - 文件：src/types/ai-workspace.ts
  - 说明：RewriteVersionDTO 新增 isFinalVersion: boolean 字段

- [ ] T-BE-006: 实现 rewriteService.setFinalVersion（1h）
  - 文件：src/server/services/rewrite.service.ts
  - 说明：权限校验 + 调用 markVersionAsFinal，统一 WORKSPACE/DIRECT 两种模式

- [ ] T-BE-007: 实现 WORKSPACE 模式 PATCH 路由（1h）
  - 文件：src/app/api/ai-workspace/[videoId]/rewrite/versions/[versionId]/final/route.ts
  - 说明：通过 videoId → Rewrite → 调用 setFinalVersion

- [ ] T-BE-008: 实现 DIRECT 模式 PATCH 路由（0.5h）
  - 文件：src/app/api/rewrites/direct/[rewriteId]/versions/[versionId]/final/route.ts
  - 说明：直接取 rewriteId → 调用 setFinalVersion
```

### 前端任务

```
- [ ] T-FE-001: 在 ai-workspace-controller.ts 新增 setFinalVersion action（1h）
  - 文件：src/components/features/benchmarks/ai-workspace-controller.ts
  - 说明：乐观更新 rewrite 状态 + API 调用 + 失败回滚，挂载到控制器返回值

- [ ] T-FE-002: WORKSPACE 模式版本列表 UI 更新（1.5h）
  - 文件：版本列表所在组件（前端开发者扫描确认具体文件）
  - 说明：每个版本条目新增「最终稿」badge + 「设为最终稿」/「已是最终稿」按钮

- [ ] T-FE-003: DirectCreatePanel 新增 onSetFinalVersion prop 及版本条目 UI（1.5h）
  - 文件：src/components/features/rewrites/direct-create-panel.tsx
  - 说明：新增 prop，在版本下拉菜单条目中增加 badge + 操作按钮

- [ ] T-FE-004: DirectCreatePage 新增 handleSetFinalVersion 回调（1h）
  - 文件：direct-create 页面组件（前端开发者扫描确认具体路径）
  - 说明：乐观更新本地 rewrite 状态 + API 调用 + 失败回滚，传给 DirectCreatePanel
```

**总任务数**：12 个（BE: 8，FE: 4）

**建议实现顺序**：T-BE-001 → T-BE-002 → T-BE-003 → T-BE-004 → T-BE-005 → T-BE-006 → T-BE-007 → T-BE-008 → T-FE-001 → T-FE-002 → T-FE-003 → T-FE-004

---

## 附录：F-005-1 决策确认

本版本通过文档确认以下决策，**无需改动代码**：

- PRD F-005-1 原始定义"框架已修正"（DECOMPOSED 状态）替换为：**有批注即可**（`annotations.length > 0`）
- 现有 `rewriteService.generate()` 中的校验逻辑 `workspaceDetails.annotations.length === 0` 已与此决策一致
- 不引入 `DECOMPOSED` 枚举值，不在 schema 或代码中新增状态机节点
