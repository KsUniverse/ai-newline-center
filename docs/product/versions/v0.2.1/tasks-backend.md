# v0.2.1 后端任务清单

## 必读文档

> 开始开发前必须按顺序阅读以下文档：

- `docs/product/versions/v0.2.1/requirements.md` — 本版本需求（理解业务背景和验收标准）
- `docs/product/versions/v0.2.1/technical-design.md` — 本版本技术设计（含所有实现细节）
- `docs/architecture/backend.md` — 后端分层规范（Route Handler → Service → Repository 模板）
- `docs/architecture/database.md` — 数据库设计规范（命名、迁移流程）
- `docs/architecture/api-conventions.md` — API 设计规范（统一响应格式、错误码）
- `docs/standards/coding-standards.md` — 编码规范（TypeScript strict、命名、注释要求）
- `prisma/schema.prisma` — 现有 schema（修改前必读）
- `src/server/services/crawler.service.ts` — 现有爬虫服务（扩展前必读）
- `src/server/services/douyin-account.service.ts` — 现有账号服务（了解权限校验模式）
- `src/server/repositories/douyin-account.repository.ts` — 现有账号 Repository
- `src/server/repositories/douyin-video.repository.ts` — 现有视频 Repository

---

## 摘要

- **任务总数**: 9
- **P0 任务数**: 7（核心功能）
- **P1 任务数**: 2（辅助/配置）
- **任务依赖**: BE-001 → BE-002 → BE-003/BE-004 → BE-005 → BE-006 → BE-007

---

## 任务列表

---

### BE-001 (P0) — Prisma Schema 变更：DouyinAccount 新增 lastSyncedAt

**文件**:
- `prisma/schema.prisma`

**详情**:

在 `DouyinAccount` 模型中新增字段：

```prisma
model DouyinAccount {
  // ...现有字段...
  lastSyncedAt   DateTime?   // 最后账号基础信息同步时间
  // ...现有字段...
}
```

字段放置位置：在 `videos DouyinVideo[]` 关系字段之后、`createdAt` 之前。

**完成后**:
1. 运行 `pnpm db:migrate --name add_last_synced_at_to_douyin_account`
2. 运行 `pnpm db:generate` 更新 Prisma Client
3. 验证迁移文件生成于 `prisma/migrations/`

**验收标准**:
- [ ] `lastSyncedAt DateTime?` 字段存在于 `DouyinAccount` 模型
- [ ] 迁移文件已生成，运行无报错
- [ ] `pnpm type-check` 通过

---

### BE-002 (P0) — 扩展 DouyinAccountRepository：新增 findAll 和 updateAccountInfo

**文件**:
- `src/server/repositories/douyin-account.repository.ts`

**详情**:

在 `DouyinAccountRepository` 类中新增两个方法：

**方法 1**: `findAll(db?: DatabaseClient): Promise<DouyinAccount[]>`
```typescript
async findAll(db: DatabaseClient = prisma): Promise<DouyinAccount[]> {
  return db.douyinAccount.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}
```

**方法 2**: `updateAccountInfo(id, data, db?): Promise<DouyinAccount>`
```typescript
async updateAccountInfo(
  id: string,
  data: {
    nickname: string;
    avatar: string;
    bio: string | null;
    followersCount: number;
    videosCount: number;
    lastSyncedAt: Date;
  },
  db: DatabaseClient = prisma,
): Promise<DouyinAccount> {
  return db.douyinAccount.update({
    where: { id },
    data,
  });
}
```

注意：`DouyinAccount` 类型需要从 `@prisma/client` 导入（已在文件头部引入）。

**验收标准**:
- [ ] 两个方法已添加并导出（通过 `douyinAccountRepository` 单例）
- [ ] TypeScript 类型标注正确（显式返回类型）
- [ ] `pnpm type-check` 通过

---

### BE-003 (P0) — 扩展 DouyinVideoRepository：新增 upsertByVideoId

**文件**:
- `src/server/repositories/douyin-video.repository.ts`

**详情**:

在 `DouyinVideoRepository` 类中新增 `upsertByVideoId` 方法：

```typescript
async upsertByVideoId(
  data: {
    videoId: string;
    accountId: string;
    title: string;
    coverUrl: string | null;
    videoUrl: string | null;
    publishedAt: Date | null;
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
  },
  db: DatabaseClient = prisma,
): Promise<DouyinVideo> {
  return db.douyinVideo.upsert({
    where: { videoId: data.videoId },
    create: data,
    update: {
      title: data.title,
      coverUrl: data.coverUrl,
      videoUrl: data.videoUrl,
      playCount: data.playCount,
      likeCount: data.likeCount,
      commentCount: data.commentCount,
      shareCount: data.shareCount,
    },
  });
}
```

**注意**:
- `create` 传入完整 `data`（包含 `accountId` 和 `publishedAt`）
- `update` 只更新数据指标和内容字段，不更新 `accountId`/`publishedAt`（这些是创建时确定的静态字段）

**验收标准**:
- [ ] 方法已添加
- [ ] 存在的 videoId 会更新指标字段（`playCount` 等），不更新 `accountId`
- [ ] 不存在的 videoId 会创建新记录
- [ ] `pnpm type-check` 通过

---

### BE-004 (P0) — 扩展 CrawlerService：新增 fetchDouyinVideos

**文件**:
- `src/server/services/crawler.service.ts`

**详情**:

在 `crawler.service.ts` 顶部新增接口定义（模块内 private 类型）：

```typescript
interface VideoFromCrawler {
  videoId: string;
  title: string;
  coverUrl: string | null;
  videoUrl: string | null;
  publishedAt: string | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

interface FetchVideosResult {
  videos: VideoFromCrawler[];
  hasMore: boolean;
}
```

在 `CrawlerService` 类中新增两个方法：

**公开方法**:
```typescript
async fetchDouyinVideos(profileUrl: string, page: number): Promise<FetchVideosResult> {
  if (env.NODE_ENV === "development" && !env.CRAWLER_API_URL) {
    return this.mockVideos(profileUrl, page);
  }
  return this.callCrawlerApi<FetchVideosResult>("/douyin/user/videos", { profileUrl, page });
}
```

**私有 mock 方法**:
```typescript
private mockVideos(profileUrl: string, page: number): FetchVideosResult {
  if (page > 1) return { videos: [], hasMore: false };
  const slug = profileUrl.split("/").pop() ?? "mock";
  const videos: VideoFromCrawler[] = Array.from({ length: 8 }, (_, i) => ({
    videoId: `mock_${slug}_${i}`,
    title: `模拟视频 ${i + 1} — ${slug}`,
    coverUrl: null,
    videoUrl: null,
    publishedAt: new Date(Date.now() - i * 86400000).toISOString(),
    playCount: Math.floor(Math.random() * 10000),
    likeCount: Math.floor(Math.random() * 1000),
    commentCount: Math.floor(Math.random() * 100),
    shareCount: Math.floor(Math.random() * 50),
  }));
  return { videos, hasMore: false };
}
```

**注意**: `VideoFromCrawler` 和 `FetchVideosResult` 为文件内部类型，不需要导出到 `src/types/`。

**验收标准**:
- [ ] `fetchDouyinVideos(profileUrl, page)` 方法已添加
- [ ] 开发模式下无 `CRAWLER_API_URL` 时返回 mock 数据（第 1 页 8 条，第 2 页起为空）
- [ ] 生产模式调用 `POST /douyin/user/videos`
- [ ] `pnpm type-check` 通过

---

### BE-005 (P0) — 新建 SyncService

**文件**:
- `src/server/services/sync.service.ts`（新建）

**详情**:

完整实现 `SyncService` 类。关键逻辑说明：

**`runAccountInfoBatchSync()`**:
```
1. douyinAccountRepository.findAll()
2. for each account: try { await this.syncAccountInfo(account) } catch { console.error(log); continue }
```

**`runVideoBatchSync()`**:
```
1. douyinAccountRepository.findAll()
2. for each account: try { await this.syncAccountVideos(account) } catch { console.error(log); continue }
```

**`syncAccount(accountId, callerId)` (供 API 调用)**:
```
1. douyinAccountRepository.findById(accountId)
2. if !account → throw AppError(NOT_FOUND)
3. if account.userId !== callerId → throw AppError(FORBIDDEN)
4. await this.syncAccountInfo(account)   ← 失败则抛出，不执行后续
5. await this.syncAccountVideos(account) ← 失败记录日志，不影响返回
6. return { lastSyncedAt: account.lastSyncedAt! }
```

**`private syncAccountInfo(account)`**:
```
1. const profile = await crawlerService.fetchDouyinProfile(account.profileUrl)
2. await douyinAccountRepository.updateAccountInfo(account.id, {
     nickname: profile.nickname,
     avatar: profile.avatar,
     bio: profile.bio,
     followersCount: profile.followersCount,
     videosCount: profile.videosCount,
     lastSyncedAt: new Date(),
   })
```

**`private syncAccountVideos(account)`**:
```
const MAX_VIDEO_PAGES = 3;
for (let page = 1; page <= MAX_VIDEO_PAGES; page++) {
  const result = await crawlerService.fetchDouyinVideos(account.profileUrl, page);
  for each video in result.videos:
    await douyinVideoRepository.upsertByVideoId({
      ...video,
      accountId: account.id,
      publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
    })
  if (!result.hasMore) break;
}
```

**注意**:
- `syncAccount(accountId, callerId)` 中，`syncAccountInfo` 失败→抛出给 API（返回 502/500）；`syncAccountVideos` 失败→只记录日志，`lastSyncedAt` 仍然返回（账号信息已成功更新）
- `runAccountInfoBatchSync` 和 `runVideoBatchSync` 内每个账号独立 try/catch，单账号失败不中断批次

**导入**:
```typescript
import type { DouyinAccount } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { crawlerService } from "@/server/services/crawler.service";
import { douyinAccountRepository } from "@/server/repositories/douyin-account.repository";
import { douyinVideoRepository } from "@/server/repositories/douyin-video.repository";
```

**验收标准**:
- [ ] `syncService` 单例已导出
- [ ] `runAccountInfoBatchSync()` 可以处理空账号列表（不报错）
- [ ] 单账号失败不中断批次
- [ ] `syncAccount()` 未找到账号时抛 NOT_FOUND，他人账号时抛 FORBIDDEN
- [ ] `pnpm type-check` 通过

---

### BE-006 (P0) — 新建手动同步 API Route Handler

**文件**:
- `src/app/api/douyin-accounts/[id]/sync/route.ts`（新建）

**详情**:

参考现有 `src/app/api/douyin-accounts/[id]/route.ts` 的结构。

```typescript
import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { syncService } from "@/server/services/sync.service";
import { handleApiError, successResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { UserRole } from "@prisma/client";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new AppError("UNAUTHORIZED", "请先登录", 401);
    }

    // 仅 EMPLOYEE 可触发手动同步
    if (session.user.role !== UserRole.EMPLOYEE) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    const { id } = paramsSchema.parse(await params);
    const result = await syncService.syncAccount(id, session.user.id);

    return successResponse({ lastSyncedAt: result.lastSyncedAt.toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}
```

**注意**:
- 在 Next.js 15 中，`params` 是 `Promise<{id: string}>`，需要 `await params`（参考项目内已有的 `[id]/route.ts` 实现风格）
- `syncService.syncAccount()` 内部已做账号归属权限校验，无需在 Route Handler 中重复

**验收标准**:
- [ ] `POST /api/douyin-accounts/[id]/sync` 路由存在
- [ ] 未登录返回 401
- [ ] 非 EMPLOYEE 角色返回 403
- [ ] 调用他人账号返回 403
- [ ] 账号不存在返回 404
- [ ] 成功返回 `{ success: true, data: { lastSyncedAt: "..." } }`
- [ ] 爬虫失败返回 502
- [ ] `pnpm type-check` + `pnpm lint` 通过

---

### BE-007 (P0) — 新建 Scheduler 和 instrumentation.ts

**文件**:
- `src/lib/scheduler.ts`（新建）
- `instrumentation.ts`（项目根目录新建，与 `src/` 同级）

**详情**:

**src/lib/scheduler.ts**:
```typescript
import cron from "node-cron";
import { env } from "@/lib/env";
import { syncService } from "@/server/services/sync.service";

let initialized = false;

export function startScheduler(): void {
  if (initialized) return;
  initialized = true;

  const accountSyncCron = env.ACCOUNT_SYNC_CRON ?? "0 */6 * * *";
  const videoSyncCron = env.VIDEO_SYNC_CRON ?? "0 * * * *";

  cron.schedule(accountSyncCron, () => {
    void syncService.runAccountInfoBatchSync();
  });

  cron.schedule(videoSyncCron, () => {
    void syncService.runVideoBatchSync();
  });
}
```

**instrumentation.ts** (项目根目录):
```typescript
export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV !== "test"
  ) {
    const { startScheduler } = await import("./src/lib/scheduler");
    startScheduler();
  }
}
```

**注意**:
- `instrumentation.ts` 中使用 dynamic import（避免在 Edge Runtime 加载 node-cron）
- `initialized = false` guard 防止开发模式热重载导致重复注册
- `NODE_ENV !== "test"` 防止测试环境启动定时器

**验收标准**:
- [ ] `scheduler.ts` 存在，两个 cron 任务已注册
- [ ] `instrumentation.ts` 位于项目根目录
- [ ] 开发模式下 `pnpm dev` 启动时控制台无 cron 相关报错
- [ ] `pnpm type-check` 通过

---

### BE-008 (P1) — 更新 env.ts：新增 ACCOUNT_SYNC_CRON 和 VIDEO_SYNC_CRON

**文件**:
- `src/lib/env.ts`

**详情**:

在 `envSchema` 中新增两个可选字段：

```typescript
const envSchema = z.object({
  // ... 现有字段 ...
  ACCOUNT_SYNC_CRON: z.string().optional(),  // cron 表达式，默认 "0 */6 * * *"
  VIDEO_SYNC_CRON: z.string().optional(),    // cron 表达式，默认 "0 * * * *"
});
```

**验收标准**:
- [ ] 两个字段已添加（optional，不影响现有 env 验证）
- [ ] 现有测试 `src/lib/env.test.ts` 通过
- [ ] `pnpm type-check` 通过

---

### BE-009 (P1) — 更新 DouyinAccountDetailDTO：新增 lastSyncedAt

**文件**:
- `src/types/douyin-account.ts`
- `src/server/repositories/douyin-account.repository.ts`（findById 查询 select 包含新字段）

**详情**:

**types/douyin-account.ts**:
```typescript
export interface DouyinAccountDetailDTO extends DouyinAccountDTO {
  user: {
    id: string;
    name: string;
  };
  lastSyncedAt: string | null;  // 新增
}
```

**douyin-account.repository.ts** 中 `findById` 的查询已使用 Prisma 默认 select（`select: *`），自动包含新字段，无需修改。

但需要检查 `douyin-account.service.ts` 中 `getAccountDetail` 的返回值是否包含 `lastSyncedAt`，以及 Route Handler 是否需要将 Prisma 对象映射为 DTO（若当前直接返回 Prisma 对象，则自动包含）。

**验收标准**:
- [ ] `DouyinAccountDetailDTO` 包含 `lastSyncedAt: string | null`
- [ ] `GET /api/douyin-accounts/[id]` 的响应中包含 `lastSyncedAt` 字段
- [ ] `pnpm type-check` 通过

---

## 任务执行顺序

```
BE-001 (schema)
  └── BE-002 (account repo 扩展)
  └── BE-003 (video repo 扩展)
        └── BE-004 (crawler 扩展)
              └── BE-005 (sync service)  ← 依赖 BE-002/003/004
                    └── BE-006 (API route)
                    └── BE-007 (scheduler)
BE-008 (env 扩展)  ← 独立，建议最先或与 BE-007 同时
BE-009 (类型更新)  ← 独立，建议最后（在前端开始前完成）
```

---

## 全量验收 Checklist

- [ ] 两个定时器在 `pnpm dev` 启动后在设定时间触发（可将 cron 表达式临时改为每分钟 `* * * * *` 验证）
- [ ] 定时任务触发时控制台有日志输出（成功/失败均有记录）
- [ ] 某账号爬虫失败时，其他账号继续同步（看日志确认）
- [ ] `POST /api/douyin-accounts/[id]/sync` 在 Postman/curl 中测试成功
- [ ] 手动同步后 DB 中 `lastSyncedAt` 字段更新为当前时间
- [ ] 视频增量同步：同一 videoId 不产生重复记录（多次调用后 `douyin_videos` 表中 `videoId` 唯一）
- [ ] `pnpm type-check` 全量通过
- [ ] `pnpm lint` 全量通过
