# v0.2.1.1 后端任务清单

> 版本: v0.2.1.1  
> 创建日期: 2026-04-03

---

## 必读文档

> 开始开发前必须阅读以下文档：

- `docs/product/versions/v0.2.1.1/requirements.md` — 本版本需求（理解业务背景）
- `docs/product/versions/v0.2.1.1/technical-design.md` — 本版本技术设计
- `docs/architecture/backend.md` — 后端分层规范
- `docs/architecture/database.md` — 数据库设计规范
- `docs/architecture/api-conventions.md` — API 设计规范
- `docs/standards/coding-standards.md` — 编码规范
- `.github/instructions/backend.instructions.md` — 后端开发指令
- `.github/instructions/api-routes.instructions.md` — API 路由指令
- `.github/instructions/prisma.instructions.md` — Prisma 指令

---

## 摘要

- **任务总数**: 6
- **涉及文件**:
  - `prisma/schema.prisma`
  - `src/lib/env.ts`
  - `src/lib/scheduler.ts`
  - `src/types/douyin-account.ts`
  - `src/server/services/crawler.service.ts`（重写）
  - `src/server/services/sync.service.ts`（升级）
  - `src/server/services/storage.service.ts`（新建）
  - `src/server/services/video.service.ts`（新建）
  - `src/server/repositories/douyin-account.repository.ts`（扩展）
  - `src/server/repositories/douyin-video.repository.ts`（扩展）
  - `src/server/repositories/video-snapshot.repository.ts`（新建）
  - `src/app/api/videos/route.ts`（新建）
  - `src/app/api/douyin-accounts/route.ts`（修改创建接口）
  - `src/app/api/douyin-accounts/preview/route.ts`（修改返回值）

---

## 任务列表

### BE-001: (P0) Schema 变更 — secUserId + tags + VideoSnapshot

**描述**: 修改 Prisma schema，新增 `secUserId` 字段到 DouyinAccount，新增 `tags` 字段到 DouyinVideo，新增 VideoSnapshot 模型。

**涉及文件**:
- `prisma/schema.prisma`

**实现要点**:

1. `DouyinAccount` 新增字段:
   ```prisma
   secUserId      String?   @unique
   ```

2. `DouyinVideo` 新增字段:
   ```prisma
   tags           String[]  @default([])
   snapshots      VideoSnapshot[]
   ```

3. 新增 `VideoSnapshot` 模型:
   ```prisma
   model VideoSnapshot {
     id            String      @id @default(cuid())
     videoId       String
     video         DouyinVideo @relation(fields: [videoId], references: [id])
     timestamp     DateTime    @default(now())
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

4. 执行迁移:
   ```bash
   pnpm db:migrate --name add_sec_user_id_tags_video_snapshot
   pnpm db:generate
   ```

**验收标准**:
- [ ] `pnpm db:migrate` 成功执行，生成迁移文件
- [ ] `pnpm db:generate` 成功，Prisma Client 类型更新
- [ ] DouyinAccount 表新增 `sec_user_id` 列（nullable, unique）
- [ ] DouyinVideo 表新增 `tags` 列（默认空数组）
- [ ] video_snapshots 表创建成功，含双索引
- [ ] 现有数据不受影响（secUserId 为 null，tags 为空数组）

---

### BE-002: (P0) CrawlerService 重写 — 5 个真实接口 + JSON 日志

**描述**: 将 CrawlerService 从 mock 实现替换为真实爬虫 REST API 调用。对接 5 个接口，全部响应打印完整 JSON 日志。

**涉及文件**:
- `src/server/services/crawler.service.ts`（重写）
- `src/types/douyin-account.ts`（AccountPreview 新增 secUserId）

**实现要点**:

1. **删除所有 mock 方法**（`mockProfile`, `mockVideos`）

2. **新增接口方法**:

   - `getSecUserId(url: string): Promise<string>` — 调用 `/api/douyin/web/get_sec_user_id`
   - `fetchUserProfile(secUserId: string): Promise<CrawlerUserProfile>` — 调用 `/api/douyin/web/handler_user_profile`
   - `fetchVideoList(secUserId: string, cursor?: number): Promise<CrawlerVideoListResult>` — 调用视频列表接口（路径从爬虫文档确认，如 `/api/douyin/web/fetch_user_post_videos`）
   - `fetchCollectionVideos(secUserId: string): Promise<CrawlerCollectionResult>` — 调用 `/api/douyin/web/fetch_user_collection_videos`（本版本仅封装 + 日志，不在业务中实际调用）
   - `fetchOneVideo(awemeId: string): Promise<CrawlerVideoDetail>` — 调用 `/api/douyin/web/fetch_one_video`

3. **内部类型定义**: 在 `crawler.service.ts` 文件顶部定义爬虫原始响应类型和归一化业务类型（参考 technical-design.md 第 2.3 节）

4. **字段映射**: 爬虫返回 snake_case 字段，在 Service 内部完成到 camelCase 业务类型的映射。首次以合理猜测实现，后续根据日志微调。

5. **JSON 日志**: `callCrawlerApi` 方法内，解析响应后立即:
   ```typescript
   console.info(`[CrawlerService] ${path} response:`, JSON.stringify(rawJson));
   ```

6. **错误处理**: 保持现有 `callCrawlerApi` 的重试逻辑（最大重试 2 次，超时 30s，线性退避）

7. **环境变量**: 继续使用 `env.CRAWLER_API_URL`（从 `@/lib/env`），不直接 `process.env`

8. **待下载日志**: 在映射 `coverUrl` / `videoUrl` 时打印:
   ```typescript
   if (coverUrl) console.info(`[CrawlerService] 待下载封面: ${coverUrl}`);
   if (videoUrl) console.info(`[CrawlerService] 待下载视频: ${videoUrl}`);
   ```

**验收标准**:
- [ ] 5 个爬虫接口方法均已实现
- [ ] 无 mock 代码残留
- [ ] 所有爬虫响应有 `[CrawlerService] <路径> response:` 格式日志
- [ ] 字段映射从 snake_case 到 camelCase 完成
- [ ] 爬虫不可用时抛出 `AppError("CRAWLER_ERROR", ..., 502)`
- [ ] 超时设置为 30s
- [ ] coverUrl/videoUrl 有 `[CrawlerService] 待下载` 日志标记
- [ ] 不直接使用 `process.env`，走 `env.CRAWLER_API_URL`

---

### BE-003: (P0) SyncService 升级 — secUserId 流程 + 视频增量同步

**描述**: 升级 SyncService，使用 secUserId 作为爬虫调用入参，实现增量视频同步策略。

**涉及文件**:
- `src/server/services/sync.service.ts`
- `src/server/services/douyin-account.service.ts`（添加账号流程变更）
- `src/server/repositories/douyin-account.repository.ts`（新增方法）
- `src/server/repositories/douyin-video.repository.ts`（新增方法）
- `src/app/api/douyin-accounts/route.ts`（创建接口新增 secUserId 字段）
- `src/app/api/douyin-accounts/preview/route.ts`（返回值新增 secUserId）
- `src/types/douyin-account.ts`（AccountPreview 新增 secUserId）

**实现要点**:

1. **添加账号流程变更**:
   - `DouyinAccountService.previewAccount()`:
     1. 调用 `crawlerService.getSecUserId(profileUrl)` 获取 secUserId
     2. 调用 `crawlerService.fetchUserProfile(secUserId)` 获取账号资料
     3. 返回 `AccountPreview`（含 secUserId）
   - `DouyinAccountService.createAccount()`: 接收 `secUserId` 字段并存库
   - `POST /api/douyin-accounts`: Zod schema 新增 `secUserId: z.string()`
   - Preview API: 返回值含 secUserId

2. **账号信息同步变更** (`syncAccountInfo`):
   ```
   if (!account.secUserId) {
     secUserId = await crawlerService.getSecUserId(account.profileUrl);
     await douyinAccountRepository.updateSecUserId(account.id, secUserId);
   }
   profile = await crawlerService.fetchUserProfile(account.secUserId ?? secUserId);
   ```

3. **视频同步策略升级** (`syncAccountVideos`):
   - 判断 `account.secUserId` 是否存在，不存在先补充
   - 首次同步（账号下无视频）: 取前 10 条
   - 增量同步: 每批 4 条, 遇到已存在 `videoId` 停止
   - 安全上限: 最多 10 次翻页（40 条）

4. **Repository 新增方法**:
   - `douyinAccountRepository.updateSecUserId(id, secUserId)` — 更新 secUserId
   - `douyinVideoRepository.countByAccountId(accountId)` — 统计账号下视频数
   - `douyinVideoRepository.findByVideoId(videoId)` — 按抖音 videoId 查找

**验收标准**:
- [ ] 添加账号时经过 URL→secUserId→Profile 两步，secUserId 持久化到 DB
- [ ] Preview 接口返回包含 secUserId
- [ ] 创建接口接收并存储 secUserId
- [ ] 账号信息同步使用 secUserId（不再依赖 profileUrl）
- [ ] 已有账号（secUserId 为空）首次同步时自动补充
- [ ] 首次同步取前 10 条视频
- [ ] 增量同步每批 4 条，遇到已存在 videoId 自动停止
- [ ] 增量同步最多翻页 10 次
- [ ] 手动同步（`syncAccount`）同样使用新流程

---

### BE-004: (P0) VideoSnapshot 定时器 — 10 分钟快照采集

**描述**: 新增 VideoSnapshot 定时器，每 10 分钟采集所有视频的最新播放数据，写入 VideoSnapshot 记录并更新 DouyinVideo 指标字段。

**涉及文件**:
- `src/server/repositories/video-snapshot.repository.ts`（新建）
- `src/server/services/sync.service.ts`（新增 runVideoSnapshotCollection）
- `src/server/repositories/douyin-video.repository.ts`（新增方法）
- `src/lib/scheduler.ts`（注册新定时器）
- `src/lib/env.ts`（新增 VIDEO_SNAPSHOT_CRON）

**实现要点**:

1. **新建 VideoSnapshotRepository** (`src/server/repositories/video-snapshot.repository.ts`):
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
     }): Promise<VideoSnapshot[]>
   }
   ```

2. **DouyinVideoRepository 新增方法**:
   - `findAllActive()`: 获取所有未删除的视频（用于定时器遍历）
   - `updateStats(id, { playCount, likeCount, commentCount, shareCount })`: 更新数据指标

3. **SyncService 新增** `runVideoSnapshotCollection()`:
   - 获取所有活跃视频
   - 逐条调用 `crawlerService.fetchOneVideo(video.videoId)`
   - 写入 VideoSnapshot + 更新 DouyinVideo 指标
   - 单条失败跳过，不中断整批（`try/catch` 在循环内）

4. **Scheduler 注册**:
   ```typescript
   const videoSnapshotCron = env.VIDEO_SNAPSHOT_CRON ?? "*/10 * * * *";
   cron.schedule(videoSnapshotCron, () => {
     void syncService.runVideoSnapshotCollection();
   });
   ```

5. **env.ts 新增**:
   ```typescript
   VIDEO_SNAPSHOT_CRON: z.string().optional(),
   ```

**验收标准**:
- [ ] VideoSnapshotRepository 创建完成，遵循 Repository 模式
- [ ] `runVideoSnapshotCollection` 方法实现，逐条采集
- [ ] 每次采集写入新的 VideoSnapshot 记录（不覆盖历史）
- [ ] DouyinVideo 上的数据指标同步更新
- [ ] 单条视频失败不中断整批，有错误日志
- [ ] 定时器在 scheduler.ts 中注册，使用 `VIDEO_SNAPSHOT_CRON` 环境变量
- [ ] env.ts 新增 `VIDEO_SNAPSHOT_CRON` 字段
- [ ] 默认定时频率为 `*/10 * * * *`（每 10 分钟）

---

### BE-005: (P0) StorageService 骨架

**描述**: 建立文件下载和存储的基础服务骨架，当前阶段仅实现接口定义和日志打印，不实际执行下载。

**涉及文件**:
- `src/server/services/storage.service.ts`（新建）

**实现要点**:

1. **创建 StorageService** 类:
   ```typescript
   class StorageService {
     async downloadAndStore(url: string, category: string): Promise<string> {
       const storagePath = this.generatePath(category, url);
       console.info(`[StorageService] 待下载: ${url} → ${storagePath}`);
       return storagePath;
     }
     
     private generatePath(category: string, url: string): string {
       const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
       const filename = this.extractFilename(url);
       return `storage/${category}/${date}/${filename}`;
     }
     
     private extractFilename(url: string): string {
       // 从 URL 提取文件名，带 fallback
     }
   }
   
   export const storageService = new StorageService();
   ```

2. **接口设计考虑后续 OSS 迁移**:
   - 返回类型 `string`（本地路径），后续可改为返回 OSS URL
   - `category` 参数支持 `"covers"`, `"videos"` 等分类

3. **暂不在业务中调用**: 仅创建 Service 骨架，爬虫数据映射时的"待下载"日志直接在 CrawlerService 中打印

**验收标准**:
- [ ] `storage.service.ts` 文件创建，包含 `downloadAndStore` 和 `generatePath` 方法
- [ ] 单例模式导出 (`export const storageService`)
- [ ] 日志格式: `[StorageService] 待下载: <url> → <path>`
- [ ] 存储路径格式: `storage/{category}/{YYYY-MM-DD}/{filename}`
- [ ] 不实际执行下载（仅骨架）

---

### BE-006: (P0) 新增 GET /api/videos — 跨账号视频列表

**描述**: 新增跨账号视频列表端点，支持按账号/标签筛选和排序，按用户角色自动过滤可见视频。

**涉及文件**:
- `src/app/api/videos/route.ts`（新建）
- `src/server/services/video.service.ts`（新建）
- `src/server/repositories/douyin-video.repository.ts`（新增方法）
- `src/server/repositories/douyin-account.repository.ts`（新增查询方法）
- `src/types/douyin-account.ts`（新增 DouyinVideoWithAccountDTO）

**实现要点**:

1. **Route Handler** (`src/app/api/videos/route.ts`):
   ```typescript
   const listVideosSchema = z.object({
     page: z.coerce.number().int().min(1).default(1),
     limit: z.coerce.number().int().min(1).max(100).default(20),
     accountId: z.string().optional(),
     tag: z.string().optional(),
     sort: z.enum(["publishedAt", "likeCount"]).default("publishedAt"),
     order: z.enum(["asc", "desc"]).default("desc"),
   });
   
   export async function GET(request: Request) {
     const session = await auth();
     requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE);
     const params = listVideosSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
     const result = await videoService.listVideos(session.user, params);
     return successResponse(result);
   }
   ```

2. **VideoService** (`src/server/services/video.service.ts`):
   - `listVideos(caller, params)`: 根据 caller.role 确定可见的 accountIds，调用 Repository 查询
   - 角色过滤逻辑:
     - EMPLOYEE: 仅自己名下账号的视频
     - BRANCH_MANAGER: 本组织所有账号的视频
     - SUPER_ADMIN: 不过滤
   - 如指定 `accountId`，验证 caller 有权访问该账号

3. **DouyinVideoRepository 新增方法**:
   ```typescript
   async findManyWithAccount(params: {
     accountIds?: string[];
     tag?: string;
     sort: "publishedAt" | "likeCount";
     order: "asc" | "desc";
     page: number;
     limit: number;
   }): Promise<{ items: DouyinVideoWithAccount[]; total: number; page: number; limit: number }>
   ```
   - 使用 Prisma `include: { account: { select: { id, nickname, avatar } } }`
   - 标签过滤: `{ tags: { has: params.tag } }`
   - 排序: 根据 `sort` 字段动态构建 `orderBy`

4. **DouyinAccountRepository 新增方法**（辅助角色过滤）:
   - `findIdsByUserId(userId: string): Promise<string[]>` — 获取用户名下所有账号 ID
   - `findIdsByOrganizationId(organizationId: string): Promise<string[]>` — 获取组织所有账号 ID

5. **类型定义** (`src/types/douyin-account.ts`):
   ```typescript
   export interface DouyinVideoWithAccountDTO extends DouyinVideoDTO {
     accountNickname: string;
     accountAvatar: string;
   }
   ```

**验收标准**:
- [ ] `GET /api/videos` 端点可用
- [ ] 支持 `page`, `limit`, `accountId`, `tag`, `sort`, `order` 参数
- [ ] Zod 验证所有参数，sort 仅接受 `publishedAt` / `likeCount`
- [ ] 必须认证（`auth()`）
- [ ] EMPLOYEE 仅看到自己账号的视频
- [ ] BRANCH_MANAGER 看到本公司所有账号的视频
- [ ] SUPER_ADMIN 看到全部视频
- [ ] 指定 `accountId` 时验证权限
- [ ] 返回格式: `{ success: true, data: { items, total, page, limit } }`
- [ ] 每条视频包含 `accountNickname` 和 `accountAvatar`
- [ ] 标签筛选使用 PostgreSQL 数组 `has` 操作
- [ ] 默认排序: `publishedAt desc`
