# v0.4.0 需求文档 — AI 仿写完善（F-005-1 对齐 + F-005-2 标记最终稿）

> 版本: v0.4.0
> 里程碑: v0.4.x（AI 仿写）
> 需求来源: [PRD.md M-005](../../PRD.md) F-005-1 + F-005-2
> 创建日期: 2026-04-28

---

## 版本信息

| 属性 | 值 |
|------|-----|
| 版本号 | v0.4.0 |
| 里程碑 | v0.4.x — AI 仿写 |
| 功能点 | F-005-1（对齐验证）+ F-005-2（标记最终稿）|
| 依赖版本 | v0.3.3（Rewrite + RewriteVersion 数据模型）+ v0.3.3.1（直接创作入口）+ v0.3.4（拆解列表）|
| 优先级分布 | P0(1), P1(1) |

> **版本定位说明**：v0.3.3 和 v0.3.3.1 已交付 AI 仿写生成的核心能力（WORKSPACE + DIRECT 两种模式），但对照 PRD F-005-1 / F-005-2 仍存在两处差距：①F-005-1 框架状态校验未对齐 PRD 边界条件（已决策以"有批注即可"替代"已修正"状态，本版明确落地此决策）；②F-005-2 版本管理缺少「标记最终稿」功能（`isFinalVersion` 字段及配套 UI 均未实现）。本版合并原计划的 v0.4.0 + v0.4.1，一次性交付全部差距，为后续 F-005-3 Prompt 模板管理（v0.4.2）打好基础。

---

## 摘要

- **版本目标**：
  1. 在文档层面明确 F-005-1 框架状态校验的决策（以"有批注即可"对齐现有实现，无需改代码）
  2. 实现 F-005-2「标记最终稿」：新增 `RewriteVersion.isFinalVersion` 字段，提供设置/取消最终稿的 API 和 UI
- **功能数量**：1 个决策对齐（无代码变更）+ 1 个新功能（标记最终稿）
- **前置依赖**：
  - v0.3.3 的 `Rewrite` + `RewriteVersion` 数据模型已存在
  - v0.3.3.1 的直接创作页面 `/rewrites/new` 已存在
  - v0.3.4 的拆解列表页 `/decompositions` 已存在
- **本版交付**：
  - Prisma schema：`RewriteVersion` 新增 `isFinalVersion Boolean @default(false)` 字段 + 新增 Prisma 迁移
  - Repository 层：`rewriteRepository.markVersionAsFinal(versionId, rewriteId)` 方法（事务操作）
  - Service 层：`rewriteService.setFinalVersion(params)` 方法（权限校验 + 调用 repository）
  - API：新增两个 PATCH 端点（WORKSPACE 模式 + DIRECT 模式）
  - DTO：`RewriteVersionDTO` 新增 `isFinalVersion` 字段
  - 前端（WORKSPACE 模式工作台右栏版本列表）：每个版本新增「设为最终稿」按钮 + 「最终稿」badge
  - 前端（DIRECT 模式直接创作页面版本列表）：同上

---

## 边界结论

### 范围内

- `RewriteVersion` 新增 `isFinalVersion` 字段及对应 Prisma 迁移
- 同一 `Rewrite` 下最多只有一个版本 `isFinalVersion=true`（业务约束，通过事务保证）
- WORKSPACE 模式 API：`PATCH /api/ai-workspace/[videoId]/rewrite/versions/[versionId]/final`
- DIRECT 模式 API：`PATCH /api/rewrites/direct/[rewriteId]/versions/[versionId]/final`
- 版本列表 UI（WORKSPACE + DIRECT 两种模式均需更新）：
  - 每个版本条目新增「设为最终稿」操作按钮（已是最终稿时显示「取消最终稿」或禁用）
  - 已标记为最终稿的版本显示「最终稿」badge（视觉上区分）
- `RewriteVersionDTO` 新增 `isFinalVersion: boolean` 字段，相关列表接口均需返回此字段
- F-005-1 框架状态校验决策文档化：以"有批注即可"（`annotations.length > 0`）替代 PRD 原始"框架已修正"（DECOMPOSED 状态），本版不引入 DECOMPOSED 状态校验

### 非目标（明确排除）

- 基于最终稿做任何自动化操作（如自动发布、经验反馈）→ M-006 F-006-1
- 最终稿版本的导出或复制功能
- 版本数量上限管理
- 跨 Rewrite 的最终稿汇总视图
- Prompt 模板管理（→ v0.4.2 F-005-3）
- 仿写历史列表页（跨 Rewrite 任务的汇总）→ 后续迭代
- 版本对比功能

---

## 用户故事

### US-001：标记某个版本为最终稿

**作为**员工，  
**我希望**在 AI 生成的多个版本中，将满意的那个标记为「最终稿」，  
**以便**我和团队能清楚地知道这个任务的最终交付物是哪个版本，不需要反复翻查版本历史来猜测。

**验收标准：**

| # | 条件 |
|---|------|
| AC-001 | 在 AI 工作台（WORKSPACE 模式）右栏版本列表中，每个版本条目显示「设为最终稿」按钮 |
| AC-002 | 在直接创作页（DIRECT 模式）版本列表中，每个版本条目同样显示「设为最终稿」按钮 |
| AC-003 | 点击「设为最终稿」后，该版本显示「最终稿」badge，同一 Rewrite 下其他版本的最终稿标记自动取消 |
| AC-004 | 已是最终稿的版本，按钮变为禁用态或「已是最终稿」，无需二次确认弹框 |
| AC-005 | 同一 Rewrite 只能有一个最终稿（后端事务保证，前端乐观更新后需响应后端结果） |
| AC-006 | 操作失败时（网络异常等），回滚前端乐观更新状态，提示用户错误信息 |
| AC-007 | `isFinalVersion` 字段随版本列表接口一起返回，页面刷新后状态持久 |

---

### US-002：快速识别最终稿

**作为**员工，  
**我希望**在版本列表中一眼看出哪个版本是最终稿，  
**以便**我不需要逐个查看版本内容来确认。

**验收标准：**

| # | 条件 |
|---|------|
| AC-001 | 最终稿版本的条目有明显的「最终稿」视觉标识（badge 或图标），与普通版本区分 |
| AC-002 | 版本列表按版本号排序，最终稿可出现在任意位置（不强制置顶） |
| AC-003 | 无最终稿时，版本列表无任何「最终稿」标识 |

---

## 功能清单

### F-001：Prisma 数据模型变更（P0）

**描述**：在 `RewriteVersion` 模型中新增 `isFinalVersion` 字段，并创建对应的 Prisma 迁移。

#### 数据模型变更

```prisma
model RewriteVersion {
  // ... 现有字段不变 ...

  isFinalVersion Boolean @default(false)  // ← 新增字段
}
```

**业务约束**（由 Service + Repository 层保证，非数据库约束）：
- 同一 `Rewrite` 下最多一个 `RewriteVersion.isFinalVersion = true`
- 通过数据库事务保证原子性：先将同 `rewriteId` 下所有版本设为 `false`，再将目标版本设为 `true`

**验收标准：**

| # | 条件 |
|---|------|
| AC-001 | Prisma schema 已更新，`RewriteVersion` 含 `isFinalVersion Boolean @default(false)` |
| AC-002 | 迁移文件已创建（`prisma migrate dev` 可正常执行） |
| AC-003 | 现有数据不受影响（默认值 `false`，无数据丢失） |

---

### F-002：Repository 层 — markVersionAsFinal（P0）

**描述**：在 `rewriteRepository` 中新增 `markVersionAsFinal` 方法，使用事务原子更新同一 Rewrite 下所有版本的 `isFinalVersion` 字段。

#### 方法签名（参考）

```typescript
markVersionAsFinal(versionId: string, rewriteId: string): Promise<RewriteVersion>
```

#### 事务逻辑

```
BEGIN TRANSACTION
  1. UPDATE RewriteVersion SET isFinalVersion=false WHERE rewriteId=:rewriteId
  2. UPDATE RewriteVersion SET isFinalVersion=true  WHERE id=:versionId
COMMIT
```

**验收标准：**

| # | 条件 |
|---|------|
| AC-001 | 方法已实现，使用 Prisma `$transaction` 保证原子性 |
| AC-002 | 操作后同一 Rewrite 下只有一个版本 `isFinalVersion=true` |
| AC-003 | 若 versionId 不属于 rewriteId，抛出 `AppError`（NOT_FOUND 或 FORBIDDEN） |

---

### F-003：Service 层 — setFinalVersion（P0）

**描述**：在 `rewriteService` 中新增 `setFinalVersion` 方法，校验权限后调用 repository 层完成操作。

#### 方法签名（参考）

```typescript
setFinalVersion(params: {
  rewriteId: string;
  versionId: string;
  organizationId: string;
  userId: string;
}): Promise<RewriteVersionDTO>
```

#### 业务校验

1. 查询 `Rewrite`，确认 `organizationId` 一致（数据隔离）
2. 确认 `Rewrite.userId === userId`（只有创建者可操作，或超级管理员——本版仅创建者）
3. 确认 `versionId` 属于该 `rewriteId`
4. 调用 `rewriteRepository.markVersionAsFinal(versionId, rewriteId)`
5. 返回更新后的 `RewriteVersionDTO`（含 `isFinalVersion: true`）

**验收标准：**

| # | 条件 |
|---|------|
| AC-001 | 权限校验通过后，成功标记最终稿 |
| AC-002 | 非创建者调用时返回 403 AppError |
| AC-003 | organizationId 不匹配时返回 403 AppError |
| AC-004 | versionId 不属于 rewriteId 时返回 404 AppError |

---

### F-004：API 端点 — WORKSPACE 模式（P0）

**描述**：新增 WORKSPACE 模式下的「标记最终稿」API 端点。

#### 端点定义

```
PATCH /api/ai-workspace/[videoId]/rewrite/versions/[versionId]/final
```

**请求体**：无（PATCH 语义已明确操作）

**响应体**：

```json
{
  "success": true,
  "data": {
    "id": "...",
    "versionNumber": 2,
    "isFinalVersion": true,
    "modelConfigId": "...",
    "generatedContent": "...",
    "editedContent": null,
    "createdAt": "..."
  }
}
```

**路由实现要点**：
1. `auth()` 获取 session，未登录返回 401
2. 通过 `videoId` 查询 AiWorkspace，获取 `rewriteId`（若 Rewrite 不存在，返回 404）
3. 调用 `rewriteService.setFinalVersion({ rewriteId, versionId, organizationId, userId })`
4. 返回统一 API 响应格式

**验收标准：**

| # | 条件 |
|---|------|
| AC-001 | 未认证访问返回 401 |
| AC-002 | videoId 对应的 Rewrite 不存在时返回 404 |
| AC-003 | 无权操作时返回 403 |
| AC-004 | 成功时返回 200 + 更新后的版本 DTO |

---

### F-005：API 端点 — DIRECT 模式（P0）

**描述**：新增 DIRECT 模式下的「标记最终稿」API 端点。

#### 端点定义

```
PATCH /api/rewrites/direct/[rewriteId]/versions/[versionId]/final
```

**请求体**：无

**响应体**：与 F-004 相同结构

**路由实现要点**：
1. `auth()` 获取 session，未登录返回 401
2. 直接使用 URL 中的 `rewriteId`（DIRECT 模式无需通过 videoId 间接查询）
3. 调用 `rewriteService.setFinalVersion({ rewriteId, versionId, organizationId, userId })`
4. 返回统一 API 响应格式

**验收标准：**

| # | 条件 |
|---|------|
| AC-001 | 未认证访问返回 401 |
| AC-002 | rewriteId 不存在或不属于当前用户的 organization 时返回 404 |
| AC-003 | 无权操作时返回 403 |
| AC-004 | 成功时返回 200 + 更新后的版本 DTO |

---

### F-006：DTO 更新 — RewriteVersionDTO（P0）

**描述**：在所有涉及 `RewriteVersion` 的响应 DTO 中新增 `isFinalVersion` 字段。

#### 变更范围

- `RewriteVersionDTO` 类型定义新增 `isFinalVersion: boolean`
- 以下接口的响应需包含 `isFinalVersion`：
  - `GET /api/ai-workspace/[videoId]/rewrite`（版本列表）
  - `GET /api/rewrites/direct/[rewriteId]`（直接创作详情，含版本列表）
  - `POST /api/ai-workspace/[videoId]/rewrite/generate`（生成新版本响应）
  - `POST /api/rewrites/direct/[rewriteId]/generate`（直接创作生成响应）
  - 新增的两个 PATCH final 端点响应

**验收标准：**

| # | 条件 |
|---|------|
| AC-001 | `RewriteVersionDTO` 含 `isFinalVersion: boolean` 字段 |
| AC-002 | 所有返回 RewriteVersion 的接口均包含此字段 |
| AC-003 | 新生成的版本默认 `isFinalVersion: false` |

---

### F-007：前端 UI — WORKSPACE 模式版本列表（P1）

**描述**：在 AI 工作台右栏版本列表中，为每个版本新增「设为最终稿」操作 + 「最终稿」badge。

#### UI 交互规格

**版本条目布局（在现有版本下拉/Badge 列表基础上扩展）**：

```
[ 版本 N ]  [时间]  [模型名]  [最终稿 badge / 设为最终稿 按钮]
```

**「设为最终稿」按钮**：
- 仅在该版本 `isFinalVersion === false` 时显示
- 点击后：
  1. 乐观更新：将本地状态中该版本 `isFinalVersion` 设为 `true`，同一 rewrite 下其他版本设为 `false`
  2. 调用 `PATCH /api/ai-workspace/[videoId]/rewrite/versions/[versionId]/final`
  3. 失败时回滚乐观更新 + Toast 提示"操作失败，请重试"

**「最终稿」badge**：
- 当 `isFinalVersion === true` 时显示（绿色 badge 或类似高亮样式）
- 参考 `ui-ux-system.md` 中的 badge/chip 样式规范

**验收标准：**

| # | 条件 |
|---|------|
| AC-001 | 版本列表每个条目末尾有「设为最终稿」按钮（未设为最终稿时）或「最终稿」badge（已设为最终稿时） |
| AC-002 | 点击「设为最终稿」后，UI 乐观更新，无需刷新页面 |
| AC-003 | 同一 Rewrite 同时只有一个版本显示「最终稿」badge |
| AC-004 | API 失败时，恢复之前状态并提示错误 |
| AC-005 | 「设为最终稿」按钮的样式符合 Linear 风格暗色主题（参考 `ui-ux-system.md`） |

---

### F-008：前端 UI — DIRECT 模式版本列表（P1）

**描述**：在直接创作页面（`/rewrites/new` 或 `/rewrites/[id]`）的版本列表中，同样新增「设为最终稿」操作 + 「最终稿」badge。

**交互规格**：与 F-007 完全一致，区别仅在于调用的 API 端点：
- `PATCH /api/rewrites/direct/[rewriteId]/versions/[versionId]/final`

**验收标准**：与 F-007 相同（AC-001 ~ AC-005），API 端点替换为 DIRECT 模式对应地址。

---

## 数据模型变更

### Prisma Schema 变更

**文件**：`prisma/schema.prisma`

```prisma
model RewriteVersion {
  id               String    @id @default(cuid())
  rewriteId        String
  versionNumber    Int
  modelConfigId    String?
  usedFragmentIds  String    @default("[]")   // JSON array of Fragment IDs
  generatedContent String?   @db.Text
  editedContent    String?   @db.Text
  status           RewriteStatus @default(PENDING)
  errorMessage     String?
  isFinalVersion   Boolean   @default(false)  // ← 新增字段
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  rewrite  Rewrite  @relation(fields: [rewriteId], references: [id], onDelete: Cascade)
  model    AiModelConfig? @relation(fields: [modelConfigId], references: [id])

  @@index([rewriteId])
}
```

### 迁移说明

- 迁移文件命名建议：`add_rewrite_version_is_final`（时间戳前缀由 Prisma 自动生成）
- 迁移 SQL 核心变更：`ALTER TABLE RewriteVersion ADD COLUMN isFinalVersion TINYINT(1) NOT NULL DEFAULT 0`
- 无破坏性变更，现有数据库数据不受影响

---

## API 设计

### 新增端点汇总

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| PATCH | `/api/ai-workspace/[videoId]/rewrite/versions/[versionId]/final` | 标记最终稿（WORKSPACE 模式） | 登录用户（仅创建者） |
| PATCH | `/api/rewrites/direct/[rewriteId]/versions/[versionId]/final` | 标记最终稿（DIRECT 模式） | 登录用户（仅创建者） |

### 统一响应格式

遵循项目统一规范：

```typescript
// 成功
{
  success: true,
  data: RewriteVersionDTO
}

// 失败
{
  success: false,
  error: {
    code: "NOT_FOUND" | "FORBIDDEN" | "INTERNAL_SERVER_ERROR",
    message: string
  }
}
```

### RewriteVersionDTO（更新后）

```typescript
interface RewriteVersionDTO {
  id: string;
  versionNumber: number;
  modelConfigId: string | null;
  modelName: string | null;         // 关联查询，展示模型名称
  usedFragmentIds: string[];        // 解析 JSON
  generatedContent: string | null;
  editedContent: string | null;
  status: "PENDING" | "GENERATING" | "COMPLETED" | "FAILED";
  errorMessage: string | null;
  isFinalVersion: boolean;          // ← 新增
  createdAt: string;                // ISO 8601
}
```

---

## F-005-1 框架状态校验决策备忘

> 本节记录 PM 与团队的对齐决策，供后续版本参考。

**PRD 原文**（F-005-1 边界条件）：「框架必须为'已修正'状态」

**当前实现**（v0.3.3）：检查 `annotations.length > 0`（有批注即可），未检查 AiWorkspace.status 是否为 DECOMPOSED。

**决策**：以"有批注即可"对齐实际实现，原因如下：
1. 用户手动添加批注后，工作台状态不一定流转到 DECOMPOSED（可能仍为 IN_PROGRESS 或其他状态）
2. 从用户体验角度，「有批注」是比「已修正状态」更直观的前置条件
3. 引入 DECOMPOSED 状态校验会增加用户操作摩擦，且实际用户场景中价值有限

**本版行动项**：无代码变更，仅在本需求文档中明确此决策，后续版本不再追溯此校验缺失。
