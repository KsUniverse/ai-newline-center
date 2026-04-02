# v0.2.0 技术设计方案

> 版本: v0.2.0
> 里程碑: v0.2.x（账号管理）
> 需求来源: [requirements.md](requirements.md) — F-001-1 + F-001-3
> 创建日期: 2026-04-03

---

## 摘要

- **涉及模块**: M-001（我的账号）
- **新增模型**: `DouyinAccount`, `DouyinVideo`, 枚举 `DouyinAccountType`
- **新增 API**: 5 个端点（账号 CRUD + 爬虫预览）
- **新增页面**: 2 个（`/accounts` 账号列表、`/accounts/[id]` 账号详情）
- **新增组件**: ~10 个（账号卡片、Drawer、详情头部、视频列表、视频详情 Dialog 等）
- **架构变更**: 无（遵循现有三层架构，新增 CrawlerService 为 Service 层标准模式）
- **新增环境变量**: `CRAWLER_API_URL`（爬虫 API 地址）
- **防盗链方案**: Next.js API Route 图片代理

---

## 一、数据模型变更

### 1.1 新增枚举

```prisma
enum DouyinAccountType {
  MY_ACCOUNT          // 员工自己管理的账号（v0.2.0）
  BENCHMARK_ACCOUNT   // 对标账号（v0.2.2 F-002-1 预留）
}
```

### 1.2 新增 DouyinAccount 模型

```prisma
model DouyinAccount {
  id             String             @id @default(cuid())
  profileUrl     String             @unique        // 抖音主页链接，全局唯一
  nickname       String                             // 账号昵称
  avatar         String                             // 头像 URL
  bio            String?                            // 简介
  followersCount Int                @default(0)     // 粉丝数
  videosCount    Int                @default(0)     // 作品数
  type           DouyinAccountType  @default(MY_ACCOUNT)
  userId         String                             // 归属员工 ID
  user           User               @relation(fields: [userId], references: [id])
  organizationId String                             // 归属组织 ID（反规范化，数据隔离）
  organization   Organization       @relation(fields: [organizationId], references: [id])
  videos         DouyinVideo[]
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
  deletedAt      DateTime?

  @@index([userId])
  @@index([organizationId])
  @@map("douyin_accounts")
}
```

### 1.3 新增 DouyinVideo 模型

> v0.2.0 仅创建 Schema，表中无数据。视频数据由 v0.2.1 定时器填充。

```prisma
model DouyinVideo {
  id           String        @id @default(cuid())
  videoId      String        @unique               // 抖音视频原始 ID
  accountId    String                               // 归属账号 ID
  account      DouyinAccount @relation(fields: [accountId], references: [id])
  title        String                               // 视频标题/描述
  coverUrl     String?                              // 封面缩略图 URL
  videoUrl     String?                              // 视频原始链接
  publishedAt  DateTime?                            // 发布时间
  playCount    Int           @default(0)            // 播放量
  likeCount    Int           @default(0)            // 点赞数
  commentCount Int           @default(0)            // 评论数
  shareCount   Int           @default(0)            // 转发数
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  deletedAt    DateTime?

  @@index([accountId])
  @@map("douyin_videos")
}
```

### 1.4 User/Organization 模型关系补充

在 `User` 模型中新增反向关系：

```prisma
model User {
  // ... 现有字段
  douyinAccounts DouyinAccount[]    // 新增关系
}
```

在 `Organization` 模型中新增反向关系：

```prisma
model Organization {
  // ... 现有字段
  douyinAccounts DouyinAccount[]    // 新增关系
}
```

---

## 二、后端 API

### 2.1 API 端点总览

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | `/api/douyin-accounts/preview` | 爬虫预览（获取账号信息） | EMPLOYEE |
| POST | `/api/douyin-accounts` | 添加抖音账号 | EMPLOYEE |
| GET | `/api/douyin-accounts` | 账号列表 | ALL（按角色过滤数据） |
| GET | `/api/douyin-accounts/[id]` | 账号详情 | ALL（权限校验） |
| GET | `/api/douyin-accounts/[id]/videos` | 视频列表（分页） | ALL（权限校验） |

### 2.2 API 契约

#### POST `/api/douyin-accounts/preview`

> 调用爬虫获取抖音账号预览信息，不落库。

**请求体**:
```typescript
const previewAccountSchema = z.object({
  profileUrl: z.string().url().regex(
    /^https?:\/\/(www\.)?douyin\.com\/user\/.+$/,
    "请输入合法的抖音主页链接"
  ),
});
```

**响应** (200):
```typescript
interface AccountPreview {
  profileUrl: string;
  nickname: string;
  avatar: string;
  bio: string | null;
  followersCount: number;
  videosCount: number;
}
```

**错误码**:
| 状态码 | code | 场景 |
|--------|------|------|
| 400 | VALIDATION_ERROR | 链接格式非法 |
| 401 | UNAUTHORIZED | 未登录 |
| 403 | FORBIDDEN | 非员工角色 |
| 502 | CRAWLER_ERROR | 爬虫调用失败 |

---

#### POST `/api/douyin-accounts`

> 确认添加抖音账号。

**请求体**:
```typescript
const createAccountSchema = z.object({
  profileUrl: z.string().url().regex(
    /^https?:\/\/(www\.)?douyin\.com\/user\/.+$/,
    "请输入合法的抖音主页链接"
  ),
  nickname: z.string().min(1).max(200),
  avatar: z.string().url(),
  bio: z.string().max(500).nullable().optional(),
  followersCount: z.number().int().min(0),
  videosCount: z.number().int().min(0),
});
```

**响应** (201):
```typescript
interface DouyinAccountDTO {
  id: string;
  profileUrl: string;
  nickname: string;
  avatar: string;
  bio: string | null;
  followersCount: number;
  videosCount: number;
  type: "MY_ACCOUNT";
  userId: string;
  organizationId: string;
  createdAt: string;
}
```

**错误码**:
| 状态码 | code | 场景 |
|--------|------|------|
| 400 | VALIDATION_ERROR | 参数校验失败 |
| 401 | UNAUTHORIZED | 未登录 |
| 403 | FORBIDDEN | 非员工角色 |
| 409 | ACCOUNT_EXISTS | profileUrl 已被添加 |

---

#### GET `/api/douyin-accounts`

> 获取账号列表。数据范围根据角色自动过滤。

**查询参数**:
```typescript
const listAccountsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

**数据过滤规则**:
- **EMPLOYEE**: `userId = session.user.id`（仅自己的账号）
- **BRANCH_MANAGER**: `organizationId = session.user.organizationId`（本公司所有员工的账号）
- **SUPER_ADMIN**: 无过滤（全部账号）

**响应** (200):
```typescript
interface PaginatedData<DouyinAccountDTO> {
  items: DouyinAccountDTO[];
  total: number;
  page: number;
  limit: number;
}
```

---

#### GET `/api/douyin-accounts/[id]`

> 获取单个账号详情。

**响应** (200):
```typescript
interface DouyinAccountDetailDTO extends DouyinAccountDTO {
  user: { id: string; name: string };
}
```

**权限校验**:
- EMPLOYEE: 仅可查看 `userId === session.user.id` 的账号
- BRANCH_MANAGER: 仅可查看 `organizationId === session.user.organizationId` 的账号
- SUPER_ADMIN: 无限制

**错误码**: 404 NOT_FOUND / 403 FORBIDDEN

---

#### GET `/api/douyin-accounts/[id]/videos`

> 获取账号下视频列表（分页）。

**查询参数**:
```typescript
const listVideosSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

**响应** (200):
```typescript
interface DouyinVideoDTO {
  id: string;
  videoId: string;
  title: string;
  coverUrl: string | null;
  videoUrl: string | null;
  publishedAt: string | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
}

interface PaginatedData<DouyinVideoDTO> {
  items: DouyinVideoDTO[];
  total: number;
  page: number;
  limit: number;
}
```

> v0.2.0 中该接口将返回空列表（`items: [], total: 0`），属预期行为。

---

### 2.3 CrawlerService 封装

#### 设计

```typescript
// src/server/services/crawler.service.ts
class CrawlerService {
  /**
   * 获取抖音用户的账号基本信息
   * v0.2.0 开发阶段使用模拟数据，预留真实 API 接口
   */
  async fetchDouyinProfile(profileUrl: string): Promise<AccountPreview> {
    if (env.NODE_ENV === "development" && !env.CRAWLER_API_URL) {
      return this.mockProfile(profileUrl);
    }
    return this.callCrawlerApi("/douyin/user/profile", { profileUrl });
  }

  /** 模拟数据：开发阶段无爬虫 API 时使用 */
  private mockProfile(profileUrl: string): AccountPreview {
    return {
      profileUrl,
      nickname: "模拟账号_" + profileUrl.split("/").pop(),
      avatar: "https://p3-pc.douyinpic.com/mock-avatar.jpg",
      bio: "这是一个模拟账号的简介",
      followersCount: Math.floor(Math.random() * 100000),
      videosCount: Math.floor(Math.random() * 500),
    };
  }

  /** 通用爬虫 API 调用（含重试） */
  private async callCrawlerApi<T>(path: string, payload: unknown): Promise<T> {
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${env.CRAWLER_API_URL}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Crawler API error: ${response.status}`);
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    throw new AppError("CRAWLER_ERROR", "爬虫服务调用失败，请稍后重试", 502);
  }
}

export const crawlerService = new CrawlerService();
```

#### 模拟数据模式

在 `env.ts` 中 `CRAWLER_API_URL` 为 optional。当其为空且 `NODE_ENV === "development"` 时，CrawlerService 返回模拟数据，方便前端联调。

---

### 2.4 三层架构文件清单

| 层 | 文件 | 说明 |
|----|------|------|
| Route Handler | `src/app/api/douyin-accounts/route.ts` | GET (list) + POST (create) |
| Route Handler | `src/app/api/douyin-accounts/preview/route.ts` | POST (preview) |
| Route Handler | `src/app/api/douyin-accounts/[id]/route.ts` | GET (detail) |
| Route Handler | `src/app/api/douyin-accounts/[id]/videos/route.ts` | GET (videos list) |
| Route Handler | `src/app/api/proxy/image/route.ts` | GET (图片代理) |
| Service | `src/server/services/douyin-account.service.ts` | 账号业务逻辑 |
| Service | `src/server/services/crawler.service.ts` | 爬虫封装 |
| Repository | `src/server/repositories/douyin-account.repository.ts` | 账号数据访问 |
| Repository | `src/server/repositories/douyin-video.repository.ts` | 视频数据访问 |

---

## 三、前端组件设计

### 3.1 页面路由

| 路由 | 文件 | 说明 |
|------|------|------|
| `/accounts` | `src/app/(dashboard)/accounts/page.tsx` | 账号列表页 |
| `/accounts/[id]` | `src/app/(dashboard)/accounts/[id]/page.tsx` | 账号详情 + 视频列表页 |

### 3.2 组件树

```
src/components/features/accounts/
├── index.ts                        # barrel export
├── account-card.tsx                 # 单个账号卡片（头像、昵称、粉丝数、作品数）
├── account-card-grid.tsx            # 账号卡片 Grid 布局
├── account-add-drawer.tsx           # 添加账号 Drawer（输入链接→预览→确认）
├── account-detail-header.tsx        # 账号详情页顶部信息区
├── video-list.tsx                   # 视频列表（表格形式）
├── video-detail-dialog.tsx          # 视频详情弹窗
└── account-empty-state.tsx          # 账号空状态
```

### 3.3 页面组件关系

#### 账号列表页 `/accounts`

```
AccountsPage
├── PageHeader（标题"我的账号" + "添加账号"按钮）
│   └── Button（仅 EMPLOYEE 角色可见）
├── AccountCardGrid
│   ├── AccountCard × N（点击 → router.push /accounts/[id]）
│   └── AccountEmptyState（无账号时显示）
└── AccountAddDrawer（Sheet 组件）
    ├── Step 1: 输入链接 + "获取账号信息"按钮
    ├── Step 2: 账号预览（头像、昵称、粉丝数等）+ "添加"按钮
    └── Error state: 错误提示 + 重试
```

#### 账号详情页 `/accounts/[id]`

```
AccountDetailPage
├── AccountDetailHeader（头像、昵称、粉丝数、作品数、简介）
├── VideoList（表格 + 分页）
│   ├── VideoRow × N（点击 → 打开 VideoDetailDialog）
│   └── EmptyState（"暂无视频，账号信息正在同步中"）
├── VideoDetailDialog（视频完整信息 + 原始链接）
└── Pagination（分页控件）
```

### 3.4 Sidebar 更新

在 `NAV_ITEMS` 中新增：

```typescript
{
  icon: MonitorPlay,  // lucide-react 图标
  label: "我的账号",
  href: "/accounts",
  roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
}
```

放置在「仪表盘」之后、「组织管理」之前。所有角色可见，但不同角色看到的数据范围不同（由后端 API 控制）。

### 3.5 Middleware 更新

在 `src/middleware.ts` 的 `config.matcher` 中新增 `/accounts/:path*`：

```typescript
export const config = {
  matcher: ["/login", "/dashboard/:path*", "/organizations/:path*", "/users/:path*", "/accounts/:path*"],
};
```

### 3.6 AddDrawer 交互状态机

```
IDLE → INPUT
  ↓ (点击"获取账号信息")
FETCHING (loading spinner)
  ↓ (成功)           ↓ (失败)
PREVIEW              ERROR
  ↓ (点击"添加")      ↓ (点击"重试" → FETCHING)
SUBMITTING
  ↓ (成功)           ↓ (失败)
DONE (关闭 Drawer)   SUBMIT_ERROR (提示错误)
```

---

## 四、权限矩阵

### 4.1 API 权限

| API | EMPLOYEE | BRANCH_MANAGER | SUPER_ADMIN |
|-----|----------|----------------|-------------|
| POST /preview | ✅ 可调用 | ❌ 403 | ❌ 403 |
| POST /douyin-accounts | ✅ 可创建 | ❌ 403 | ❌ 403 |
| GET /douyin-accounts | ✅ 仅自己 | ✅ 本公司 | ✅ 全部 |
| GET /douyin-accounts/[id] | ✅ 仅自己 | ✅ 本公司 | ✅ 全部 |
| GET /douyin-accounts/[id]/videos | ✅ 仅自己 | ✅ 本公司 | ✅ 全部 |

### 4.2 页面/UI 权限

| UI 元素 | EMPLOYEE | BRANCH_MANAGER | SUPER_ADMIN |
|---------|----------|----------------|-------------|
| /accounts 页面 | ✅ | ✅ | ✅ |
| "添加账号"按钮 | ✅ 可见 | ❌ 隐藏 | ❌ 隐藏 |
| 账号卡片列表 | 仅自己 | 本公司所有 | 全部 |
| /accounts/[id] 详情 | 仅自己 | 本公司 | 全部 |
| 页面标题 | "我的账号" | "本公司账号" | "所有账号" |

### 4.3 数据过滤实现

Service 层根据 caller 的角色决定 Repository 查询参数：

```typescript
// douyin-account.service.ts
async listAccounts(caller: SessionUser, params: PaginationParams) {
  switch (caller.role) {
    case "EMPLOYEE":
      return repo.findMany({ userId: caller.id, ...params });
    case "BRANCH_MANAGER":
      return repo.findMany({ organizationId: caller.organizationId, ...params });
    case "SUPER_ADMIN":
      return repo.findMany({ ...params });
  }
}
```

---

## 五、环境变量

### 5.1 新增变量

| 变量 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `CRAWLER_API_URL` | development 可选, production 必填 | — | 爬虫服务 API 地址 |

### 5.2 env.ts 变更

```typescript
// src/lib/env.ts — 新增字段
const envSchema = z.object({
  // ... 保留现有字段
  CRAWLER_API_URL: z.string().url().optional(),
}).superRefine((values, ctx) => {
  // ... 保留现有校验
  if (values.NODE_ENV === "production" && !values.CRAWLER_API_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["CRAWLER_API_URL"],
      message: "CRAWLER_API_URL 在生产环境必填",
    });
  }
});
```

---

## 六、防盗链处理方案

### 6.1 问题

抖音 CDN 图片（头像、视频封面）设有 Referer 防盗链，前端 `<img>` 直接引用会 403/404。

### 6.2 方案：Next.js API Route 图片代理

创建 `/api/proxy/image` 端点，后端代理请求抖音图片，转发给前端。

```typescript
// src/app/api/proxy/image/route.ts
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return new Response("Missing url", { status: 400 });

  // 安全校验：仅允许代理白名单域名
  const allowedHosts = ["p3-pc.douyinpic.com", "p6-pc.douyinpic.com", "p9-pc.douyinpic.com",
                         "p3-sign.douyinpic.com", "p6-sign.douyinpic.com", "p26-sign.douyinpic.com"];
  const parsed = new URL(url);
  if (!allowedHosts.some(host => parsed.hostname.endsWith(host) || parsed.hostname === host)) {
    return new Response("Forbidden host", { status: 403 });
  }

  const response = await fetch(url, {
    headers: { "Referer": "https://www.douyin.com/" },
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400", // 缓存 24 小时
    },
  });
}
```

### 6.3 前端使用

```typescript
// 工具函数
function proxyImageUrl(originalUrl: string): string {
  return `/api/proxy/image?url=${encodeURIComponent(originalUrl)}`;
}
```

在 `AccountCard`、`AccountDetailHeader` 等组件中，将抖音图片 URL 通过 `proxyImageUrl()` 转换后传给 `<img>` 或 Next.js `<Image>`。

### 6.4 Next.js Image 配置

同时在 `next.config.ts` 中配置 `remotePatterns`（允许 `/api/proxy/image` 返回的图片被 Next.js Image 组件优化）：

```typescript
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.douyinpic.com" },
    ],
  },
};
```

> 注：由于我们通过 API proxy 代理图片，前端实际使用的是 `/api/proxy/image` 的 URL，不需要 `<Image>` 直接访问抖音 CDN。`remotePatterns` 作为后备配置保留，以备后续直接使用抖音 URL 的场景。

---

## 七、共享类型定义

### 7.1 新增类型文件

```typescript
// src/types/douyin-account.ts
export interface DouyinAccountDTO {
  id: string;
  profileUrl: string;
  nickname: string;
  avatar: string;
  bio: string | null;
  followersCount: number;
  videosCount: number;
  type: "MY_ACCOUNT" | "BENCHMARK_ACCOUNT";
  userId: string;
  organizationId: string;
  createdAt: string;
}

export interface DouyinAccountDetailDTO extends DouyinAccountDTO {
  user: { id: string; name: string };
}

export interface AccountPreview {
  profileUrl: string;
  nickname: string;
  avatar: string;
  bio: string | null;
  followersCount: number;
  videosCount: number;
}

export interface DouyinVideoDTO {
  id: string;
  videoId: string;
  title: string;
  coverUrl: string | null;
  videoUrl: string | null;
  publishedAt: string | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
}
```

---

## 八、跨模块依赖与执行顺序约束

### 8.1 后端依赖链

```
BE-001 Prisma Schema 变更
  ↓
BE-002 环境变量更新 (并行)
  ↓
BE-003 CrawlerService (依赖 env)
  ↓
BE-004 DouyinAccountRepository (依赖 Schema)
  ↓
BE-005 DouyinVideoRepository (依赖 Schema)
  ↓
BE-006 DouyinAccountService (依赖 Repository + CrawlerService)
  ↓
BE-007 preview API (依赖 Service)
  ↓
BE-008 accounts API (依赖 Service)
  ↓
BE-009 account detail + videos API (依赖 Service)
  ↓
BE-010 图片代理 API (独立)
```

### 8.2 前端依赖链

```
FE-001 类型定义
  ↓
FE-002 图片代理工具函数 (独立)
  ↓
FE-003 Sidebar 更新 + Middleware 更新 (独立)
  ↓
FE-004 账号空状态组件
  ↓
FE-005 账号卡片组件
  ↓
FE-006 账号卡片 Grid 组件
  ↓
FE-007 添加账号 Drawer
  ↓
FE-008 账号列表页 (/accounts)
  ↓
FE-009 账号详情头部组件
  ↓
FE-010 视频列表组件
  ↓
FE-011 视频详情 Dialog
  ↓
FE-012 账号详情页 (/accounts/[id])
```

---

## 自省报告

### 1. 回顾

本版本设计未引入新的通用模式：
- 三层架构（Route Handler → Service → Repository）沿用现有模式
- CrawlerService 作为 Service 层标准封装，与架构规范中描述的 `crawler.service.ts` 一致
- 数据隔离继续使用 `organizationId` 反规范化 + Repository 层过滤
- 新增的图片代理 API 是简单的 Route Handler，无架构影响

### 2. 检查

| 文档 | 一致性 | 说明 |
|------|--------|------|
| `docs/architecture/OVERVIEW.md` | ✅ 一致 | CrawlerService 已在架构图中标注 |
| `docs/architecture/backend.md` | ✅ 一致 | 遵循三层架构 + CrawlerService 规范 |
| `docs/architecture/frontend.md` | ✅ 一致 | 遵循组件层次 + 弹框优先原则 |
| `docs/architecture/database.md` | ✅ 一致 | 模型遵循命名规范 + 必备字段 + 数据隔离 |
| `docs/architecture/api-conventions.md` | ✅ 一致 | RESTful 风格 + 统一响应格式 |
| `docs/architecture/project-structure.md` | ✅ 一致 | 文件放置符合目录约定 |
| `docs/standards/ui-ux-system.md` | ✅ 一致 | 卡片、空状态、Drawer 等遵循设计系统 |
| `docs/standards/coding-standards.md` | ✅ 一致 | 命名规范、类型规则均遵循 |

### 3. 提议

无需更新全局架构文档。本版本设计完全符合现有架构约定，未引入 `[ARCH-CHANGE]`。

**建议更新**（非阻塞，可在版本完成后执行）：
- `docs/architecture/project-structure.md` — 目录树中 `accounts/` 和 `douyin-account/` 已在规划中标注，无需更新
- `src/middleware.ts` 的 `config.matcher` — 在 FE-003 任务中更新
