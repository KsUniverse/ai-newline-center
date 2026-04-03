# v0.2.1.1 技术设计方案

> 版本: v0.2.1.1  
> 设计日期: 2026-04-03  
> 需求文档: [requirements.md](./requirements.md)

---

## 摘要

- **涉及模块**: CrawlerService, SyncService, Scheduler, DouyinAccount, DouyinVideo, StorageService(骨架), 前端账号首页
- **新增模型**: `VideoSnapshot`
- **修改模型**: `DouyinAccount`(+secUserId), `DouyinVideo`(+tags)
- **新增 API**: `GET /api/videos`（跨账号视频列表）
- **新增页面/组件**: 账号首页改版（AccountHomePage）、VideoGridCard、VideoFilterBar、AccountRowCard
- **架构变更**: 无（所有变更遵循现有三层架构 + CrawlerService 封装 + node-cron 定时器模式）

---

## 1. 数据模型变更

### 1.1 DouyinAccount 新增 `secUserId`

```prisma
model DouyinAccount {
  // ... 现有字段 ...
  secUserId      String?   @unique  // 抖音安全用户ID，由爬虫接口1获取
  // ... 其余不变 ...
}
```

- **类型**: `String?`（可空，兼容历史数据）
- **唯一约束**: `@unique`（全局唯一，作为去重依据）
- **填充时机**: 添加账号时（步骤1 URL→secUserId）；历史账号首次同步时自动补充

### 1.2 DouyinVideo 新增 `tags`

```prisma
model DouyinVideo {
  // ... 现有字段 ...
  tags         String[]  @default([])  // 视频标签数组，本版本默认空
  // ... 其余不变 ...
}
```

- **类型**: `String[]`，PostgreSQL 原生数组
- **默认值**: `[]`（空数组）
- **本版本**: 字段预留，标签写入机制后续迭代

### 1.3 新增 VideoSnapshot 模型

```prisma
model VideoSnapshot {
  id            String      @id @default(cuid())
  videoId       String      // 关联 DouyinVideo.id
  video         DouyinVideo @relation(fields: [videoId], references: [id])
  timestamp     DateTime    @default(now())  // 采集时间
  playsCount    Int
  likesCount    Int
  commentsCount Int
  sharesCount   Int
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([videoId])
  @@index([videoId, timestamp])
  @@map("video_snapshots")
}
```

**设计说明**:
- `videoId` 关联 `DouyinVideo.id`（非 `videoId` 字段，使用内部 DB id）
- 双索引：`[videoId]` 用于按视频查快照列表；`[videoId, timestamp]` 用于时间线查询
- 不包含 `organizationId`：通过关联链路 VideoSnapshot → DouyinVideo → DouyinAccount → organizationId 间接隔离
- 不包含 `deletedAt`：快照为追加写入型数据，不需要软删除

**DouyinVideo 补充关系字段**:

```prisma
model DouyinVideo {
  // ... 现有字段 ...
  snapshots    VideoSnapshot[]
}
```

---

## 2. CrawlerService 重写方案

### 2.1 接口封装

重写 `src/server/services/crawler.service.ts`，替换 mock 实现为真实爬虫 API 调用。

**爬虫服务**: `env.CRAWLER_API_URL`（开发默认 `http://localhost:8011`）

| 方法名 | 爬虫路径 | HTTP | 入参 | 返回类型 | 调用时机 |
|--------|---------|------|------|----------|---------|
| `getSecUserId(url)` | `/api/douyin/web/get_sec_user_id` | GET/POST | `url` | `string` (sec_user_id) | 添加账号步骤1 |
| `fetchUserProfile(secUserId)` | `/api/douyin/web/handler_user_profile` | GET/POST | `sec_user_id` | `CrawlerUserProfile` | 添加账号步骤2 + 账号信息同步 |
| `fetchVideoList(secUserId, cursor?)` | 从爬虫文档确认（如 `/api/douyin/web/fetch_user_post_videos`） | GET/POST | `sec_user_id`, `max_cursor?`, `count?` | `CrawlerVideoListResult` | 视频同步 |
| `fetchCollectionVideos(secUserId)` | `/api/douyin/web/fetch_user_collection_videos` | GET/POST | `sec_user_id` | `CrawlerCollectionResult` | v0.2.2 使用，本版本仅封装 |
| `fetchOneVideo(awemeId)` | `/api/douyin/web/fetch_one_video` | GET/POST | `aweme_id` | `CrawlerVideoDetail` | VideoSnapshot 采集 |

### 2.2 接口签名变更

现有 CrawlerService 接口签名:
- `fetchDouyinProfile(profileUrl: string): Promise<AccountPreview>`
- `fetchDouyinVideos(profileUrl: string, page: number): Promise<FetchVideosResult>`

**新增方法**: `getSecUserId`, `fetchCollectionVideos`, `fetchOneVideo`

**修改方法**:
- `fetchDouyinProfile` 签名改为 `fetchUserProfile(secUserId: string): Promise<CrawlerUserProfile>` — 入参由 `profileUrl` 改为 `secUserId`
- `fetchDouyinVideos` 签名改为 `fetchVideoList(secUserId: string, cursor?: number): Promise<CrawlerVideoListResult>` — 入参改为 `secUserId` + 游标分页

**影响面**: SyncService 和 DouyinAccountService 中调用 CrawlerService 的地方需同步更新。

### 2.3 内部类型定义

在 `crawler.service.ts` 内部定义爬虫原始响应类型，Service 内部完成字段映射，对外暴露归一化的业务类型。

```typescript
// 内部类型 — 爬虫原始返回（首次以合理猜测实现，后续根据日志调整）
interface RawCrawlerProfileResponse {
  sec_user_id: string;
  nickname: string;
  avatar_url: string;
  signature: string;
  follower_count: number;
  aweme_count: number;
  // ... 其他爬虫返回的字段（通过日志发现后补充）
}

// 归一化后的业务类型
interface CrawlerUserProfile {
  secUserId: string;
  nickname: string;
  avatar: string;
  bio: string | null;
  followersCount: number;
  videosCount: number;
}

interface CrawlerVideoItem {
  awemeId: string;       // 视频抖音ID → 映射到 DouyinVideo.videoId
  title: string;
  coverUrl: string | null;
  videoUrl: string | null;
  publishedAt: string | null;  // ISO timestamp
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

interface CrawlerVideoListResult {
  videos: CrawlerVideoItem[];
  hasMore: boolean;
  cursor: number;        // 下一页游标
}

interface CrawlerVideoDetail {
  awemeId: string;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}
```

### 2.4 JSON 日志策略

所有爬虫接口在 `callCrawlerApi` 内部，解析响应后立即打印完整原始 JSON:

```typescript
private async callCrawlerApi<T>(path: string, params: Record<string, unknown>): Promise<T> {
  // ... fetch 逻辑 ...
  const rawJson = await response.json();
  console.info(`[CrawlerService] ${path} response:`, JSON.stringify(rawJson));
  // ... 字段映射 + 返回 ...
}
```

**日志级别**: `console.info`（确保生产环境可见）
**日志格式**: `[CrawlerService] <路径> response: <完整JSON>`

### 2.5 错误处理与重试

保持现有模式:
- 最大重试次数: 2（共 3 次尝试）
- 超时: 30s（`AbortSignal.timeout(30_000)`）
- 退避: 线性 `1000 * (attempt + 1) ms`
- 失败抛出: `AppError("CRAWLER_ERROR", message, 502)`

### 2.6 环境变量

`CRAWLER_API_URL` 已存在于 `env.ts`（可选字段）。本版本无需改为必填 — 开发环境爬虫服务不可用时，CrawlerService 调用将直接失败并被上层捕获。

---

## 3. SyncService 变更

### 3.1 secUserId 流程

**账号信息同步** (`syncAccountInfo`):

```
当前: crawlerService.fetchDouyinProfile(account.profileUrl)
变更后:
  1. if (!account.secUserId) → crawlerService.getSecUserId(account.profileUrl) → 保存 secUserId
  2. crawlerService.fetchUserProfile(account.secUserId) → 更新账号信息
```

**手动同步** (`syncAccount`): 同上逻辑。

### 3.2 视频同步策略升级

替换现有固定 `MAX_VIDEO_PAGES = 3` 的翻页策略:

```typescript
private async syncAccountVideos(account: DouyinAccount): Promise<void> {
  const existingVideoCount = await douyinVideoRepository.countByAccountId(account.accountId);
  
  if (existingVideoCount === 0) {
    // 首次同步：取前 10 条
    await this.fetchAndUpsertVideos(account, { maxItems: 10 });
  } else {
    // 增量同步：每批 4 条，遇到已存在 videoId 停止
    await this.incrementalSync(account);
  }
}

private async incrementalSync(account: DouyinAccount): Promise<void> {
  const MAX_PAGES = 10;  // 安全上限，最多 40 条新视频
  const BATCH_SIZE = 4;
  let cursor: number | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await crawlerService.fetchVideoList(account.secUserId!, cursor);
    const batch = result.videos.slice(0, BATCH_SIZE);
    
    let foundExisting = false;
    for (const video of batch) {
      const existing = await douyinVideoRepository.findByVideoId(video.awemeId);
      if (existing) {
        foundExisting = true;
        break;
      }
      await douyinVideoRepository.upsertByVideoId({ ... });
    }
    
    if (foundExisting || !result.hasMore) break;
    cursor = result.cursor;
  }
}
```

**Repository 新增方法**: `douyinVideoRepository.countByAccountId(accountId)` 和 `douyinVideoRepository.findByVideoId(videoId)`

### 3.3 添加账号流程变更

`DouyinAccountService.previewAccount` 和 `createAccount` 方法变更:

```
现有流程:
  1. 用户输入 profileUrl
  2. crawlerService.fetchDouyinProfile(profileUrl) → 预览
  3. 创建 DouyinAccount

新流程:
  1. 用户输入 profileUrl
  2. crawlerService.getSecUserId(profileUrl) → 获取 secUserId
  3. crawlerService.fetchUserProfile(secUserId) → 获取账号资料
  4. 创建 DouyinAccount（含 secUserId）
```

**前端 API 调用不变**: preview 接口仍然接收 `profileUrl`，后端内部完成 URL→secUserId→Profile 的两步转换，对前端透明。

**创建账号 API** POST /api/douyin-accounts:
- 请求体新增可选字段 `secUserId?: string`（后端 preview 接口返回时带上 secUserId，前端创建时回传）
- 或者后端收到 profileUrl 后再次调用 getSecUserId（考虑到 preview 已经获取过，推荐方案 A：preview 返回 secUserId，创建时前端回传）

**推荐方案**: preview 接口返回值新增 `secUserId` 字段:

```typescript
// AccountPreview 类型变更
export interface AccountPreview {
  profileUrl: string;
  secUserId: string;    // 新增
  nickname: string;
  avatar: string;
  bio: string | null;
  followersCount: number;
  videosCount: number;
}
```

创建接口 body 新增 `secUserId` 字段，前端在 preview 成功后将 secUserId 也提交。

---

## 4. VideoSnapshot 定时器方案

### 4.1 定时器注册

在 `src/lib/scheduler.ts` 中新增 VideoSnapshot 采集定时器:

```typescript
const videoSnapshotCron = env.VIDEO_SNAPSHOT_CRON ?? "*/10 * * * *";

cron.schedule(videoSnapshotCron, () => {
  void syncService.runVideoSnapshotCollection();
});
```

### 4.2 环境变量

`src/lib/env.ts` 新增:

```typescript
VIDEO_SNAPSHOT_CRON: z.string().optional(),
```

### 4.3 采集逻辑

在 `SyncService` 中新增:

```typescript
async runVideoSnapshotCollection(): Promise<void> {
  const videos = await douyinVideoRepository.findAllActive();  // 获取所有未删除视频
  
  for (const video of videos) {
    try {
      const detail = await crawlerService.fetchOneVideo(video.videoId);
      
      // 写入快照
      await videoSnapshotRepository.create({
        videoId: video.id,  // 内部 DB id
        playsCount: detail.playCount,
        likesCount: detail.likeCount,
        commentsCount: detail.commentCount,
        sharesCount: detail.shareCount,
      });
      
      // 同步更新 DouyinVideo 数据指标
      await douyinVideoRepository.updateStats(video.id, {
        playCount: detail.playCount,
        likeCount: detail.likeCount,
        commentCount: detail.commentCount,
        shareCount: detail.shareCount,
      });
    } catch (error) {
      console.error("Failed to collect video snapshot:", { videoId: video.id, error });
      // 单条失败不中断整批
    }
  }
}
```

### 4.4 新增 Repository

`src/server/repositories/video-snapshot.repository.ts`:

```typescript
class VideoSnapshotRepository {
  async create(data: {
    videoId: string;
    playsCount: number;
    likesCount: number;
    commentsCount: number;
    sharesCount: number;
  }): Promise<VideoSnapshot>

  async findByVideoId(params: {
    videoId: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<VideoSnapshot[]>  // 后续趋势图使用
}
```

---

## 5. StorageService 骨架设计

### 5.1 文件位置

`src/server/services/storage.service.ts`

### 5.2 接口设计

```typescript
class StorageService {
  /**
   * 下载远程文件并存储到本地
   * @param url 远程文件 URL
   * @param category 分类目录（如 "covers", "videos"）
   * @returns 本地存储路径
   */
  async downloadAndStore(url: string, category: string): Promise<string> {
    // 当前阶段：仅日志，不实际下载
    const storagePath = this.generatePath(category, url);
    console.info(`[StorageService] 待下载: ${url} → ${storagePath}`);
    return storagePath;
  }

  /**
   * 生成存储路径
   * 格式: storage/{category}/{YYYY-MM-DD}/{filename}
   */
  private generatePath(category: string, url: string): string
}
```

### 5.3 调用点

在 CrawlerService 的 `fetchUserProfile` 和 `fetchVideoList` 返回数据映射时，对 `coverUrl` 和 `videoUrl` 打印待下载日志:

```typescript
// CrawlerService 内部映射时
if (video.coverUrl) {
  console.info(`[CrawlerService] 待下载封面: ${video.coverUrl}`);
}
if (video.videoUrl) {
  console.info(`[CrawlerService] 待下载视频: ${video.videoUrl}`);
}
```

暂不实际调用 `storageService.downloadAndStore()`，仅打印日志标记。

---

## 6. 新增 API: GET /api/videos

### 6.1 路由

`src/app/api/videos/route.ts`

### 6.2 请求参数 (Query)

```typescript
const listVideosSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  accountId: z.string().optional(),         // 按账号筛选
  tag: z.string().optional(),               // 按标签筛选
  sort: z.enum(["publishedAt", "likeCount"]).default("publishedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
```

### 6.3 响应类型

```typescript
// 扩展 DouyinVideoDTO
interface DouyinVideoWithAccountDTO extends DouyinVideoDTO {
  tags: string[];
  accountNickname: string;
  accountAvatar: string;
}

// 响应
ApiResponse<PaginatedData<DouyinVideoWithAccountDTO>>
```

### 6.4 Service 层

在 `DouyinAccountService` 中新增（或创建独立的 `VideoService`，考虑到跨账号且视频功能逐渐独立，**推荐新建 `src/server/services/video.service.ts`**）:

```typescript
class VideoService {
  async listVideos(
    caller: SessionUser,
    params: {
      page: number;
      limit: number;
      accountId?: string;
      tag?: string;
      sort: "publishedAt" | "likeCount";
      order: "asc" | "desc";
    }
  ): Promise<PaginatedData<DouyinVideoWithAccount>> {
    // 根据角色确定可见的 accountIds
    const accountFilter = await this.resolveAccountFilter(caller, params.accountId);
    
    return douyinVideoRepository.findManyWithAccount({
      accountIds: accountFilter,
      tag: params.tag,
      sort: params.sort,
      order: params.order,
      page: params.page,
      limit: params.limit,
    });
  }
  
  private async resolveAccountFilter(caller: SessionUser, accountId?: string): Promise<string[] | undefined> {
    if (accountId) {
      // 验证 caller 有权访问该账号
      // 返回 [accountId]
    }
    
    switch (caller.role) {
      case "EMPLOYEE":
        // 获取该用户的所有账号ID
        return (await douyinAccountRepository.findByUserId(caller.id)).map(a => a.id);
      case "BRANCH_MANAGER":
        // 获取该组织所有账号ID
        return (await douyinAccountRepository.findByOrganizationId(caller.organizationId)).map(a => a.id);
      case "SUPER_ADMIN":
        return undefined; // 不过滤
    }
  }
}
```

### 6.5 Repository 层

`douyinVideoRepository` 新增方法:

```typescript
async findManyWithAccount(params: {
  accountIds?: string[];
  tag?: string;
  sort: "publishedAt" | "likeCount";
  order: "asc" | "desc";
  page: number;
  limit: number;
}): Promise<PaginatedData<DouyinVideoWithAccount>> {
  const where: Prisma.DouyinVideoWhereInput = {
    deletedAt: null,
    ...(params.accountIds ? { accountId: { in: params.accountIds } } : {}),
    ...(params.tag ? { tags: { has: params.tag } } : {}),
  };
  
  const orderBy = params.sort === "publishedAt"
    ? [{ publishedAt: params.order }, { createdAt: params.order }]
    : [{ likeCount: params.order }];
  
  const [items, total] = await Promise.all([
    prisma.douyinVideo.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      include: {
        account: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    }),
    prisma.douyinVideo.count({ where }),
  ]);
  
  return { items, total, page: params.page, limit: params.limit };
}
```

### 6.6 数据隔离说明

视频列表的数据隔离通过 **accountIds 间接过滤**:
- 员工: 仅查自己名下账号的视频
- 分公司负责人: 仅查本公司所有账号的视频
- 超管: 不过滤

这与现有架构中 `organizationId` 过滤的模式一致（视频本身不直接挂 organizationId，而是通过 account 关联链路隔离）。

---

## 7. 前端改版方案

### 7.1 页面布局

改版 `src/app/(dashboard)/accounts/page.tsx`：从纯账号卡片网格改为 **顶部账号行 + 筛选栏 + 视频网格** 三段式布局。

```
┌─────────────────────────────────────────────────────────────┐
│ 标题区 (标题 + 添加按钮)                                      │
├───────────┬───────────┬───────────┬───────────┬─────────────┤
│ 账号行卡片 │ 账号行卡片 │ 账号行卡片 │ 账号行卡片 │ (+添加按钮)  │
├─────────────────────────────────────────────────────────────┤
│ 筛选栏: [全部账号 ▾] [全部标签 ▾]           [最新发布 ▾]      │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ 视频卡片  │ 视频卡片  │ 视频卡片  │ 视频卡片  │               │
│  (3:4)   │  (3:4)   │  (3:4)   │  (3:4)   │               │
└──────────┴──────────┴──────────┴──────────┴─────────────────┘
```

### 7.2 组件树设计

```
AccountsPage (page.tsx)
├── 标题区（复用现有头部模式）
├── AccountRow                              # 新组件：水平账号卡片行
│   ├── AccountRowCard × N                  # 新组件：精简版账号卡片（水平行内使用）
│   └── AddAccountButton (员工可见)
├── VideoFilterBar                          # 新组件：筛选排序栏
│   ├── Select (账号筛选)                    # shadcn Select
│   ├── Select (标签筛选)                    # shadcn Select
│   └── Select (排序切换)                    # shadcn Select
├── VideoGrid                               # 新组件：视频网格容器
│   └── VideoGridCard × N                   # 新组件：3:4 视频卡片
│       ├── 封面图 (img / video hover)
│       ├── 底部渐变遮罩                     
│       │   ├── 标题（单行截断）
│       │   ├── ♡ 点赞数
│       │   └── 发布时间
│       └── tags badge（可选）
├── 分页 (复用现有分页模式)
├── AccountAddDrawer (复用现有)
└── EmptyState (无视频时)
```

### 7.3 新增组件文件

| 文件 | 说明 |
|------|------|
| `src/components/features/accounts/account-row.tsx` | 顶部账号水平行 |
| `src/components/features/accounts/account-row-card.tsx` | 精简版水平账号卡片 |
| `src/components/features/accounts/video-grid.tsx` | 视频网格容器 |
| `src/components/features/accounts/video-grid-card.tsx` | 3:4 视频卡片（含 hover 播放） |
| `src/components/features/accounts/video-filter-bar.tsx` | 筛选排序栏 |

### 7.4 VideoGridCard 组件设计

**尺寸**: 3:4 比例，使用 `aspect-[3/4]`

**结构**:

```tsx
<div className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-card border border-border/60 cursor-pointer">
  {/* 封面图（默认显示） */}
  <img 
    src={proxyImageUrl(video.coverUrl)} 
    className="absolute inset-0 h-full w-full object-cover transition-opacity group-hover:opacity-0"
  />
  
  {/* 视频播放（hover 时显示） */}
  {video.videoUrl && (
    <video 
      ref={videoRef}
      src={video.videoUrl}
      muted
      loop
      playsInline
      className="absolute inset-0 h-full w-full object-cover opacity-0 group-hover:opacity-100"
    />
  )}
  
  {/* 底部渐变遮罩 */}
  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
    <p className="truncate text-sm font-medium text-white">{video.title}</p>
    <div className="mt-1 flex items-center justify-between text-sm text-white/80">
      <span className="flex items-center gap-1">
        <Heart className="h-3.5 w-3.5" />
        {formatNumber(video.likeCount)}
      </span>
      <span className="tabular-nums tracking-tight text-sm">
        {formatDateTime(video.publishedAt)}
      </span>
    </div>
  </div>
  
  {/* Tags badge（如有）*/}
  {video.tags.length > 0 && (
    <div className="absolute top-2 left-2 flex gap-1">
      {video.tags.slice(0, 2).map(tag => (
        <Badge key={tag} variant="secondary" className="text-2xs">{tag}</Badge>
      ))}
    </div>
  )}
</div>
```

**Hover 播放逻辑**:
- 使用 `ref` 控制 `<video>` 元素
- `onMouseEnter`: `videoRef.current?.play()`
- `onMouseLeave`: `videoRef.current?.pause(); videoRef.current.currentTime = 0;`
- 全局同一时间只有一个视频播放（通过 zustand store 或 ref 管理当前播放 videoId）

### 7.5 VideoFilterBar 组件设计

```tsx
<div className="flex items-center gap-3">
  {/* 账号筛选 */}
  <Select value={accountId} onValueChange={setAccountId}>
    <SelectTrigger className="w-40 h-8 text-sm">
      <SelectValue placeholder="全部账号" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">全部账号</SelectItem>
      {accounts.map(a => (
        <SelectItem key={a.id} value={a.id}>{a.nickname}</SelectItem>
      ))}
    </SelectContent>
  </Select>
  
  {/* 标签筛选（仅当有标签时显示） */}
  {availableTags.length > 0 && (
    <Select value={tag} onValueChange={setTag}>
      ...
    </Select>
  )}
  
  {/* 排序（右侧） */}
  <div className="ml-auto">
    <Select value={sort} onValueChange={setSort}>
      <SelectTrigger className="w-32 h-8 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="publishedAt">最新发布</SelectItem>
        <SelectItem value="likeCount">最多点赞</SelectItem>
      </SelectContent>
    </Select>
  </div>
</div>
```

### 7.6 AccountRowCard 设计

精简版账号卡片，适合水平单行排列:

```tsx
<button className="flex items-center gap-3 border border-border/60 rounded-lg bg-card px-4 py-3 min-w-[200px] hover:bg-muted/30 transition-colors">
  <img src={proxyImageUrl(account.avatar)} className="h-10 w-10 rounded-full object-cover" />
  <div className="min-w-0">
    <p className="truncate text-sm font-medium">{account.nickname}</p>
    <p className="text-sm text-muted-foreground tabular-nums">
      {formatNumber(account.followersCount)} 粉丝
    </p>
  </div>
</button>
```

### 7.7 数据流

```
AccountsPage
  |-- GET /api/douyin-accounts?page=1&limit=100  → accounts (顶部账号行)
  |-- GET /api/videos?page=1&limit=20&sort=publishedAt&order=desc  → videos (视频网格)
  |-- 筛选变化 → 重新调用 GET /api/videos?accountId=xxx&tag=xxx&sort=xxx
```

### 7.8 类型更新

`src/types/douyin-account.ts` 新增/修改:

```typescript
// AccountPreview 新增 secUserId
export interface AccountPreview {
  profileUrl: string;
  secUserId: string;       // 新增
  nickname: string;
  avatar: string;
  bio: string | null;
  followersCount: number;
  videosCount: number;
}

// DouyinVideoDTO 新增 tags
export interface DouyinVideoDTO {
  // ... 现有字段 ...
  tags: string[];            // 新增
}

// 新增跨账号视频 DTO
export interface DouyinVideoWithAccountDTO extends DouyinVideoDTO {
  accountNickname: string;
  accountAvatar: string;
}
```

---

## 8. 跨模块依赖

### 8.1 前后端共享类型

| 类型 | 文件 | 前端用 | 后端用 |
|------|------|--------|--------|
| `AccountPreview` (+secUserId) | `src/types/douyin-account.ts` | ✅ | ✅ |
| `DouyinVideoDTO` (+tags) | `src/types/douyin-account.ts` | ✅ | ✅ |
| `DouyinVideoWithAccountDTO` | `src/types/douyin-account.ts` | ✅ | ✅ |
| `PaginatedData<T>` | `src/types/api.ts` | ✅ | ✅ |

### 8.2 执行顺序约束

```
BE-001 (Schema 变更)
  ↓
BE-002 (CrawlerService 重写) ← 依赖 Schema 中的 secUserId 类型
  ↓
BE-003 (SyncService 升级) ← 依赖 CrawlerService 新接口
  ↓ (并行)
BE-004 (VideoSnapshot 定时器) ← 依赖 CrawlerService.fetchOneVideo + Schema
BE-005 (StorageService 骨架) ← 无强依赖
BE-006 (GET /api/videos) ← 依赖 Schema (tags) + Repository 新方法

FE-004 (类型更新) ← 与 BE-001 同步
  ↓
FE-001/FE-002/FE-003 ← 依赖 FE-004 类型 + BE-006 API
```

---

## 9. 自省报告

### 9.1 回顾

本版本设计是否引入了新的通用模式？

- **新 Repository 文件** (`video-snapshot.repository.ts`): 遵循现有 Repository 模式，无新模式
- **新 Service 文件** (`video.service.ts`): 跨账号视频查询是新的查询维度，但 Service 模式不变
- **StorageService 骨架**: 新的服务类别，但遵循现有 Service 模式
- **视频间接数据隔离**: 视频通过 accountIds 间接隔离，而非直接 organizationId。这是因为 DouyinVideo 不挂 organizationId。此模式需记录。
- **CrawlerService 日志策略**: 新增所有外部 API 响应的完整 JSON 日志。可作为通用模式推广到其他外部 API 集成。

### 9.2 检查

`docs/architecture/*` 和 `docs/standards/*` 是否与本版本设计一致？

| 文档 | 状态 | 说明 |
|------|------|------|
| `OVERVIEW.md` | ✅ 一致 | 定时任务模式、CrawlerService 封装模式均已描述 |
| `backend.md` | ✅ 一致 | 三层架构、CrawlerService 模式不变 |
| `frontend.md` | ✅ 一致 | 组件层次不变，新增组件在 features/accounts/ 下 |
| `database.md` | ⚠️ 需补充 | VideoSnapshot 模型不含 organizationId（因为是间接隔离），需在文档中补充"间接隔离"说明 |
| `api-conventions.md` | ✅ 一致 | GET /api/videos 遵循现有分页/排序约定 |
| `project-structure.md` | ⚠️ 可补充 | 新增 `video.service.ts`、`storage.service.ts`、`video-snapshot.repository.ts` |
| `coding-standards.md` | ✅ 一致 | 无新编码模式 |
| `ui-ux-system.md` | ✅ 一致 | VideoGridCard 使用标准暗色主题变量 |

### 9.3 提议

建议在后续迭代中更新以下全局文档（非本版本阻塞项）:

1. **`docs/architecture/database.md`** — 添加"间接数据隔离"说明：部分模型（如 DouyinVideo、VideoSnapshot）不直接挂 `organizationId`，而是通过关联链路间接隔离。Repository 层通过 `accountIds` 过滤实现。
2. **`docs/architecture/project-structure.md`** — 在 services/ 和 repositories/ 示例中补充 `video.service.ts`、`storage.service.ts`、`video-snapshot.repository.ts`。

**这些更新不影响本版本开发**，可在 v0.2.1.1 完成后统一更新。如需立即更新，请确认。
