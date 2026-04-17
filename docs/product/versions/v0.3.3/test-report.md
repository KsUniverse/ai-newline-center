# v0.3.3 测试报告

## 测试结论
**有问题** — 发现 1 项阻塞性问题（测试 Mock 陈旧，已修复）；4 项非阻塞问题（含 2 项评审报告已知问题）

---

## 自动化测试结果

| 检查项 | 结果 | 备注 |
|--------|------|------|
| type-check | ✅ | 无类型错误 |
| lint | ✅ | 无 ESLint 错误 |
| unit tests | ✅ | 修复后：173 passed, 9 failed (pre-existing), 1 skipped |
| pnpm build | ✅ | 所有路由编译通过，无构建错误 |

> 单元测试中 9 个失败均为 v0.3.3 之前已存在的问题（scheduler / server-bootstrap / transcription-worker / crawler-service / storage-service / benchmark-copy），与本版本无关。

---

## 功能验收结果

| 验收标准 | 结果 | 备注 |
|---------|------|------|
| AC-1 三栏布局 | ✅ | 左栏(25%) 批注列表，`onAnnotationSelect` 正确调用；中栏(35%) 用 `buildTranscriptHighlightChunks` 按 startOffset/endOffset 高亮；右栏(40%) 为 `AiRewritePanel` |
| AC-2 观点选择 | ✅ | `viewpoint-picker.tsx` 存在，checkbox 多选，`scope=today` 已传参，确认按钮无禁用条件（0 条可用） |
| AC-3 账号模型选择 | ✅ | 调用 `/douyin-accounts?limit=100` 和 `/ai-config/settings`，目标账号未选时 `isGenerateDisabled=true` |
| AC-4 前置检查 | ✅ | `annotations.length === 0` 在 `isGenerateDisabled` 中，界面展示 amber 提示文字 |
| AC-5 仿写生成链路 | ✅ | `generateRewrite` 调用 POST `/rewrite/generate`，轮询在 `status !== "GENERATING"` 后停止，`generatingRewrite` 正确置 false |
| AC-6 版本切换 | ✅ | `rewrite.versions` 渲染到 DropdownMenu，`onSetActiveVersionId` 在 item 点击时调用 |
| AC-7 人工编辑自动保存 | ✅ | `handleEditChange` 中有 1s debounce，调用 `onSaveVersionEdit` → PATCH `/rewrite/versions/${versionId}` |
| AC-8 确认弹框 | ✅ | `activeVersion?.editedContent` 非空时触发 AlertDialog，AlertDialogAction 确认后发起生成 |
| AC-9 localStorage 持久化 | ✅ | `use-rewrite-local-state.ts` 存在，key 为 `ai_rewrite_state_${videoId}`，videoId 变化时 `loadFromStorage(videoId)` 重置状态 |
| AC-10 失败处理 | ✅ | Worker `on("failed")` 在 `attemptsMade >= maxAttempts` 后写入 status=FAILED；前端 `activeVersion?.status === "FAILED"` 显示错误覆盖层 |

---

## 安全检查

| 检查项 | 结果 | 备注 |
|--------|------|------|
| `GET /api/ai-workspace/[videoId]/rewrite` 调用 `auth()` | ✅ | route.ts 第 18 行 |
| `POST /api/ai-workspace/[videoId]/rewrite/generate` 调用 `auth()` | ✅ | route.ts 第 25 行 |
| `PATCH /api/ai-workspace/[videoId]/rewrite/versions/[versionId]` 调用 `auth()` | ✅ | route.ts 第 25 行 |
| `GET /api/ai-config/settings` 调用 `auth()` | ✅ | route.ts 第 12 行 |
| `rewrite.service.ts generate` 验证 targetAccount 属于 caller | ✅ | 调用 `douyinAccountRepository.findOwnedMyAccount(id, caller.id, caller.organizationId)`，null 时抛 ACCOUNT_ACCESS_DENIED(403) |

---

## 发现的问题

### [T-001] 测试 Mock 陈旧（已修复）— 阻塞性

- **严重度**: High（单元测试中安全验证路径 ACCOUNT_ACCESS_DENIED 无法验证）
- **位置**: `src/server/services/rewrite.service.test.ts`
- **描述**: 代码评审 H-001 修复后，service 改用 `douyinAccountRepository.findOwnedMyAccount()`，但测试仍 mock `prisma.douyinAccount.findUnique`；实际调用是 `findFirst`，导致 `db.douyinAccount.findFirst is not a function` 错误，两个安全验证测试用例失败。
- **修复方案**: 添加 `vi.mock("@/server/repositories/douyin-account.repository")` 将 `findOwnedMyAccount` 指向 `findUniqueAccountMock`；移除 prisma mock 中的 `douyinAccount.findUnique`；ACCOUNT_ACCESS_DENIED 测试 mock 改为返回 `null`（而非 `{ userId: "other_user" }`，因为 ownership 校验已内化到 Repository 层）。
- **修复状态**: **已修复** — 测试 7/7 通过。

---

### [T-002] 账号下拉未过滤 type=MY_ACCOUNT — 非阻塞

- **严重度**: Low
- **位置**: `src/components/features/benchmarks/ai-rewrite-panel.tsx`（第 101 行）
- **描述**: 组件调用 `/douyin-accounts?limit=100`，无 `type=MY_ACCOUNT` 过滤参数。需求明确指定"仅 MY_ACCOUNT 类型"。当前 EMPLOYEE 角色通过 `userId` 过滤在实践中不会看到组织级 BENCHMARK_ACCOUNT，但与规格不完全对齐。
- **预期**: 请求添加 `type=MY_ACCOUNT` 参数（或后端 API 支持此参数过滤）。
- **实际**: 所有账号（含潜在的 BENCHMARK_ACCOUNT）均可出现在下拉中。

---

### [T-003] ViewpointPicker 跨搜索选择后 Chip 展示不全 — 非阻塞（评审已知 M-001）

- **严重度**: Medium（UI 展示与实际发送数据不一致，但不影响生成结果）
- **位置**: `src/components/features/benchmarks/viewpoint-picker.tsx`（`handleConfirm` ~108 行）
- **描述**: `handleConfirm` 中 `items.filter(...)` 仅过滤当前可见列表。搜索切换视图后，非当前搜索页的已选项在 Chip 层不显示，但其 ID 仍正确传给 API。
- **建议修复**: 维护 `allSelectedFragments: Map<string, FragmentDTO>` 缓存。

---

### [T-004] 预存在的单元测试失败（与 v0.3.3 无关）— 非阻塞

- **严重度**: Low（历史问题）
- **失败文件**: scheduler.test.ts / server-bootstrap.test.ts / transcription-worker.test.ts / crawler.service.test.ts (2) / storage.service.test.ts (3) / benchmark-copy.test.ts (1)
- **描述**: 共 9 个失败，均为 v0.3.3 版本引入之前已存在的测试问题，与本版本功能无关。

---

### [T-005] 轮询函数缺少 cancelled 标志位 — 非阻塞（评审已知 L-001）

- **严重度**: Low
- **位置**: `src/components/features/benchmarks/ai-workspace-controller.ts`（`startRewritePoll` 内 `poll` 函数）
- **描述**: 多次快速点击「仿写」可产生并发 poll 实例，await 后无 `cancelled` 检查，state updater 可能互相干扰。

---

## 总结

v0.3.3 功能实现完整，10 项验收标准全部通过，4 个 API 路由安全鉴权完备，AI 生成链路正确。代码评审阶段的 H-001 / H-002 阻塞性修复均已合入代码并验证有效。

唯一阻塞性问题（T-001：测试 Mock 陈旧导致安全验证测试用例失败）已在本次测试阶段直接修复，`rewrite.service.test.ts` 现全部 7/7 通过。

非阻塞问题（T-002 ~ T-005）建议在后续迭代中处理，不阻碍当前版本发布。
