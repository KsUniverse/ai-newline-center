# v0.3.3 Bug 记录

> 来源：v0.3.3 评审报告 M-001 / L-001 和测试报告 T-003 / T-005
> 创建时间: 2026-04-17
> 状态: 修复中

---

## BUG-001: ViewpointPicker 跨搜索选择后 Chip 展示不全

- **严重度**: Medium
- **来源**: 评审报告 M-001 / 测试报告 T-003
- **文件**: `src/components/features/benchmarks/viewpoint-picker.tsx`（`handleConfirm` 函数）
- **描述**: `handleConfirm` 通过 `items.filter(item => localSelectedIds.includes(item.id))` 构造 `selectedFragments`，其中 `items` 仅为当前搜索过滤后的可见列表。
  - 用户先选中 A、B，再搜索切换视图选中 D，最终 `localSelectedIds` = [A, B, D]
  - 但 B 若不在当前 `items` 中，返回的 `selectedFragments` 仅含 A、D
  - B 的 chip 在 `AiRewritePanel` 中消失，但 B 的 ID 仍在 `usedFragmentIds` 并会发送给 API
  - **结果**: UI 展示与实际发送数据不一致（用户看到 2 条，实际生成用 3 条）
- **修复方案**: 在组件内维护 `allSelectedFragmentsMap: Map<string, FragmentDTO>` 缓存，每次 `items` 更新时通过 `useEffect` 将当前 `items` 合并到 map；`handleConfirm` 时从 map 中取全部已选 ID 的 fragment 对象，而非仅过滤当前 `items`。
- **修复状态**: ✅ 已修复 — 新增 `allSelectedFragmentsMap: Map<string, FragmentDTO>` state 缓存，每次 items 变化时合并已选 fragment，`handleConfirm` 改为从 map 读取而非过滤 items。

---

## BUG-002: startRewritePoll 缺少 cancelled 标志位

- **严重度**: Low
- **来源**: 评审报告 L-001 / 测试报告 T-005
- **文件**: `src/components/features/benchmarks/ai-workspace-controller.ts`（`startRewritePoll` 内的 `poll` 函数）
- **描述**: `poll` 函数在 await 期间若 timer 被 `clearTimeout` 取消（如用户快速多次点击「仿写」），仍会在 await 解析后调用 `setRewrite`、`setGeneratingRewrite`、`setActiveVersionId` 等 state updater。多个并发 poll 实例可相互干扰：
  - 旧 poll 覆盖新 poll 的最新 `rewrite` 数据
  - `generatingRewrite` 可能被旧 poll 错误地置为 `false`
- **修复方案**: 在 `startRewritePoll` 内部引入 `cancelled` 标志位。`startRewritePoll` 调用时将上一个实例的 `cancelled` 置为 `true`；`poll` 函数内每次 await 后检查 `if (cancelled) return`。
- **修复状态**: ✅ 已修复 — 新增 `pollVersionRef: useRef<number>(0)` 版本号机制，`startRewritePoll` 每次调用递增版本号，`poll` 函数内每次 await 后检查版本号是否一致，旧 poll 实例自动退出。`resetToInitialWorkspace` 和 video?.id 变更 effect 也会递增版本号以使正在进行的 poll 失效。
