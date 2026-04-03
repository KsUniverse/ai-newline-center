# 测试报告 — v0.2.1.1

> 测试日期: 2026-04-03  
> 测试人员: Tester Agent  

---

## 测试统计

| 项目 | 结果 |
|------|------|
| 自动化测试 | 64/64 通过 ✅ |
| Build | 通过 ✅ |
| Lint | 0 错误, 1 warning ✅ |
| Type-check | 通过 ✅ |
| 功能验收 (后端 1-14) | 14/14 通过 ✅ |
| 功能验收 (前端 15-23) | 22/23 通过 (1 注意项) |
| UI 一致性 | 9/10 通过 |
| **结论** | **通过 ✅** |

---

## 验收标准逐项结果

### 爬虫对接

#### 1. CrawlerService 调用真实爬虫 API — ✅ 通过

- `CrawlerService` 包含 5 个完整接口封装：`getSecUserId`、`fetchUserProfile`、`fetchVideoList`、`fetchCollectionVideos`、`fetchOneVideo`
- 所有接口通过 `callCrawlerApi` 统一调用 `env.CRAWLER_API_URL` 的真实 HTTP 端点，非 mock
- 请求使用 `AbortSignal.timeout(30_000)` 超时控制
- 字段映射采用灵活的 `pickString`/`pickNumber`/`pickArray` 多候选字段策略

#### 2. 所有爬虫接口响应有完整 JSON 日志输出 — ✅ 通过

- `callCrawlerApi` 方法第 171 行：`console.info([CrawlerService] ${path} response:, JSON.stringify(rawJson))`
- 测试用例输出已验证日志格式正确（如 `[CrawlerService] /api/douyin/web/get_sec_user_id response: {"code":200,"data":{...}}`）
- 封面/视频 URL 有额外日志标记（见验收标准 14）

#### 3. 爬虫服务不可用时错误处理行为一致 — ✅ 通过

- `callCrawlerApi` 实现了最多 2 次重试（`maxRetries = 2`），退避间隔递增
- 重试耗尽后抛出 `AppError("CRAWLER_ERROR", "爬虫服务调用失败，请稍后重试", 502)`
- 未配置 `CRAWLER_API_URL` 时直接抛错
- 批量同步（`runAccountInfoBatchSync`/`runVideoBatchSync`）对单条失败 catch 后 continue，不中断整批
- VideoSnapshot 采集同样单条失败跳过

### secUserId

#### 4. 添加账号两步流程 — ✅ 通过

- `douyinAccountService.previewAccount()` 实现两步流程：
  1. `crawlerService.getSecUserId(profileUrl)` — URL → secUserId
  2. `crawlerService.fetchUserProfile(secUserId)` — secUserId → 账号信息
- `AccountPreview` 类型包含 `secUserId` 字段
- `CreateDouyinAccountData` 包含 `secUserId` 字段，创建时持久化到 DB

#### 5. 同步均使用 secUserId 作为入参 — ✅ 通过

- `syncAccountInfo()` 调用 `ensureSecUserId(account)` 获取 secUserId，然后 `crawlerService.fetchUserProfile(secUserId)`
- `syncAccountVideos()` 同理先 `ensureSecUserId(account)` 再 `crawlerService.fetchVideoList(secUserId, ...)`
- 不再依赖 `profileUrl` 进行 API 调用

#### 6. 已有账号首次同步自动补充 secUserId — ✅ 通过

- `ensureSecUserId()` 方法：若 `account.secUserId` 为空，自动调用 `crawlerService.getSecUserId(account.profileUrl)` 并通过 `douyinAccountRepository.updateSecUserId()` 持久化

### 视频同步策略

#### 7. 首次同步取前 10 条 — ✅ 通过

- `INITIAL_SYNC_LIMIT = 10`
- 当 `existingVideoCount === 0` 时，调用 `fetchVideoList(secUserId, 0, INITIAL_SYNC_LIMIT)`，结果 slice 前 10 条

#### 8. 增量同步 4 条/批，遇已存在自动停止 — ✅ 通过

- `INCREMENTAL_BATCH_SIZE = 4`
- 增量循环中对每条视频调用 `douyinVideoRepository.findByVideoId(video.awemeId)` 检查是否已存在
- 发现已存在则 `foundExisting = true; break`，跳出当前批、终止翻页

#### 9. 增量同步有安全翻页上限 — ✅ 通过

- `MAX_INCREMENTAL_BATCHES = 10`，最多翻 10 页（即最多 40 条新视频）
- 循环条件 `batchIndex < MAX_INCREMENTAL_BATCHES`

### VideoSnapshot

#### 10. 定时器每 10 分钟运行 — ✅ 通过

- `scheduler.ts` 中 `VIDEO_SNAPSHOT_CRON` 默认值 `*/10 * * * *`
- 对应调用 `syncService.runVideoSnapshotCollection()`
- 环境变量 `VIDEO_SNAPSHOT_CRON` 在 `env.ts` schema 中已定义

#### 11. 每次采集写入新 VideoSnapshot 记录 — ✅ 通过

- `runVideoSnapshotCollection()` 遍历活跃视频，调用 `videoSnapshotRepository.create()` 写入新记录
- `VideoSnapshot` 模型有 `@default(now())` 的 `timestamp` 字段，每条都是新增

#### 12. DouyinVideo 数据指标同步更新 — ✅ 通过

- 采集后调用 `douyinVideoRepository.updateStats(video.id, {...})` 更新 `playCount`、`likeCount`、`commentCount`、`shareCount`
- 保持与 v0.2.1 行为兼容

### 文件存储

#### 13. StorageService 骨架已创建 — ✅ 通过

- `src/server/services/storage.service.ts` 存在
- `downloadAndStore(url, category)` 接口完整，返回 `Promise<string>`
- 路径格式 `storage/{category}/{date}/{filename}` 通过 `generatePath()` 生成
- 当前仅日志输出不实际下载，符合需求
- 有 `extractFilename` URL 解析容错

#### 14. 封面/视频 URL 有「待下载」日志标记 — ✅ 通过

- `CrawlerService.mapVideoItem()` 中：
  - `console.info([CrawlerService] 待下载封面: ${coverUrl})`
  - `console.info([CrawlerService] 待下载视频: ${videoUrl})`

### 账号首页改版

#### 15. 顶部账号卡片行 + 下方视频网格 — ✅ 通过

- 三段式布局：Header → AccountRow → VideoFilterBar → VideoGrid
- 使用 `animate-in-up` / `animate-in-up-d1` / `d2` / `d3` 交错入场
- AccountRow 横向排列卡片，支持添加按钮
- AccountRowCard 可点击跳转到详情页 `router.push(/accounts/${account.id})`

#### 16. 视频网格默认按发布时间倒序 — ✅ 通过

- `sort` 初始值 `"publishedAt"`，请求参数 `order: "desc"`
- API 端点 `GET /api/videos` 默认 `sort=publishedAt, order=desc`

#### 17. 可按账号筛选 — ✅ 通过

- VideoFilterBar 提供账号筛选 Select 组件
- 选中后设置 `filterAccountId`，传入 API 参数 `accountId`
- 后端 `videoService.listVideos()` 按 `accountId` 过滤

#### 18. 可按标签筛选（空时隐藏） — ✅ 通过

- 标签筛选基于 `availableTags`（从当前视频去重生成）
- `availableTags.length > 0` 时才渲染标签 Select
- 后端 `douyinVideoRepository.findManyWithAccount` 使用 `tags: { has: tag }` 过滤

#### 19. 排序切换：最新发布 / 最多点赞 — ✅ 通过

- Select 组件提供 `publishedAt`（最新发布）和 `likeCount`（最多点赞）两选项
- 排序切换后自动重置到第一页

#### 20. 视频卡片 3:4 比例 — ✅ 通过

- `VideoGridCard` 使用 `aspect-[3/4]`
- 封面 `object-cover` 铺满
- 底部渐变遮罩 `bg-gradient-to-t from-black/80 via-black/40 to-transparent`
- 显示：标题（truncate 单行截断）、♡ Heart 图标 + 点赞数、发布时间

#### 21. hover 自动播放 + 离开暂停 — ✅ 通过

- `onMouseEnter` → `onHoverStart` → `setPlayingVideoId(video.id)`
- `onMouseLeave` → `onHoverEnd` → `setPlayingVideoId(null)`
- `isPlaying` 时 `el.play()`，否则 `el.pause(); el.currentTime = 0`
- 封面/视频通过 `opacity` + `transition-opacity duration-300` 切换
- 无 `videoUrl` 时不渲染 `<video>` 元素，hover 无播放效果
- **同一时间最多一个视频播放**：`VideoGrid` 通过 `playingVideoId` 单一状态控制

#### 22. 发布时间格式 yyyy-MM-dd HH:mm — ✅ 通过

- `formatDateTime()` 返回格式 `${year}-${month}-${day} ${hours}:${minutes}`
- 年月日时分均有 `padStart(2, "0")` 补零

#### 23. 点击视频卡片可查看详情 — ✅ 通过

- `onClick={() => onVideoClick(video)}` → `setSelectedVideo(video)`
- `VideoDetailDialog` 弹出 Dialog，显示封面、标题、播放/点赞/评论/转发数据、原视频链接

---

## UI 一致性

| 检查项 | 结果 | 备注 |
|--------|------|------|
| 页面容器规范 | ✅ | `flex flex-1 flex-col gap-6 px-8 py-6 max-w-6xl mx-auto w-full` |
| 标题区规范 | ✅ | `text-xl font-semibold tracking-tight leading-none text-foreground/90` + `text-sm text-muted-foreground/80` |
| 间距系统 | ✅ | `gap-6`（区域间距）、`gap-4`（视频网格）、`gap-3`（账号行/筛选项） |
| 暗色主题色彩变量 | ✅ | 使用 `foreground/90`、`muted-foreground/80`、`border/60`、`bg-card`、`bg-muted` |
| 入场动画 | ✅ | `animate-in-up`、`animate-in-up-d1`~`d3` 交错渐显 |
| 骨架屏 loading | ✅ | 账号行 4 个 `animate-pulse` 骨架、视频网格 8 个 `aspect-[3/4] animate-pulse` 骨架 |
| 空状态设计 | ✅ | 账号空状态 `AccountEmptyState`、视频空状态（Film 图标 + 提示文字） |
| 响应式布局 | ✅ | `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`（2→3→4列） |
| "use client" 指令 | ✅ | 所有交互组件均有 `"use client"` |
| 过渡动画 | ⚠️ | 视频卡片有 `transition-opacity duration-300`；账号行卡片有 `transition-colors`；但 `VideoGridCard` 的 `<button>` 本身缺少 `transition-colors` |

---

## 问题列表

### [T-001] lint warning: useEffect 缺少依赖

- **严重度**: Low
- **位置**: [video-grid-card.tsx](src/components/features/accounts/video-grid-card.tsx#L38)
- **描述**: `useEffect` 依赖数组缺少 `onHoverEnd`，ESLint react-hooks/exhaustive-deps 报 warning
- **预期**: 依赖数组完整或用 useCallback 包装
- **实际**: 依赖数组仅含 `[isPlaying]`，缺少 `onHoverEnd`
- **影响**: 功能不受影响（`onHoverEnd` 由父组件 useCallback 稳定引用），但 lint 有 warning

### [T-002] 标签筛选从当前页面数据提取（非全量）

- **严重度**: Low（设计限制）
- **位置**: [page.tsx](src/app/(dashboard)/accounts/page.tsx#L63)
- **描述**: `availableTags` 从当前已加载的 `videos`（当前页 20 条）去重生成，而非从后端获取全量标签列表
- **预期**: 由于本版本 tags 字段预留为空数组，实际不影响功能
- **影响**: 当 tags 有值且分页数据不全时，某些标签可能不出现在筛选器中。考虑后续版本从后端单独接口获取全量标签

---

## 自省

### 1. 回顾

- requirements.md 验收标准 1-23 条覆盖了所有功能点，足够具体
- ui-ux-system.md 的动效规范、间距规范、色彩变量覆盖全面，检查过程中可直接对照

### 2. 检查

- `useEffect` 依赖完整性可补充到 review-checklist.md 前端部分
- 标签筛选的数据源（前端本地 vs 后端全量）在后续有 tags 功能时值得关注

### 3. 提议

无需修改文档。以上两项为 Low 级别观察项，不阻塞交付。

---

## 结论: ✅ 通过

所有 23 项验收标准全部满足，自动化测试 64/64 通过，构建/Lint/类型检查均通过。发现 2 个 Low 级别观察项不影响功能，可在后续迭代优化。
