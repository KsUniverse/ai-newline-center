# v0.3.2.1 后端任务清单

## 必读文档
- `docs/product/versions/v0.3.2.1/requirements.md`
- `docs/product/versions/v0.3.2.1/technical-design.md`
- `docs/architecture/backend.md`
- `docs/architecture/api-conventions.md`
- `.github/instructions/backend.instructions.md`
- `.github/instructions/prisma.instructions.md`

## 任务清单

### T-001: Prisma Schema 变更

**描述**
- 新增枚举 `BenchmarkVideoTag`（8 个值：LIMIT_UP/DRAGON_TIGER/OVERNIGHT/DARK_POOL/THEME_REVIEW/THREE_DRAGONS/NOON_REVIEW/RECAP）
- `BenchmarkVideo` 新增字段：`customTag BenchmarkVideoTag?`、`isBringOrder Boolean @default(false)`
- `BenchmarkAccount` 新增字段：`isBanned Boolean @default(false)`、`bannedAt DateTime?`
- 添加索引：`BenchmarkVideo @@index([organizationId, publishedAt])`（用于仪表盘日期范围查询）
- 添加索引：`BenchmarkAccount @@index([organizationId, isBanned, bannedAt])`

**涉及文件**
- `prisma/schema.prisma`

**操作**
运行 `pnpm db:migrate` 生成 migration（命名：`add_dashboard_fields`）

**验收标准**
- schema 语法无错
- migration 生成成功
- `pnpm db:generate` 后 Prisma Client 包含新枚举和字段

---

### T-002: BenchmarkVideo Repository 扩展

**描述**
在 `benchmark-video.repository.ts` 中新增三个方法：

1. `findDashboardVideos(params: FindDashboardVideosParams)` — cursor 分页，支持 dateRange/customTag/isBringOrder 过滤，按 likeCount DESC + id ASC 排序，include account（只选 id/nickname/avatar 字段）
   - cursor 解码：`{likeCount}_{id}` → `where: { OR: [{ likeCount: { lt: cursorLikeCount } }, { likeCount: cursorLikeCount, id: { gt: cursorId } }] }`
   - 同时 count 总数

2. `updateCustomTag(id: string, organizationId: string, customTag: BenchmarkVideoTag | null)` — 校验 organizationId，update customTag

3. `updateBringOrder(id: string, organizationId: string, isBringOrder: boolean)` — 校验 organizationId，update isBringOrder

**涉及文件**
- `src/server/repositories/benchmark-video.repository.ts`

**验收标准**
- TypeScript 编译通过
- 方法正确传递 organizationId 过滤（通过 account.organizationId 关联过滤）
- 新增导出类型：`FindDashboardVideosParams`、`DashboardVideoItem`

---

### T-003: BenchmarkAccount Repository 扩展

**描述**
在 `benchmark-account.repository.ts` 中新增三个方法：

1. `findBannedAccounts(params: { organizationId: string; dateRange: DateRangeToken })` — 查询 isBanned=true 且 bannedAt 在范围内的账号，返回 id/nickname/avatar/douyinNumber/bannedAt，按 bannedAt DESC，最多 100 条

2. `updateBanStatus(id: string, organizationId: string, isBanned: boolean)` — isBanned=true 时同时写 bannedAt=now()；isBanned=false 时清空 bannedAt=null

3. `searchAccounts(organizationId: string, q: string, limit: number)` — 按 nickname/douyinNumber 模糊匹配，返回活跃账号（deletedAt=null），最多 limit 条

**涉及文件**
- `src/server/repositories/benchmark-account.repository.ts`

**验收标准**
- TypeScript 编译通过
- `updateBanStatus` 中 bannedAt 逻辑正确
- `searchAccounts` 使用 `contains` 条件

---

### T-004: BenchmarkVideo Service 扩展

**描述**
在 `benchmark-video.service.ts` 中新增方法：

1. `listDashboardVideos(caller: SessionUser, params: { dateRange: DateRangeToken; customTag?: BenchmarkVideoTag; isBringOrder?: boolean; cursor?: string; limit?: number })` — 解析 dateRange 为 UTC 时间范围，调用 Repository，返回 items/nextCursor/total

2. `updateVideoTag(caller: SessionUser, videoId: string, customTag: BenchmarkVideoTag | null)` — 校验视频属于 caller.organizationId，调用 Repository

3. `updateVideoBringOrder(caller: SessionUser, videoId: string, isBringOrder: boolean)` — 校验视频属于 caller.organizationId，调用 Repository

**日期范围计算工具**（在 Service 层内实现 private 方法 `resolveDateRange`）：
- today: `{gte: 今日零点 UTC, lt: 今日 23:59:59 UTC}`
- yesterday: `{gte: 昨日零点 UTC, lt: 昨日 23:59:59 UTC}`
- this_week: `{gte: 本周一零点 UTC}`
- this_month: `{gte: 本月 1 日零点 UTC}`

**涉及文件**
- `src/server/services/benchmark-video.service.ts`

**验收标准**
- TypeScript 编译通过
- dateRange 解析正确（通过 Date 对象计算，不依赖第三方库）

---

### T-005: BenchmarkAccount Service 扩展

**描述**
在 `benchmark-account.service.ts` 中新增方法：

1. `listBannedAccounts(caller: SessionUser, params: { dateRange: DateRangeToken })` — 调用 Repository 的 findBannedAccounts

2. `toggleBanStatus(caller: SessionUser, accountId: string, isBanned: boolean)` — 校验账号属于 caller.organizationId（软删除账号不可操作），调用 Repository 的 updateBanStatus

3. `searchBenchmarkAccounts(caller: SessionUser, q: string, limit: number)` — 校验 q 非空，调用 Repository 的 searchAccounts

**涉及文件**
- `src/server/services/benchmark-account.service.ts`

**验收标准**
- TypeScript 编译通过
- toggleBanStatus 对已归档账号抛出 AppError('BENCHMARK_ARCHIVED', ...)

---

### T-006: API 路由 — 仪表盘视频列表

**描述**
新建 `src/app/api/dashboard/benchmark-videos/route.ts`

```
GET /api/dashboard/benchmark-videos
Query: dateRange, customTag, isBringOrder, cursor, limit
Auth: 所有角色
```

Zod 验证 schema，调用 `benchmarkVideoService.listDashboardVideos()`，返回 `successResponse(result)`。

**涉及文件**
- `src/app/api/dashboard/benchmark-videos/route.ts`（新建）

---

### T-007: API 路由 — 仪表盘封禁账号列表

**描述**
新建 `src/app/api/dashboard/banned-accounts/route.ts`

```
GET /api/dashboard/banned-accounts
Query: dateRange
Auth: 所有角色
```

**涉及文件**
- `src/app/api/dashboard/banned-accounts/route.ts`（新建）

---

### T-008: API 路由 — 视频标签/带单更新

**描述**
新建两个路由：
- `src/app/api/benchmark-videos/[id]/tag/route.ts` → PATCH，body: `{ customTag: string | null }`
- `src/app/api/benchmark-videos/[id]/bring-order/route.ts` → PATCH，body: `{ isBringOrder: boolean }`

注意新建 `src/app/api/benchmark-videos/[id]/` 路由组，[id] 参数通过 context.params 获取。

**涉及文件**
- `src/app/api/benchmark-videos/[id]/tag/route.ts`（新建）
- `src/app/api/benchmark-videos/[id]/bring-order/route.ts`（新建）

---

### T-009: API 路由 — 账号封禁操作 & 搜索

**描述**
新建两个路由：
- `src/app/api/benchmarks/[id]/ban/route.ts` → PATCH，body: `{ isBanned: boolean }`
- `src/app/api/benchmarks/search/route.ts` → GET，query: `q: string, limit?: number`

**涉及文件**
- `src/app/api/benchmarks/[id]/ban/route.ts`（新建）
- `src/app/api/benchmarks/search/route.ts`（新建）

---

## 自省要求
完成后在本文件底部写「后端自省」：
- 实际实现与任务描述的偏差
- TypeScript/Prisma 编译问题及解决方案
- 遗留给集成阶段的 TODO 项
