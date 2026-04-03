# v0.2.1 技术设计方案

> 版本: v0.2.1
> 里程碑: v0.2.x（账号管理）
> 需求来源: [requirements.md](requirements.md) — F-001-2
> 创建日期: 2026-04-03

---

## 摘要

- **涉及模块**: M-001（我的账号）— 账号信息同步与视频增量同步
- **修改模型**: `DouyinAccount`（新增 `lastSyncedAt` 字段）
- **新增 API**: 1 个（`POST /api/douyin-accounts/[id]/sync`）
- **新增 Service**: 1 个（`SyncService`）
- **新增基础设施**: 2 个文件（`src/lib/scheduler.ts` + `instrumentation.ts`）
- **新增页面/组件**: 1 个组件（`AccountSyncSection`），修改 1 个页面
- **架构变更**: 无（cron 调度为首次实现，与架构规划一致；BullMQ 说明见下文）
- **环境变量新增**: `ACCOUNT_SYNC_CRON`（可选）、`VIDEO_SYNC_CRON`（可选）

---

### [ARCH-NOTE] 关于 BullMQ

架构文档（OVERVIEW.md）将爬虫同步任务列为 BullMQ 的使用场景。但 v0.2.1 不引入 BullMQ，原因：

1. Redis/BullMQ 在当前代码库中尚未有任何实现
2. v0.2.1 的同步为顺序批处理（逐账号同步），无需分布式 Worker
3. 账号量级（数十到数百）不需要并发队列
4. BullMQ 将在 AI 任务（v0.3+）时统一引入

因此 v0.2.1 定时任务采用：**node-cron → SyncService 直接调用（进程内同步执行）**。这不违反现有架构约定（非 breaking change），因为 BullMQ 从未被实现过。

---

## 一、数据模型变更

### 1.1 DouyinAccount 新增字段

```prisma
model DouyinAccount {
  // ... 现有字段不变 ...

  lastSyncedAt   DateTime?   // 最后一次账号基础信息成功同步的时间（定时或手动触发均更新）

  // ... 现有字段不变 ...
}
```

**字段说明**:
- `lastSyncedAt`：由账号信息同步（F-001-2a）和手动同步（F-001-2c）写入，视频同步（F-001-2b）不写入
- 初始值为 `null`（从未同步），对应前端"尚未同步"文案

### 1.2 DouyinVideo 无变更

v0.2.0 已创建完整 schema，字段与需求一致：

| Prisma 字段 | 需求描述 |
|------------|---------|
| `playCount` | 播放量 |
| `likeCount` | 点赞数 |
| `commentCount` | 评论数 |
| `shareCount` | 转发数 |

> ⚠ 需求文档中的 `playsCount`/`likesCount` 为拼写风格差异，以 Prisma schema 已有字段为准。

---

## 二、爬虫 API 契约

### 2.1 现有接口（直接复用）

**账号基础信息**（已实现）:

```
POST /douyin/user/profile
Body: { profileUrl: string }
Response: AccountPreview (昵称/头像/粉丝数/作品数/简介)
```

### 2.2 新增接口（v0.2.1 新增）

**视频列表**:

```
POST /douyin/user/videos
Body: { profileUrl: string; page: number }
Response: { videos: VideoFromCrawler[]; hasMore: boolean }
```

`VideoFromCrawler` 结构（定义在 `crawler.service.ts` 内部）:

```typescript
interface VideoFromCrawler {
  videoId: string;       // 抖音视频唯一 ID
  title: string;         // 标题/描述
  coverUrl: string | null;
  videoUrl: string | null;
  publishedAt: string | null;  // ISO 8601 日期字符串
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

interface FetchVideosResult {
  videos: VideoFromCrawler[];
  hasMore: boolean;       // 是否还有更多页
}
```

**Mock 数据**（开发环境无 CRAWLER_API_URL 时返回）:
- 随机生成 5~15 条视频数据，`hasMore: false`

---

## 三、后端架构设计

### 3.1 新增 SyncService

**文件**: `src/server/services/sync.service.ts`

职责：封装所有同步逻辑。对外暴露两类方法：批量（供 cron 调用）和单账号（供 API 调用）。

```typescript
class SyncService {
  // ── 批量方法（供 cron 调用）──

  // F-001-2a: 账号基础信息批量同步
  // 逐账号执行，单账号失败记录日志后跳过，不中断批次
  async runAccountInfoBatchSync(): Promise<void>

  // F-001-2b: 视频增量批量同步
  // 逐账号执行，单账号失败记录日志后跳过，不中断批次
  async runVideoBatchSync(): Promise<void>

  // ── 单账号方法（供手动同步 API 调用）──

  // F-001-2c: 手动触发单账号同步（账号信息 + 视频，串行执行）
  // callerId 用于权限校验（只有账号所有者可触发）
  // 成功：返回更新后的 lastSyncedAt
  // 失败：抛出 AppError
  async syncAccount(accountId: string, callerId: string): Promise<{ lastSyncedAt: Date }>

  // ── 私有方法 ──

  // 同步单账号基础信息：调用 crawlerService.fetchDouyinProfile → 更新 DB
  private async syncAccountInfo(account: DouyinAccount): Promise<void>

  // 同步单账号视频：分页调用 crawlerService.fetchDouyinVideos → upsert DB
  // 最多抓取 MAX_VIDEO_PAGES（默认 3）页
  private async syncAccountVideos(account: DouyinAccount): Promise<void>
}

export const syncService = new SyncService();
```

**视频增量策略**（`syncAccountVideos` 内部）:
1. 从第 1 页开始，循环调用 `crawlerService.fetchDouyinVideos(profileUrl, page)`
2. 每页视频逐条 upsert（`douyinVideoRepository.upsertByVideoId`）
3. 终止条件（满足其一即停止）：
   - `hasMore === false`（爬虫无更多数据）
   - 已达到 `MAX_VIDEO_PAGES = 3` 页上限
4. 失败直接抛出（由调用方决定如何处理）

### 3.2 新增 Scheduler

**文件**: `src/lib/scheduler.ts`

```typescript
// 使用 initialized 标志防止热重载重复注册
let initialized = false;

export function startScheduler(): void {
  if (initialized) return;
  initialized = true;

  // F-001-2a: 账号基础信息同步（默认每 6 小时）
  const accountSyncCron = env.ACCOUNT_SYNC_CRON ?? "0 */6 * * *";
  cron.schedule(accountSyncCron, () => {
    void syncService.runAccountInfoBatchSync();
  });

  // F-001-2b: 视频增量同步（默认每 1 小时）
  const videoSyncCron = env.VIDEO_SYNC_CRON ?? "0 * * * *";
  cron.schedule(videoSyncCron, () => {
    void syncService.runVideoBatchSync();
  });
}
```

### 3.3 新增 instrumentation.ts

**文件**: `instrumentation.ts`（项目根目录，与 `src/` 同级）

Next.js 15 原生支持，无需在 `next.config.ts` 中配置额外 flag。

```typescript
export async function register() {
  // 仅在 Node.js 运行时执行（避免 Edge Runtime / 测试环境中运行）
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "test") {
    const { startScheduler } = await import("./src/lib/scheduler");
    startScheduler();
  }
}
```

### 3.4 CrawlerService 扩展

在 `crawler.service.ts` 中新增 `fetchDouyinVideos` 方法：

```typescript
async fetchDouyinVideos(profileUrl: string, page: number): Promise<FetchVideosResult> {
  if (env.NODE_ENV === "development" && !env.CRAWLER_API_URL) {
    return this.mockVideos(profileUrl, page);
  }
  return this.callCrawlerApi<FetchVideosResult>("/douyin/user/videos", { profileUrl, page });
}

private mockVideos(profileUrl: string, page: number): FetchVideosResult {
  // 第 1 页返回模拟数据，第 2+ 页返回空（hasMore: false）
  if (page > 1) return { videos: [], hasMore: false };
  const videos = Array.from({ length: 8 }, (_, i) => ({
    videoId: `mock_${profileUrl.split("/").pop()}_${Date.now()}_${i}`,
    title: `模拟视频 ${i + 1}`,
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

### 3.5 Repository 扩展

#### DouyinAccountRepository 新增方法

```typescript
// 获取所有未删除账号（供 cron batch 使用）
async findAll(db?: DatabaseClient): Promise<DouyinAccount[]>

// 更新账号基础信息 + lastSyncedAt（用于账号信息同步写回）
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
  db?: DatabaseClient,
): Promise<DouyinAccount>
```

#### DouyinVideoRepository 新增方法

```typescript
// 按 videoId upsert 视频记录（增量写入核心）
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
  db?: DatabaseClient,
): Promise<DouyinVideo>
```

实现使用 Prisma `upsert`，`where.videoId`，`create` 为完整字段，`update` 仅更新数据指标字段（`playCount`/`likeCount`/`commentCount`/`shareCount`）和 `title`/`coverUrl`/`videoUrl`。

---

## 四、API 契约

### 4.1 POST `/api/douyin-accounts/[id]/sync`

**描述**: 手动触发单账号同步（账号信息 + 视频增量），仅账号所有者可操作。

**路径**: `src/app/api/douyin-accounts/[id]/sync/route.ts`

**认证**: 必须已登录（`auth()` 获取 session）

**权限**: `EMPLOYEE` 只能同步自己的账号（`account.userId === session.user.id`）；`BRANCH_MANAGER`/`SUPER_ADMIN` 无触发权限（返回 403）

> 设计依据：需求文档 F-001-2c 仅给 EMPLOYEE 权限触发同步。

**请求体**: 无（`id` 从路径参数获取）

**请求 schema**（路径参数验证）:
```typescript
const syncParamsSchema = z.object({
  id: z.string().cuid(),
});
```

**成功响应** (200):
```typescript
interface SyncAccountResponse {
  lastSyncedAt: string; // ISO 8601 datetime
}
```

```json
{
  "success": true,
  "data": {
    "lastSyncedAt": "2026-04-03T10:30:00.000Z"
  }
}
```

**错误码**:

| HTTP | code | 场景 |
|------|------|------|
| 400 | VALIDATION_ERROR | id 格式非法 |
| 401 | UNAUTHORIZED | 未登录 |
| 403 | FORBIDDEN | 非员工角色，或尝试同步他人账号 |
| 404 | NOT_FOUND | 账号不存在 |
| 502 | CRAWLER_ERROR | 爬虫服务调用失败 |
| 500 | SYNC_FAILED | 其他同步失败 |

---

## 五、类型层变更

### 5.1 src/types/douyin-account.ts

在 `DouyinAccountDetailDTO` 中新增 `lastSyncedAt` 字段：

```typescript
export interface DouyinAccountDetailDTO extends DouyinAccountDTO {
  user: {
    id: string;
    name: string;
  };
  lastSyncedAt: string | null;  // 新增字段
}
```

> `DouyinAccountDTO`（列表 DTO）不加此字段，减少列表查询返回数据量。

---

## 六、前端组件设计

### 6.1 新增组件：AccountSyncSection

**文件**: `src/components/features/accounts/account-sync-section.tsx`

**职责**: 渲染「最后同步时间」文案 + 「立即同步」按钮，封装同步状态逻辑。

**Props**:
```typescript
interface AccountSyncSectionProps {
  accountId: string;
  lastSyncedAt: string | null;   // 来自 DouyinAccountDetailDTO
  onSyncSuccess: (newLastSyncedAt: string) => void; // 同步成功后回调更新父组件状态
}
```

**内部状态**: `syncing: boolean`

**交互逻辑**:
- 点击按钮 → `syncing = true`，按钮 disabled + 显示"同步中…"
- 调用 `apiClient.post<SyncAccountResponse>('/douyin-accounts/{id}/sync')`
- 成功 → `syncing = false`，调用 `onSyncSuccess(data.lastSyncedAt)`，`toast.success('同步成功')`
- 失败 → `syncing = false`，`toast.error('同步失败，请稍后再试')`

**时间展示规则**:
- `lastSyncedAt === null` → 显示「尚未同步」
- 距今 < 60 分钟 → 「N 分钟前」
- 距今 < 24 小时 → 「HH:mm」
- 距今 >= 24 小时 → 「MM-DD HH:mm」

时间格式化使用 `src/lib/utils.ts` 中新增的 `formatRelativeTime(date)` 工具函数。

### 6.2 修改：AccountDetailHeader

将 `AccountSyncSection` 嵌入 `AccountDetailHeader` 组件，放置在粉丝数/作品数行的下方，作为第三行信息展示。

**修改后 Props**:
```typescript
interface AccountDetailHeaderProps {
  account: DouyinAccountDetailDTO;
  onSyncSuccess: (newLastSyncedAt: string) => void;  // 新增
}
```

### 6.3 修改：账号详情页面

**文件**: `src/app/(dashboard)/accounts/[id]/page.tsx`

修改点：
1. `account` 状态类型改为 `DouyinAccountDetailDTO`（已包含 `lastSyncedAt`）
2. 向 `AccountDetailHeader` 传入 `onSyncSuccess` 回调
3. 回调中调用 `setAccount(prev => ({ ...prev!, lastSyncedAt: newLastSyncedAt }))`（局部更新，无需重新请求）

### 6.4 组件树（变更部分）

```
AccountDetailPage  (/accounts/[id]/page.tsx)
├── AccountDetailHeader            ← 修改（接收 onSyncSuccess + 传递给子组件）
│   ├── [头像 + 昵称 + 简介]        ← 不变
│   ├── [粉丝数 + 作品数]           ← 不变
│   └── AccountSyncSection         ← 新增
│       ├── 最后同步时间文案
│       └── 「立即同步」Button
├── VideoList                      ← 不变
└── VideoDetailDialog              ← 不变
```

---

## 七、环境变量变更

在 `src/lib/env.ts` 中新增两个可选 env vars：

```typescript
ACCOUNT_SYNC_CRON: z.string().optional(),  // cron 表达式，默认 "0 */6 * * *"
VIDEO_SYNC_CRON: z.string().optional(),    // cron 表达式，默认 "0 * * * *"
```

---

## 八、跨模块依赖与执行顺序

```
prisma schema 变更（+lastSyncedAt）
  └── DB migration
        └── douyinAccountRepository.updateAccountInfo [新增]
              └── douyinVideoRepository.upsertByVideoId [新增]
                    └── crawlerService.fetchDouyinVideos [新增]
                          └── SyncService [新建]
                                ├── scheduler.ts [新建] → instrumentation.ts [新建]
                                └── POST /api/.../sync handler [新建]
                                      └── (前端) AccountSyncSection [新建]
                                            └── AccountDetailHeader [修改]
                                                  └── AccountDetailPage [修改]
```

后端任务须在前端任务之前完成。前端仅依赖 API 契约（Section 4），与 Service 实现无关。

---

## 九、关键设计决策备注

| 决策点 | 方案 | 原因 |
|--------|------|------|
| 不使用 BullMQ | node-cron 直接调用 SyncService | Redis 未引入，账号量级小，串行足够；见 ARCH-NOTE |
| 视频增量最大页数 | MAX_VIDEO_PAGES = 3（常量） | 首次同步可能有大量视频，限制避免超时；后续可调整 |
| lastSyncedAt 更新时机 | 账号信息同步成功后更新，视频同步不独立更新 | 语义清晰：该字段代表"账号基础信息最后刷新时间" |
| 手动同步权限 | EMPLOYEE 仅限自己账号 | 与需求文档权限矩阵一致 |
| 时间展示 | 相对时间（分钟/小时）+ 超过 24h 显示具体时间 | 对用户最直观 |
| instrumentation.ts 位置 | 项目根目录（与 src/ 同级） | Next.js 15 约定位置，无需 next.config 配置 |
