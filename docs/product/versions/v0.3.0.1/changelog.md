# Changelog — v0.3.0.1

> 发布日期: 2026-04-04
> 状态: Released

## 摘要

Bug修复（3项）+ 前端功能增强（1项）。

## Bug 修复

### Bug-1: 收藏同步未触发对标博主新增

**根因**：`runCollectionSync()` 中两处缺陷：
1. `collectedAt` 为 null 时直接 `continue` 跳过，导致爬虫未返回收藏时间时整批丢弃
2. 时间窗口过滤使用 `break` 而非 `continue`，乱序响应时提前退出整个循环

**修复**：合并为 `if (item.collectedAt !== null && item.collectedAt < windowStart) { continue; }`；增加「发现新博主」「创建成功」「P2002冲突」结构化日志。

### Bug-2: 视频同步封面重复下载

**根因**：`upsertCrawlerVideo()` 在入库检查前即下载文件，已有视频会重复下载封面/视频文件。

**修复**：方法开头加 `findByVideoId` 预检查，已存在则调用新增的 `updateStatsByVideoId()` 仅更新播放/点赞/评论数，完全跳过文件下载流程。

### Bug-3: 对标账号未纳入视频同步

**结论**：经代码审查，`runVideoBatchSync()` 的账号查询无 type 过滤，已覆盖 `BENCHMARK_ACCOUNT`，无需修改逻辑。补充了账号类型分布日志增强可观测性。

## 功能增强

### Feature-1: 页面自动刷新 + Loading 标志

- 新建 `src/lib/hooks/use-auto-refresh.ts`（60s interval，callbackRef 模式，卸载自动清理）
- 以下 4 个页面接入自动刷新：账号列表、账号详情、对标账号列表、对标账号详情
- 页面标题右侧展示 `RefreshCw` 图标（触发时 `animate-spin`，Tooltip 提示「每60秒自动刷新」）
- 刷新只更新数据，不影响正在打开的 Drawer/Dialog UI 状态

## 验证

- `pnpm type-check` ✅
- `pnpm lint` ✅
