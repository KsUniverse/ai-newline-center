# 代码评审报告 — v0.3.0.1

> 评审日期: 2026-04-04  
> 评审人: Reviewer Agent  
> 评审范围: Bug-1 / Bug-2 / Bug-3 / Feature-1 所有变更文件

---

## 摘要

| 项目 | 值 |
|------|----|
| 审查文件数 | 7 |
| 问题总数 | 3 (Critical: 0 / High: 0 / Medium: 1 / Low: 2) |
| 编译状态 | `pnpm type-check` ✅ / `pnpm lint` ✅ |
| 结论 | **通过 ✅**（Medium 问题建议下轮修复，不阻塞发布） |

---

## 审查文件清单

| 文件 | 对应任务 | 结论 |
|------|----------|------|
| `src/server/repositories/douyin-video.repository.ts` | BE-001 | ✅ |
| `src/server/services/sync.service.ts` | BE-002 / BE-003 / BE-004 | ✅ 含 L-001 |
| `src/lib/hooks/use-auto-refresh.ts` | FE-001 | ✅ 含 M-001 |
| `src/components/features/accounts/accounts-page.tsx` | FE-002 | ✅ |
| `src/components/features/accounts/account-detail-page.tsx` | FE-003 | ✅ |
| `src/components/features/benchmarks/benchmarks-page.tsx` | FE-004 | ✅ |
| `src/components/features/benchmarks/benchmark-detail-page.tsx` | FE-005 | ✅ |

---

## 问题列表

### [M-001] Medium: `useAutoRefresh` 中 `refresh` 的返回值是死代码，`setTimeout` 不会在组件卸载时清理

- **文件**: [src/lib/hooks/use-auto-refresh.ts](src/lib/hooks/use-auto-refresh.ts#L21-L24)
- **描述**:

  `refresh` 函数末尾返回了 `() => clearTimeout(timer)`，但该函数是通过 `setInterval(refresh, intervalMs)` 被调用，`setInterval` 会忽略回调的返回值。因此这行返回语句是**死代码**，`timer` 从未被实际清理。

  当组件卸载时：
  1. `useEffect` cleanup 正确调用 `clearInterval(id)` — 停止后续的 60s 计时 ✓
  2. 若组件卸载发生在最后一次 `refresh` 调用后的 800ms 内，`setTimeout` 仍会执行 `setIsRefreshing(false)` — React 18 下无 crash（状态更新静默丢弃），但违反了需求的"不留后台任务"表述，且是误导开发者的死代码

  ```typescript
  // 现有代码（有问题）
  const refresh = useCallback(() => {
    setIsRefreshing(true);
    callbackRef.current();
    const timer = setTimeout(() => setIsRefreshing(false), 800);
    return () => clearTimeout(timer);  // ← setInterval 调用时返回值被丢弃，此行永远不会清理 timer
  }, []);
  ```

- **修复建议**: 用 `ref` 持有 timer，在 `setInterval` 的同一 `useEffect` cleanup 中同时清理：

  ```typescript
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    callbackRef.current();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsRefreshing(false), 800);
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, intervalMs);
    return () => {
      clearInterval(id);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [intervalMs, refresh]);
  ```

> 注：此问题同样存在于 `tasks-frontend.md` 的规范代码示例中，上述修复建议需同步更新设计文档。

---

### [L-001] Low: 增量同步"停止边界"处的已有视频不触发统计更新

- **文件**: [src/server/services/sync.service.ts](src/server/services/sync.service.ts#L260-L270)（`syncAccountVideos` 增量路径）
- **描述**:

  增量路径在 `syncAccountVideos` 中对每个视频先做 `findByVideoId` 预检查：发现已有视频时执行 `foundExisting = true; break`，直接停止循环，**不调用** `upsertCrawlerVideo`，也不执行 `updateStatsByVideoId`。

  需求 Bug-2 期望行为第 3 点明确要求：「已存在 → 更新已有记录的数据指标（播放数、点赞数等），不重新下载封面」。该边界视频的指标在本轮同步中不会被更新。

  实际影响有限：`runVideoSnapshotCollection()` 定期对所有活跃视频做快照并更新指标，可以兜底补偿。

- **修复建议（可选）**:

  若希望与需求措辞严格一致，可在 `break` 前增加一次 `updateStatsByVideoId`：

  ```typescript
  if (existing) {
    // 已有视频：仅更新统计字段，不重新下载
    await douyinVideoRepository.updateStatsByVideoId(video.awemeId, {
      playCount: video.playCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      shareCount: video.shareCount,
      collectCount: video.collectCount,
      admireCount: video.admireCount,
      recommendCount: video.recommendCount,
    });
    foundExisting = true;
    break;
  }
  ```

  若不修改，`runVideoSnapshotCollection()` 兜底已足够，可接受。

---

### [L-002] Low: 增量路径中 `findByVideoId` 被调用两次（冗余 DB 查询）

- **文件**: [src/server/services/sync.service.ts](src/server/services/sync.service.ts)（`syncAccountVideos` + `upsertCrawlerVideo`）
- **描述**:

  增量路径流程：
  1. `syncAccountVideos` 对每个视频调用 `findByVideoId`（null → 调用 `upsertCrawlerVideo`）
  2. `upsertCrawlerVideo` 内部再次调用 `findByVideoId`（必然 null，因为 step 1 已验证）

  对于增量批次中的每个**新视频**，产生两次 `findByVideoId` DB 查询。无功能影响，批次量小（每批最多 4 条），性能可接受。

- **修复建议（可选）**: 可将 `upsertCrawlerVideo` 的 `existing` 参数化（传入预检查结果），或将双重检查视为防御性编码保留原样。

---

## 验收逐项确认

### Bug-1 修复（`runCollectionSync`）

| 验收点 | 状态 | 说明 |
|--------|------|------|
| `collectedAt` 为 null 时不跳过 item | ✅ | `if (item.collectedAt !== null && item.collectedAt < windowStart)` — null 时进入处理逻辑 |
| `break` 改为 `continue`，防止乱序 API 提前退出 | ✅ | 时间窗口过滤使用 `continue` |
| `!item.authorSecUserId` guard | ✅ | 有日志和 continue |
| `findBySecUserIdIncludingDeleted` 去重 | ✅ | 已有则 continue |
| P2002 并发冲突捕获 | ✅ | `instanceof Prisma.PrismaClientKnownRequestError && code === "P2002"` |
| 结构化关键日志 | ✅ | 开始/发现新博主/创建成功/冲突跳过 4 条日志均已实现 |
| 单账号爬虫失败不中断整体 | ✅ | 外层 `try/catch` 逐账号隔离 |

### Bug-2 修复（`upsertCrawlerVideo` + `updateStatsByVideoId`）

| 验收点 | 状态 | 说明 |
|--------|------|------|
| `upsertCrawlerVideo` 先检查 `findByVideoId` | ✅ | 预检查在下载逻辑之前 |
| 已有视频 → 仅调用 `updateStatsByVideoId`，不下载 | ✅ | early return 在 download 代码之前 |
| `updateStatsByVideoId` 不更新 `coverStoragePath` | ✅ | 方法仅含 7 个统计字段 |
| `videoId` 是 `@unique` 字段，`update where` 合法 | ✅ | `prisma/schema.prisma:108` 确认 |
| 新视频仍正常下载封面 | ✅ | existing=null 分支逻辑不变 |

### Bug-3 确认（视频同步扫描范围）

| 验收点 | 状态 | 说明 |
|--------|------|------|
| `runVideoBatchSync` 无 type 过滤 | ✅ | `douyinAccountRepository.findAll()` 不含 type 条件 |
| 扫描日志输出 MY_ACCOUNT / BENCHMARK_ACCOUNT 计数 | ✅ | 已实现日志 `[VideoSync] 开始批量视频同步，共 N 个账号（MY_ACCOUNT: M，BENCHMARK_ACCOUNT: K）` |

### Feature-1 自动刷新（4 个页面）

| 验收点 | 状态 | 说明 |
|--------|------|------|
| Hook 接入 60s 间隔 | ✅ 全部 4 个页面 | `useAutoRefresh(60_000, ...)` |
| `refreshKey` 变化触发数据重新加载 | ✅ 全部 4 个页面 | 加入对应 `useEffect` 依赖 |
| `clearInterval` 在 unmount 时调用 | ✅ | `useEffect` cleanup |
| 旋转图标：`isRefreshing` 时 `animate-spin` | ✅ 全部 4 个页面 | `cn("h-3.5 w-3.5 text-muted-foreground/50", isRefreshing && "animate-spin")` |
| 图标尺寸低调 (`h-3.5 w-3.5`) | ✅ | |
| Tooltip 说明"每 60 秒自动刷新" | ✅ | |
| 刷新不重置 Drawer/Dialog 状态 | ✅ | `refreshKey` 仅影响 data loading state；`drawerOpen`/`archiveDialogOpen`/`selectedVideo`/`videoDialogOpen` 均未与 `refreshKey` 耦合 |
| 使用 apiClient，无直接 fetch | ✅ | |
| 使用 Tailwind utility class，无硬编码色值 | ✅ | |
| `TooltipProvider` + `Tooltip` 包裹图标 | ✅ | shadcn/ui 组件 |

---

## 自省

### 评审发现的额外观察

- **`upsertCrawlerVideo` 的 `updateStatsByVideoId` 分支实际上只在"初始同步的竞态边缘"场景下触达**，增量路径因 `syncAccountVideos` 的预检查保护而不会到达此分支。这是设计规范（`technical-design.md`）与实际调用路径之间的一处"纸面上合理、运行时罕见"的差异，非实现错误，但值得在设计注释中说明，避免未来开发者误解 `upsertCrawlerVideo` 的调用语义。

### 文档建议

1. **`tasks-frontend.md` FE-001 示例代码** 含 `return () => clearTimeout(timer)` 死代码，建议在下一文档版本中将设计修正为 `timerRef` 持有方案（同 M-001 修复建议）。
2. **`technical-design.md` Bug-2 方案** 描述"已存在→仅更新统计"路径时，可补充一句说明该路径在增量同步流程中仅作为竞态兜底，主 stats 更新由 `runVideoSnapshotCollection` 负责，避免歧义。

以上文档修改建议提交架构师/编排者确认后执行。
