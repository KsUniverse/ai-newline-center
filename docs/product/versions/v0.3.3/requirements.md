# v0.3.3 需求文档 — AI 仿写生成

> 版本: v0.3.3
> 里程碑: v0.3.x（AI 拆解 + 碎片观点）
> 需求来源: [PRD.md M-005](../../PRD.md) F-005-1
> 创建日期: 2026-04-11

---

## 版本信息

| 属性 | 值 |
|------|-----|
| 版本号 | v0.3.3 |
| 里程碑 | v0.3.x — AI 拆解 + 碎片观点 |
| 功能点 | F-005-1（AI 仿写生成）|
| 依赖版本 | v0.3.2（碎片观点库）+ v0.3.1（AI 工作台 + 拆解）|
| 优先级分布 | P0(1) |

> **版本定位说明**：在 v0.3.2 建立观点库后，本版接入 AI 仿写生成能力。重构仿写阶段为三栏布局，新增 `Rewrite + RewriteVersion` 数据模型，通过 BullMQ 异步生成 AI 仿写文案，支持多版本管理与人工编辑。
>
> **v0.3.3.1 预留**：不依赖拆解视频（纯观点+指令直接创作）的入口，留到 v0.3.3.1 实现。

---

## 摘要

- **版本目标**：在 AI 工作台的「仿写」阶段，选择目标账号、碎片观点、输入临时素材，选择模型后由 AI 生成完整仿写文案；支持多次生成产出多个版本，每个版本可人工编辑。
- **功能数量**：F-005-1 的首轮落地（不含版本管理独立页、Prompt 模板管理）
- **前置依赖**：
  - 当前视频的 AI 拆解必须已完成（有 Annotation 记录）
  - v0.3.2 的观点库（Fragment 表）已存在
  - 系统 AI 配置中已配置至少一个 AiModelConfig
  - 员工已添加至少一个「我的账号」（DouyinAccount，type=MY_ACCOUNT）
- **本版交付**：
  - 仿写阶段三栏布局重构
  - ViewpointPicker 多选弹框（今日观点）
  - 目标账号选择、模型选择
  - BullMQ 仿写任务队列 + RewriteWorker
  - `Rewrite` + `RewriteVersion` 表（含 Prisma 迁移）
  - AI 生成 → 结果回填 → 人工编辑 → 自动保存链路
  - 本地持久化（localStorage，按 videoId 存储选择状态）

---

## 边界结论

### 范围内

- 仿写阶段三栏布局：左栏（拆解批注列表）、中栏（转录原文，批注高亮响应）、右栏（仿写操作区）
- 右栏操作区组件（从上至下）：
  1. 「选择今日观点」按钮 → 多选弹框（ViewpointPicker）
  2. 已选观点 Chip 展示（可逐条移除）
  3. 临时素材输入框（促进创作的金句/例子，不入观点库）
  4. 目标账号选择（下拉，仅 MY_ACCOUNT 类型）
  5. AI 模型选择（下拉，全量 AiModelConfig）
  6. 版本 Badge/下拉（版本 N，切换历史版本）
  7. 「仿写」按钮
  8. 生成结果编辑区（editable textarea）
- 每次点击「仿写」生成一个新版本（RewriteVersion），版本编号自增
- 切换版本时，编辑区展示对应版本内容（editedContent ?? generatedContent）
- 编辑区内容修改时自动防抖保存为 RewriteVersion.editedContent
- 已有编辑内容时再次点击「仿写」弹出确认对话框
- 生成期间「仿写」按钮禁用，展示生成中状态
- localStorage 按 videoId 缓存：已选观点 IDs、临时素材文本、已选模型 ID、已选目标账号 ID（切换视频时清空）
- AI Prompt 注入：目标账号昵称 + 简介（v0.3.3 仅此，后续版本迭代加入历史仿写经验数据）

### 非目标（明确排除）

- 不依赖拆解视频的直接创作入口（→ v0.3.3.1）
- 历史仿写经验注入 Prompt（→ M-006 发布复盘后）
- 「标记最终稿」按钮（当前激活版本即为最终稿，后续需要时再加）
- 版本数量上限
- Prompt 模板管理（→ F-005-3）
- 仿写结果与我的账号视频关联（→ M-006 F-006-1）

---

## 用户故事

1. 作为员工，在完成视频 AI 拆解后，我希望能在仿写区直接让 AI 基于拆解框架 + 我选的观点生成一篇新文案，而不是自己从零开始写。
2. 作为员工，我希望能多次生成、比较不同模型/不同观点组合的输出，切换查看历史版本。
3. 作为员工，拿到 AI 生成的文案后，我希望能在界面上直接修改，改完自动保存，不需要手动点"保存"。
4. 作为员工，我希望仿写时能选择这篇文案要发布的账号，让 AI 了解该账号风格偏好。

---

## 功能清单

### F-005-1-A: 仿写阶段三栏布局重构（P0）

**描述**：将当前仿写阶段（`AiWorkspaceRewriteStageModern`）重构为三栏布局。

#### 三栏定义

| 栏位 | 内容 | 交互 |
|------|------|------|
| 左栏（~25%） | 拆解批注列表 | 点击某条批注 → 中栏对应引文高亮 |
| 中栏（~35%） | 转录文案全文 | 只读，响应左栏点击时高亮对应引文片段 |
| 右栏（~40%） | 仿写操作区 | 详见 F-005-1-B |

- 左栏和中栏样式参考现有 `AiWorkspaceTranscriptCanvas` 风格（Linear 风格卡片）
- 左栏和中栏**仅展示**，不支持 AI 转录阶段的操作（不可创建批注、不可编辑文案、不可选中文本触发新批注）
- 仅支持点击左栏批注在中栏触发高亮（视觉反馈）

#### 进入仿写阶段的前置检查

- 若 `annotations.length === 0`（未完成拆解），右栏展示禁用提示："请先完成拆解步骤，才能发起 AI 仿写"，「仿写」按钮不可点击

---

### F-005-1-B: 右栏仿写操作区（P0）

**描述**：右栏从上至下包含以下模块：

#### 1. 观点选择

- 一个「选择今日观点」按钮，点击打开 **ViewpointPicker 弹框**
- 弹框内容：
  - 搜索框（debounce 300ms）
  - 今日观点列表（scope=today，最多 50 条）
  - 每条观点：checkbox + 文本内容 + 创建者
  - 底部：「确认」按钮（关闭弹框，更新选中列表）
  - 已选数量 badge
- 弹框关闭后，右栏显示已选观点的 Chip 列表：
  - 每条 chip 展示观点前 30 字 + 「×」移除按钮
  - 整体已选数量 badge
- 观点为可选（0 条亦可发起生成）

#### 2. 临时素材输入框

- 标签："临时素材（不入观点库）"
- 多行文本框，最多 500 字
- 占位文字："输入金句、例子、数据等，直接参与本次仿写"
- 内容实时写入 localStorage（不存 DB，每次生成时作为 Prompt 输入）

#### 3. 目标账号选择

- 标签："目标发布账号"
- 下拉组件，数据来源：当前员工自己的 DouyinAccount 列表（type=MY_ACCOUNT）
- 若员工没有账号：禁用状态 + 提示"请先在「我的账号」中添加抖音账号"
- 目标账号为**必选**，未选时「仿写」按钮 disabled
- 选中后展示账号头像 + 昵称

#### 4. AI 模型选择

- 标签："生成模型"
- 下拉，数据来源：`GET /api/ai-config/settings` 返回的全部 AiModelConfig
- 展示模型名称（name 字段）
- 默认选中系统 REWRITE 步骤绑定的模型（若有），否则选第一个
- 未配置任何模型时：禁用状态 + 提示"请联系管理员配置 AI 模型"

#### 5. 版本面板

- 当前版本号 Badge + 下拉展开历史版本列表
- 每项显示：「版本 N」+ 创建时间 + 所用模型名
- 点击切换版本：编辑区内容切换到该版本的 `editedContent ?? generatedContent`
- 无版本时：Badge 显示「暂无版本」

#### 6. 「仿写」按钮

禁用条件（任一满足即禁用）：
- `annotations.length === 0`（未拆解）
- 目标账号未选
- 模型未配置/未选
- 当前有版本处于 GENERATING 状态

点击逻辑：
1. 若编辑区有已修改内容（当前版本 editedContent 非空）：弹出确认对话框「将生成新版本，当前编辑内容将保留在版本 N 中，继续？」
2. 确认后：调用 `POST /api/ai-workspace/[videoId]/rewrite/generate`
3. 轮询新版本状态，生成中显示 loading，完成后填入编辑区

#### 7. 生成结果编辑区

- 多行 textarea，占满右栏剩余高度
- 状态：
  - **无版本**：空，placeholder="点击「仿写」生成 AI 文案"
  - **GENERATING**：禁用态，placeholder="AI 正在生成..."（可加 spinner）
  - **FAILED**：显示错误提示文字，可重新生成
  - **COMPLETED**：展示 `editedContent ?? generatedContent`，可编辑
- 编辑时：debounce 1s 后自动保存（PATCH editedContent 到 RewriteVersion）
- 字数统计 badge（右上角）

---

### F-005-1-C: 数据模型（P0）

#### 新增 Prisma 模型

```prisma
model Rewrite {
  id              String          @id @default(cuid())
  workspaceId     String          @unique
  targetAccountId String?
  organizationId  String
  userId          String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  workspace     AiWorkspace     @relation(fields: [workspaceId], references: [id])
  targetAccount DouyinAccount?  @relation(fields: [targetAccountId], references: [id])
  organization  Organization    @relation(fields: [organizationId], references: [id])
  user          User            @relation(fields: [userId], references: [id])
  versions      RewriteVersion[]
}

model RewriteVersion {
  id               String   @id @default(cuid())
  rewriteId        String
  versionNumber    Int      // 每个 Rewrite 内自增，从 1 开始
  generatedContent String?  @db.Text  // AI 生成原文
  editedContent    String?  @db.Text  // 用户编辑稿（优先展示）
  modelConfigId    String?
  usedFragmentIds  Json     @default("[]")  // string[] 今日已选观点 IDs
  userInputContent String?  @db.Text  // 临时素材（BC-1 输入框内容）
  status           RewriteVersionStatus @default(GENERATING)
  errorMessage     String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  rewrite     Rewrite         @relation(fields: [rewriteId], references: [id])
  modelConfig AiModelConfig?  @relation(fields: [modelConfigId], references: [id])

  @@unique([rewriteId, versionNumber])
}

enum RewriteVersionStatus {
  GENERATING
  COMPLETED
  FAILED
}
```

#### 关系说明

- `AiWorkspace` 1:1 → `Rewrite`（一工作台一仿写任务）
- `Rewrite` 1:N → `RewriteVersion`（每次点击「仿写」新增一版本）
- `Rewrite.targetAccountId` → `DouyinAccount`（目标发布账号）
- `RewriteVersion.modelConfigId` → `AiModelConfig`（每版本独立记录所用模型，模型被删除时 nullable）

---

### F-005-1-D: BullMQ 仿写任务（P0）

**任务队列**：`REWRITE_QUEUE_NAME = "rewrite"`

**Job Data**：
```typescript
interface RewriteJobData {
  rewriteVersionId: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
}
```

**Worker 执行流程**：
1. 读取 RewriteVersion → 关联 Rewrite → 关联 AiWorkspace（含 transcript + annotations）
2. 从 AiModelConfig 读取模型配置（baseUrl + apiKey + modelName）
3. 从 DouyinAccount 读取目标账号信息（nickname + signature）
4. 从 Fragment 表批量读取 usedFragmentIds 对应的观点文本
5. 组建 Prompt（见 F-005-1-E）
6. 调用 Vercel AI SDK `generateText`（非流式，因任务为后台异步）
7. 成功：将结果写入 `RewriteVersion.generatedContent`，status → COMPLETED
8. 失败：status → FAILED，errorMessage 记录错误详情
9. 重试策略：最多 2 次，指数退避

**配置**：
- `removeOnComplete: { age: 86_400 }`（24h 后清理）
- `removeOnFail: false`（失败保留，便于排查）

---

### F-005-1-E: AI Prompt 设计（P0）

**System Prompt**：
```
你是一位短视频文案创作专家，擅长基于对标视频的内容框架，结合观点素材，创作适合特定账号风格的短视频文案。
```

**User Prompt 结构**（按优先级排列）：
```
【目标账号风格】
账号名称：{targetAccount.nickname}
账号简介：{targetAccount.signature ?? "暂无"}

【对标视频拆解框架】
以下是对标视频的拆解批注，每条批注说明了原文对应的写作手法或内容角色：
{annotations.map(a => `• "${a.quotedText}"：${a.note ?? a.function}`).join('\n')}

【对标视频原文案】
{transcriptText}

【本次仿写使用的观点素材】
{usedFragments.length > 0 ? fragments.map(f => `• ${f.content}`).join('\n') : "（未选择观点）"}

{userInputContent ? `【创作者补充的临时素材】\n${userInputContent}` : ""}

【创作要求】
请基于以上对标视频的框架结构，融入上述观点素材，为「{targetAccount.nickname}」这个账号创作一篇新的短视频文案。
要求：
1. 遵循对标视频的整体结构节奏，但内容不能重复原文
2. 将观点素材自然融入对应的框架位置
3. 语言风格贴合账号定位
4. 直接输出文案正文，不需要解释或说明
```

> **v0.3.3 范围限制**：目标账号信息仅注入 nickname + signature。历史仿写经验数据（待 M-006 发布复盘完成后）将在后续版本中追加注入。

---

### F-005-1-F: API 设计（P0）

#### 获取/创建 Rewrite

```
GET /api/ai-workspace/[videoId]/rewrite
```

- 返回当前 workspace 的 Rewrite + 所有 RewriteVersion（按 versionNumber desc）
- 若不存在 Rewrite 记录则返回 `{ rewrite: null }`（不自动创建）

#### 发起仿写生成

```
POST /api/ai-workspace/[videoId]/rewrite/generate
```

Request body：
```typescript
{
  targetAccountId: string;       // 必填
  modelConfigId: string;         // 必填
  usedFragmentIds: string[];     // 可为空数组
  userInputContent?: string;     // 临时素材，可空
}
```

Response：
```typescript
{
  rewriteVersionId: string;    // 新建的 RewriteVersion.id
  versionNumber: number;
}
```

逻辑：
1. auth() 验证
2. 检查 annotations.length > 0，否则返回 400
3. 若 Rewrite 不存在则先创建（懒创建）
4. 忽略 targetAccountId 外键校验（存在即可），更新 Rewrite.targetAccountId
5. 计算 versionNumber = 当前最大 versionNumber + 1
6. 创建 RewriteVersion（status=GENERATING）
7. 入队 BullMQ rewrite job
8. 返回 versionId + versionNumber

#### 保存编辑内容

```
PATCH /api/ai-workspace/[videoId]/rewrite/versions/[versionId]
```

Request body：
```typescript
{
  editedContent: string;
}
```

- 仅更新 editedContent 字段
- 版本需属于当前 workspace，否则 403

#### 前端轮询

前端使用与转录相同的轮询策略，在 RewriteVersion.status === "GENERATING" 期间：
- 每 3s 轮询 `GET /api/ai-workspace/[videoId]/rewrite`
- COMPLETED 时停止轮询，填入编辑区

---

### F-005-1-G: 本地持久化（P0）

**localStorage Key**：`ai_rewrite_state_${videoId}`

**存储结构**：
```typescript
interface RewriteLocalState {
  selectedFragmentIds: string[];
  modelConfigId: string | null;
  userInputContent: string;
  targetAccountId: string | null;
}
```

**行为规则**：
- 工作台打开时：读取对应 videoId 的缓存，恢复四个字段到 UI 状态
- 任意字段变更时：即时写入 localStorage
- 切换到其他视频时：清空 UI 状态（但不删除旧 videoId 的 localStorage 记录）
- 下次打开同一 videoId：恢复缓存选项，但如果 Fragment 已被删除则跳过对应 ID

---

## 交互流程图

```
进入仿写阶段
    │
    ├─ annotations = 0 → 显示禁用提示，流程结束
    │
    └─ annotations > 0
         │
         ├─ 初始化：读 localStorage → 恢复 fragmentIds/model/account/inputContent
         │
         ├─ GET /rewrite → 若有历史版本，展示最新版本内容
         │
         └─ 用户操作右栏：
               ├─ 点击「选择今日观点」→ ViewpointPicker 弹框 → 确认 → Chips 更新
               ├─ 输入临时素材 → localStorage 更新
               ├─ 选择目标账号 → localStorage 更新
               ├─ 选择模型 → localStorage 更新
               └─ 点击「仿写」
                     ├─ 若 editedContent 非空 → 确认弹框
                     └─ POST /generate → 返回 versionId
                           │
                           └─ 轮询 GET /rewrite（每 3s）
                                 ├─ GENERATING → 继续轮询，编辑区 loading
                                 ├─ COMPLETED → 停止轮询，填入编辑区
                                 └─ FAILED → 停止轮询，显示错误
```

---

## 版本信息对接（v0.3.3.1 预留）

v0.3.3.1 将新增「直接创作」入口（不依赖 BenchmarkVideo 和 AI 拆解）：
- 独立的创作入口（如「新建创作」）
- 工作台中无左栏/中栏（无拆解框架和转录文案）
- 右栏操作区与 v0.3.3 相同，但无前置 annotations 检查
- 数据模型上：Rewrite 新增 workspaceId nullable（直接创作时为 null）
- **v0.3.3 中勿将 workspaceId 设为必填约束之外的 unique 约束**（v0.3.3.1 时放开）

> 注：v0.3.3 中 Rewrite.workspaceId 保持 `@unique`，v0.3.3.1 时将讨论是否需要放开（允许 null 意味着不能 unique，或 nullable unique）。

---

## 验收标准

1. **三栏布局**：仿写阶段正确渲染三栏，左栏批注点击后中栏对应文字高亮
2. **观点选择**：ViewpointPicker 可弹出、可搜索、可多选，确认后 Chips 正确展示，0 条可用
3. **账号模型选择**：下拉正确展示当前员工账号和已配置模型，目标账号未选时「仿写」不可点
4. **前置检查**：annotations 为 0 时「仿写」按钮禁用并展示提示
5. **仿写生成**：点击「仿写」后产生新版本，轮询期间展示 loading，完成后文案填入编辑区
6. **版本切换**：生成多版本后，版本下拉可正确切换，编辑区内容跟随
7. **人工编辑**：编辑区修改后 1s 内自动保存（PATCH），刷新页面后内容保留
8. **确认弹框**：已有编辑内容时再次仿写会触发确认弹框
9. **localStorage**：关闭工作台后重新打开，已选模型/账号/素材恢复；切换视频后状态清空
10. **失败处理**：AI 生成失败时版本状态置为 FAILED，界面展示错误信息，可重新生成
