# v0.4.2 技术设计方案 — Prompt 模板管理

> 创建日期: 2026-04-28  
> 依赖版本: v0.4.0（AI 仿写生成链路完整）

---

## 1. 技术方案概览

本版本在现有 AI 配置管理体系之上扩展 Prompt 模板管理能力。**数据层**新增 `PromptStepType` 枚举与 `PromptTemplate` 表；**后端**按三层架构实现 `promptTemplateRepository` → `promptTemplateService` → 6 个 REST API 端点；**工具层**新增轻量渲染函数 `renderPromptTemplate`，提供 `{{variable}}` mustache 替换；**Worker 集成**在 `rewrite-worker.ts` 中对 REWRITE / DIRECT_REWRITE 两个步骤添加「先查 DB 模板、渲染变量、fallback 硬编码」逻辑；**前端**新增 `/system-settings/prompt-templates` 管理页面（SUPER_ADMIN 专属）。全程不破坏现有硬编码 Prompt fallback，迁移过程可逐步灰度。

---

## 2. Prisma Schema 变更

### 2.1 新增枚举

```prisma
// 新增：Prompt 步骤类型（独立于现有 AiStep，语义更清晰）
enum PromptStepType {
  TRANSCRIPTION
  DECOMPOSITION
  REWRITE
  DIRECT_REWRITE
}
```

> **与 `AiStep` 的关系**：现有 `AiStep`（TRANSCRIBE / DECOMPOSE / REWRITE）用于模型绑定，新增 `PromptStepType` 专用于 Prompt 模板，两者独立演化，不做合并。

### 2.2 新增模型

```prisma
model PromptTemplate {
  id            String         @id @default(cuid())
  name          String
  stepType      PromptStepType
  systemContent String?        @db.Text   // 可选：覆盖系统 Prompt；null 时 worker 使用硬编码 system prompt
  content       String         @db.Text   // 用户 Prompt 模板正文，支持 {{variable}} 占位符
  modelConfigId String?                   // 可选关联模型（null = 通用模板）
  modelConfig   AiModelConfig? @relation(fields: [modelConfigId], references: [id], onDelete: SetNull)
  isDefault     Boolean        @default(false)
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@index([stepType, isDefault])
  @@index([stepType, isActive])
  @@map("prompt_templates")
}
```

> **架构决策 — `systemContent` 字段**：需求文档中 content 字段仅描述用户 Prompt，但各步骤均有 system prompt（如 `buildRewriteSystemPrompt()` 返回的创作角色设定）。为使管理员能完整覆盖 AI 调用的两段 prompt，设计时增加可选的 `systemContent` 字段。若为 null，worker 继续使用硬编码 system prompt；若有值则覆盖之。PM 文档仅规定了 `content`，此字段为架构层增量，不影响现有需求验收。

### 2.3 修改现有模型

在 `AiModelConfig` 末尾新增反向关联：

```prisma
model AiModelConfig {
  // ... 现有字段不变 ...
  stepBindings    AiStepBinding[]
  rewriteVersions RewriteVersion[]
  promptTemplates PromptTemplate[]   // ← 新增反向关联
}
```

### 2.4 迁移文件命名

```
prisma/migrations/20260428010000_add_prompt_templates/migration.sql
```

---

## 3. Repository 层设计

**文件路径**: `src/server/repositories/prompt-template.repository.ts`

### 3.1 DTO 类型

```typescript
// src/types/prompt-template.ts（新增）

export interface PromptTemplateDTO {
  id: string;
  name: string;
  stepType: PromptStepType;
  systemContent: string | null;
  content: string;
  modelConfigId: string | null;
  modelConfigName: string | null;   // JOIN 结果，供列表展示
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromptTemplateInput {
  name: string;
  stepType: PromptStepType;
  systemContent?: string | null;
  content: string;
  modelConfigId?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdatePromptTemplateInput {
  name?: string;
  systemContent?: string | null;
  content?: string;
  modelConfigId?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface ListPromptTemplatesParams {
  stepType?: PromptStepType;
  isActive?: boolean;
}
```

### 3.2 Repository 方法签名

```typescript
type DatabaseClient = PrismaClient | Prisma.TransactionClient;

class PromptTemplateRepository {
  // 内部 toDTO 将 Prisma record + modelConfig 转为 DTO
  private toDTO(record: PromptTemplate & { modelConfig: AiModelConfig | null }): PromptTemplateDTO

  findAll(params: ListPromptTemplatesParams, db?: DatabaseClient): Promise<PromptTemplateDTO[]>
  findById(id: string, db?: DatabaseClient): Promise<PromptTemplateDTO | null>
  findDefault(stepType: PromptStepType, db?: DatabaseClient): Promise<PromptTemplate | null>
  create(input: CreatePromptTemplateInput, db?: DatabaseClient): Promise<PromptTemplateDTO>
  update(id: string, input: UpdatePromptTemplateInput, db?: DatabaseClient): Promise<PromptTemplateDTO | null>
  setDefault(id: string, stepType: PromptStepType, db?: DatabaseClient): Promise<void>
  delete(id: string, db?: DatabaseClient): Promise<boolean>
}

export const promptTemplateRepository = new PromptTemplateRepository();
```

### 3.3 方法实现要点

**`findAll`**
- `include: { modelConfig: { select: { id, name } } }`
- 过滤条件：`stepType`（可选）、`isActive`（可选）
- 排序：`createdAt: "desc"`

**`findById`**
- `include: { modelConfig: { select: { id, name } } }`
- 不找到返回 null

**`findDefault`**
- `where: { stepType, isDefault: true, isActive: true }`
- 返回原始 Prisma record（含 systemContent / content）供 worker 直接消费，不转 DTO
- 若多条（理论不应出现），取 `createdAt` 最早的一条（`orderBy: { createdAt: "asc" }, take: 1`）

**`create`**
- 使用 `db.promptTemplate.create({ data: input, include: { modelConfig } })`

**`update`**
- 先查 `findUnique`，不存在返回 null
- 仅更新传入的非 undefined 字段

**`setDefault` 事务逻辑**（核心）
```typescript
async setDefault(id: string, stepType: PromptStepType, db: DatabaseClient = prisma): Promise<void> {
  // 若 db 已是事务客户端则直接使用，否则开启新事务
  const run = async (tx: Prisma.TransactionClient) => {
    // Step 1: 将同 stepType 所有模板 isDefault 置 false
    await tx.promptTemplate.updateMany({
      where: { stepType },
      data: { isDefault: false },
    });
    // Step 2: 将目标模板 isDefault 置 true
    await tx.promptTemplate.update({
      where: { id },
      data: { isDefault: true },
    });
  };

  if ("$transaction" in db) {
    await (db as PrismaClient).$transaction(run);
  } else {
    await run(db as Prisma.TransactionClient);
  }
}
```

**`delete`**
- 先查存在性，不存在返回 false
- 执行 `db.promptTemplate.delete({ where: { id } })`（硬删除）
- 返回 true

---

## 4. Service 层设计

**文件路径**: `src/server/services/prompt-template.service.ts`

### 4.1 方法签名与业务规则

```typescript
class PromptTemplateService {
  list(params: ListPromptTemplatesParams): Promise<PromptTemplateDTO[]>
  getById(id: string): Promise<PromptTemplateDTO>
  create(input: CreatePromptTemplateInput): Promise<PromptTemplateDTO>
  update(id: string, input: UpdatePromptTemplateInput): Promise<PromptTemplateDTO>
  setDefault(id: string): Promise<PromptTemplateDTO>
  delete(id: string): Promise<void>
  getDefaultTemplate(stepType: PromptStepType): Promise<PromptTemplate | null>
}

export const promptTemplateService = new PromptTemplateService();
```

### 4.2 各方法业务规则

**`list(params)`**
- 直接透传 repository.findAll(params)

**`getById(id)`**
- 调用 repository.findById(id)
- 若为 null，抛出 `AppError("NOT_FOUND", "模板不存在", 404)`

**`create(input)`**
- 调用 `repository.create({ ...input, isDefault: false })` 获得新记录
- 若原始 `input.isDefault === true`，再调用 `repository.setDefault(newRecord.id, input.stepType)`
- 返回 repository.findById(newRecord.id)

**`update(id, input)`**
- 调用 `repository.findById(id)` 确认存在（不存在抛 NOT_FOUND）
- 若 `input.isDefault === true`，调用 `repository.setDefault(id, existing.stepType)` 后再 update 其余字段
- 若 `input.isDefault === false` 且当前 `existing.isDefault === true`，抛出 `AppError("PROMPT_TEMPLATE_CANNOT_UNSET_DEFAULT", "不能直接取消默认，请将其他模板设为默认", 400)`
- 返回更新后的 DTO

**`setDefault(id)`**
- 先 `repository.findById(id)` 获取 stepType（不存在抛 NOT_FOUND）
- 调用 `repository.setDefault(id, stepType)`
- 返回更新后的 `repository.findById(id)`

**`delete(id)`**
- 先 `repository.findById(id)` 获取记录（不存在抛 NOT_FOUND）
- 若 `record.isDefault === true`，抛出 `AppError("PROMPT_TEMPLATE_IS_DEFAULT", "请先将其他模板设为默认后再删除", 400)`
- 调用 `repository.delete(id)`

**`getDefaultTemplate(stepType)`** — 供 Worker 专用
```typescript
async getDefaultTemplate(stepType: PromptStepType): Promise<PromptTemplate | null> {
  try {
    return await promptTemplateRepository.findDefault(stepType);
  } catch (error) {
    console.warn("[PromptTemplateService] Failed to fetch default template", {
      stepType,
      error: error instanceof Error ? error.message : error,
    });
    return null;  // 失败时 fallback，不抛异常
  }
}
```

---

## 5. 变量替换工具函数

**文件路径**: `src/lib/prompt-template-renderer.ts`

```typescript
/**
 * 将模板内容中的 {{variable}} 占位符替换为对应变量值。
 * 若变量表中不存在该 key，保留原始占位符（避免生成残缺 Prompt）。
 */
export function renderPromptTemplate(
  content: string,
  variables: Record<string, string>,
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in variables ? variables[key] : match;
  });
}
```

**设计决策**：
- 正则 `/\{\{(\w+)\}\}/g`：`\w+` 匹配字母、数字、下划线，覆盖 `share_url`、`target_account`、`user_input` 等含下划线的变量名
- 未找到变量时保留原始占位符（如 `{{unknown}}`），避免生成语义缺失的 Prompt
- 纯函数，无副作用，易于单元测试

---

## 6. AI Worker 集成方案

**集成原则**：不破坏现有逻辑，在各 Prompt 构建点前插入「查 DB → 有则渲染 → 无则 fallback」逻辑。

### 6.1 修改文件

| 文件 | 改动类型 | 改动描述 |
|------|----------|----------|
| `src/lib/rewrite-worker.ts` | 修改 | 在 `systemPrompt` / `userPrompt` 赋值前插入模板读取逻辑 |
| `src/lib/prompt-template-renderer.ts` | 新增 | 变量渲染工具函数 |

> **TRANSCRIPTION / DECOMPOSITION 步骤**：`transcription-worker.ts` 中 prompt 由 `aiGateway.streamTranscriptionFromVideo()` 内部管理，接口未暴露 prompt 参数。该步骤的模板管理（UI 可创建，但 worker 暂不消费）留待 AI Gateway 改造时实现，不在本版本 Worker 集成范围内。

### 6.2 REWRITE 步骤集成

在 `rewrite-worker.ts` 的 worker 处理函数中，找到 `// 4. Build prompts` 注释处，添加以下逻辑：

**WORKSPACE 模式（原 `mode !== "direct"`）**：

```typescript
// Step 4a: Try DB template for REWRITE
const rewriteTemplate = await promptTemplateService.getDefaultTemplate(
  PromptStepType.REWRITE,
);

let systemPrompt: string;
let userPrompt: string;

if (rewriteTemplate) {
  // 渲染变量
  const targetAccountStr = [
    `账号名称：${targetAccountNickname}`,
    `账号简介：${targetAccountSignature ?? "暂无"}`,
  ].join("\n");

  const annotationsText = workspace.annotations
    .map((a) => `• "${a.quotedText}"：${a.note ?? a.function ?? "（无说明）"}`)
    .join("\n");

  const fragmentsText =
    orderedFragments.length > 0
      ? orderedFragments.map((f) => `• ${f.content}`).join("\n")
      : "（未选择观点，请基于框架结构自由创作）";

  const variables: Record<string, string> = {
    framework: annotationsText,
    transcript: transcriptText,
    viewpoints: fragmentsText,
    target_account: targetAccountStr,
    user_input: version.userInputContent?.trim() ?? "",
  };

  systemPrompt = rewriteTemplate.systemContent
    ? renderPromptTemplate(rewriteTemplate.systemContent, variables)
    : buildRewriteSystemPrompt();

  userPrompt = renderPromptTemplate(rewriteTemplate.content, variables);
} else {
  // Fallback to hardcoded logic
  systemPrompt = buildRewriteSystemPrompt();
  userPrompt = buildRewriteUserPrompt({
    targetAccountNickname,
    targetAccountSignature,
    annotations: workspace.annotations,
    transcriptText,
    fragments: orderedFragments,
    userInputContent: version.userInputContent ?? null,
  });
}
```

### 6.3 DIRECT_REWRITE 步骤集成

**DIRECT 模式**（`mode === "direct"`）：

```typescript
const directTemplate = await promptTemplateService.getDefaultTemplate(
  PromptStepType.DIRECT_REWRITE,
);

if (directTemplate) {
  const targetAccountStr = [
    `账号名称：${targetAccountNickname}`,
    `账号简介：${targetAccountSignature ?? "暂无"}`,
  ].join("\n");

  const fragmentsText =
    orderedFragments.length > 0
      ? orderedFragments.map((f) => `• ${f.content}`).join("\n")
      : "（未选择观点，请基于创作主题自由创作）";

  const variables: Record<string, string> = {
    topic: topic,
    viewpoints: fragmentsText,
    target_account: targetAccountStr,
    user_input: version.userInputContent?.trim() ?? "",
  };

  systemPrompt = directTemplate.systemContent
    ? renderPromptTemplate(directTemplate.systemContent, variables)
    : buildRewriteSystemPrompt();

  userPrompt = renderPromptTemplate(directTemplate.content, variables);
} else {
  // Fallback
  systemPrompt = buildRewriteSystemPrompt();
  userPrompt = buildDirectRewriteUserPrompt({
    targetAccountNickname,
    targetAccountSignature,
    topic,
    fragments: orderedFragments,
    userInputContent: version.userInputContent ?? null,
  });
}
```

### 6.4 新增 import

在 `rewrite-worker.ts` 顶部新增：

```typescript
import { PromptStepType } from "@prisma/client";
import { renderPromptTemplate } from "@/lib/prompt-template-renderer";
import { promptTemplateService } from "@/server/services/prompt-template.service";
```

**重构边界**：现有 `buildRewriteSystemPrompt`、`buildRewriteUserPrompt`、`buildDirectRewriteUserPrompt` 函数**保留不删**，作为 fallback 路径继续使用。

---

## 7. API 端点设计

**路由目录**：`src/app/api/prompt-templates/`

所有端点均要求 `SUPER_ADMIN` 角色，在 handler 顶部执行：
```typescript
const session = await auth();
requireRole(session, UserRole.SUPER_ADMIN);
```

### 7.1 端点总览

| 方法 | 路径 | 描述 | 状态码 |
|------|------|------|--------|
| GET | `/api/prompt-templates` | 列表查询（支持 `?stepType=` 筛选） | 200 |
| POST | `/api/prompt-templates` | 创建模板 | 201 |
| GET | `/api/prompt-templates/[id]` | 单条查询 | 200 / 404 |
| PATCH | `/api/prompt-templates/[id]` | 部分更新 | 200 / 404 |
| DELETE | `/api/prompt-templates/[id]` | 删除 | 200 / 404 |
| POST | `/api/prompt-templates/[id]/set-default` | 设为默认 | 200 / 404 |

### 7.2 文件路径规划

```
src/app/api/prompt-templates/
├── route.ts                       # GET list + POST create
└── [id]/
    ├── route.ts                   # GET one + PATCH + DELETE
    └── set-default/
        └── route.ts               # POST set-default
```

### 7.3 Zod Schema 定义

```typescript
// src/app/api/prompt-templates/route.ts 顶部

const createSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100),
  stepType: z.nativeEnum(PromptStepType),
  systemContent: z.string().min(1).nullable().optional(),
  content: z.string().min(1, "模板内容不能为空"),
  modelConfigId: z.string().cuid().nullable().optional(),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

const listQuerySchema = z.object({
  stepType: z.nativeEnum(PromptStepType).optional(),
  isActive: z.coerce.boolean().optional(),
});
```

```typescript
// src/app/api/prompt-templates/[id]/route.ts 顶部

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  systemContent: z.string().min(1).nullable().optional(),
  content: z.string().min(1).optional(),
  modelConfigId: z.string().cuid().nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
```

### 7.4 响应格式

所有成功响应：
```json
{ "success": true, "data": { ...PromptTemplateDTO } }
```
列表响应：
```json
{ "success": true, "data": [ ...PromptTemplateDTO[] ] }
```
错误响应遵循统一格式：
```json
{ "success": false, "error": { "code": "...", "message": "..." } }
```

---

## 8. 前端设计

### 8.1 页面入口

```
src/app/(dashboard)/system-settings/prompt-templates/page.tsx
```

```tsx
import { PromptTemplatesPageView } from "@/components/features/system-settings/prompt-templates-page";

export default function PromptTemplatesPage() {
  return <PromptTemplatesPageView />;
}
```

> 页面路由访问控制：SUPER_ADMIN 专属，通过 middleware 中的 dashboard 鉴权逻辑保护（与现有 `/system-settings/ai` 一致），API 层有二重保障。

### 8.2 组件结构

```
src/components/features/system-settings/
└── prompt-templates-page.tsx        # 页面主组件（含状态管理）
    ├── <DashboardPageShell>          # 页面壳
    ├── <Tabs>                        # stepType Tab 筛选（转录/拆解/仿写/直接创作）
    ├── <PromptTemplateTable>         # 桌面端表格（内联，非独立文件）
    ├── <PromptTemplateMobileCard>    # 移动端卡片列表（内联）
    ├── <PromptTemplateDrawer>        # 新增/编辑抽屉（Sheet）
    └── <PromptTemplateDeleteDialog>  # 删除确认弹框（AlertDialog）
```

### 8.3 状态管理

使用 React `useState`（无需 Zustand），状态定义：

```typescript
const [templates, setTemplates] = useState<PromptTemplateDTO[]>([]);
const [loading, setLoading] = useState(true);
const [activeTab, setActiveTab] = useState<PromptStepType>("REWRITE");
const [drawerOpen, setDrawerOpen] = useState(false);
const [editingTemplate, setEditingTemplate] = useState<PromptTemplateDTO | null>(null);
const [deleteTarget, setDeleteTarget] = useState<PromptTemplateDTO | null>(null);
```

### 8.4 Tab 标签映射

```typescript
const STEP_TYPE_LABELS: Record<PromptStepType, string> = {
  REWRITE: "仿写",
  DIRECT_REWRITE: "直接创作",
  TRANSCRIPTION: "转录",
  DECOMPOSITION: "拆解",
};
```

### 8.5 可用变量列表 UI

在新增/编辑抽屉的 `content` Textarea 上方，展示当前 stepType 的可用变量：

```typescript
const STEP_VARIABLES: Record<PromptStepType, Array<{ name: string; description: string }>> = {
  TRANSCRIPTION: [
    { name: "share_url", description: "视频分享链接" },
  ],
  DECOMPOSITION: [
    { name: "transcript_text", description: "转录文本" },
  ],
  REWRITE: [
    { name: "framework", description: "对标视频拆解批注框架" },
    { name: "transcript", description: "对标视频原文案" },
    { name: "viewpoints", description: "观点素材" },
    { name: "target_account", description: "目标账号信息" },
    { name: "user_input", description: "创作者补充的临时素材" },
  ],
  DIRECT_REWRITE: [
    { name: "topic", description: "创作主题/指令" },
    { name: "viewpoints", description: "观点素材" },
    { name: "target_account", description: "目标账号信息" },
    { name: "user_input", description: "创作者补充的临时素材" },
  ],
};
```

每个变量显示为可点击的 pill（`badge variant="outline"`），点击复制 `{{variable_name}}` 到剪贴板。

### 8.6 删除约束 UI

删除目标为 `isDefault=true` 时，`AlertDialog` 中展示警告文案：
> "此模板为当前默认模板，删除前请先将其他模板设为默认。"
并将「确认删除」按钮置为 disabled。

（防御性设计：API 层已有相同业务规则保护，前端仅为提升体验。）

### 8.7 抽屉表单字段

| 字段 | 组件 | 校验规则 |
|------|------|----------|
| 名称 | Input | 必填，1~100 字符 |
| 步骤类型 | Select | 必填；编辑模式下只读 |
| 系统 Prompt（可选） | Textarea | 可为空 |
| 模板内容 | Textarea | 必填，min-h-[200px] |
| 关联模型 | Select | 可选，选项从 `/api/ai-config/settings` 获取 |
| 设为默认 | Switch | 默认 off |
| 是否启用 | Switch | 默认 on |

---

## 9. 跨模块依赖与执行顺序约束

```
T-BE-001 (Schema) 
  → T-BE-002 (Migration)
  → T-BE-003 (Repository)
  → T-BE-004 (Service)
  → T-BE-005 (API Routes)      ←─ 可与 T-BE-006 并行
  → T-BE-006 (Types)           ←─
  → T-BE-007 (Worker 集成)     ← 依赖 T-BE-004 Service
  → T-FE-001 (前端页面)        ← 依赖 T-BE-005 API 可用
```

**共享类型文件**: `src/types/prompt-template.ts`  
前端直接导入 `PromptTemplateDTO`、`PromptStepType`（Prisma 生成）。

---

## 10. 任务分解

### 后端任务

```
- [ ] T-BE-001: 新增 Prisma Schema（估时 0.5h）
  - 文件：prisma/schema.prisma
  - 说明：新增 PromptStepType 枚举、PromptTemplate 模型、AiModelConfig 反向关联

- [ ] T-BE-002: 生成并验证数据库迁移（估时 0.5h）
  - 文件：prisma/migrations/20260428010000_add_prompt_templates/migration.sql
  - 说明：pnpm db:migrate 执行迁移，验证表结构

- [ ] T-BE-003: 实现 promptTemplateRepository（估时 2h）
  - 文件：src/server/repositories/prompt-template.repository.ts
  - 说明：findAll / findById / findDefault / create / update / setDefault(事务) / delete

- [ ] T-BE-004: 实现 promptTemplateService（估时 2h）
  - 文件：src/server/services/prompt-template.service.ts
  - 说明：list / getById / create / update / setDefault / delete(禁删默认) / getDefaultTemplate(带 warn fallback)

- [ ] T-BE-005: 实现变量渲染工具（估时 0.5h）
  - 文件：src/lib/prompt-template-renderer.ts
  - 说明：renderPromptTemplate 纯函数，未知变量保留原占位符

- [ ] T-BE-006: 定义共享类型（估时 0.5h）
  - 文件：src/types/prompt-template.ts
  - 说明：PromptTemplateDTO / CreatePromptTemplateInput / UpdatePromptTemplateInput / ListPromptTemplatesParams

- [ ] T-BE-007: 实现 API 端点（估时 3h）
  - 文件：
    src/app/api/prompt-templates/route.ts
    src/app/api/prompt-templates/[id]/route.ts
    src/app/api/prompt-templates/[id]/set-default/route.ts
  - 说明：6 个端点，均 SUPER_ADMIN 鉴权，Zod 校验，调用 Service

- [ ] T-BE-008: Rewrite Worker 集成（估时 2h）
  - 文件：src/lib/rewrite-worker.ts
  - 说明：REWRITE / DIRECT_REWRITE 步骤前插入 DB 模板读取 + 变量渲染逻辑，保留 fallback
```

### 前端任务

```
- [ ] T-FE-001: 实现 Prompt 模板管理页面（估时 5h）
  - 文件：
    src/app/(dashboard)/system-settings/prompt-templates/page.tsx
    src/components/features/system-settings/prompt-templates-page.tsx
  - 说明：Tab 筛选 + 表格列表 + 新增/编辑 Sheet 抽屉 + 删除 AlertDialog + 变量 pill 提示
```

**任务总数**：9 个  
**总估时**：约 16h

---

## 附录 A：各步骤变量映射完整表

| PromptStepType | 变量名 | Worker 中对应值 | 备注 |
|----------------|--------|-----------------|------|
| REWRITE | `framework` | annotations 格式化文本 | `buildRewriteUserPrompt` 内的 `annotationsText` |
| REWRITE | `transcript` | `transcriptText` | workspace transcript |
| REWRITE | `viewpoints` | fragments 格式化文本 | `fragmentsText` |
| REWRITE | `target_account` | 账号名称 + 简介拼接 | `targetAccountNickname` + `targetAccountSignature` |
| REWRITE | `user_input` | `version.userInputContent` | 可为空字符串 |
| DIRECT_REWRITE | `topic` | `version.rewrite.topic` | 必填 |
| DIRECT_REWRITE | `viewpoints` | fragments 格式化文本 | 同 REWRITE |
| DIRECT_REWRITE | `target_account` | 账号名称 + 简介拼接 | 同 REWRITE |
| DIRECT_REWRITE | `user_input` | `version.userInputContent` | 可为空字符串 |
| TRANSCRIPTION | `share_url` | 视频 URL | **本版 worker 暂不集成** |
| DECOMPOSITION | `transcript_text` | 转录文本 | **本版 worker 暂不集成** |

---

## 附录 B：最复杂技术决策

**`setDefault` 事务 vs 创建时原子化**

`create(data)` 中若 `isDefault=true`，采用「先 create（isDefault=false）→ 再 setDefault 事务」两步方案，而非在单一事务中同时完成。

**理由**：Repository 层 `setDefault` 设计为独立可复用的事务单元（`create` / `update` / `setDefault` API 三条路径均需调用）。若将创建与 setDefault 合并成一个特殊事务，则 `setDefault` 方法需要额外的 `data` 参数重载，破坏其单一职责。

**风险**：极低并发场景下，create 成功但 setDefault 失败，导致模板存在但未被设为默认——此为幂等可重试操作，管理员可手动点击「设为默认」恢复，不影响核心仿写链路（仅影响模板管理 UI 状态）。系统无自动任务依赖「创建时立即成为默认」的语义，风险可接受。
