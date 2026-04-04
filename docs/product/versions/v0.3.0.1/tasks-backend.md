# v0.3.0.1 后端任务清单

## 必读文档

> 开始开发前必须阅读以下文档：

- `docs/product/versions/v0.3.0.1/requirements.md` — 本版本需求（理解业务背景）
- `docs/product/versions/v0.3.0.1/technical-design.md` — 本版本技术设计（含精确修复点）
- `docs/architecture/backend.md` — 后端分层规范
- `docs/architecture/database.md` — 数据库设计规范
- `docs/standards/coding-standards.md` — 编码规范

## 摘要

| 属性 | 值 |
|------|----|
| 任务总数 | 4 |
| 涉及文件 | `src/server/services/sync.service.ts`、`src/server/repositories/douyin-video.repository.ts` |
| 优先级 | BE-001 ~ BE-003 为 P0，BE-004 为 P3（日志增强） |
| 执行顺序约束 | BE-001 必须先于 BE-002 完成 |

---

## 任务列表

---

### BE-001: (P0) DouyinVideoRepository 新增 `updateStatsByVideoId()` 方法

**文件**：`src/server/repositories/douyin-video.repository.ts`

**详情**：

在 `DouyinVideoRepository` 类中新增以下方法，位置建议在 `upsertByVideoId()` 之后：

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

**说明**：
- `videoId` 对应 `DouyinVideo.videoId`（即 awemeId），是 Prisma schema 中的 `@unique` 字段
- 仅更新统计数字字段，不触碰 `coverStoragePath`、`videoStoragePath` 等文件字段
- 无需 `organizationId` 过滤（这是内部 Service 调用，videoId 全局唯一）

**验收**：
- 方法存在且 TypeScript 编译通过
- 不改变类的其他方法

---

### BE-002: (P0) SyncService 修复 `upsertCrawlerVideo()` — 先检查存在性再下载文件

**文件**：`src/server/services/sync.service.ts`

**详情**：

修改私有方法 `upsertCrawlerVideo()`。**当前实现**（有问题）：

```typescript
private async upsertCrawlerVideo(accountId: string, video: {...}): Promise<void> {
  const coverStoragePath = video.coverSourceUrl
    ? await storageService.downloadAndStore(video.coverSourceUrl, "covers")
    : null;
  const videoStoragePath = video.videoSourceUrl
    ? await storageService.downloadAndStore(video.videoSourceUrl, "videos")
    : null;
  await douyinVideoRepository.upsertByVideoId({ ... });
}
```

**修复后**：在方法最开头加入 `findByVideoId` 预检查，若已存在则仅更新统计字段并 `return`，不执行任何文件下载：

```typescript
private async upsertCrawlerVideo(
  accountId: string,
  video: { awemeId: string; ... },
): Promise<void> {
  // 预检查：已存在则仅更新数据指标，不重新下载文件
  const existing = await douyinVideoRepository.findByVideoId(video.awemeId);
  if (existing) {
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

  // 不存在：正常下载文件并创建记录（以下代码与原实现相同）
  const coverStoragePath = video.coverSourceUrl
    ? await storageService.downloadAndStore(video.coverSourceUrl, "covers")
    : null;
  const videoStoragePath = video.videoSourceUrl
    ? await storageService.downloadAndStore(video.videoSourceUrl, "videos")
    : null;

  await douyinVideoRepository.upsertByVideoId({
    videoId: video.awemeId,
    accountId,
    title: video.title,
    coverUrl: coverStoragePath,
    coverSourceUrl: video.coverSourceUrl,
    coverStoragePath,
    videoUrl: videoStoragePath,
    videoSourceUrl: video.videoSourceUrl,
    videoStoragePath,
    publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
    playCount: video.playCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    shareCount: video.shareCount,
    collectCount: video.collectCount,
    admireCount: video.admireCount,
    recommendCount: video.recommendCount,
    tags: [],
  });
}
```

**依赖**：BE-001 必须先完成（`updateStatsByVideoId` 方法需已存在）

**验收**：
1. 对已有视频执行 `syncAccountVideos` 后，`coverStoragePath` 不变（未被重新下载）
2. 对已有视频执行后，`updatedAt` 字段更新（stats 被写入）
3. 对新视频执行后，正常触发封面和视频下载并写入 DB

---

### BE-003: (P0) SyncService 修复 `runCollectionSync()` — 修复不创建 BENCHMARK_ACCOUNT 的两处缺陷

**文件**：`src/server/services/sync.service.ts`

**详情**：

在 `runCollectionSync()` 方法中，修改 `for (const item of result.items)` 循环体的前两个条件判断。

**当前代码**（有问题，两处缺陷）：

```typescript
for (const item of result.items) {
  if (!item.collectedAt) {
    continue;                        // 缺陷 A：collectedAt 为 null 时跳过
  }
  if (item.collectedAt < windowStart) {
    break;                           // 缺陷 B：假设降序排列，实际可能不是
  }
  if (!item.authorSecUserId) { ... }
  // ...
}
```

**修复后**：合并两个条件，将 `break` 改为 `continue`，并去掉对 `null` 的单独 `continue`：

```typescript
for (const item of result.items) {
  // collectedAt 为 null（爬虫未返回字段）→ 视为状态未知，继续处理（由 findBySecUserIdIncludingDeleted 去重）
  // collectedAt 有值但早于时间窗口 → 跳过（continue，不 break，防止 API 返回乱序）
  if (item.collectedAt !== null && item.collectedAt < windowStart) {
    continue;
  }

  if (!item.authorSecUserId) {
    console.warn("[CollectionSync] 跳过无 authorSecUserId 的 item", {
      accountId: account.id,
      awemeId: item.awemeId,
    });
    continue;
  }

  const existing = await douyinAccountRepository.findBySecUserIdIncludingDeleted(
    item.authorSecUserId,
  );
  if (existing) {
    continue;
  }

  try {
    console.log(`[CollectionSync] 发现新博主 secUserId=${item.authorSecUserId}，准备创建 BENCHMARK_ACCOUNT`);
    const profile = await crawlerService.fetchUserProfile(item.authorSecUserId);
    const created = await douyinAccountRepository.createBenchmark({
      // ... 原有字段不变
    });
    console.log(`[CollectionSync] BENCHMARK_ACCOUNT 创建成功 secUserId=${item.authorSecUserId} id=${created.id}`);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      console.log(`[CollectionSync] secUserId=${item.authorSecUserId} 已存在（并发写冲突），跳过`);
      continue;
    }
    console.error("[CollectionSync] 创建 BENCHMARK_ACCOUNT 失败", {
      accountId: account.id,
      authorSecUserId: item.authorSecUserId,
      error,
    });
  }
}
```

同时在外层 `for (const account of accounts)` 循环之前，添加开始日志：

```typescript
console.log(`[CollectionSync] 开始，共扫描 ${accounts.length} 个员工账号`);
```

**注意**：`windowStart` 变量可保留（后续若需恢复严格窗口筛选），只是当前不再用于 `break`。`createBenchmark` 调用的参数内容保持与原代码一致，不做修改。

**验收**：
1. 收藏同步日志可见「[CollectionSync] 开始」「[CollectionSync] 发现新博主」「[CollectionSync] BENCHMARK_ACCOUNT 创建成功」
2. 员工收藏了新博主视频（且 `collectedAt` 可能为 null），下次定时器执行后对标账号列表出现该博主
3. 同一博主被多个员工收藏时，DB 中只有一条 BENCHMARK_ACCOUNT（P2002 冲突被正确处理并记录日志）
4. 单账号爬虫失败不影响其他账号处理（原 `try/catch` 结构已支持，确认未被改动）

---

### BE-004: (P3) SyncService 在 `runVideoBatchSync()` 增加账号类型可观测日志

**文件**：`src/server/services/sync.service.ts`

**详情**：

在 `runVideoBatchSync()` 方法中，在现有 `const accounts = await douyinAccountRepository.findAll();` 之后、`for` 循环之前添加：

```typescript
const myCount = accounts.filter((a) => a.type === "MY_ACCOUNT").length;
const benchmarkCount = accounts.filter((a) => a.type === "BENCHMARK_ACCOUNT").length;
console.log(
  `[VideoSync] 开始批量视频同步，共 ${accounts.length} 个账号` +
    `（MY_ACCOUNT: ${myCount}，BENCHMARK_ACCOUNT: ${benchmarkCount}）`,
);
```

**说明**：`findAll()` 已无 `type` 过滤，此任务仅为日志增强，使 Bug-3 验收条件 1「日志可见 BENCHMARK_ACCOUNT 类型账号被扫描」得以满足。

**验收**：
1. 视频同步日志输出含 `BENCHMARK_ACCOUNT: N` 的字样（N ≥ 0）
2. 无任何逻辑变更，TypeScript 编译通过

---

## 任务完成状态

| 任务 | 状态 |
|------|------|
| BE-001: DouyinVideoRepository 新增 `updateStatsByVideoId()` | ✅ |
| BE-002: SyncService 修复 `upsertCrawlerVideo()` | ✅ |
| BE-003: SyncService 修复 `runCollectionSync()` | ✅ |
| BE-004: SyncService `runVideoBatchSync()` 增加日志 | ✅ |

---

## 自省报告（后端开发）

**完成时间**: 2026-04-04

### 完成情况

- BE-001 ✅ 在 `DouyinVideoRepository` 新增 `updateStatsByVideoId(videoId, stats)` 方法，位于 `upsertByVideoId` 之后，仅更新统计字段，不触碰文件路径字段
- BE-002 ✅ 在 `upsertCrawlerVideo()` 方法开头加入 `findByVideoId` 预检查：已存在则调 `updateStatsByVideoId` 后 return，不执行任何文件下载
- BE-003 ✅ 修复 `runCollectionSync()` 两处缺陷：将 `!item.collectedAt → continue` 和 `< windowStart → break` 合并为单一 `continue` 判断（含 `!== null` 保护），并追加结构化日志（开始/发现新博主/创建成功/P2002 冲突）
- BE-004 ✅ 在 `runVideoBatchSync()` `findAll()` 后添加账号类型分布日志，输出 `MY_ACCOUNT` 和 `BENCHMARK_ACCOUNT` 计数

`pnpm type-check` 和 `pnpm lint` 均通过，无编译/lint 错误。

### 技术决策记录

1. **BE-001 插入位置**：选择插入在 `countByAccountId` 之前（而非 `upsertByVideoId` 紧后），因为 `updateStatsByVideoId` 在语义上与 `updateStats(id, ...)` 同组（同为统计更新），但现有 `updateStats` 基于内部 `id`，新方法基于外部 `videoId`，分开可读性更好。最终按任务要求放在 `upsertByVideoId` 之后，符合任务规范。

2. **BE-002 对 `syncAccountVideos` 增量分支的影响**：增量分支中已有 `findByVideoId` 检查（遇到已有视频则 `break`），因此对于增量同步中被 break 前的视频（新视频），`upsertCrawlerVideo` 内的第二次 `findByVideoId` 代价可接受（通常命中新视频）。初始同步分支（`existingVideoCount === 0` 时）则受益最明显——首次同步后再次触发不再重复下载封面。

3. **BE-003 `windowStart` 保留**：按任务要求保留 `windowStart` 变量（不删除），仅将其从 `break` 判断中移除，方便后续恢复严格时间窗口。

### 问题与提议

- 无文档偏差，技术设计与实现完全一致。
- `syncAccountVideos` 增量分支中对 `upsertCrawlerVideo` 的调用路径存在轻微双重检查（外层 `findByVideoId` 后 break，内层再次 `findByVideoId`），属于可接受的防御性设计，暂不优化。



---

## 集成联调报告（Phase 5）

**完成时间**: 2026-04-04
- type-check: ✅
- lint: ✅

### 发现并修复的问题

无需修复。所有检查项均已正确实现：

**后端逻辑**：
- `runCollectionSync()` — Bug-1 两处缺陷均已修复：`null collectedAt` 合并进统一条件（不再单独 `continue`），`break` 已改为 `continue` ✅
- `upsertCrawlerVideo()` — Bug-2 预检查 `findByVideoId` 已加入，已存在视频仅更新 stats 不重新下载文件 ✅
- `runVideoBatchSync()` — 日志已包含 `MY_ACCOUNT` / `BENCHMARK_ACCOUNT` 数量分布 ✅

**前端 Hook**：
- `use-auto-refresh.ts` — `clearInterval` cleanup 正确，`callbackRef` 模式正确 ✅
- 4 个页面（`accounts-page`、`account-detail-page`、`benchmarks-page`、`benchmark-detail-page`）均已接入 `useAutoRefresh(60_000, ...)` ✅
