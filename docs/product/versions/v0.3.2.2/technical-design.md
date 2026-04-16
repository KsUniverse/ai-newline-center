# v0.3.2.2 技术设计方案

## 摘要

- **涉及模块**: 系统设置导航、爬虫 Cookie 管理、CrawlerService 轮询改造
- **新增模型**: `CrawlerCookie`
- **新增 API**: `GET/POST/DELETE /api/settings/crawler-cookies`, `DELETE /api/settings/crawler-cookies/[id]`
- **新增页面/组件**: `/settings/crawler-cookies` 页面 + 相关功能组件
- **架构变更**: `[ARCH-CHANGE]` CrawlerService 内部直接持有 Redis 客户端（见第 5 节）; 导航结构从纯平铺升级为支持分组（见第 7 节）

---

## 1. 数据库变更

### 新增 Prisma 模型：`CrawlerCookie`

```prisma
model CrawlerCookie {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  value          String       @db.Text   // AES-256-GCM 加密后的密文（格式见第 3 节）
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([organizationId, createdAt])
  @@map("crawler_cookies")
}
```

**设计说明**：
- 不加 `deletedAt`（Cookie 无需软删除，删了就删）
- 复合索引 `(organizationId, createdAt)` 支持按组织拉取全量并按创建时间升序排列（与轮询顺序一致）
- `value` 字段使用 `@db.Text` 存储加密密文，长度不确定且通常较长

### `Organization` 模型关联追加

在 `Organization` 模型中添加：

```prisma
crawlerCookies CrawlerCookie[]
```

---

## 2. 环境变量变更

在 `src/lib/env.ts` 的 `envSchema` 中新增以下两个字段：

```typescript
// 降级兜底 Cookie（可选，不由本应用管理，由运维直接配置到爬虫 API 侧）
CRAWLER_COOKIE: z.string().optional(),

// Cookie 加密密钥，64 位十六进制字符串（= 32 字节 AES key）
CRAWLER_COOKIE_ENCRYPTION_KEY: z
  .string()
  .regex(
    /^[0-9a-fA-F]{64}$/,
    "CRAWLER_COOKIE_ENCRYPTION_KEY 必须为 64 位十六进制字符串",
  ),
```

**为何必填**：`CRAWLER_COOKIE_ENCRYPTION_KEY` 设计为必填项，原因如下：

1. 若设为可选，当未配置时无法加密任何 Cookie，功能完全不可用，但不会在启动时报错，会在运行时静默失败 —— 这是更差的体验。
2. 设为必填后，若部署环境未配置，应用在启动时立刻抛出 Zod 校验错误，运维能立即感知并修复。
3. 生成密钥的命令简单：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 。

**生产环境约束**：通过 `superRefine` 在现有校验基础上自动生效（`envSchema.parse(process.env)` 在模块加载时执行）。

---

## 3. 加密方案

### 文件：`src/lib/crypto.ts`

使用 Node.js 内置 `crypto` 模块，AES-256-GCM 对称加密：

```typescript
// 密文格式（均为 hex，以 ":" 分隔）：
// <iv_hex>:<authTag_hex>:<ciphertext_hex>
// - iv:       12 字节（96-bit，GCM 推荐）
// - authTag:  16 字节（128-bit）
// - ciphertext: 任意长度

export function encryptCookieValue(plaintext: string): string
export function decryptCookieValue(encrypted: string): string
```

**关键实现要点**：
- 每次加密生成随机 IV（`crypto.randomBytes(12)`），不可复用
- Key 通过 `Buffer.from(env.CRAWLER_COOKIE_ENCRYPTION_KEY, "hex")` 载入
- 使用 `crypto.createCipheriv("aes-256-gcm", key, iv)` + `cipher.getAuthTag()`
- 解密时先拆分密文格式，`createDecipheriv` + `decipher.setAuthTag(authTag)` 后 decrypt
- 解密失败（如密文被篡改）会抛出 `AppError("CRYPTO_ERROR", "Cookie 解密失败", 500)`
- **明文决不落日志**：调用方（Repository / CrawlerService）不得 `console.log` 解密结果

---

## 4. Redis 设计

### Key 规范

| Key | 类型 | 说明 |
|-----|------|------|
| `crawler:cookie:counter:{organizationId}` | String (整数) | 累计爬虫请求计数，原子 INCR |
| `crawler:cookie:pointer:{organizationId}` | String (整数) | 当前使用的 Cookie 在池中的索引（0-based） |

两个 Key 均不设 TTL（持久化），服务重启后轮询状态自动恢复。

### 操作说明

| 操作 | 时机 | 命令 |
|------|------|------|
| 计数 | 每次 `callCrawlerApi`（有 orgId）触发 | `INCR crawler:cookie:counter:{orgId}` |
| 读指针 | 需要获取当前 Cookie 时 | `GET crawler:cookie:pointer:{orgId}` |
| 写指针 | 切换 Cookie 时 | `SET crawler:cookie:pointer:{orgId} {newPointer}` |
| 归零 | 删除 Cookie 后 | `DEL crawler:cookie:counter:{orgId}` + `DEL crawler:cookie:pointer:{orgId}` |

### 并发安全

- `INCR` 是 Redis 原子操作，多 Worker 场景下计数准确
- `pointer` 更新和 `update_cookie` 调用之间有非原子窗口（可能多 Worker 同时触发切换），但影响仅为同 Cookie 多调几次 `update_cookie`，属可接受的最终一致

---

## 5. CrawlerService 改造方案

### [ARCH-CHANGE] 说明

当前架构规范中，Service 层不直接操作 Redis（Redis 用于 BullMQ 队列后端）。本版 `CrawlerService` 需要直接持有一个 IORedis 实例用于计数和指针管理。

**变更理由**：
1. Cookie 轮询是 CrawlerService 自身的内部状态机，属于该服务的基础设施职责。
2. 引入额外的 Repository 层（如 `CrawlerCookieRedisRepository`）处理简单 INCR/GET/SET 是过度设计。
3. Redis 客户端在 CrawlerService 内部懒初始化（私有字段），不对外暴露，隔离良好。

**向后兼容保障**：所有公开方法的现有签名不变，`organizationId` 作为可选末尾参数追加，默认 `undefined`。当未传入时，计数/轮询逻辑全部跳过，行为与改造前完全一致。

### 改造后关键签名

```typescript
class CrawlerService {
  // ── 公开方法（organizationId 为新增可选参数，不影响现有调用点）──
  async getSecUserId(url: string, organizationId?: string): Promise<string>
  async fetchUserProfile(secUserId: string, organizationId?: string): Promise<CrawlerUserProfile>
  async fetchVideoList(secUserId: string, cursor?: number, count?: number, options?: ShareResolveRequestOptions, organizationId?: string): Promise<CrawlerVideoListResult>
  async fetchCollectionVideos(input: FetchCollectionVideosInput, organizationId?: string): Promise<CrawlerCollectionResult>
  async fetchOneVideo(awemeId: string, options?: ShareResolveRequestOptions, organizationId?: string): Promise<CrawlerVideoDetail>

  // ── 私有方法（新增）──
  private get redis(): IORedis | null          // 懒初始化，REDIS_URL 未配置时返回 null
  private async maybeRotateCookie(organizationId: string): Promise<void>
  private async callUpdateCookieApi(cookie: string): Promise<void>  // fire-and-forget, 3s timeout

  // ── 私有方法（改造）──
  private async callCrawlerApi<T>(
    path: string,
    params: Record<string, string | number>,
    options?: { authSensitive?: boolean; requestHeaders?: HeadersInit; organizationId?: string },
  ): Promise<T>
}
```

### Cookie 轮询流程（`maybeRotateCookie`）

```
callCrawlerApi 被调用
  └─ 若 options.organizationId 存在且 REDIS_URL 已配置：
       1. INCR crawler:cookie:counter:{orgId}  → count
       2. 若 count % 5 !== 0 → 直接结束（不切换）
       3. 否则：
          a. 从 crawlerCookieRepository 查全量 cookies（按 createdAt asc）
          b. 若 cookies.length === 0 → 结束（空池不切换）
          c. GET crawler:cookie:pointer:{orgId} → currentPointer (默认 0)
          d. nextPointer = (currentPointer + 1) % cookies.length
          e. SET crawler:cookie:pointer:{orgId} nextPointer
          f. 解密 cookies[nextPointer].value → plainCookie
          g. void callUpdateCookieApi(plainCookie)  ← 异步，不 await，不阻塞主请求
  └─ 继续执行原 callCrawlerApi 逻辑（fetch to crawler API）
```

### `callUpdateCookieApi` 实现要点

- POST `${env.CRAWLER_API_URL}/api/hybrid/update_cookie`
- Body: `{ "service": "douyin_web", "cookie": "<plaintext>" }`
- `AbortSignal.timeout(3000)` —— 超时 3 秒
- 失败时 `console.warn("[CrawlerService] update_cookie failed", ...)` —— 不抛异常，不重试

### 降级策略

| 场景 | 行为 |
|------|------|
| `organizationId` 未传 | 跳过所有计数/轮询，行为与改造前一致 |
| REDIS_URL 未配置 | `this.redis` 返回 null，跳过所有计数/轮询 |
| Cookie 池为空 | 计数后不切换，`update_cookie` 不调用，请求正常发出 |
| `update_cookie` 失败 | `console.warn` 后继续，主请求无影响 |

---

## 6. API 设计

所有接口要求：`auth()` session 校验 + 角色 `SUPER_ADMIN` + `organizationId` 隔离。

### 路由结构

```
src/app/api/settings/crawler-cookies/
  route.ts       ← GET（列表）+ POST（创建）+ DELETE（批量删除）
  [id]/
    route.ts     ← DELETE（单条删除）
```

### GET `/api/settings/crawler-cookies`

**请求**: 无 body，依赖 session 中的 `organizationId`

**响应**:
```typescript
// 200 OK
ApiResponse<CrawlerCookieDTO[]>

interface CrawlerCookieDTO {
  id: string;
  valueRedacted: string;  // 前 20 字符 + "..." + 后 10 字符（原文不出现）
  createdAt: string;      // ISO 8601
}
```

**失败**: 401（未登录）、403（非 ADMIN）

### POST `/api/settings/crawler-cookies`

**请求 body Zod schema**:
```typescript
const createCrawlerCookieSchema = z.object({
  value: z.string().min(1, "Cookie 值不能为空"),
});
```

**响应**:
```typescript
// 201 Created
ApiResponse<CrawlerCookieDTO>
```

**失败**: 400（空值）、401、403

### DELETE `/api/settings/crawler-cookies` （批量删除）

**请求 body Zod schema**:
```typescript
const deleteCrawlerCookiesSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, "至少选择一个 Cookie"),
});
```

**响应**:
```typescript
// 200 OK
ApiResponse<{ deletedCount: number }>
```

**安全要点**: Service 层校验所有 `ids` 均属于当前 `organizationId`（通过 `deleteMany(ids, organizationId)` 在 WHERE 中同时过滤），防止越权删除。

**副作用**: 删除成功后，Service 层调用 `redis.del(counterKey, pointerKey)` 归零 Redis 状态。

### DELETE `/api/settings/crawler-cookies/[id]` （单条删除）

**响应**:
```typescript
// 200 OK
ApiResponse<{ deletedCount: number }>
```

**副作用**: 同批量删除，Redis 归零。

---

## 7. 前端组件树

### 导航结构变更 `[ARCH-CHANGE]`

当前 `APP_NAV_ITEMS` 是纯平铺数组（`AppNavItem[]`）。本版引入分组概念：

```typescript
// src/components/shared/layout/app-navigation.ts

export interface AppNavItem {           // 现有（不变）
  icon: LucideIcon;
  label: string;
  href: string;
  roles: readonly string[];
}

export interface AppNavGroup {          // 新增
  type: "group";
  icon: LucideIcon;
  label: string;
  basePath: string;                     // 用于 active 检测（pathname.startsWith(basePath)）
  roles: readonly string[];
  children: AppNavItem[];
}

export type AppNavEntry = AppNavItem | AppNavGroup;

export function isNavGroup(entry: AppNavEntry): entry is AppNavGroup
export function getVisibleNavEntries(role?: string): readonly AppNavEntry[]
```

`AppSidebar` 改造：增加对 `AppNavGroup` 的渲染（可折叠的分组头 + 缩进的子项列表），默认有 active 子项时自动展开，否则折叠。

**变更理由**：当前平铺模型无法承载 "分组 + 子项" 的 UX 需求；新类型是对现有 `AppNavItem` 的增量扩展，不破坏现有平铺项渲染逻辑。

### 新增导航条目

```typescript
// 追加到 APP_NAV_ENTRIES 中
{
  type: "group",
  icon: Settings,                     // lucide-react
  label: "系统设置",
  basePath: "/settings",
  roles: ["SUPER_ADMIN"],
  children: [
    {
      icon: Cookie,                   // lucide-react
      label: "爬虫 Cookie 管理",
      href: "/settings/crawler-cookies",
      roles: ["SUPER_ADMIN"],
    },
  ],
}
```

### 页面组件树

```
src/app/(dashboard)/settings/crawler-cookies/page.tsx
  └─ <CrawlerCookiePage />
       (src/components/features/settings/crawler-cookie-page.tsx)

       ├─ <DashboardPageShell title="爬虫 Cookie 管理" actions={<AddButton />}>
       │
       ├─ 有数据时：
       │    <CrawlerCookieTable
       │      items={items}
       │      selectedIds={selectedIds}
       │      onSelectChange={...}
       │      onDelete={id => openConfirm("single", id)}
       │    />
       │    (src/components/features/settings/crawler-cookie-table.tsx)
       │
       ├─ 无数据时：
       │    <EmptyState ... />
       │    (复用 src/components/shared/common/empty-state.tsx)
       │
       ├─ <AddCrawlerCookieDialog
       │      open={dialogOpen}
       │      onClose={...}
       │      onCreated={refreshList}
       │    />
       │    (src/components/features/settings/crawler-cookie-add-dialog.tsx)
       │
       └─ <AlertDialog />（单条/批量删除确认，复用 shadcn AlertDialog）
```

---

## 8. 类型定义

### 新增 `src/types/crawler-cookie.ts`

```typescript
export interface CrawlerCookieDTO {
  id: string;
  valueRedacted: string;  // 脱敏后的展示值，不含原文
  createdAt: string;      // ISO 8601
}

export interface CreateCrawlerCookieInput {
  value: string;          // 原文，仅在 POST body 中传输，响应不回传
}

export interface DeleteCrawlerCookiesInput {
  ids: string[];
}
```

### `management-client.ts` 追加

在 `src/lib/management-client.ts` 中追加 crawler cookie 相关方法：

```typescript
// 添加至 managementClient 对象
listCrawlerCookies(): Promise<CrawlerCookieDTO[]>
createCrawlerCookie(input: CreateCrawlerCookieInput): Promise<CrawlerCookieDTO>
deleteCrawlerCookie(id: string): Promise<{ deletedCount: number }>
deleteCrawlerCookies(input: DeleteCrawlerCookiesInput): Promise<{ deletedCount: number }>
```

---

## 9. 跨模块依赖与执行顺序

```
B-001（env + crypto）
  └─ B-002（Prisma model + migration）
       └─ B-003（Repository）
            ├─ B-004（CrawlerCookieService）
            │    └─ B-006（API Route Handlers）
            └─ B-005（CrawlerService 改造）
B-007（Types + managementClient）— 可与 B-003 并行，需在 F-009 前完成
F-002（导航结构）— 独立，可最先做
F-003（导航条目）— 依赖 F-002
F-004 ~ F-008（页面骨架 + 组件）— 依赖 F-002/F-003，可与 B-xxx 并行
F-009（集成 API）— 依赖 B-006 + B-007
```

---

## 10. 自省

### 全局文档同步需求

| 文档 | 需要同步的内容 |
|------|---------------|
| `docs/architecture/frontend.md` 导航壳节 | 补充"导航支持二级分组（AppNavGroup）"说明 |
| `docs/architecture/project-structure.md` | 补充 `src/app/(dashboard)/settings/` 路由目录，`src/lib/crypto.ts`，`src/types/crawler-cookie.ts` |
| `docs/architecture/OVERVIEW.md` `[ARCH-CHANGE]` | 补充"CrawlerService 内部持有 Redis 客户端用于计数/轮询"说明 |
