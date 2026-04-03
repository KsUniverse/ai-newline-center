# v0.2.2 测试验收报告

**测试日期**: 2026-04-04

---

## 修复记录（评审问题）

| 问题 # | 状态 | 修复说明 |
|--------|------|---------|
| 问题 1 | ✅ 已修复 | 从 `listBenchmarksSchema` 移除 `archiveFilter` 字段，主列表端点现只接受 `page`/`limit`，无法通过主端点查询归档数据 |
| 问题 2 | ⏭ 跳过 | 低优先级，`listBenchmarkVideos` 返回类型可由 TypeScript 推断，不影响类型安全 |
| 问题 3 | ⏭ 跳过 | 低优先级，前端创建对标账号后不使用返回值（仅调用 `onSuccess()`），不影响功能 |
| 问题 4 | ✅ 已修复 | 将 `account-payload.ts` 迁移至 `src/lib/account-payload.ts`；原 `features/accounts/account-payload.ts` 改为 re-export；`benchmark-add-drawer.tsx` 和 `account-payload.test.ts` import 路径更新为 `@/lib/account-payload` |
| 问题 5 | ✅ 已修复 | 在 `globals.css` `:root` 和 `.dark` 两处新增 `--verification-badge-bg`/`--verification-badge-text`/`--verification-badge-icon-text` CSS 变量；`benchmark-detail-header.tsx` 中 3 处硬编码 hex 值替换为 `var(--*)` 引用 |
| 问题 6 | ✅ 已修复 | `DashboardPageShell` 新增可选 `backHref`/`backLabel`/`description` props；`benchmarks-archived-page.tsx` 替换为 `<DashboardPageShell title="已归档对标账号" backHref="/benchmarks" backLabel="返回对标账号">`，与主列表页布局一致 |

---

## 功能验收结果

### F-002-1 收藏同步（后端）

| 检查项 | 结果 | 备注 |
|--------|------|------|
| 第 4 个 cron（`collectionSyncCron`，默认 `*/5 * * * *`）| ✅ | `scheduler.ts:L17` — `env.COLLECTION_SYNC_CRON ?? "*/5 * * * *"` |
| `collectionSyncRunning` 防重入 flag | ✅ | `scheduler.ts:L22` — `let collectionSyncRunning = false;` 及 `if (collectionSyncRunning)` 守卫 |
| `syncService.runCollectionSync()` 存在 | ✅ | `scheduler.ts:L63` — `void syncService.runCollectionSync()` |

### F-002-2 对标账号管理（全栈）

| 检查项 | 结果 | 备注 |
|--------|------|------|
| `POST /api/benchmarks/preview` | ✅ | `src/app/api/benchmarks/preview/route.ts` |
| `GET /api/benchmarks` | ✅ | `src/app/api/benchmarks/route.ts` |
| `POST /api/benchmarks` | ✅ | `src/app/api/benchmarks/route.ts` |
| `GET /api/benchmarks/archived` | ✅ | `src/app/api/benchmarks/archived/route.ts` |
| `GET /api/benchmarks/[id]` | ✅ | `src/app/api/benchmarks/[id]/route.ts` |
| `DELETE /api/benchmarks/[id]` | ✅ | `src/app/api/benchmarks/[id]/route.ts` |
| `GET /api/benchmarks/[id]/videos` | ✅ | `src/app/api/benchmarks/[id]/videos/route.ts` |
| 前端 `/benchmarks` 页面 | ✅ | `src/app/(dashboard)/benchmarks/page.tsx` |
| 前端 `/benchmarks/archived` 页面 | ✅ | `src/app/(dashboard)/benchmarks/archived/page.tsx` |
| 前端 `/benchmarks/[id]` 页面 | ✅ | `src/app/(dashboard)/benchmarks/[id]/page.tsx` |
| 侧边栏「对标账号」导航入口 | ✅ | `app-sidebar.tsx:L50` — `label: "对标账号", href: "/benchmarks"` |

### 权限验收

| 检查项 | 结果 | 备注 |
|--------|------|------|
| 归档仅限创建者（`account.userId === session.user.id`）| ✅ | `benchmark-account.service.ts` `archiveBenchmark` 方法检查 `account.userId !== caller.id` → `FORBIDDEN` |
| 所有 API 端点有认证检查 (`requireRole`) | ✅ | 5 个 route 文件共 12 处 `requireRole` 调用，覆盖全部端点 |

### 构建检查

| 检查项 | 结果 | 备注 |
|--------|------|------|
| `pnpm type-check` | ✅ | 零错误，exit code 0 |
| `pnpm lint` | ✅ | 零错误，exit code 0 |

---

## 总体结论

✅ **通过** — 所有功能验收项目通过，4 个高/中优先级评审问题已修复，构建检查零错误。

---

## 未解决问题

以下为跳过的低优先级问题，不影响本次验收：

| # | 描述 | 建议后续处理 |
|---|------|------------|
| 问题 2 | `listBenchmarkVideos` 缺少显式返回类型 | 下一迭代补全 Service 方法返回类型 |
| 问题 3 | `createBenchmark` 返回值与技术设计约定不一致（返回子集而非完整 DTO）| 后续迭代对齐 API 契约 |
| 问题 7 | 归档确认 `AlertDialog` 在两处重复（benchmarks-page.tsx + benchmark-detail-page.tsx）| 提取 `ArchiveConfirmDialog` 共享组件 |
| 问题 8 | `archiveBenchmark` 轻微信息泄露（跨组织 ID 探测时返回 `FORBIDDEN` 而非 `NOT_FOUND`）| 在 userId 检查前加 organizationId 检查 |
