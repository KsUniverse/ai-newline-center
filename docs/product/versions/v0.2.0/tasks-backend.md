# v0.2.0 后端任务清单

> 版本: v0.2.0
> 责任角色: @backend
> 技术方案: [technical-design.md](technical-design.md)

## 必读文档

开始前按序阅读：
1. [docs/INDEX.md](../../../INDEX.md) — 项目状态
2. [docs/product/versions/v0.2.0/requirements.md](requirements.md) — 本版本需求（理解业务背景）
3. [docs/product/versions/v0.2.0/technical-design.md](technical-design.md) — 本版本技术设计
4. [docs/architecture/OVERVIEW.md](../../../architecture/OVERVIEW.md) — 架构总览
5. [docs/architecture/backend.md](../../../architecture/backend.md) — 后端分层规范
6. [docs/architecture/database.md](../../../architecture/database.md) — 数据库设计规范
7. [docs/architecture/api-conventions.md](../../../architecture/api-conventions.md) — API 设计规范
8. [docs/standards/coding-standards.md](../../../standards/coding-standards.md) — 编码规范

---

## 摘要

- **任务总数**: 10
- **新增文件**: 8 个
- **修改文件**: 3 个（`prisma/schema.prisma`, `src/lib/env.ts`, `next.config.ts`）

---

## 任务列表

### BE-001 — Prisma Schema 变更 + 迁移 (P0)

**文件**: `prisma/schema.prisma`

- [x] 新增枚举 `DouyinAccountType { MY_ACCOUNT  BENCHMARK_ACCOUNT }` ✅
- [x] 新增 `DouyinAccount` 模型（详见技术方案 §1.2）✅
  - `id`, `profileUrl` (@unique), `nickname`, `avatar`, `bio`, `followersCount`, `videosCount`
  - `type` (DouyinAccountType, default: MY_ACCOUNT)
  - `userId` + `user` 关系（→ User）
  - `organizationId` + `organization` 关系（→ Organization）
  - `videos` 反向关系（→ DouyinVideo[]）
  - `createdAt`, `updatedAt`, `deletedAt`
  - `@@index([userId])`, `@@index([organizationId])`, `@@map("douyin_accounts")`
- [x] 新增 `DouyinVideo` 模型（详见技术方案 §1.3）✅
  - `id`, `videoId` (@unique), `accountId` + `account` 关系（→ DouyinAccount）
  - `title`, `coverUrl`, `videoUrl`, `publishedAt`
  - `playCount`, `likeCount`, `commentCount`, `shareCount`
  - `createdAt`, `updatedAt`, `deletedAt`
  - `@@index([accountId])`, `@@map("douyin_videos")`
- [x] `User` 模型新增 `douyinAccounts DouyinAccount[]` 反向关系 ✅
- [x] `Organization` 模型新增 `douyinAccounts DouyinAccount[]` 反向关系 ✅
- [x] 执行 `pnpm db:generate` 更新 Prisma Client ✅
- [x] 执行 `pnpm db:migrate --name add_douyin_models` 创建迁移 ✅

**验收**: `prisma/migrations/` 下新增迁移文件，Prisma Client 类型包含 `DouyinAccount`, `DouyinVideo`, `DouyinAccountType`

---

### BE-002 — 环境变量更新 (P0)

**文件**: `src/lib/env.ts`

- [x] 新增 `CRAWLER_API_URL` 字段（`z.string().url().optional()`）✅
- [x] 在 `superRefine` 中新增生产环境校验：`NODE_ENV === "production"` 时 `CRAWLER_API_URL` 必填 ✅

**验收**: 开发环境不设置 `CRAWLER_API_URL` 不报错；生产环境缺失则报 Zod 校验错误

---

### BE-003 — CrawlerService 爬虫封装 (P0)

**新建文件**: `src/server/services/crawler.service.ts`

- [x] 实现 `CrawlerService` 类 ✅
- [x] `fetchDouyinProfile(profileUrl)` 方法 ✅：
  - 当 `NODE_ENV === "development"` 且 `CRAWLER_API_URL` 未配置时，返回模拟数据
  - 否则调用 `callCrawlerApi("/douyin/user/profile", { profileUrl })`
- [x] `callCrawlerApi<T>(path, payload)` 私有方法 ✅：
  - 调用 `${env.CRAWLER_API_URL}${path}`，POST body 为 payload
  - 含自动重试（最多 2 次重试，间隔递增 1s/2s）
  - 失败时抛 `AppError("CRAWLER_ERROR", "爬虫服务调用失败，请稍后重试", 502)`
- [x] `mockProfile(profileUrl)` 私有方法：返回模拟的 `AccountPreview` 数据 ✅
- [x] 导出单例 `crawlerService` ✅

**要点**:
- 返回类型 `AccountPreview`（详见技术方案 §2.2）
- 遵循 Service 层规范（见 `docs/architecture/backend.md`）
- 模拟数据生成合理的随机粉丝数和作品数

---

### BE-004 — DouyinAccountRepository (P0)

**新建文件**: `src/server/repositories/douyin-account.repository.ts`

- [x] `findByProfileUrl(profileUrl)` — 按主页链接查找（去重检测）✅
- [x] `findById(id)` — 按 ID 查询单个账号，含 `user { id, name }` 关联 ✅
- [x] `findMany(params: { userId?, organizationId?, page, limit })` — 分页列表查询 ✅
  - `userId` 和 `organizationId` 为可选过滤条件（按角色传入不同参数）
  - 仅查询 `deletedAt = null` 的记录
  - 按 `createdAt desc` 排序
  - 返回 `{ items, total, page, limit }`
- [x] `create(data)` — 创建账号（type 固定为 `MY_ACCOUNT`）✅
- [x] 所有方法支持 `db: DatabaseClient = prisma` 参数（与现有 Repository 模式一致）✅

**要点**:
- 参照 `organization.repository.ts` 的代码风格
- `findMany` 返回 `PaginatedData<DouyinAccount>` 格式

---

### BE-005 — DouyinVideoRepository (P0)

**新建文件**: `src/server/repositories/douyin-video.repository.ts`

- [x] `findByAccountId(params: { accountId, page, limit })` — 按账号 ID 分页查询视频 ✅
  - 仅查询 `deletedAt = null`
  - 按 `publishedAt desc` 排序（null 排最后）
  - 返回 `{ items, total, page, limit }`
- [x] `findById(id)` — 按 ID 查询单条视频 ✅
- [x] 导出单例 `douyinVideoRepository` ✅

**要点**:
- v0.2.0 阶段该 Repository 返回的数据为空（`DouyinVideo` 表无数据），但需验证查询逻辑正确
- 预留 `create` / `createMany` 方法签名供 v0.2.1 使用（可选，不影响 v0.2.0 验收）

---

### BE-006 — DouyinAccountService (P0)

**新建文件**: `src/server/services/douyin-account.service.ts`

- [x] `previewAccount(profileUrl)` — 调用 `crawlerService.fetchDouyinProfile`，返回 `AccountPreview` ✅
- [x] `createAccount(caller, data)` — 添加账号逻辑 ✅：
  - 仅 EMPLOYEE 可调用（Service 层内部检查）
  - 检查 `profileUrl` 全局唯一（调用 `repo.findByProfileUrl`），已存在则抛 `AppError("ACCOUNT_EXISTS", "该账号已被添加", 409)`
  - 调用 `repo.create`，自动填入 `userId: caller.id`, `organizationId: caller.organizationId`, `type: MY_ACCOUNT`
- [x] `listAccounts(caller, params: PaginationParams)` — 列表查询 ✅：
  - EMPLOYEE: 传入 `userId = caller.id`
  - BRANCH_MANAGER: 传入 `organizationId = caller.organizationId`
  - SUPER_ADMIN: 不传过滤条件
- [x] `getAccountDetail(caller, id)` — 获取单个账号详情 ✅：
  - 查询账号 → 不存在抛 404
  - 权限校验：EMPLOYEE 需 `userId === caller.id`；BRANCH_MANAGER 需 `organizationId === caller.organizationId`；SUPER_ADMIN 无限制
  - 不满足则抛 403
- [x] `listVideos(caller, accountId, params: PaginationParams)` — 获取账号下视频列表 ✅：
  - 先调用 `getAccountDetail(caller, accountId)` 做权限校验
  - 再调用 `douyinVideoRepository.findByAccountId`
- [x] 导出单例 `douyinAccountService` ✅

**要点**:
- `caller` 类型为 `{ id: string; role: UserRole; organizationId: string }`（从 session 中提取）
- 参照 `organization.service.ts` 的代码风格

---

### BE-007 — 爬虫预览 API (P0)

**新建文件**: `src/app/api/douyin-accounts/preview/route.ts`

- [x] `POST` handler ✅:
  - `auth()` 获取 session
  - `requireRole(session, UserRole.EMPLOYEE)` — 仅员工可调用
  - Zod 验证 `previewAccountSchema`（`profileUrl` 必须为合法抖音主页 URL）
  - 调用 `douyinAccountService.previewAccount(data.profileUrl)`
  - 返回 `successResponse(preview)`

**Zod schema**:
```typescript
const previewAccountSchema = z.object({
  profileUrl: z.string().url("请输入合法的 URL").regex(
    /^https?:\/\/(www\.)?douyin\.com\/user\/.+$/,
    "请输入合法的抖音主页链接"
  ),
});
```

---

### BE-008 — 账号列表 + 创建 API (P0)

**新建文件**: `src/app/api/douyin-accounts/route.ts`

- [x] `GET` handler（账号列表）✅:
  - `auth()` 获取 session
  - `requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE)`
  - 解析 query params（page, limit）
  - 调用 `douyinAccountService.listAccounts(caller, { page, limit })`
  - 返回 `successResponse(result)`
- [x] `POST` handler（添加账号）✅:
  - `auth()` 获取 session
  - `requireRole(session, UserRole.EMPLOYEE)` — 仅员工可创建
  - Zod 验证 `createAccountSchema`
  - 调用 `douyinAccountService.createAccount(caller, data)`
  - 返回 `successResponse(account, 201)`

**Zod schema**:
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

---

### BE-009 — 账号详情 + 视频列表 API (P0)

**新建文件**:
- `src/app/api/douyin-accounts/[id]/route.ts`
- `src/app/api/douyin-accounts/[id]/videos/route.ts`

#### `[id]/route.ts` — 账号详情

- [x] `GET` handler ✅:
  - `auth()` + `requireRole(session, SUPER_ADMIN, BRANCH_MANAGER, EMPLOYEE)`
  - 调用 `douyinAccountService.getAccountDetail(caller, params.id)`
  - 返回 `successResponse(account)`

#### `[id]/videos/route.ts` — 视频列表

- [x] `GET` handler ✅:
  - `auth()` + `requireRole(session, SUPER_ADMIN, BRANCH_MANAGER, EMPLOYEE)`
  - 解析 query params（page, limit）
  - 调用 `douyinAccountService.listVideos(caller, params.id, { page, limit })`
  - 返回 `successResponse(result)`

---

### BE-010 — 图片代理 API (P0)

**新建文件**: `src/app/api/proxy/image/route.ts`

- [x] `GET` handler ✅:
  - 从 query 获取 `url` 参数
  - 缺失 `url` 返回 400
  - 白名单域名校验（仅允许 `*.douyinpic.com` 域名），非白名单返回 403
  - 使用 `fetch(url, { headers: { Referer: "https://www.douyin.com/" } })` 代理请求
  - 转发 response body，设置 `Content-Type` 和 `Cache-Control: public, max-age=86400`
- [x] **修改** `next.config.ts`: 新增 `images.remotePatterns` 配置（详见技术方案 §6.4）✅

**安全要点**:
- 严格白名单域名校验，防止 SSRF 攻击
- 仅代理 GET 请求，不支持其他 HTTP 方法
- URL 解析使用 `new URL()` 并 catch 异常

---

## 完成标准

- [x] 所有 BE-001 ~ BE-010 任务完成 ✅
- [x] `pnpm type-check` 无错误 ✅
- [x] `pnpm lint` 无错误 ✅
- [x] `pnpm db:generate` 成功 ✅
- [ ] 所有 API 端点可通过 curl/Postman 手动测试：
  - POST /api/douyin-accounts/preview 返回模拟/真实账号信息
  - POST /api/douyin-accounts 成功创建账号
  - GET /api/douyin-accounts 返回账号列表（按角色过滤）
  - GET /api/douyin-accounts/[id] 返回账号详情
  - GET /api/douyin-accounts/[id]/videos 返回空视频列表
  - GET /api/proxy/image?url=... 成功代理图片
- [ ] 重复添加同一 profileUrl 返回 409 ACCOUNT_EXISTS

---

## 自省报告（后端开发完成后填写）

<!-- 完成后在此填写：遇到的问题、偏离技术方案的决策、以及对下个版本的改进提议 -->

### 已完成自省

1. `CRAWLER_API_URL` 在开发环境允许为空，并通过 `CrawlerService` 自动回退到 mock 数据，便于前端先联调。
2. `DouyinVideoRepository` 目前只实现读取接口；写入接口保留到 `v0.2.1` 的同步任务阶段，符合当前范围。
3. `db:migrate` 已成功创建 `add_douyin_models` 迁移，但由于本地有运行中的 Next 开发进程，Prisma 在迁移后的二次 generate 阶段打印过一次引擎文件 `EPERM rename`；随后单独执行 `pnpm db:generate` 已成功。

### 建议更新的文档

1. `docs/product/versions/v0.2.0/technical-design.md`
   - **修改**: 明确 `CRAWLER_API_URL` 在开发环境为空时走 mock 数据的前提条件是 `NODE_ENV === "development"`
   - **原因**: 该行为已经实现，建议在技术文档中强调为正式约定

### 当前未覆盖

1. API 端点还未做基于真实登录态的 curl/Postman 手动验收
2. 图片代理 API 还未做真实 douyin 图片链接联调，仅完成代码实现与静态验证
