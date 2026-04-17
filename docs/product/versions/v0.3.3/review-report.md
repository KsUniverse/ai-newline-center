# v0.3.3 代码评审报告

## 摘要

- 审查文件数: 16
- 问题总数: 4 (Critical: 0 / High: 2 / Medium: 1 / Low: 1)
- 结论: 需修复 ❌ → 已修复 ✅（所有 High 问题已直接在源码中修复）

---

## 必须修复（Blocker）

### [H-001] High: Service 层直接调用 Prisma（violates 三层架构）— ✅ 已修复

- **文件**: `src/server/services/rewrite.service.ts`（原 ~44-48 行，`generate` 方法中）
- **描述**: `generate` 方法使用 `prisma.douyinAccount.findUnique` 直接调用 Prisma 验证 targetAccount 归属，绕过 Repository 层。违反架构规则「Service 不直接调用 Prisma（经过 Repository）」。
- **修复方案**: 替换为 `douyinAccountRepository.findOwnedMyAccount(input.targetAccountId, caller.id, caller.organizationId)`，同函数语义更精准（同时检查 userId + organizationId + 非归档状态），追加了 `douyinAccountRepository` 导入。
- **修复状态**: 已修复。

---

### [H-002] High: `resetToInitialWorkspace` 未清空仿写状态 — ✅ 已修复

- **文件**: `src/components/features/benchmarks/ai-workspace-controller.ts`（`resetToInitialWorkspace` 函数）
- **描述**: 当工作台加载失败（同一 video 下重试）时，`resetToInitialWorkspace` 不会清空 `rewrite`、`activeVersionId`、`generatingRewrite`，也不取消轮询 timer。若 `generatingRewrite` 残留为 `true`，「仿写」按钮会永久禁用；旧的 `rewrite` 数据也会在新工作台中错误显示。（注：`video?.id`变更 effect 只在 video 切换时触发，无法覆盖此场景。）
- **修复方案**: 在 `resetToInitialWorkspace` 中补充清空 `rewrite`、`activeVersionId`、`generatingRewrite`，并在 `startTransition` 之前 `clearTimeout(rewritePollTimerRef.current)` 取消轮询。
- **修复状态**: 已修复。

---

## 建议修复（Warning）

### [M-001] Medium: ViewpointPicker 确认时仅保存当前搜索视图的 fragment 对象

- **文件**: `src/components/features/benchmarks/viewpoint-picker.tsx`（`handleConfirm`，~108 行）
- **描述**: `handleConfirm` 通过 `items.filter(item => localSelectedIds.includes(item.id))` 构造 `selectedFragments`，其中 `items` 仅为当前搜索过滤后的可见列表。若用户先选中条目 A、B，再搜索切换视图选中 D，最终 `localSelectedIds` = [A, B, D]，但 B 若不在当前 `items` 中，返回的 `selectedFragments` 仅含 A、D，B 的 chip 消失，但 B 的 ID 仍在 `usedFragmentIds` 并会发送给 API。导致 UI 展示与实际发送数据不一致。
- **修复建议**: 在组件内维护 `allSelectedFragments: Map<string, FragmentDTO>` 缓存，每次 `items` 更新时合并到 map；`handleConfirm` 时从 map 中取全部已选 ID 的 fragment 对象，而非仅过滤当前 `items`。

---

### [L-001] Low: 轮询函数缺少 `cancelled` 标志位

- **文件**: `src/components/features/benchmarks/ai-workspace-controller.ts`（`startRewritePoll` 内的 `poll` 函数）
- **描述**: `poll` 函数在 await 期间若 timer 被 `clearTimeout` 取消，仍会在 await 解析后调用 `setRewrite`、`setGeneratingRewrite` 等 state updater。React 18 不报 "setState after unmount" 警告，但多个并发 poll 实例可相互干扰（例如快速多次点击「仿写」）。
- **修复建议**: 在 `startRewritePoll` 顶部用 `let cancelled = false` + 清理函数 `return () => { cancelled = true }`模式，poll 函数内每次 await 后检查 `if (cancelled) return`。

---

## 正向反馈

- **架构严格性好**：三个 API Route Handler（GET rewrite / POST generate / PATCH versions）结构一致，均为「auth → requireRole → parse params → call service → return」，无直接 Prisma 调用。
- **数据安全完备**：PATCH 接口先通过 `videoId + callerId` 锁定 workspace，再校验 `version.rewrite.workspaceId === workspace.id`，有效防止 IDOR；generate 接口增加了 `targetAccountId` 归属验证和 `modelConfigId` 合法性验证。
- **Worker 容错设计合理**：`on("failed")` 钩子仅在 `attemptsMade >= maxAttempts` 时才标记 FAILED，避免重试期间重复写 DB；`globalThis.__rewriteWorkerInitialized` 防重复启动模式与 TranscriptionWorker 保持一致。
- **事务并发安全**：`generate` 在单一 `prisma.$transaction` 内计算 `MAX(versionNumber) + 1` 并创建版本，结合 `@@unique([rewriteId, versionNumber])` 约束，在并发场景下能保证版本号唯一。
- **前端防抖保存**：`AiRewritePanel` 内部持有 `debounceRef`，1s 防抖后才调 PATCH，匹配设计需求，避免频繁 API 调用。
- **本地状态 SSR 安全**：`useRewriteLocalState` 用 `typeof window === "undefined"` 守卫，初始化时 `useState(() => loadFromStorage(videoId))` 避免水合不一致。
- **Zod 验证完整**：三个接口的输入类型（`generateRewriteSchema` / `saveEditedContentSchema`）均有 cuid / maxLength / default 校验，与技术设计 API 契约完全对齐。

---

## 自省

本次评审无遗漏的复制式实现，未发现风格漂移。以下建议供架构师考虑是否更新文档：

1. **review-checklist.md**：可补充「Service 层用 `prisma.$transaction` 协调多 Repository 操作是允许的，但 `prisma.*` 直接查询必须通过 Repository」以消除歧义。
2. **technical-design.md（此版本）**：设计文档中伪代码直接使用 `prisma.rewrite.upsert` / `prisma.rewriteVersion.aggregate`，但实现已重构为通过 Repository。设计文档与实现存在落差，未来版本可在设计阶段注明「事务内协调通过 Repository tx 参数传递」。
3. **project-structure.md**：本版类型定义（RewriteDTO 等）追加到了 `ai-workspace.ts` 而非按设计创建独立 `src/types/rewrite.ts`。当 `ai-workspace.ts` 类型不断增加时，建议拆分。可在结构文档中增加「当单个类型文件超过 ~150 行时，按领域拆分」的规范。
