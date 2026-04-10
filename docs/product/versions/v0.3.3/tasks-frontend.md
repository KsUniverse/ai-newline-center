# v0.3.3 前端任务清单

## 必读文档

> 开始开发前必须阅读以下文档：

- `docs/product/versions/v0.3.3/requirements.md` — 本版本需求（理解业务背景，重点 F-005-1-A/B/G）
- `docs/product/versions/v0.3.3/technical-design.md` — 本版本技术设计（**主要参考**）
- `docs/product/versions/v0.3.3/tasks-backend.md` — 后端接口细节（后端自省节特别重要）
- `docs/architecture/frontend.md` — 前端组件体系
- `docs/standards/ui-ux-system.md` — UI/UX 设计系统
- `.github/instructions/frontend.instructions.md` — 前端编码规范

**参考现有实现**：

- `src/components/features/benchmarks/ai-workspace-shell.tsx` — Shell（装配三栏）
- `src/components/features/benchmarks/ai-workspace-controller.ts` — controller 状态管理
- `src/components/features/benchmarks/ai-workspace-rewrite-stage-modern.tsx` — 被替换的旧组件（备用保留）
- `src/components/features/benchmarks/ai-workspace-transcript-canvas.tsx` — 转录画布（高亮逻辑参考）
- `src/components/features/benchmarks/ai-workspace-view-model.ts` — annotation 数据结构 + buildTranscriptHighlightChunks
- `src/types/ai-workspace.ts` — RewriteDTO、RewriteVersionDTO、GenerateRewriteInput

---

## 摘要

- 任务总数: 7
- 核心目标:
  - 新增 `useRewriteLocalState` hook，localStorage 持久化仿写配置
  - 新增 `ViewpointPicker` 弹框多选今日观点
  - 扩展 `useAiWorkspaceController`：新增仿写状态、generate/poll/saveEdit 方法
  - 重构仿写阶段为三栏布局（`AiWorkspaceRewriteStageV2`）
  - 新增右栏仿写操作区（`AiRewritePanel`）：账号选择、模型选择、版本管理、生成结果编辑
  - Shell 切换到 V2 组件

---

## 任务列表

- [x] **FE-001**: (P0) useRewriteLocalState hook

  - 文件: `src/lib/hooks/use-rewrite-local-state.ts`
  - 详情:
    1. `RewriteLocalState { selectedFragmentIds, modelConfigId, userInputContent, targetAccountId }`
    2. localStorage key: `ai_rewrite_state_${videoId}`
    3. `videoId` 变化时 useEffect 加载对应存储，清空上一个 videoId 的状态
    4. 各 setter 使用函数式 setState，写入时同步写 localStorage
    5. `clearState()` 清空状态并删除 localStorage key
  - 验证: `pnpm type-check` 通过

---

- [x] **FE-002**: (P0) ViewpointPicker 弹框

  - 文件: `src/components/features/benchmarks/viewpoint-picker.tsx`
  - 详情:
    1. `Dialog` 包裹，受控 `open/onOpenChange`
    2. 搜索框 + debounce 300ms，调用 `GET /api/viewpoints?scope=today&q=xxx&limit=50`
    3. 每条观点：Checkbox + 内容前 80 字 + 创建者姓名
    4. 底部已选 Badge + 「确认」+ 「取消」按钮
    5. 确认时同时传出 `ids: string[]` 和 `fragments: FragmentDTO[]`（为 chip 展示准备）
  - 偏差: `onConfirm(ids, fragments)` 签名携带 fragment 对象，较任务规格增加了 `fragments` 参数，为 chip 文本展示提供数据

---

- [x] **FE-003**: (P0) 扩展 useAiWorkspaceController

  - 文件: `src/components/features/benchmarks/ai-workspace-controller.ts`
  - 详情:
    1. 新增 state: `rewrite`, `activeVersionId`, `generatingRewrite`, `rewritePollTimerRef`
    2. `startRewritePoll(targetVersionId)` — 2s 轮询 GET rewrite，目标版本离开 GENERATING 时停止，自动设置 activeVersionId
    3. `generateRewrite(input)` — POST generate，入队后启动 poll
    4. `saveVersionEdit(versionId, content)` — 直接 PATCH（debounce 在 AiRewritePanel 侧管理）
    5. useEffect 监听 `stage + video?.id`：进入 rewrite 阶段自动 loadRewrite
    6. useEffect 监听 `video?.id`：video 切换时重置 rewrite 状态
    7. 返回 `rewrite, activeVersionId, generatingRewrite, onGenerateRewrite, onSaveVersionEdit, onSetActiveVersionId`
  - 验证: `pnpm type-check` 通过，现有行为不变

---

- [x] **FE-004**: (P0) AiWorkspaceRewriteStageV2 三栏主组件

  - 文件: `src/components/features/benchmarks/ai-workspace-rewrite-stage-v2.tsx`
  - 详情:
    1. 三栏布局：左 25% / 中 35% / 右 flex-1（约 40%）
    2. 左栏：批注列表，只读，点击触发 `onAnnotationSelect`，激活状态高亮
    3. 中栏：转录原文只读，复用 `buildTranscriptHighlightChunks` 响应 `activeAnnotationId` 高亮
    4. 右栏：`AiRewritePanel` 封装
    5. 无批注或无转录时展示空状态提示
  - 验证: 暗色/亮色模式下三栏可见

---

- [x] **FE-005**: (P0) AiRewritePanel 右栏操作区

  - 文件: `src/components/features/benchmarks/ai-rewrite-panel.tsx`
  - 详情:
    1. 内部使用 `useRewriteLocalState(videoId)` 管理配置状态
    2. 观点 Chip 列表：超 5 条收折，每条前 30 字 + × 移除
    3. 临时素材 Textarea，max 500 字，realtime → localStorage
    4. 目标账号 Select，调用 `GET /api/douyin-accounts?limit=100`（EMPLOYEE 已按 userId 过滤）
    5. 生成模型 Select，调用 `GET /api/ai-config/settings`，默认 REWRITE step 绑定模型
    6. 版本 Badge + DropdownMenu（versionNumber desc）
    7. 「仿写」按钮：禁用条件（无批注 / 未选账号 / 无模型 / 生成中）；已有 editedContent 时弹 AlertDialog 确认
    8. 结果 Textarea：GENERATING 禁用 + placeholder；FAILED 展示错误 banner；COMPLETED 可编辑 + 1s debounce save
    9. `ViewpointPicker` 弹框集成
  - 验证: `pnpm type-check` 通过，lint 通过

---

- [x] **FE-006**: (P0) Shell 替换引用

  - 文件: `src/components/features/benchmarks/ai-workspace-shell.tsx`
  - 详情:
    1. 移除 `AiWorkspaceRewriteStageModern` import，新增 `AiWorkspaceRewriteStageV2` import
    2. rewrite 列替换为 `AiWorkspaceRewriteStageV2` 并传入 controller 的新字段
    3. 保留 `ai-workspace-rewrite-stage-modern.tsx` 和 `ai-workspace-rewrite-stage.tsx` 文件（不删除）
  - 验证: `pnpm lint --max-warnings 0` 通过

---

- [x] **FE-007**: (P0) 前端任务文档

  - 文件: `docs/product/versions/v0.3.3/tasks-frontend.md`
  - 详情: 本文件

---

## 前端开发自省

### 1. 实现中与技术设计的偏差

| 偏差点 | 技术设计描述 | 实际实现 | 原因 |
|--------|-------------|---------|------|
| `onConfirm` 签名 | `onConfirm(ids: string[])` | `onConfirm(ids: string[], fragments: FragmentDTO[])` | chip 展示需要 fragment 文本，ViewpointPicker 内部已有完整 fragment 对象，confirm 时一并传出是最简路径，无需额外网络请求 |
| 左栏无 `AiWorkspaceDecompositionPanel` 复用 | 任务描述"批注列表" | 新建简化版批注列表（只读 + 点击高亮） | DecompositionPanel 含创建批注输入框、选区指示等仿写阶段不需要的交互，直接复用会引入额外限制逻辑，新建更干净 |
| `useRewriteLocalState` 不导出 `clearState` 时机 | videoId 切换时自动 clearState | 通过 useEffect 重新 loadFromStorage 替代，不调用 clearState | 切换 videoId 时应加载新 videoId 的存储，而非清空；clearState 仅供显式重置使用 |
| 账号选择 `type=MY_ACCOUNT` 过滤 | "仅 MY_ACCOUNT 类型" | 直接调用 `/douyin-accounts`，无 type 参数 | 参考 tasks-backend.md 技术对齐结论：EMPLOYEE 调用 Service 层已自动按 `userId` 过滤，无需 type 参数 |

### 2. 联调时后端注意的接口细节

- **GET `/api/ai-workspace/[videoId]/rewrite`**：响应 `{ success: true, data: { rewrite: RewriteDTO | null } }`，`apiClient.get` 返回 `{ rewrite: ... }` 层而非裸 `RewriteDTO`
- **POST `/api/ai-workspace/[videoId]/rewrite/generate`**：响应 HTTP **201**（apiClient 已正常处理），body 含 `{ rewriteVersionId, versionNumber }`；注意路径为单数 `ai-workspace`（非 `ai-workspaces`）
- **PATCH `/api/ai-workspace/[videoId]/rewrite/versions/[versionId]`**：仅允许 `status === COMPLETED` 的版本，前端已在 status 不为 COMPLETED 时跳过 debounce 调用
- **轮询频率**：2s 正常轮询，网络错误时 3s 重试，直到 `targetVersionId` 对应版本离开 GENERATING
- **`/api/douyin-accounts`**：不传 `type` 参数，EMPLOYEE 角色 Service 层自动按 `userId` 过滤

### 3. 后续可优化点

| 编号 | 问题 | 建议处理时机 |
|------|------|-------------|
| OPT-1 | `AiRewritePanel` 同时发起账号和 AI 配置两个请求，可 Promise.all 并行 | 功能稳定后小优化 |
| OPT-2 | 已选观点的 fragments map 只在 confirm 时更新，刷新页面后 chip 文本丢失（只有 IDs 从 localStorage 恢复）| 加载时 batch 查询已选 fragmentIds 文本，或将 fragment content 也存入 localStorage |
| OPT-3 | 版本 DropdownMenu 每次重新渲染，可用 useMemo 稳定版本列表渲染 | 影响可接受，暂不优化 |
| OPT-4 | 仿写区右栏限高滚动容器在极短屏幕上可能截断，需实测 | 产品验收阶段补充 |
| OPT-5 | `useRewriteLocalState` 的 `setModelConfigId` 默认选中逻辑目前在 `AiRewritePanel` 的 useEffect 中，首次加载时 localState 先为 null 再触发默认设置，存在两次 render | 可在 loadFromStorage 时同步注入默认值（但需要 AI settings 先加载）|
