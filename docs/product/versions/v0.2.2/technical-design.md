# v0.2.2 技术设计方案

> 版本: v0.2.2  
> 创建日期: 2026-04-03  
> 功能范围: F-002-1（收藏同步）+ F-002-2（对标账号管理）

---

## 摘要

| 项目 | 内容 |
|------|------|
| 涉及模块 | M-002（对标账号） |
| 新增模型 | 无（复用 `DouyinAccount` + `DouyinVideo`，通过 `type` 字段区分） |
| 新增 API | 6 个路由组（`/api/benchmarks/*`） |
| 新增页面/组件 | 3 个页面 + 7 个业务组件 |
| 架构变更 | 无 `[ARCH-CHANGE]` — 新增第 4 个定时器；账号域采用共享 Repository 条件构建，避免 `MY_ACCOUNT` / `BENCHMARK_ACCOUNT` 重复查询 |

---

## 数据模型变更

### 结论：Prisma Schema 无变更

`DouyinAccount` 模型已具备所有需要的字段：

| 字段 | 已有 | 说明 |
|------|------|------|
| `type DouyinAccountType` | ✅ | `MY_ACCOUNT` / `BENCHMARK_ACCOUNT` |
| `deletedAt DateTime?` | ✅ | 软删除（归档）标准字段 |
| `userId String` | ✅ | 归属/创建者员工 ID（first-creator 语义） |
| `organizationId String` | ✅ | 数据隔离字段 |
| `secUserId String? @unique` | ✅ | 全局唯一约束，确保同一博主只有一条记录 |

**「收藏时间」（collectedAt）不需要存入 DB**：该字段仅在收藏同步定时器执行期间用于时间窗口过滤，是过程中的瞬时值，不需要持久化。

---

## API 契约

### 通用规则
- 认证：所有接口均需 `auth()` session
- 权限：员工可手动添加/归档自己创建的
- 数据隔离：EMPLOYEE 按 `organizationId` 过滤（不按 `userId`，基准账号是全组织共享的）
- BRANCH_MANAGER 按 `organizationId` 过滤
- SUPER_ADMIN 不过滤

---

### POST /api/benchmarks/preview

预览对标账号信息（与 `/api/douyin-accounts/preview` 逻辑完全一致，独立端点避免耦合）。

```typescript
// 请求体 Zod schema
const previewBenchmarkSchema = z.object({
  profileUrl: z
    .string()
    .url()
    .regex(/^https?:\/\/(www\.)?douyin\.com\/user\/.+$/, "请输入合法的抖音主页链接"),
});

// 响应类型: AccountPreview（复用 src/types/douyin-account.ts 中的现有类型）
```

---

### POST /api/benchmarks

手动创建对标账号。

```typescript
// 请求体 Zod schema（与 douyin-accounts POST 字段一致，type 由后端固定为 BENCHMARK_ACCOUNT）
const createBenchmarkSchema = z.object({
  profileUrl: z
    .string()
    .url()
    .regex(/^https?:\/\/(www\.)?douyin\.com\/user\/.+$/, "请输入合法的抖音主页链接"),
  secUserId: z.string().min(1),
  nickname: z.string().min(1).max(200),
  avatar: z.string().url(),
  bio: z.string().max(500).nullable().optional(),
  signature: z.string().max(500).nullable().optional(),
  followersCount: z.number().int().min(0),
  followingCount: z.number().int().min(0),
  likesCount: z.number().int().min(0),
  videosCount: z.number().int().min(0),
  douyinNumber: z.string().max(100).nullable().optional(),
  ipLocation: z.string().max(100).nullable().optional(),
  age: z.number().int().min(0).nullable().optional(),
  province: z.string().max(100).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  verificationLabel: z.string().max(200).nullable().optional(),
  verificationIconUrl: z.string().url().nullable().optional(),
  verificationType: z.number().int().nullable().optional(),
});

// 成功响应: 201 + BenchmarkAccountDTO
// 业务错误码:
//   BENCHMARK_EXISTS (409)  — 该 secUserId 的 BENCHMARK 未归档时已存在
//   BENCHMARK_ARCHIVED (409) — 该 secUserId 的 BENCHMARK 已存在但已归档
//   ACCOUNT_EXISTS_AS_MY (409) — 该 profileUrl 已作为 MY_ACCOUNT 被添加
```

**Service 层去重逻辑**（顺序检查）：
1. `findBySecUserIdIncludingDeleted(secUserId)` → 若找到且 `deletedAt=null` → `BENCHMARK_EXISTS`
2. → 若找到且 `deletedAt!=null` → `BENCHMARK_ARCHIVED`
3. `findByProfileUrl(profileUrl)`（findByProfileUrl 不过滤 deletedAt，因为 profileUrl 是 unique 约束） → 若找到且 `type=MY_ACCOUNT` → `ACCOUNT_EXISTS_AS_MY`
4. 全部通过 → 创建

---

### GET /api/benchmarks

列表查询（仅未归档）。

```typescript
// Query Params Zod schema
const listBenchmarksSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// 响应类型: PaginatedData<BenchmarkAccountDTO>
// BenchmarkAccountDTO 定义见"共享类型"节
```

---

### GET /api/benchmarks/archived

归档列表查询（仅 `deletedAt IS NOT NULL`）。

```typescript
// Query Params: 同 listBenchmarksSchema
// 响应类型: PaginatedData<BenchmarkAccountDTO>（含 deletedAt 字段）
```

---

### GET /api/benchmarks/[id]

查询单个对标账号详情（包含已归档）。

```typescript
// 无请求体/Query Params
// 响应类型: BenchmarkAccountDetailDTO
// 错误: NOT_FOUND (404) — id 不存在或不属于可访问范围
```

---

### DELETE /api/benchmarks/[id]

归档对标账号（软删除）。

```typescript
// 无请求体
// 成功响应: 200 + { id: string; deletedAt: string }
// 错误:
//   NOT_FOUND (404)   — 账号不存在或已归档
//   FORBIDDEN (403)   — 当前用户不是账号创建者 (account.userId != session.userId)
```

---

### GET /api/benchmarks/[id]/videos

查询对标账号的视频列表（包含已归档账号的视频，只读）。

```typescript
// Query Params Zod schema
const listBenchmarkVideosSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// 响应类型: PaginatedData<DouyinVideoDTO>（复用现有类型）
```

---

## 共享类型定义

新增至 `src/types/douyin-account.ts`：

```typescript
// 对标账号列表 DTO（含创建者姓名，用于卡片展示）
export interface BenchmarkAccountDTO extends DouyinAccountDTO {
  creatorName: string; // user.name 平铺到 DTO，避免前端访问嵌套
  deletedAt: string | null; // 主列表为 null；归档列表用于展示归档时间
}

// 对标账号详情 DTO
export interface BenchmarkAccountDetailDTO extends BenchmarkAccountDTO {
  lastSyncedAt: string | null;
}
```

---

## fetchCollectionVideos 改造方案

### 当前状态

```typescript
// 当前：完全未结构化
type CrawlerCollectionResult = Record<string, unknown>;

async fetchCollectionVideos(secUserId: string): Promise<CrawlerCollectionResult> {
  return this.callCrawlerApi<CrawlerCollectionResult>(
    "/api/douyin/web/fetch_user_collection_videos",
    { sec_user_id: secUserId },
  );
}
```

### 目标：结构化返回类型

```typescript
// 新增接口（在 crawler.service.ts 文件顶部）
interface CrawlerCollectionItem {
  awemeId: string | null;        // 视频 ID（用于日志追踪）
  authorSecUserId: string | null; // 博主的 secUserId（核心字段）
  collectedAt: Date | null;      // 收藏时间（用于时间窗口过滤）
}

interface CrawlerCollectionResult {
  items: CrawlerCollectionItem[];
  hasMore: boolean;
  cursor: number;
}
```

### 字段映射策略（多 Key 探测，与 fetchVideoList 保持一致）

**[PENDING-CRAWLER-DETAIL]** 以下字段名需在实际调用爬虫后确认。候选 Key 已按可能性排序：

| 业务字段 | 候选 JSON Key（按优先级） | 处理方式 |
|---------|----------------------|---------|
| 视频列表数组 | `["aweme_list", "collect_list", "video_list"]` | `pickArray(raw, [...])` |
| 收藏时间 | `["collect_time", "favorited_time", "create_time"]` | `pickNumber` → `new Date(v * 1000)` |
| 博主信息对象 | `["author", "author_info"]` | `pickRecord(item, [...])` |
| 博主 secUserId | `["sec_user_id", "sec_uid"]` | `pickString(author, [...])` |
| awemeId | `["aweme_id", "awemeId"]` | `pickString(item, [...])` |
| hasMore | `["has_more"]` | `pickBoolean(raw, [...])` |
| cursor | `["max_cursor", "cursor"]` | `pickNumber(raw, [...])` |

> **实现要求**：后端开发者实现时，先调用一次真实爬虫 API（可在测试脚本中），打印完整 JSON 响应后，按实际字段名调整候选 Key 列表。

---

## 定时器设计

### 现有定时器（保持不变）

| 定时器 | Cron 默认 | 功能 |
|--------|-----------|------|
| 账号信息同步 | `0 */6 * * *` | 全量更新所有账号基础信息 |
| 视频同步 | `0 * * * *` | 增量同步视频列表 |
| 视频快照 | `*/10 * * * *` | 采集视频播放数据快照 |

### 新增第 4 个定时器：收藏同步

| 项目 | 值 |
|------|-----|
| 新增环境变量 | `COLLECTION_SYNC_CRON`（可选，默认 `*/5 * * * *`） |
| 执行方法 | `syncService.runCollectionSync()` |
| 防重入机制 | `startScheduler()` 内部 `let collectionSyncRunning = false` flag |

**scheduler.ts 变更**：

```typescript
// 新增环境变量
const collectionSyncCron = env.COLLECTION_SYNC_CRON ?? "*/5 * * * *";

// 新增防重入变量（startScheduler 内部）
let collectionSyncRunning = false;

// 新增定时器注册
cron.schedule(collectionSyncCron, () => {
  if (collectionSyncRunning) {
    console.warn("[Scheduler] Collection sync already running, skipping...");
    return;
  }
  collectionSyncRunning = true;
  void syncService.runCollectionSync().finally(() => {
    collectionSyncRunning = false;
  });
});
```

---

## 收藏同步算法

### 执行流程（`SyncService.runCollectionSync()`）

```
1. 查询所有符合条件的 MY_ACCOUNT：
   secUserId IS NOT NULL AND deletedAt IS NULL AND type = MY_ACCOUNT

2. 遍历每个账号（独立 try/catch，单个失败不中断整体）：

   a. 调用 crawlerService.fetchCollectionVideos(account.secUserId)
      → 失败：记录 error 日志，continue

   b. 计算时间窗口截止时间：windowStart = new Date(Date.now() - 60 * 60 * 1000)

   c. 遍历 result.items（已按最新收藏排序）：
      - 若 item.collectedAt == null → 跳过
      - 若 item.collectedAt < windowStart → break（遇到旧记录，直接停止）
      - 若 item.authorSecUserId == null → 记录 warn 日志，continue

      d. 查询 DB：douyinAccountRepository.findBySecUserIdIncludingDeleted(item.authorSecUserId)
         - 若找到（无论 type 或 deletedAt 状态）→ skip（不重复创建）
         - 若未找到：
           i. 调用 crawlerService.fetchUserProfile(item.authorSecUserId)
              → 失败：记录 error 日志，continue（不创建）
           ii. 调用 douyinAccountRepository.createBenchmark({
                 ...profile,
                 profileUrl: `https://www.douyin.com/user/${item.authorSecUserId}`,
                 userId: account.userId,        // first-creator
                 organizationId: account.organizationId,
               })
               → 唯一约束冲突（并发创建）：catch 并 continue（幂等）

3. 新创建的 BENCHMARK_ACCOUNT 无需任何额外操作
   → 已有的视频同步定时器调用 douyinAccountRepository.findAll()
   → findAll() 返回所有 deletedAt=null 的账号（含新创建的 BENCHMARK_ACCOUNT）
   → 自动进入视频同步范围
```

### 关键约束说明

| 约束 | 实现方式 |
|------|---------|
| 防重入 | `startScheduler()` 内部 `collectionSyncRunning` flag |
| 单账号失败不中断 | for 循环内 try/catch |
| 博主全局唯一 | `secUserId @unique` 约束 + service 层检查 |
| 已归档博主不重建 | `findBySecUserIdIncludingDeleted` 找到则 skip |
| 并发安全 | catch Prisma P2002（唯一约束冲突）→ continue |
| 时间窗口覆盖 | `collectedAt >= now - 1h`，保证 5 分钟延迟下不漏数据 |

---

## 对标账号软删除方案

**使用现有 `deletedAt DateTime?` 字段，与所有其他模型（Organization、User）保持一致。**

不引入任何新的软删除模式。

| 操作 | 实现 |
|------|------|
| 归档 | `UPDATE douyin_accounts SET deletedAt = now() WHERE id = ?` |
| 主列表查询 | `WHERE type=BENCHMARK_ACCOUNT AND deletedAt IS NULL` |
| 归档列表查询 | `WHERE type=BENCHMARK_ACCOUNT AND deletedAt IS NOT NULL` |
| 详情查询 | `WHERE id = ?`（不过滤 deletedAt，支持归档详情页） |
| 恢复归档 | **v0.2.2 不实现** |
| 硬删除 | **v0.2.2 不实现** |
| 定时同步跳过 | `findAll()` 已过滤 `deletedAt: null`，自动跳过已归档账号 ✓ |

---

## 前端组件设计

### 路由结构

| 路径 | 页面文件 | 说明 |
|------|---------|------|
| `/benchmarks` | `src/app/(dashboard)/benchmarks/page.tsx` | 主列表页（未归档）|
| `/benchmarks/archived` | `src/app/(dashboard)/benchmarks/archived/page.tsx` | 归档列表页 |
| `/benchmarks/[id]` | `src/app/(dashboard)/benchmarks/[id]/page.tsx` | 详情页（兼容活跃/归档）|

> Next.js App Router 中静态路由段 `/archived` 优先于动态段 `/[id]`，不存在冲突。

### 组件树

```
/benchmarks
└── BenchmarksPage
    ├── 页面标题区（"对标账号" + "添加对标账号"按钮）
    ├── BenchmarkCardGrid（卡片 Grid 布局）
    │   └── BenchmarkCard × N
    │       └── DropdownMenu（「···」→「归档」，仅 userId 匹配时显示）
    │           └── ConfirmDialog（归档确认弹窗）
    ├── BenchmarkEmptyState（空状态 + 添加引导）
    ├── 分页控件（同现有账号页）
    ├── "查看已归档" 文字链接（右上角或列表底部）
    └── BenchmarkAddDrawer（右侧 Sheet）

/benchmarks/archived
└── BenchmarksArchivedPage
    ├── 页面标题区（"已归档对标账号" + 返回主列表链接）
    ├── BenchmarkCardGrid（使用相同组件，archived=true 传入）
    └── ArchivedEmptyState

/benchmarks/[id]
└── BenchmarkDetailPage
    ├── BenchmarkDetailHeader
    │   ├── 博主信息卡（头像、昵称、粉丝数、简介、创建者姓名）
    │   ├── 已归档标记（若 deletedAt != null）
    │   └── "归档"按钮（仅 userId 匹配且未归档时显示）
    └── BenchmarkVideoList
        └── BenchmarkVideoGridCard × N
            └── "未拆解" Badge（v0.2.2 固定显示，为 v0.3.x 占位）
```

### 组件文件位置

新建 `src/components/features/benchmarks/` 目录：

```
src/components/features/benchmarks/
├── benchmark-add-drawer.tsx       # 参照 account-add-drawer.tsx，调用 /api/benchmarks/*
├── benchmark-card.tsx             # 卡片（含创建者姓名 + 归档入口菜单）
├── benchmark-card-grid.tsx        # Grid 布局容器
├── benchmark-detail-header.tsx    # 详情页博主信息卡
├── benchmark-empty-state.tsx      # 空状态
├── benchmark-video-grid-card.tsx  # 视频格子卡片 + "未拆解" Badge
├── benchmark-video-list.tsx       # 视频列表（分页）
└── index.ts                       # barrel export
```

### 状态管理

- 使用组件内 `useState` + `useEffect`（同现有 `accounts/page.tsx` 模式）
- 无需新增 Zustand Store

### 归档确认 Dialog 文案

> 「归档后，该博主的账号和视频数据均保留但会从主列表隐藏。确认归档？」
> \[取消\] \[确认归档\]（使用 `variant="destructive"`）

### "查看已归档" 入口

主列表页 Header 区域，右侧与"添加对标账号"按钮同行，使用 `variant="ghost"` 的文字链接样式（`text-sm text-muted-foreground hover:text-foreground`）：

```
[查看已归档 →]   [+ 添加对标账号]
```

### 侧边栏变更

在 `app-sidebar.tsx` 的 `NAV_ITEMS` 中，在「我的账号」之后添加"对标账号"入口：

```typescript
{
  icon: Target,   // 使用 lucide-react 的 Target 图标（含义：对标/瞄准）
  label: "对标账号",
  href: "/benchmarks",
  roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
},
```

---

## Repository 层变更

修改 `src/server/repositories/douyin-account.repository.ts`，新增以下方法：

### 抽象优先实现说明

由于 `DouyinAccount` 同时服务 `MY_ACCOUNT` 与 `BENCHMARK_ACCOUNT` 两种业务视图，实际实现采用了
“**共享 where/include 构建 + 语义方法封装**”模式：

- 共享条件构建：抽取 `buildWhere()` / `buildArchiveWhere()`
- 共享 include：抽取 `userInclude`
- 语义方法保留：`findManyBenchmarks()`、`findAllMyAccountsForCollection()`、`findBenchmarkById()` 等

这样可以保持 Service 层使用语义化方法，同时避免在 Repository 中复制多套近似 Prisma 查询。

| 方法 | 说明 |
|------|------|
| `findAllMyAccountsForCollection()` | `type=MY_ACCOUNT AND secUserId IS NOT NULL AND deletedAt IS NULL`，用于收藏同步 |
| `findBySecUserIdIncludingDeleted(secUserId)` | 查询（忽略 deletedAt），用于去重检查 |
| `findManyBenchmarks(params)` | type=BENCHMARK_ACCOUNT 分页列表，含 user include，支持 `includeArchived` 参数 |
| `createBenchmark(data)` | 创建 type=BENCHMARK_ACCOUNT 记录（type 在方法内固定，防误传） |
| `findBenchmarkById(id)` | 按 id 查询（不过滤 deletedAt），用于详情页和归档操作 |
| `archiveBenchmark(id)` | `UPDATE SET deletedAt = now()`，返回更新后记录 |

`findManyBenchmarks` params 类型：

```typescript
interface FindManyBenchmarksParams {
  organizationId?: string;
  includeArchived?: boolean; // false = 仅未归档（主列表），true = 仅已归档（归档列表）
  page: number;
  limit: number;
}
```

其中 `includeArchived` 控制 WHERE：
- `false`（默认）→ `deletedAt IS NULL AND type = BENCHMARK_ACCOUNT`
- `true` → `deletedAt IS NOT NULL AND type = BENCHMARK_ACCOUNT`

---

## 跨模块依赖

### 执行顺序约束

```
BE-001（env.ts 新增变量）
  └── BE-006（scheduler.ts 注册第 4 个 cron）

BE-002（crawler.service.ts 改造）
  └── BE-005（sync.service.ts runCollectionSync）

BE-003（repository 新增方法）
  └── BE-004（benchmark-account.service.ts）
       └── BE-007、BE-008（API routes）

BE-004（benchmark-account.service.ts）
  └── BE-005（sync.service.ts runCollectionSync）
```

### 前后端共享类型

| 类型 | 定义位置 | 消费方 |
|------|---------|--------|
| `BenchmarkAccountDTO` | `src/types/douyin-account.ts` | 前端列表页、卡片组件 |
| `BenchmarkAccountDetailDTO` | `src/types/douyin-account.ts` | 前端详情页 |
| `AccountPreview` | 已有，`src/types/douyin-account.ts` | `BenchmarkAddDrawer` 复用 |
| `DouyinVideoDTO` | 已有 | 对标账号视频列表复用 |

### 后端依赖

- `BenchmarkAccountService` 依赖 `CrawlerService`（previewBenchmark 调用）
- `SyncService.runCollectionSync` 依赖 `CrawlerService.fetchCollectionVideos`（已改造）
- 视频同步：`SyncService.runVideoBatchSync` 通过 `findAll()` 自动包含 BENCHMARK_ACCOUNT，**无需修改**

---

## 环境变量变更

修改 `src/lib/env.ts`，在 `envSchema` 中新增：

```typescript
COLLECTION_SYNC_CRON: z.string().optional(),
```

---

## 架构变更记录

无 `[ARCH-CHANGE]`。

所有设计决策均遵循现有架构约定：

| 决策 | 遵循的约定 |
|------|-----------|
| 第 4 个定时器 | 与现有 3 个定时器模式完全一致（`startScheduler` + `initialized` flag） |
| 软删除 | 复用现有 `deletedAt DateTime?` 字段，未引入新模式 |
| 防重入 | `startScheduler()` 内部 flag + `initialized` 幂等注册 |
| 数据隔离 | Repository 层 organizationId 过滤，与现有规范一致 |
| 对标账号与 MY_ACCOUNT | 独立页面（`/benchmarks`），不合并，通过 `type` 字段区分 |
| fetchCollectionVideos 改造 | 仍在 CrawlerService 内，保持单一封装原则 |
| `collectedAt` 不持久化 | 瞬时值，不需要新 schema 字段 |
| 账号域复用 | Repository 内抽取共享查询构建函数，减少 type 分支重复实现 |
