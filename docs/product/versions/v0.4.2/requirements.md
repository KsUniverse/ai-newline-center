# v0.4.2 需求文档 — Prompt 模板管理（F-005-3）

> 版本: v0.4.2
> 里程碑: v0.4.x（AI 仿写）
> 需求来源: [PRD.md M-005](../../PRD.md) F-005-3
> 创建日期: 2026-04-28

---

## 版本信息

| 属性 | 值 |
|------|-----|
| 版本号 | v0.4.2 |
| 里程碑 | v0.4.x — AI 仿写 |
| 功能点 | F-005-3（Prompt 模板管理）|
| 依赖版本 | v0.4.0（AI 仿写生成链路完整）|
| 优先级分布 | P0(5), P1(1) |

---

## 版本定位说明

现有 AI 调用链路为：AiGateway → Vercel AI SDK → 多模型 Provider。各 AI 步骤（转录、拆解、仿写、直接创作）的 Prompt 当前**硬编码**在 worker 文件中（`rewrite-worker.ts` 的 `buildRewriteSystemPrompt` / `buildRewriteUserPrompt` / `buildDirectRewriteUserPrompt`，以及转录相关代码）。

v0.4.2 将 Prompt 模板管理迁移至数据库，由超级管理员通过管理后台界面维护。AI 调用时从数据库读取对应步骤的默认模板，完成变量替换后作为 Prompt 使用；若数据库中无匹配模板，则 fallback 到代码中的硬编码 Prompt，确保系统平滑迁移。

---

## 摘要

- **版本目标**：
  1. 新增 `PromptTemplate` 数据表，支持按步骤类型管理多个模板，并指定默认模板
  2. 管理员后台新增 Prompt 模板管理页面（`/system-settings/prompt-templates`），支持列表、新增、编辑、删除、设为默认
  3. AI 各步骤（转录/拆解/仿写/直接创作）调用时从 DB 读取默认模板，完成变量插值后使用；无模板时 fallback 到现有硬编码逻辑
- **功能数量**：6 个功能点（F-001 ~ F-006）
- **前置依赖**：
  - v0.4.0 的 AI 仿写生成链路（`rewrite-worker.ts`、`transcription-worker.ts`）已完整
  - `AiModelConfig`、`AiStepBinding` 数据模型已存在
  - 系统设置管理后台 `/system-settings/ai` 已有管理员权限控制模式可参照
- **本版交付**：
  - Prisma schema：新增 `PromptTemplate` 表 + `PromptStepType` 枚举 + Prisma 迁移
  - Repository 层：`promptTemplateRepository`（CRUD + 设为默认事务）
  - Service 层：`promptTemplateService`（权限校验 + 业务规则）
  - API：`/api/prompt-templates` CRUD 端点（超级管理员专属）
  - AI 集成：各 worker 从 DB 读取模板并注入变量（带 fallback）
  - 前端：`/system-settings/prompt-templates` 管理页面（列表 + 新增/编辑抽屉）

---

## 边界结论

### 范围内

**数据层**
- Prisma 新增 `PromptStepType` 枚举：`TRANSCRIPTION` / `DECOMPOSITION` / `REWRITE` / `DIRECT_REWRITE`（对应 4 个 AI 步骤）
- Prisma 新增 `PromptTemplate` 表，字段：
  - `id` (cuid)、`name`（模板名称）、`stepType`（PromptStepType）
  - `content`（模板正文，支持 `{{variable}}` 占位符，TEXT 类型）
  - `modelConfigId`（可选，关联 `AiModelConfig`；为 null 时表示通用模板，不限模型）
  - `isDefault`（Boolean，每个 stepType 至多一个 true）
  - `isActive`（Boolean，软删除/停用标志）
  - `createdAt`、`updatedAt`

**Repository 层**（`promptTemplateRepository`）
- `findAll({ stepType?, isActive? })` — 列表查询，支持按 stepType 筛选
- `findById(id)` — 单条查询
- `findDefault(stepType)` — 查找指定步骤的默认模板（`isDefault=true AND isActive=true`）
- `create(data)` — 创建模板
- `update(id, data)` — 更新模板（name / content / modelConfigId / isActive）
- `setDefault(id, stepType)` — 事务：将同 stepType 所有模板 `isDefault=false`，再将目标模板 `isDefault=true`
- `delete(id)` — 硬删除（Repository 层）

**Service 层**（`promptTemplateService`）
- `list(params)` — 列表（调用 repository）
- `getById(id)` — 单条
- `create(data)` — 创建（若 `isDefault=true` 则调用 `setDefault` 事务）
- `update(id, data)` — 更新（若变更 `isDefault=true` 则调用 `setDefault` 事务）
- `setDefault(id)` — 设为默认（先查出 stepType，再调 repository 事务）
- `delete(id)` — 删除（默认模板不允许直接删除，需先切换默认）

**API 端点**（超级管理员专属，`requireRole(session, UserRole.SUPER_ADMIN)`）
- `GET /api/prompt-templates` — 列表（支持 `?stepType=` 筛选）
- `POST /api/prompt-templates` — 创建
- `GET /api/prompt-templates/[id]` — 单条
- `PATCH /api/prompt-templates/[id]` — 更新
- `DELETE /api/prompt-templates/[id]` — 删除
- `POST /api/prompt-templates/[id]/set-default` — 设为默认

**AI 集成**（带 fallback）
- 各步骤调用 AI 前，调用 `promptTemplateService.getDefaultTemplate(stepType)` 获取模板
- 获取到模板：用 mustache 风格替换 `{{variable}}` 变量，生成最终 Prompt
- 未获取到模板（DB 无记录）：fallback 到现有硬编码 Prompt 逻辑，不抛出错误
- 各步骤可用变量：
  - `TRANSCRIPTION`：`{{share_url}}`（视频分享链接）
  - `DECOMPOSITION`：`{{transcript_text}}`（转录文本）
  - `REWRITE`：`{{framework}}`（拆解批注框架）、`{{transcript}}`（原文）、`{{viewpoints}}`（观点素材）、`{{target_account}}`（目标账号信息）、`{{user_input}}`（临时素材）
  - `DIRECT_REWRITE`：`{{topic}}`（创作主题）、`{{viewpoints}}`（观点素材）、`{{target_account}}`（目标账号信息）、`{{user_input}}`（临时素材）

**前端页面**（`/system-settings/prompt-templates`，超级管理员专属路由）
- 页面布局沿用 `/system-settings/ai` 的管理后台模式
- 列表视图：
  - 按 stepType Tab 筛选（转录 / 拆解 / 仿写 / 直接创作）
  - 每行显示：模板名称、stepType badge、是否默认（badge）、关联模型（或"通用"）、操作列（编辑 / 删除 / 设为默认）
- 新增/编辑抽屉（Drawer/Sheet）：
  - 字段：名称（必填）、步骤类型（Select，必填）、模板内容（Textarea，必填）、关联模型（Select，可选）、是否设为默认（Switch）、是否启用（Switch）
  - 模板内容区域旁展示当前步骤的可用变量列表（提示性 UI，点击可复制变量名）
- 删除确认弹框（Confirm Dialog）：若为默认模板则展示警告文案，禁止删除

### 非目标（明确排除）

- **版本化 Prompt**：模板修改不记录历史版本，变更不回溯已生成的仿写结果
- **A/B 测试**：不支持同一步骤多模板轮询测试
- **模板语法校验**：不对 `{{variable}}` 变量名合法性做校验，只做基础非空校验
- **非管理员访问**：员工角色无任何 Prompt 模板的读写权限
- **分公司隔离**：模板全局共享，不按 `organizationId` 隔离
- **模板导入/导出**：不提供批量导入导出功能
- **模板预览/测试**：不在 UI 中提供"用当前模板跑一次 AI"的测试功能
- **自动迁移**：不将现有硬编码 Prompt 自动写入数据库；初始状态 DB 为空，系统 fallback 到硬编码

---

## 用户故事

### US-001：管理 Prompt 模板列表

**作为**超级管理员，  
**我希望**在管理后台能查看各 AI 步骤的所有 Prompt 模板，并能按步骤分类筛选，  
**以便**我清晰了解每个步骤当前使用的模板内容，及时发现和调整不合适的 Prompt。

**验收标准：**
- AC-001-1：进入 `/system-settings/prompt-templates` 页面，能看到模板列表，可按 stepType Tab 切换筛选
- AC-001-2：列表显示模板名称、步骤类型、是否默认、关联模型（或"通用"）及操作按钮
- AC-001-3：页面仅超级管理员可访问，其他角色访问返回 403

### US-002：创建和编辑 Prompt 模板

**作为**超级管理员，  
**我希望**通过表单创建新的 Prompt 模板并指定步骤类型，或修改已有模板的内容，  
**以便**根据业务经验优化每个 AI 步骤的指令，提升生成质量。

**验收标准：**
- AC-002-1：点击「新增模板」按钮，侧边抽屉打开，填写名称、步骤类型、模板内容后可提交
- AC-002-2：模板内容输入框旁展示当前步骤的可用变量提示（如 `{{viewpoints}}`），点击可复制
- AC-002-3：勾选「设为默认」创建模板时，同步将该步骤原默认模板的 `isDefault` 改为 false
- AC-002-4：编辑已有模板（名称、内容、关联模型、启用状态）后保存成功，列表刷新

### US-003：AI 步骤使用数据库中的默认模板

**作为**系统，  
**我希望**AI 各步骤执行前先检查数据库中是否有对应步骤的默认模板，  
**以便**管理员在后台修改 Prompt 后，新的 AI 调用即可生效，无需重新部署代码。

**验收标准：**
- AC-003-1：REWRITE 步骤执行时，若数据库中存在 stepType=REWRITE 的 isDefault=true 模板，则使用该模板的 content 替换 `{{framework}}`、`{{transcript}}`、`{{viewpoints}}`、`{{target_account}}`、`{{user_input}}` 后作为 Prompt
- AC-003-2：若数据库中无对应 stepType 的默认模板，AI 步骤正常执行且使用硬编码 Prompt（fallback），不报错
- AC-003-3：DIRECT_REWRITE 步骤同样从 DB 读取默认模板（stepType=DIRECT_REWRITE），fallback 行为相同

---

## 功能清单

### F-001：Prisma 数据模型 — PromptTemplate 表

**描述**：新增 `PromptStepType` 枚举和 `PromptTemplate` 数据模型，并生成 Prisma 迁移。

**验收标准：**
- AC-F001-1：`schema.prisma` 新增 `PromptStepType` 枚举，包含 `TRANSCRIPTION`、`DECOMPOSITION`、`REWRITE`、`DIRECT_REWRITE` 四个值
- AC-F001-2：`schema.prisma` 新增 `PromptTemplate` model，包含 `id`、`name`、`stepType`、`content`（`@db.Text`）、`modelConfigId?`、`modelConfig?`（关联 `AiModelConfig`，`onDelete: SetNull`）、`isDefault`、`isActive`、`createdAt`、`updatedAt` 字段
- AC-F001-3：`PromptTemplate` 表名 `@@map("prompt_templates")`；在 `(stepType, isDefault)` 上建索引
- AC-F001-4：`AiModelConfig` 模型中新增 `promptTemplates PromptTemplate[]` 反向关系
- AC-F001-5：`pnpm db:migrate` 执行成功，迁移文件正确生成

### F-002：Repository 层 — promptTemplateRepository

**描述**：实现 `PromptTemplateRepository` 类，封装所有数据库访问逻辑。

**验收标准：**
- AC-F002-1：`findAll({ stepType?, isActive? })` 返回满足条件的模板列表，按 `createdAt` 倒序
- AC-F002-2：`findDefault(stepType)` 返回 `stepType` 对应的 `isDefault=true AND isActive=true` 模板（无则返回 null）
- AC-F002-3：`setDefault(id, stepType)` 在事务中：先将同 stepType 所有模板 `isDefault` 置为 false，再将目标模板 `isDefault` 置为 true
- AC-F002-4：`delete(id)` 执行硬删除
- AC-F002-5：Repository 方法均接受可选的 `DatabaseClient` 参数（支持事务透传）

### F-003：Service 层 — promptTemplateService

**描述**：实现 `PromptTemplateService`，包含权限无关的业务规则，供 API Route Handler 调用。

**验收标准：**
- AC-F003-1：`create(data)` 若 `data.isDefault=true`，调用 `repository.setDefault` 事务；否则直接 `repository.create`
- AC-F003-2：`update(id, data)` 若 `data.isDefault=true` 且原来不是默认，调用 `setDefault` 事务
- AC-F003-3：`setDefault(id)` 先查出模板的 `stepType`，再调用 `repository.setDefault(id, stepType)`
- AC-F003-4：`delete(id)` 若目标模板 `isDefault=true`，抛出 `AppError`（code: `PROMPT_TEMPLATE_IS_DEFAULT`，message: "请先设置其他模板为默认后再删除"）
- AC-F003-5：`getDefaultTemplate(stepType)` 返回默认模板（用于 AI 调用集成），无模板时返回 null

### F-004：API 端点（CRUD）

**描述**：实现 Prompt 模板的 REST API，仅 `SUPER_ADMIN` 角色可访问。

**验收标准：**
- AC-F004-1：`GET /api/prompt-templates` 支持 `?stepType=REWRITE` 查询参数，返回 `{ success: true, data: PromptTemplateDTO[] }`
- AC-F004-2：`POST /api/prompt-templates` 接收 Zod 验证的请求体（name、stepType、content 必填，modelConfigId / isDefault / isActive 可选），返回新建模板
- AC-F004-3：`GET /api/prompt-templates/[id]` 返回单条模板，不存在时返回 404
- AC-F004-4：`PATCH /api/prompt-templates/[id]` 接收部分字段更新，返回更新后模板
- AC-F004-5：`DELETE /api/prompt-templates/[id]` 返回 204；若为默认模板返回 400 + 错误信息
- AC-F004-6：`POST /api/prompt-templates/[id]/set-default` 将目标模板设为默认，返回更新后模板
- AC-F004-7：所有端点 `requireRole(session, UserRole.SUPER_ADMIN)`，非超管返回 403

### F-005：AiGateway / Worker 集成 — 从 DB 读取并使用模板

**描述**：在 AI 各步骤执行前，从 DB 查找默认模板，完成变量替换后作为 Prompt；无模板时 fallback 到原有硬编码逻辑。

**验收标准：**
- AC-F005-1：`rewrite-worker.ts` 执行 REWRITE 步骤时，调用 `promptTemplateService.getDefaultTemplate('REWRITE')`；若返回非 null，将模板 content 中 `{{framework}}`、`{{transcript}}`、`{{viewpoints}}`、`{{target_account}}`、`{{user_input}}` 替换为实际值后作为 Prompt
- AC-F005-2：`rewrite-worker.ts` 执行 DIRECT_REWRITE 步骤时，同上使用 `DIRECT_REWRITE` 模板，变量为 `{{topic}}`、`{{viewpoints}}`、`{{target_account}}`、`{{user_input}}`
- AC-F005-3：`promptTemplateService.getDefaultTemplate(stepType)` 返回 null 时，worker 使用现有的 `buildRewriteUserPrompt` / `buildDirectRewriteUserPrompt` 等硬编码函数，不报错
- AC-F005-4：变量替换使用简单字符串替换（`content.replace(/\{\{variable\}\}/g, value)`），未定义的变量占位符保留原样（不报错）
- AC-F005-5：转录步骤（TRANSCRIPTION）和拆解步骤（DECOMPOSITION）同样接入 DB 模板查找（fallback 机制相同）

### F-006：前端管理页面

**描述**：在系统设置下新增 `/system-settings/prompt-templates` 页面，实现模板列表、新增/编辑抽屉。

**验收标准：**
- AC-F006-1：系统设置侧边导航新增「Prompt 模板」菜单项，点击跳转 `/system-settings/prompt-templates`，仅超级管理员可见
- AC-F006-2：页面顶部有 4 个 Tab（转录 / 拆解 / 仿写 / 直接创作），默认选中第一个，切换 Tab 时列表按 stepType 筛选
- AC-F006-3：列表包含列：模板名称、步骤类型、是否默认（badge）、关联模型（或"通用"）、启用状态、操作（编辑/删除/设为默认）
- AC-F006-4：点击「新增模板」/ 「编辑」打开右侧 Sheet（Drawer），包含：名称（Input）、步骤类型（Select，编辑时不可更改）、关联模型（Select，可选）、模板内容（Textarea，高度足够）、设为默认（Switch）、启用（Switch）
- AC-F006-5：模板内容 Textarea 下方展示当前步骤的可用变量列表（`Badge` 形式），点击 Badge 将 `{{variable}}` 复制到剪贴板
- AC-F006-6：点击「删除」，弹出 Confirm Dialog；若目标模板为默认模板，Dialog 中展示警告文案"该模板为当前默认，删除前请先切换默认模板"，且确认按钮禁用
- AC-F006-7：「设为默认」操作成功后，列表中原默认模板的「默认」badge 消失，新默认模板显示 badge
- AC-F006-8：所有表单操作（创建/更新/删除/设为默认）完成后，列表自动刷新

---

## 数据模型变更说明

### 新增枚举：PromptStepType

```prisma
enum PromptStepType {
  TRANSCRIPTION
  DECOMPOSITION
  REWRITE
  DIRECT_REWRITE
}
```

> 与现有 `AiStep` 枚举（`TRANSCRIBE / DECOMPOSE / REWRITE`）**分开维护**，原因：`AiStep` 是 step binding 的配置维度（用于选择用哪个模型），`PromptStepType` 是 Prompt 模板的业务维度（多出 `DIRECT_REWRITE` 子步骤）；两者语义不同，保持独立可各自演化。

### 新增表：prompt_templates

```prisma
model PromptTemplate {
  id            String          @id @default(cuid())
  name          String
  stepType      PromptStepType
  content       String          @db.Text
  modelConfigId String?
  modelConfig   AiModelConfig?  @relation(fields: [modelConfigId], references: [id], onDelete: SetNull)
  isDefault     Boolean         @default(false)
  isActive      Boolean         @default(true)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([stepType, isDefault])
  @@map("prompt_templates")
}
```

### AiModelConfig 变更（反向关系）

```prisma
model AiModelConfig {
  // ... 现有字段 ...
  promptTemplates PromptTemplate[]  // 新增反向关系
}
```

---

## API 设计汇总

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | `/api/prompt-templates` | 列表（`?stepType=`） | SUPER_ADMIN |
| POST | `/api/prompt-templates` | 创建模板 | SUPER_ADMIN |
| GET | `/api/prompt-templates/[id]` | 单条详情 | SUPER_ADMIN |
| PATCH | `/api/prompt-templates/[id]` | 更新模板 | SUPER_ADMIN |
| DELETE | `/api/prompt-templates/[id]` | 删除模板 | SUPER_ADMIN |
| POST | `/api/prompt-templates/[id]/set-default` | 设为默认 | SUPER_ADMIN |

### 请求体示例（POST /api/prompt-templates）

```json
{
  "name": "仿写标准模板 v1",
  "stepType": "REWRITE",
  "content": "【目标账号风格】\n账号名称：{{target_account}}\n\n【拆解框架】\n{{framework}}\n\n【原文案】\n{{transcript}}\n\n【观点素材】\n{{viewpoints}}\n{{user_input}}",
  "modelConfigId": null,
  "isDefault": true,
  "isActive": true
}
```

### 响应体示例（PromptTemplateDTO）

```json
{
  "id": "cuid...",
  "name": "仿写标准模板 v1",
  "stepType": "REWRITE",
  "content": "...",
  "modelConfigId": null,
  "isDefault": true,
  "isActive": true,
  "createdAt": "2026-04-28T00:00:00.000Z",
  "updatedAt": "2026-04-28T00:00:00.000Z"
}
```

### 错误码

| code | 场景 |
|------|------|
| `PROMPT_TEMPLATE_NOT_FOUND` | 指定 id 的模板不存在 |
| `PROMPT_TEMPLATE_IS_DEFAULT` | 尝试删除默认模板 |
| `VALIDATION_ERROR` | 请求体字段校验失败 |

---

## 关键决策

1. **`PromptStepType` 与 `AiStep` 分开维护**：`AiStep` 枚举（TRANSCRIBE / DECOMPOSE / REWRITE）用于步骤-模型绑定配置，而 `PromptStepType` 新增了 `DIRECT_REWRITE` 子步骤（直接创作与标准仿写业务语义不同），两者各自演化，不强行合并。

2. **DB 无模板时 Fallback 到硬编码**：初始上线时 DB 为空，不自动迁移现有硬编码 Prompt，保证系统不因"无默认模板"而中断 AI 流程；管理员在后台按需创建模板并设为默认后，AI 调用自动切换，实现零停机过渡。
