# v0.3.0.1 技术设计方案

> 版本: v0.3.0.1  
> 设计日期: 2026-04-04  
> 类型: Bug 修复 + 小功能增强

---

## 摘要

| 属性 | 值 |
|------|----|
| 涉及模块 | SyncService、DouyinVideoRepository、前端页面 Hook |
| 新增模型 | 无 |
| 新增 API | 无 |
| 新增页面 | 无 |
| 新增共享代码 | `src/lib/hooks/use-auto-refresh.ts` |
| 架构变更 | 无 |

---

## Bug-1 分析与修复方案

### 问题定位

文件：`src/server/services/sync.service.ts`，方法：`runCollectionSync()`

通过代码阅读，发现两处并列缺陷共同导致「收藏同步不创建 BENCHMARK_ACCOUNT」：

**缺陷 A（第一区块）— `collectedAt` 为 null 时跳过所有 item**

```typescript
// 现有代码（有问题）
for (const item of result.items) {
  if (!item.collectedAt) {
    continue;  // ← 若爬虫未返回 collect_time 字段，整批 items 全部被 continue 跳过
  }
  if (item.collectedAt < windowStart) {
    break;
  }
  // ...
}
```

`crawlerService.fetchCollectionVideos()` 内部（`src/server/services/crawler.service.ts`，`fetchCollectionVideos()` 方法）通过 `pickNumber(item, ["collect_time", "favorited_time", "create_time"])` 提取时间戳。若爬虫 API 在某些账号下不返回这三个字段，`collectedAt` 则为 `null`，所有 item 均被 `continue` 跳过，不走到创建逻辑。

**缺陷 B（第二区块）— `break` 依赖降序排列假设**

```typescript
if (item.collectedAt < windowStart) {
  break;  // ← 假设 items 按收藏时间降序排列（最新在前）
          //   若爬虫返回升序（最旧在前），第一条即满足 break 条件，整循环退出
}
```

`fetchCollectionVideos` 不保证返回顺序；若 API 以升序返回，最旧的条目排在最前，立即触发 `break`，后续所有新条目均被错过。

### 修复方案

将两个条件合并为单一 `continue` 判断，并在条件中增加 `!== null` 保护，不再区分 null 和「超时间窗口」；对所有具有有效 `authorSecUserId` 的 item 均进行处理，由现有的 `findBySecUserIdIncludingDeleted` 去重逻辑兜底：

```typescript
// 修复后
for (const item of result.items) {
  // collectedAt 为 null（爬虫未返回）视为「状态未知」，仍处理；
  // collectedAt 有值但早于时间窗口，跳过（不 break，防止乱序）
  if (item.collectedAt !== null && item.collectedAt < windowStart) {
    continue;
  }

  if (!item.authorSecUserId) {
    console.warn("[CollectionSync] 跳过无 authorSecUserId 的 item", { ... });
    continue;
  }

  const existing = await douyinAccountRepository.findBySecUserIdIncludingDeleted(
    item.authorSecUserId,
  );
  if (existing) {
    continue;
  }
  // ... 调用 fetchUserProfile + createBenchmark（逻辑不变）
}
```

增加关键节点结构化日志：
- 同步开始：`[CollectionSync] 开始，共扫描 {accounts.length} 个员工账号`
- 发现新博主：`[CollectionSync] 发现新博主 secUserId={x}，准备创建 BENCHMARK_ACCOUNT`
- 创建成功：`[CollectionSync] BENCHMARK_ACCOUNT 创建成功 secUserId={x} id={id}`
- 创建失败（P2002 冲突）：`[CollectionSync] secUserId={x} 已存在（并发写冲突），跳过`

**修改文件**：`src/server/services/sync.service.ts`，`runCollectionSync()` 方法内部

---

## Bug-2 分析与修复方案

### 问题定位

文件：`src/server/services/sync.service.ts`，私有方法：`upsertCrawlerVideo()`

```typescript
// 现有代码（有问题）
private async upsertCrawlerVideo(accountId: string, video: {...}): Promise<void> {
  const coverStoragePath = video.coverSourceUrl
    ? await storageService.downloadAndStore(video.coverSourceUrl, "covers")  // ← 先下载
    : null;
  const videoStoragePath = video.videoSourceUrl
    ? await storageService.downloadAndStore(video.videoSourceUrl, "videos")  // ← 先下载
    : null;

  await douyinVideoRepository.upsertByVideoId({
    videoId: video.awemeId,
    ...
    coverStoragePath,   // ← UPDATE 时也写入新路径，覆盖旧路径
    videoStoragePath,
  });
}
```

当视频已存在于 DB 时：
1. `downloadAndStore` 仍然执行，产生重复文件写入（或覆写同路径文件）
2. `upsertByVideoId` 的 `update` 分支（见 `src/server/repositories/douyin-video.repository.ts` 的 `upsertByVideoId()`）将 `coverStoragePath`、`videoStoragePath` 更新为新下载的值，导致「封面已有但被重复下载并覆写」
3. 日志中出现「待下载封面」但实际没有新视频入库，与预期不符

### 修复方案

在 `upsertCrawlerVideo()` 方法开头添加 DB 存在性检查，已存在的视频**仅更新统计数字字段**，不进行文件下载：

```typescript
private async upsertCrawlerVideo(accountId: string, video: {...}): Promise<void> {
  // Step 1: 预检查是否已存在
  const existing = await douyinVideoRepository.findByVideoId(video.awemeId);

  if (existing) {
    // Step 2: 已存在 → 仅更新数据指标，不重新下载文件
    await douyinVideoRepository.updateStatsByVideoId(video.awemeId, {
      playCount: video.playCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      shareCount: video.shareCount,
      collectCount: video.collectCount,
      admireCount: video.admireCount,
      recommendCount: video.recommendCount,
    });
    return;
  }

  // Step 3: 不存在 → 下载文件并创建记录（逻辑不变）
  const coverStoragePath = video.coverSourceUrl
    ? await storageService.downloadAndStore(video.coverSourceUrl, "covers")
    : null;
  const videoStoragePath = video.videoSourceUrl
    ? await storageService.downloadAndStore(video.videoSourceUrl, "videos")
    : null;

  await douyinVideoRepository.upsertByVideoId({ ... });
}
```

同时在 `src/server/repositories/douyin-video.repository.ts` 新增 `updateStatsByVideoId()` 方法：

```typescript
async updateStatsByVideoId(
  videoId: string,
  stats: {
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    collectCount?: number;
    admireCount?: number;
    recommendCount?: number;
  },
  db: DatabaseClient = prisma,
): Promise<void> {
  await db.douyinVideo.update({
    where: { videoId },
    data: stats,
  });
}
```

**修改文件**：
- `src/server/services/sync.service.ts`，`upsertCrawlerVideo()` 私有方法
- `src/server/repositories/douyin-video.repository.ts`，新增 `updateStatsByVideoId()`

---

## Bug-3 分析与修复方案

### 现状确认（无需修改过滤逻辑）

文件：`src/server/services/sync.service.ts`，`runVideoBatchSync()` 方法：

```typescript
async runVideoBatchSync(): Promise<void> {
  const accounts = await douyinAccountRepository.findAll();  // ← 未传 type 参数
  ...
}
```

`douyinAccountRepository.findAll()`（`src/server/repositories/douyin-account.repository.ts`）内部调用：

```typescript
async findAll(db: DatabaseClient = prisma): Promise<DouyinAccount[]> {
  return db.douyinAccount.findMany({
    where: this.buildWhere({ archiveFilter: "active" }),  // ← 无 type 字段
    ...
  });
}
```

`buildWhere({ archiveFilter: "active" })` 不含 `type` 过滤，因此 `findAll()` **已经返回所有类型**（MY_ACCOUNT + BENCHMARK_ACCOUNT）。**代码逻辑本身正确，无需修改过滤条件**。

### 行动：增加日志使其可观测

在 `runVideoBatchSync()` 开头增加日志，明确输出扫描账号数量及类型分布：

```typescript
async runVideoBatchSync(): Promise<void> {
  const accounts = await douyinAccountRepository.findAll();
  const myCount = accounts.filter((a) => a.type === "MY_ACCOUNT").length;
  const benchmarkCount = accounts.filter((a) => a.type === "BENCHMARK_ACCOUNT").length;
  console.log(`[VideoSync] 开始批量视频同步，共 ${accounts.length} 个账号（MY: ${myCount}，BENCHMARK: ${benchmarkCount}）`);
  ...
}
```

**修改文件**：`src/server/services/sync.service.ts`，`runVideoBatchSync()` 方法开头

---

## Feature-1 设计方案

### Hook 设计

新建文件：`src/lib/hooks/use-auto-refresh.ts`

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 每隔 intervalMs 毫秒自动调用 callback。
 * 返回 isRefreshing：callback 执行期间为 true，完成后自动变回 false。
 */
export function useAutoRefresh(intervalMs: number, callback: () => void) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  // 用 ref 持有最新 callback，避免 interval 捕获旧闭包
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    try {
      callbackRef.current();
    } finally {
      // 给一个短暂窗口让旋转动画可见；实际数据加载由调用方的 loading state 控制
      setTimeout(() => setIsRefreshing(false), 800);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, refresh]);

  return { isRefreshing };
}
```

### 需要接入 Hook 的页面

| 页面组件文件 | 触发刷新的现有机制 | 接入方式 |
|---|---|---|
| `src/components/features/accounts/accounts-page.tsx` | `setRefreshKey(k => k + 1)` | `useAutoRefresh(60_000, () => setRefreshKey(k => k + 1))` |
| `src/components/features/accounts/account-detail-page.tsx` | 无 | `useAutoRefresh(60_000, () => setRefreshKey(k => k + 1))`，新增 `refreshKey` state，加入两个 useEffect deps |
| `src/components/features/benchmarks/benchmarks-page.tsx` | `setRefreshKey(k => k + 1)` | `useAutoRefresh(60_000, () => setRefreshKey(k => k + 1))` |
| `src/components/features/benchmarks/benchmark-detail-page.tsx` | 无 | `useAutoRefresh(60_000, () => setRefreshKey(k => k + 1))`，新增 `refreshKey` state，加入两个 useEffect deps |

> `account-detail-page.tsx` 和 `benchmark-detail-page.tsx` 当前没有 `refreshKey` state，需要手动添加。

### Loading 图标设计

在每个页面的 `DashboardPageShell` 的 `actions` 区域，将刷新图标混入现有操作按钮旁：

```tsx
import { RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// 在 actions JSX 中添加：
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <RefreshCw
        className={cn(
          "h-3.5 w-3.5 text-muted-foreground/50",
          isRefreshing && "animate-spin",
        )}
      />
    </TooltipTrigger>
    <TooltipContent side="bottom">
      <p>每 60 秒自动刷新</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

- 图标颜色：`text-muted-foreground/50`（低调，不喧宾夺主）
- 尺寸：`h-3.5 w-3.5`（小于主按钮 icon）
- 旋转动画：Tailwind `animate-spin`，仅在 `isRefreshing === true` 时生效
- 不影响布局（`shrink-0`，内联 inline-flex）

对于 `account-detail-page.tsx` 和 `benchmark-detail-page.tsx` 没有使用 `DashboardPageShell` 的情况，将图标放置在页面顶部 Header 的右侧按钮区域（如归档按钮旁边）。

---

## 跨模块依赖

```
BE-001 (DouyinVideoRepository.updateStatsByVideoId) → BE-002 (SyncService.upsertCrawlerVideo 修复)
BE-003 (runCollectionSync 修复)   → 独立，无依赖
BE-004 (runVideoBatchSync 日志)   → 独立，无依赖
FE-001 (useAutoRefresh Hook)      → FE-002/003/004/005 所有页面接入任务
```

---

## 架构变更记录

无 `[ARCH-CHANGE]`。所有变更均在现有三层架构、现有文件范围内完成，未新增 API 路由、未修改数据库 Schema、未引入新的状态管理模式。
