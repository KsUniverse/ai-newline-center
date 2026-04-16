# v0.3.2.1 技术设计文档 — 仪表盘改造

> 版本: v0.3.2.1
> 创建日期: 2026-04-16

---

## 数据模型变更

### 新增枚举 `BenchmarkVideoTag`

```prisma
enum BenchmarkVideoTag {
  LIMIT_UP       // 涨停榜
  DRAGON_TIGER   // 龙虎榜
  OVERNIGHT      // 隔夜单
  DARK_POOL      // 暗盘资金
  THEME_REVIEW   // 题材梳理
  THREE_DRAGONS  // 三只妖龙
  NOON_REVIEW    // 午评
  RECAP          // 复盘
}
```

### `BenchmarkVideo` 新增字段

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `customTag` | `BenchmarkVideoTag?` | `null` | 人工标签，可为空 |
| `isBringOrder` | `Boolean` | `false` | 是否带单 |

### `BenchmarkAccount` 新增字段

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `isBanned` | `Boolean` | `false` | 是否被封禁 |
| `bannedAt` | `DateTime?` | `null` | 封禁时间（标记时自动写入，取消时清空） |

### Migration 策略

新建 migration，不涉及数据迁移，纯 DDL 增列 + 枚举。

---

## API 设计

### 1. GET `/api/dashboard/benchmark-videos`

仪表盘短视频列表，cursor 分页，likeCount 降序。

**Query Params:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `dateRange` | `today\|yesterday\|this_week` | 按 publishedAt 过滤，必须有值（默认 today） |
| `customTag` | `BenchmarkVideoTag` (optional) | 精确匹配，不传 = 全部 |
| `isBringOrder` | `true\|false` (optional) | 不传 = 全部 |
| `cursor` | `string` (optional) | `{likeCount}_{id}` 格式的游标 |
| `limit` | `number` | 默认 20，最大 50 |

**Response data:**

```ts
{
  items: DashboardVideoItem[];
  nextCursor: string | null;  // null = 没有更多
  total: number;
}

type DashboardVideoItem = {
  id: string;
  videoId: string;
  title: string;
  coverUrl: string | null;
  likeCount: number;
  publishedAt: string | null;  // ISO
  customTag: BenchmarkVideoTag | null;
  isBringOrder: boolean;
  account: {
    id: string;
    nickname: string;
    avatar: string;
  };
};
```

---

### 2. PATCH `/api/benchmark-videos/[id]/tag`

更新视频自定义标签。

**Body:**

```ts
{ customTag: BenchmarkVideoTag | null }
```

**Response:** `{ id: string; customTag: BenchmarkVideoTag | null }`

---

### 3. PATCH `/api/benchmark-videos/[id]/bring-order`

切换带单状态。

**Body:** `{ isBringOrder: boolean }`

**Response:** `{ id: string; isBringOrder: boolean }`

---

### 4. GET `/api/dashboard/banned-accounts`

封禁账号列表，全量返回（最多 100 条）。

**Query Params:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `dateRange` | `today\|yesterday\|this_week\|this_month` | 按 bannedAt 过滤，默认 this_week |

**Response data:**

```ts
{
  items: BannedAccountItem[];
}

type BannedAccountItem = {
  id: string;
  nickname: string;
  avatar: string;
  douyinNumber: string | null;
  bannedAt: string;  // ISO
};
```

---

### 5. PATCH `/api/benchmarks/[id]/ban`

标记/取消封禁对标账号。

**Body:** `{ isBanned: boolean }`

**Response:** `{ id: string; isBanned: boolean; bannedAt: string | null }`

---

### 6. GET `/api/benchmarks/search`

供"标记封禁"弹框搜索账号（按昵称/抖音号模糊匹配，返回未封禁账号）。

**Query Params:** `q: string`（最少 1 字符），`limit: number`（默认 10，最大 20）

**Response data:**

```ts
{
  items: { id: string; nickname: string; avatar: string; douyinNumber: string | null; isBanned: boolean }[];
}
```

---

## 后端分层设计

### Repository 层新增方法

**`benchmark-video.repository.ts`**

```ts
// 仪表盘视频列表（cursor 分页）
findDashboardVideos(params: FindDashboardVideosParams): Promise<{ items: ...; nextCursor: string | null; total: number }>

// 更新自定义标签
updateCustomTag(id: string, organizationId: string, customTag: BenchmarkVideoTag | null): Promise<BenchmarkVideo>

// 更新带单状态
updateBringOrder(id: string, organizationId: string, isBringOrder: boolean): Promise<BenchmarkVideo>
```

**`benchmark-account.repository.ts`**

```ts
// 封禁账号列表
findBannedAccounts(params: FindBannedAccountsParams): Promise<BannedAccountItem[]>

// 更新封禁状态
updateBanStatus(id: string, organizationId: string, isBanned: boolean): Promise<BenchmarkAccount>

// 搜索账号（供弹框）
searchAccounts(organizationId: string, q: string, limit: number): Promise<BenchmarkAccount[]>
```

### Service 层新增方法

**`benchmark-video.service.ts`** 新增：

```ts
listDashboardVideos(caller: SessionUser, params): Promise<DashboardVideosResult>
updateVideoTag(caller: SessionUser, videoId: string, customTag: BenchmarkVideoTag | null): Promise<...>
updateVideoBringOrder(caller: SessionUser, videoId: string, isBringOrder: boolean): Promise<...>
```

**`benchmark-account.service.ts`** 新增：

```ts
listBannedAccounts(caller: SessionUser, params): Promise<BannedAccountsResult>
toggleBanStatus(caller: SessionUser, accountId: string, isBanned: boolean): Promise<...>
searchBenchmarkAccounts(caller: SessionUser, q: string, limit: number): Promise<...>
```

### Route Handler 层新增文件

```
src/app/api/dashboard/benchmark-videos/route.ts
src/app/api/dashboard/banned-accounts/route.ts
src/app/api/benchmark-videos/[id]/tag/route.ts
src/app/api/benchmark-videos/[id]/bring-order/route.ts
src/app/api/benchmarks/[id]/ban/route.ts
src/app/api/benchmarks/search/route.ts
```

---

## 前端组件设计

仪表盘页 `dashboard-home.tsx` 保持 Server Component，新增两个 Client Component Section：

```
DashboardHome (Server Component)
├── DashboardPageShell
│   ├── 快速入口 Section（现有）
│   ├── DashboardVideoSection (Client Component)  ← 新增
│   └── DashboardBannedSection (Client Component)  ← 新增
```

### `DashboardVideoSection`

- 文件：`src/components/features/dashboard/dashboard-video-section.tsx`
- State：`dateRange`（today/yesterday/this_week）、`customTag`（null | enum）、`isBringOrder`（null | boolean）、`cursor`（分页游标）、`items` 列表
- 操作：
  - 筛选变更 → 重置 cursor，重新 fetch
  - 加载更多 → 携带 nextCursor fetch，追加 items
  - 切换标签：`PATCH /api/benchmark-videos/[id]/tag` + 乐观更新
  - 切换带单：`PATCH /api/benchmark-videos/[id]/bring-order` + 乐观更新

### `DashboardBannedSection`

- 文件：`src/components/features/dashboard/dashboard-banned-section.tsx`
- State：`dateRange`（today/yesterday/this_week/this_month）、`items` 列表、`markBanOpen`（弹框开关）
- 操作：
  - 筛选变更 → 重新 fetch
  - 取消封禁：`PATCH /api/benchmarks/[id]/ban` `{isBanned: false}` + 乐观更新（从列表删除该条）
  - 标记封禁：弹框搜索 + `PATCH /api/benchmarks/[id]/ban` `{isBanned: true}` + 重新 fetch

### 枚举标签显示映射

在 `src/types/benchmark-video.ts`（新建）中定义前端展示映射：

```ts
export const BENCHMARK_VIDEO_TAG_LABELS: Record<BenchmarkVideoTag, string> = {
  LIMIT_UP: '涨停榜',
  DRAGON_TIGER: '龙虎榜',
  OVERNIGHT: '隔夜单',
  DARK_POOL: '暗盘资金',
  THEME_REVIEW: '题材梳理',
  THREE_DRAGONS: '三只妖龙',
  NOON_REVIEW: '午评',
  RECAP: '复盘',
};
```

---

## 复用策略

| 复用内容 | 复用方式 |
|----------|----------|
| `benchmarkAccountRepository.findMany()` 查询模式 | 新方法参照同一 `buildWhere` 模式 |
| `BenchmarkVideoRepository.findByAccountId()` 分页模式 | cursor 分页参照同一结构扩展 |
| `SurfaceSection` 组件 | 新 Section 直接使用 |
| `apiClient.get/patch()` | 前端直接调用 |
| 现有 `benchmarks/[id]/route.ts` | PATCH ban 作为同级子路由 `ban/route.ts` |

---

## 架构师自省

1. **复用**：两个 Repository 完全复用现有查询结构，Service 层扩展现有 class。Dashboard API 新建专用路由目录 `/api/dashboard/`，与现有资源路由解耦。
2. **无 ARCH-CHANGE**：cursor 分页在项目中首次使用，但属于 Prisma 标准模式，不违反架构约定。
3. **后端关键提示**：日期范围计算统一在 Service 层执行，入参为字符串 token（today/yesterday/this_week/this_month），输出 `{gte, lt}` UTC 时间对传给 Repository。游标格式为 `{likeCount}_{id}`，解码后转 `where: { OR: [{ likeCount: { lt: cursor.likeCount } }, { likeCount: cursor.likeCount, id: { gt: cursor.id } }] }`。
4. **前端关键提示**：两个 Section 均为 Client Component，初始数据通过 `useEffect` 在 mount 时 fetch（不使用 SSR，减少首屏数据依赖）。乐观更新用 `setItems(prev => prev.map(...))` 后 `try/catch` 回滚。
