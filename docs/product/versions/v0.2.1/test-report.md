# 测试报告 — v0.2.1

> 测试日期: 2026-04-03  
> 测试人: Tester  
> 分支: feature/v0.2.1

---

## 摘要

- 测试功能数: 1（F-001-2 账号信息同步，含 a/b/c/d 四个子功能点）
- 自动化测试: 54 passed / 0 failed（12 个测试文件）
- 静态代码审查项: 18 项全部通过
- UI 问题: 0
- 构建检查: 通过 ✅
- 结论: **可以 Release ✅**

---

## 1. 自动化测试

### 1.1 单元/集成测试（pnpm test）

```
Test Files  12 passed (12)
      Tests  54 passed (54)
   Duration  3.50s
```

**✅ 通过** — 全部 54 个测试均通过，包括：
- `sync.service.test.ts` (3 tests)
- `douyin-accounts/[id]/sync/route.test.ts` (3 tests)
- `scheduler.test.ts` (1 test)
- `crawler.service.test.ts` (6 tests)
- 其余已有测试套件

### 1.2 TypeScript 类型检查（pnpm type-check）

**✅ 通过** — `tsc --noEmit` 无任何错误或警告。

### 1.3 ESLint 检查（pnpm lint）

**✅ 通过** — `eslint .` 无任何错误或警告。

### 1.4 生产构建（pnpm build）

**✅ 通过** — Next.js 构建完成，无编译错误，所有路由正常生成。

---

## 2. 功能验收

### F-001-2a/2b: 定时同步任务 — ✅ 通过

#### 2.1 手动同步 API 验收（`src/app/api/douyin-accounts/[id]/sync/route.ts`）

- [x] 有 `auth()` 鉴权 — `const session = await auth()` + 未登录时抛 401
- [x] 仅 EMPLOYEE 角色可访问 — `session.user.role !== UserRole.EMPLOYEE` 时抛 403
- [x] 响应格式正确 — `successResponse({ lastSyncedAt: result.lastSyncedAt.toISOString() })` 符合 `{ success: true, data: { lastSyncedAt: string } }`

#### 2.2 SyncService 逻辑验收（`src/server/services/sync.service.ts`）

- [x] `syncAccount` 传入 `callerOrganizationId`，`account.organizationId !== callerOrganizationId` 时抛 `AppError("NOT_FOUND", ..., 404)`
- [x] `syncAccountInfo` 返回 `Promise<Date>`，无对象突变（从 `updateAccountInfo` 返回值取 `lastSyncedAt`，不修改入参 `account`）
- [x] 批量同步方法 `runAccountInfoBatchSync` 和 `runVideoBatchSync` 均有 `try-catch` 包裹单账号逻辑，单条失败仅记录日志，不中断循环

#### 2.3 定时任务验收（`src/lib/scheduler.ts` + `instrumentation.ts`）

- [x] `scheduler.ts` 有 `let initialized = false` + 函数内 `if (initialized) return` 防重复注册
- [x] `instrumentation.ts` 仅在 `process.env.NEXT_RUNTIME === "nodejs"` 且 `process.env.NODE_ENV !== "test"` 时调用 `startScheduler()`
- [x] 账号同步默认 cron: `"0 */6 * * *"`（每 6 小时）
- [x] 视频同步默认 cron: `"0 * * * *"`（每 1 小时）

---

### F-001-2c/2d: 手动触发同步 + 状态可见性 — ✅ 通过

#### 2.4 AccountSyncSection 组件（`src/components/features/accounts/account-sync-section.tsx`）

- [x] `"use client"` 指令在文件第一行
- [x] `syncing === true` 时按钮 `disabled` + `<Loader2 className="h-3 w-3 animate-spin" />` 动画 + 文字"同步中…"
- [x] 成功时 `toast.success("同步成功")` 并调用 `onSyncSuccess(data.lastSyncedAt)`
- [x] 失败时 `toast.error(message)`（优先使用 `ApiError.message`，兜底"同步失败，请稍后再试"）

#### 2.5 formatRelativeTime 工具函数（`src/lib/utils.ts`）

- [x] `null` → `"尚未同步"`
- [x] `diffSeconds < 60` → `"刚刚"`
- [x] `diffMinutes < 60`（且 ≥ 1 分钟）→ `"N 分钟前"`
- [x] `diffHours < 24`（且 ≥ 1 小时）→ `"N 小时前"`
- [x] `diffHours >= 24` → `"MM-DD HH:mm"` 格式，月日小时分钟均补零

#### 2.6 AccountDetailHeader 组件（`src/components/features/accounts/account-detail-header.tsx`）

- [x] 有 `"use client"` 指令（文件第一行）
- [x] 嵌入了 `AccountSyncSection`，并将 `account.id`、`account.lastSyncedAt`、`onSyncSuccess` 正确透传

---

## 3. env 和 .env.example 验收

#### 3.1 `src/lib/env.ts`

- [x] 定义了 `CRAWLER_API_URL: z.string().url().optional()`
- [x] 定义了 `REDIS_URL: z.string().url().optional()`
- [x] 定义了 `ACCOUNT_SYNC_CRON: z.string().optional()`
- [x] 定义了 `VIDEO_SYNC_CRON: z.string().optional()`
- [x] `CRAWLER_API_URL` 在构建阶段不强制要求 — `superRefine` 中 `process.env.NEXT_PHASE !== "phase-production-build"` 守卫

#### 3.2 `.env.example`

- [x] 包含 `REDIS_URL`（赋值示例）
- [x] 包含 `CRAWLER_API_URL`（已注释，附说明）
- [x] 包含 `ACCOUNT_SYNC_CRON`（已注释，含默认值 `0 */6 * * *`）
- [x] 包含 `VIDEO_SYNC_CRON`（已注释，含默认值 `0 * * * *`）

---

## 4. UI 一致性

| 检查项 | 结果 | 备注 |
|--------|------|------|
| `"use client"` 指令 | ✅ | AccountSyncSection 和 AccountDetailHeader 均有 |
| shadcn/ui 组件使用 | ✅ | `Button`、`Separator` 使用正确 |
| 色彩使用 CSS 变量 | ✅ | `text-muted-foreground`、`text-foreground/80`，无硬编码色值 |
| 间距规范 | ✅ | `gap-3`、`gap-4`、`gap-5`，均为 4px 倍数 |
| 按钮 size/variant | ✅ | `size="sm" variant="outline"` 符合规范 |
| 加载状态 | ✅ | Loader2 动画 + 按钮 disabled |
| 错误/成功反馈 | ✅ | sonner toast 正确使用 |

---

## 5. 问题列表

无问题。所有验收项均通过。

---

## 6. 自省

### 回顾
- `requirements.md` 验收标准中，F-001-2d 的"定时任务在后台执行时不向前端推送通知"属于纯后端行为，无法通过静态代码审查验证前端侧的具体表现，但该需求本质上是"不做"而非"有明确 UI"，故不计入失败项。
- 视频同步的增量翻页逻辑（`MAX_VIDEO_PAGES = 3`，遇到无更多数据时 break）实现合理，但 requirements.md 中仅注明"具体翻页深度由技术层面决定"，与实现一致。

### 检查
- `review-checklist.md` 可考虑补充：**instrumentation.ts 的 runtime 守卫**（`NEXT_RUNTIME === "nodejs"` + `NODE_ENV !== "test"`）作为定时任务/服务端初始化的标准检查项。
- `ui-ux-system.md` 可考虑新增：**Toast 通知规范**（成功/失败场景的 sonner 使用约定），目前规范中仅有 shadcn/ui 组件层，无 toast 使用说明。

### 提议（待架构师/编排者确认后执行）
1. **`docs/standards/review-checklist.md`** — 新增 `instrumentation.ts runtime 守卫` 检查项至「后端定时任务/服务端初始化」区块
2. **`docs/standards/ui-ux-system.md`** — 新增「Toast 通知」规范节，说明成功/失败/加载三类场景应使用 sonner 的 `toast.success` / `toast.error` / `toast.loading`
