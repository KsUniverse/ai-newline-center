# v0.2.2 代码评审报告

**评审日期**: 2026-04-04  
**评审范围**: 后端 API + 前端页面/组件  
**审查文件数**: 18

---

## 总体结论

⚠️ **有建议性问题** — 无 🔴 阻塞性问题，存在 6 个 🟡 建议性问题和 2 个 🟢 提议性问题。通过 `pnpm type-check` 和 `pnpm lint` 检查（零错误）。

---

## 问题列表

| # | 严重性 | 文件 | 问题描述 | 建议 |
|---|--------|------|---------|------|
| 1 | 🟡建议 | `src/app/api/benchmarks/route.ts` | `listBenchmarksSchema` 含 `archiveFilter` 字段，与技术设计 API 契约不符，主列表端点意外支持查询归档账号 | 从 schema 中删除 `archiveFilter` 字段，仅保留 `page` + `limit` |
| 2 | 🟡建议 | `src/server/services/benchmark-account.service.ts:L148` | `listBenchmarkVideos` 公共方法缺少显式返回类型标注 | 添加 `Promise<PaginatedData<DouyinVideoDTO>>` 返回类型 |
| 3 | 🟡建议 | `src/server/services/benchmark-account.service.ts:L42` | `createBenchmark` 返回 `{ id, profileUrl, secUserId }`，技术设计约定返回 `BenchmarkAccountDTO`（201）；前端已类型化为 `BenchmarkAccountDTO` 但实际收到子集 | 返回完整 `BenchmarkAccountDTO` 或与前端对齐后更新前端泛型 |
| 4 | 🟡建议 | `src/components/features/benchmarks/benchmark-add-drawer.tsx:L8` | 跨 feature 模块引用：`features/benchmarks` 直接 import `features/accounts/account-payload`，违反"组件层级 ui→shared→features 无跨 feature 依赖"规则 | 将 `account-payload.ts` 迁移至 `src/lib/account-payload.ts`，两侧同步更新 import |
| 5 | 🟡建议 | `src/components/features/benchmarks/benchmark-detail-header.tsx:L36` | 验证徽章使用硬编码色值 `bg-[#2b2210]`、`text-[#f5d37a]`，违反"颜色只用 CSS 变量"规则 | 在 `globals.css` 中新增 `--verification-bg`/`--verification-text` CSS 变量后引用 |
| 6 | 🟡建议 | `src/components/features/benchmarks/benchmarks-archived-page.tsx` | 已归档账号页未使用 `DashboardPageShell`，而主列表页 `benchmarks-page.tsx` 使用了；导致两页布局结构不一致 | 参照 `benchmarks-page.tsx` 替换外层布局，使用 `DashboardPageShell` |
| 7 | 🟢提议 | `benchmarks-page.tsx:L88` + `benchmark-detail-page.tsx:L138` | 归档确认 `AlertDialog`（含标题、描述、按钮文案）在两处完全相同地重复，违反 DRY 原则 | 提取 `ArchiveConfirmDialog` 共享组件，接收 `open`/`onOpenChange`/`onConfirm` props |
| 8 | 🟢提议 | `src/server/services/benchmark-account.service.ts:L120` | `archiveBenchmark` 仅靠 `userId` 检查保护，未先做 `organizationId` 隔离：跨组织 ID 探测时对"不属于自己的账号"返回 `FORBIDDEN` 而非 `NOT_FOUND`，轻微信息泄露 | 在 `userId` 检查前先做 `organizationId` 检查，非本组织返回 `NOT_FOUND` |

---

## 详细说明

### [1] 🟡 archiveFilter 暴露在主列表端点

**位置**: `src/app/api/benchmarks/route.ts:35`

```typescript
// 现状 — 技术设计未约定 archiveFilter 字段
const listBenchmarksSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  archiveFilter: z.enum(["active", "archived", "all"]).optional(), // ← 多余字段
});
```

技术设计将"活跃列表"和"归档列表"明确分到两个端点（`GET /api/benchmarks` 和 `GET /api/benchmarks/archived`），职责分离清晰。当前实现在主端点暴露 `archiveFilter`，导致客户端可调用 `GET /api/benchmarks?archiveFilter=archived` 绕过 `/archived` 端点获取归档数据，也可用 `archiveFilter=all` 同时拿到两类数据。虽然 `organizationId` 隔离仍然有效，但破坏了 API 契约。

**建议修复**:
```typescript
const listBenchmarksSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

对应 service 层 `listBenchmarks` 中的 `params.archiveFilter ?? "active"` 改为直接 `"active"` 硬编码，或 `listBenchmarks` 只接受 `page`/`limit`，由调用方（`listArchivedBenchmarks`）在内部传入 `archiveFilter: "archived"`（现已如此，只需从对外入参中移除）。

---

### [2] 🟡 listBenchmarkVideos 缺少返回类型

**位置**: `src/server/services/benchmark-account.service.ts:L148`

```typescript
// 现状
async listBenchmarkVideos(caller: SessionUser, benchmarkId: string, params: ListParams) {
```

编码规范要求"Service 和 Repository 公共方法必须标注返回类型"。该方法调用 `douyinVideoRepository.findByAccountId`，其推断类型可用，但缺少显式声明会降低可读性和类型安全。

**建议修复**:
```typescript
async listBenchmarkVideos(
  caller: SessionUser,
  benchmarkId: string,
  params: ListParams,
): Promise<PaginatedData<DouyinVideoDTO>> {
```

---

### [3] 🟡 createBenchmark 返回值与技术设计不符

**位置**: `src/server/services/benchmark-account.service.ts:L42`

技术设计约定 `POST /api/benchmarks` 成功响应为 `201 + BenchmarkAccountDTO`。当前 service 返回 `{ id: string; profileUrl: string; secUserId: string }`（三字段的子集）。

前端调用处类型标注为 `apiClient.post<BenchmarkAccountDTO>(...)` 但实际接收的数据只有三个字段，虽然前端不使用返回值（仅调用 `onSuccess()`）不会 crash，但类型签名误导，且不符合 API 契约。

**建议修复**: 在 repository 的 `createBenchmark` 返回中 `include: userInclude`，Service 改为调用 `findBenchmarkById` 后用 `toBenchmarkAccountDTO` 映射并返回完整 DTO，或前端将泛型改为 `<{ id: string; profileUrl: string; secUserId: string }>` 并文档化偏差。推荐前者。

---

### [4] 🟡 跨 feature 模块引用 — benchmark-add-drawer.tsx

**位置**: `src/components/features/benchmarks/benchmark-add-drawer.tsx:L8`

```typescript
import { toCreateDouyinAccountPayload } from "@/components/features/accounts/account-payload";
```

`account-payload.ts` 是纯工具函数（无 JSX、无 state），目前放置在 `features/accounts/` 中，却被 `features/benchmarks/` 直接引用。这违反了组件层级约束（features 各模块之间不应互相依赖）。若未来 `accounts` feature 模块被提取或重命名，会静默破坏 `benchmarks`。

**建议修复**:
1. 将 `account-payload.ts`（含 `CreateDouyinAccountPayload` 接口和 `toCreateDouyinAccountPayload` 函数）迁移到 `src/lib/account-payload.ts`
2. 更新 `features/accounts/account-add-drawer.tsx` 和 `features/benchmarks/benchmark-add-drawer.tsx` 的 import
3. 更新 `features/accounts/account-payload.test.ts` 的 import，或将测试文件一同迁移至 `src/lib/`
4. 原 `features/accounts/account-payload.ts` 可改为 re-export 保持向后兼容，或直接删除

---

### [5] 🟡 硬编码色值 — benchmark-detail-header.tsx

**位置**: `src/components/features/benchmarks/benchmark-detail-header.tsx:L36`

```tsx
<div className="... bg-[#2b2210] ... text-[#f5d37a]">
```

UI 规范要求颜色只使用 CSS 变量（不硬编码色值）。此处金色调的验证徽标使用了固定 hex 值，在主题系统变动时无法自适应。

**建议修复**: 在 `src/app/globals.css` 的 `:root.dark`（当前主题为暗色）下新增：
```css
--verification-badge-bg: hsl(36 62% 11%);   /* #2b2210 等价 */
--verification-badge-text: hsl(43 87% 71%);  /* #f5d37a 等价 */
```
组件改为 `bg-[--verification-badge-bg] text-[--verification-badge-text]`。

---

### [6] 🟡 归档页未使用 DashboardPageShell

**位置**: `src/components/features/benchmarks/benchmarks-archived-page.tsx`

主列表页 `BenchmarksPageView` 使用了 `<DashboardPageShell title="..." description="..." actions={...}>` 布局，而归档页 `BenchmarksArchivedPageView` 使用了裸 `<div className="flex flex-1 flex-col gap-6 px-8 py-6 ...">` 手写布局。

前端规范："Dashboard 页面优先复用 `DashboardPageShell`"。两页视觉结构不一致，后续改样式时需要同步维护两处。

**建议修复**: 将 `BenchmarksArchivedPageView` 改为使用 `<DashboardPageShell title="已归档对标账号" backHref="/benchmarks" backLabel="返回对标账号">` 包裹内容区。

---

### [7] 🟢 重复的归档确认 AlertDialog

`benchmarks-page.tsx` 和 `benchmark-detail-page.tsx` 各自包含一套完全相同的 `AlertDialog` 归档确认对话框（标题"确认归档"、描述文案、`AlertDialogCancel`+`Button variant="destructive"` 结构相同）。

建议提取为 `src/components/shared/archive-confirm-dialog.tsx`，props 为 `open`, `onOpenChange`, `onConfirm`。

---

### [8] 🟢 archiveBenchmark 轻微信息泄露

`archiveBenchmark` 在 `findBenchmarkById`（无 organizationId 过滤）找到账号后，仅凭 `userId !== caller.id` 返回 `FORBIDDEN`。若跨组织 ID 探测，响应是 `FORBIDDEN` 而非 `NOT_FOUND`，泄露了"此 ID 确实存在"的信息。

因为 CUID 是随机不可猜测的，实际可利用性极低。但防御性编程建议先做 org 检查：

```typescript
if (account.organizationId !== caller.organizationId && caller.role !== UserRole.SUPER_ADMIN) {
  throw new AppError("NOT_FOUND", "对标账号不存在", 404);
}
if (account.userId !== caller.id) {
  throw new AppError("FORBIDDEN", "只能归档自己创建的对标账号", 403);
}
```

---

## 合格项确认

| 检查项 | 状态 |
|--------|------|
| `pnpm type-check` 零错误 | ✅ |
| `pnpm lint` 零错误 | ✅ |
| 所有 API 均调用 `auth()` + `requireRole()` | ✅ |
| Zod 验证覆盖所有输入（body + query params） | ✅ |
| Route Handler → Service → Repository 三层分离 | ✅ |
| `organizationId` 过滤在 `listBenchmarks`/`getBenchmarkDetail` 正确应用 | ✅ |
| SUPER_ADMIN 不过滤 org 的逻辑正确 | ✅ |
| 归档权限检查（仅创建者可归档）逻辑正确 | ✅ |
| `findBenchmarkById` 使用 `archiveFilter: "all"` 支持已归档账号详情查看 | ✅ |
| 第 4 个定时器 `collectionSyncCron` 已注册，防重入 flag 正确 | ✅ |
| `COLLECTION_SYNC_CRON` 环境变量已添加到 `env.ts` | ✅ |
| `findAllMyAccountsForCollection` 只查 `MY_ACCOUNT` + `secUserId` 非空 | ✅ |
| 收藏同步时间窗口 1 小时逻辑正确，`break` 策略正确 | ✅ |
| P2002 并发安全 `continue` 处理 | ✅ |
| `BenchmarkAccountDTO`/`BenchmarkAccountDetailDTO` 类型定义与技术设计一致 | ✅ |
| `DouyinBenchmarkWithUser` 共享 include，无重复定义 | ✅ |
| `buildWhere` 统一查询构建，无复制扩散 | ✅ |
| 前端组件使用 `apiClient`，无直接 fetch | ✅ |
| 前端组件 named export | ✅ |
| 无 `any` 类型、无 `@ts-ignore` | ✅ |
| 无直接 `process.env` 访问 | ✅ |
| 侧边栏正确新增"对标账号"导航项 | ✅ |

---

## 自省提议

### 需要更新的规范文档

1. **`docs/architecture/project-structure.md`**（建议架构师更新）  
   `src/lib/` 目录下目前未说明"前端侧共享工具函数"（如 account-payload 类纯函数）的安置位置。建议在 `src/lib/` 说明中加一行："前端与后端均无 UI 依赖的纯映射/工具函数应放置于此（如各 feature 共用的 payload builder）"，避免下次仍将其放入 `features/` 引发跨 feature 依赖。

2. **`docs/standards/review-checklist.md`**（建议评审师或编排者更新）  
   "架构合规性"一节可增加一条：  
   - `[ ]` **feature 层内聚**：`features/A` 中的纯工具函数若被 `features/B` 引用，需提升至 `src/lib/` 或 `components/shared/`，不允许跨 feature 直接引用。

3. **`docs/product/versions/v0.2.2/technical-design.md`**（可由编排者确认后补充）  
   API 契约章节的 `POST /api/benchmarks` 响应类型写的是 `BenchmarkAccountDTO`，但如果最终对齐为返回子集，建议在技术设计中明确注明偏差原因，避免后续版本的前端开发者按完整 DTO 编写消费代码。
