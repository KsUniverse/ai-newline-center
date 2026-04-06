# v0.3.1 后端任务清单

## 必读文档

- `docs/product/versions/v0.3.1/requirements.md`
- `docs/product/versions/v0.3.1/technical-design.md`
- `docs/architecture/backend.md`
- `docs/architecture/database.md`
- `docs/architecture/api-conventions.md`
- `docs/standards/coding-standards.md`

**开发前必须通读的现有实现**：

- `prisma/schema.prisma`
- `src/server/services/ai-gateway.service.ts`
- `src/lib/transcription-worker.ts`
- `src/server/services/crawler.service.ts`
- `src/server/services/sync.service.ts`
- `src/server/repositories/benchmark-video.repository.ts`
- `src/lib/env.ts`

---

## 摘要

- 任务总数: 11
- 核心目标:
  - 交付系统级 AI 配置
  - 建立员工级 AI 工作台数据模型
  - 打通真实 AI 转录
  - 落结构化拆解存储
  - 承接仿写草稿

---

## 任务列表

- [x] **BE-001**: (P0) 更新 Prisma Schema 与迁移
  - 文件: `prisma/schema.prisma`, `prisma/migrations/*`
  - 详情:
    1. 新增 `AiStepBinding`
    2. 新增 `AiWorkspace`
    3. 新增 `AiWorkspaceTranscript`
    4. 新增 `AiTranscriptSegment`
    5. 新增 `AiDecompositionAnnotation`    7. 新增 `AiRewriteDraft`
    8. 给 `BenchmarkVideo`、`DouyinVideo` 保持/补齐 `shareUrl`

- [x] **BE-002**: (P0) 改造环境变量与 AI Gateway
  - 文件: `src/lib/env.ts`, `src/lib/env.test.ts`, `src/server/services/ai-gateway.service.ts`
  - 详情:
    1. 支持 Ark 配置
    2. 保留系统级步骤绑定
    3. `generateText(step, prompt, implementationKey?)` 成为统一入口

- [x] **BE-003**: (P0) 完成 AI 配置 Repository / Service / API
  - 文件: `src/server/repositories/ai-step-binding.repository.ts`, `src/server/services/ai-settings.service.ts`, `src/app/api/system-settings/ai/route.ts`
  - 详情:
    1. 查询与更新三步绑定
    2. 校验实现可用性
    3. 仅允许 `SUPER_ADMIN`

- [x] **BE-004**: (P0) 建立 AI 工作台 Repository / Service
  - 文件: `src/server/repositories/ai-workspace.repository.ts`, `src/server/services/ai-workspace.service.ts`
  - 详情:
    1. 以 `(videoId, userId)` 查找/创建工作台
    2. 聚合 transcript / segments / annotations / rewriteDraft
    3. 统一返回工作台 DTO

- [x] **BE-005**: (P0) 改造转录主链路，把结果落到工作台
  - 文件: `src/server/services/ai-workspace.service.ts`, `src/lib/transcription-worker.ts`, `src/server/repositories/ai-workspace.repository.ts`
  - 详情:
    1. 继续复用异步转录能力
    2. 结果写入 `AiWorkspaceTranscript.originalText/currentText`
    3. 工作台状态同步为 `TRANSCRIBING` / `TRANSCRIPT_DRAFT`
    4. 关联当前员工，而不是全局共享
    - 当前状态:
      1. 工作台转录任务已经按 `shareUrl -> AiWorkspaceTranscript` 落库
      2. 旧 `/api/transcriptions` 链路已移除，转录正式收口为 AI 工作台单轨

- [x] **BE-006**: (P0) 新增 AI 工作台 API
  - 文件: `src/app/api/ai-workspaces/route.ts`, `src/app/api/ai-workspaces/transcribe/route.ts`, `src/app/api/ai-workspaces/[id]/*`
  - 详情:
    1. `GET /api/ai-workspaces?videoId=...`
    2. `POST /api/ai-workspaces/transcribe`
    3. `PATCH /api/ai-workspaces/:id/transcript`
    4. `POST /api/ai-workspaces/:id/transcript/confirm`
    5. `POST /api/ai-workspaces/:id/transcript/unlock`

- [x] **BE-007**: (P0) 实现语义段落保存与结构地图数据承接
  - 文件: `src/server/services/ai-workspace.service.ts`, `src/server/repositories/ai-workspace.repository.ts`
  - 详情:
    1. 保存 `AiTranscriptSegment`
    2. 支持段落顺序、文本、offset、purpose、summary
    3. 为前端结构地图直接提供数据源

- [x] **BE-008**: (P0) 实现结构化拆解 CRUD
  - 文件: `src/server/repositories/ai-decomposition.repository.ts`, `src/server/services/ai-decomposition.service.ts`, `src/app/api/ai-workspaces/[id]/annotations/*`
  - 详情:
    1. 新增/编辑/删除拆解
    2. 支持任意文本范围
    3. 3. 存储 存储 `function/technique/purpose/effectiveness/argumentRole/note`
    - 当前状态:
      1. 已补上“确认转录稿后才能拆解”的业务约束
      2. 拆解增删改会同步维护 `DECOMPOSED` / `TRANSCRIPT_CONFIRMED` 状态

- [x] **BE-009**: (P0) 实现“解锁编辑会清空拆解与仿写”的原子逻辑
  - 文件: `src/server/services/ai-workspace.service.ts`
  - 详情:
    1. 单事务清空 annotations/rewriteDraft
    2. 把 transcript 置回未确认
    3. 返回最新工作台

- [x] **BE-010**: (P0) 实现仿写草稿保存
  - 文件: `src/server/repositories/ai-rewrite.repository.ts`, `src/server/services/ai-rewrite.service.ts`, `src/app/api/ai-workspaces/[id]/rewrite-draft/route.ts`
  - 详情:
    1. 保存/更新当前草稿
    2. 保留来源 transcript/decomposition 快照字段
    3. 本版不强制实现 AI 自动生成

- [~] **BE-011**: (P0) 补齐测试
  - 文件: 相关 `*.test.ts`
  - 详情:
    1. 工作台按员工隔离
    2. 转录依赖 `shareUrl`
    3. 确认后才能拆解
    4. 解锁编辑会清空拆解与仿写
    5. 拆解支持任意范围
    - 当前状态:
      1. `ai-workspace.service`、`ai-settings.service`、`ai-gateway.service` 定向测试已补齐并通过
      2. `ai-workspaces/transcribe`、`ai-workspaces/[id]/transcript/confirm`、`system-settings/ai` 路由测试已补齐并通过
      3. worker 与更完整 UI 集成覆盖仍可后续加强

