# v0.3.2.2 后端任务清单

## 必读文档

> 开始开发前必须阅读以下文档：

- `docs/product/versions/v0.3.2.2/requirements.md` — 本版本需求（理解业务背景）
- `docs/product/versions/v0.3.2.2/technical-design.md` — 本版本技术设计
- `docs/architecture/backend.md` — 后端分层规范
- `docs/architecture/database.md` — 数据库设计规范
- `docs/architecture/api-conventions.md` — API 设计规范
- `docs/standards/coding-standards.md` — 编码规范

## 摘要

- **任务总数**: 7
- **涉及文件（新增）**:
  - `src/lib/crypto.ts`
  - `src/lib/env.ts`（修改）
  - `prisma/schema.prisma`（修改）
  - `prisma/migrations/<timestamp>_add_crawler_cookie/`
  - `src/server/repositories/crawler-cookie.repository.ts`
  - `src/server/services/crawler-cookie.service.ts`
  - `src/server/services/crawler.service.ts`（修改）
  - `src/app/api/settings/crawler-cookies/route.ts`
  - `src/app/api/settings/crawler-cookies/[id]/route.ts`
  - `src/types/crawler-cookie.ts`
  - `src/lib/management-client.ts`（修改）

---

## 任务列表

### B-001 (P0) 环境变量 + 加密工具

**描述**: 在 `env.ts` 中注册两个新环境变量，并实现 AES-256-GCM 加解密工具函数。

**涉及文件**:
- `src/lib/env.ts`
- `src/lib/crypto.ts`（新建）

**实现要点**:

1. **`src/lib/env.ts`** — 在 `envSchema` 的 `z.object({...})` 内追加两个字段：
   ```typescript
   CRAWLER_COOKIE: z.string().optional(),
   CRAWLER_COOKIE_ENCRYPTION_KEY: z.string().regex(
     /^[0-9a-fA-F]{64}$/,
     "CRAWLER_COOKIE_ENCRYPTION_KEY 必须为 64 位十六进制字符串",
   ),
   ```
   无需修改 `superRefine`（这两个字段在所有环境强制生效规则）。

2. **`src/lib/crypto.ts`** — 实现以下两个函数（使用 Node.js `node:crypto`）：
   ```typescript
   // 加密：每次生成随机 12 字节 IV
   // 返回格式 "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
   export function encryptCookieValue(plaintext: string): string

   // 解密：按格式拆分后 AES-256-GCM 解密
   // 失败（格式错误/认证失败）抛 AppError("CRYPTO_ERROR", "Cookie 解密失败", 500)
   export function decryptCookieValue(encrypted: string): string
   ```
   - Key 来源: `Buffer.from(env.CRAWLER_COOKIE_ENCRYPTION_KEY, "hex")`（32 字节）
   - IV: `crypto.randomBytes(12)`
   - AuthTag: `cipher.getAuthTag()`（16 字节）
   - 算法: `"aes-256-gcm"`
   - **禁止**在任何 `console.log` 中输出 `plaintext`

**完成标准**:
- [ ] `pnpm type-check` 通过
- [ ] 运行 `src/lib/env.ts` 导入时，缺少 `CRAWLER_COOKIE_ENCRYPTION_KEY` 会在启动时抛出错误
- [ ] `encryptCookieValue` 的输出经 `decryptCookieValue` 能还原原文
- [ ] 给一个被篡改的密文调用 `decryptCookieValue` 时，抛出 `AppError("CRYPTO_ERROR", ...)`

---

### B-002 (P0) Prisma Schema 变更 + 迁移

**描述**: 在 `prisma/schema.prisma` 中新增 `CrawlerCookie` 模型并执行迁移。

**涉及文件**:
- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_add_crawler_cookie/migration.sql`（自动生成）

**实现要点**:

1. 在 `schema.prisma` 末尾（或合适位置）新增模型：
   ```prisma
   model CrawlerCookie {
     id             String       @id @default(cuid())
     organizationId String
     organization   Organization @relation(fields: [organizationId], references: [id])
     value          String       @db.Text
     createdAt      DateTime     @default(now())
     updatedAt      DateTime     @updatedAt

     @@index([organizationId, createdAt])
     @@map("crawler_cookies")
   }
   ```

2. 在 `Organization` 模型中追加关联字段：
   ```prisma
   crawlerCookies CrawlerCookie[]
   ```

3. 执行迁移命令：
   ```bash
   pnpm db:migrate --name add_crawler_cookie
   pnpm db:generate
   ```

**完成标准**:
- [ ] `prisma/migrations/` 下生成新迁移文件，SQL 包含 `CREATE TABLE crawler_cookies`
- [ ] `pnpm db:generate` 成功，Prisma Client 包含 `crawlerCookie` 模型操作
- [ ] `pnpm type-check` 通过（无 Prisma 类型错误）

---

### B-003 (P0) CrawlerCookieRepository

**描述**: 实现 `CrawlerCookie` 的数据访问层，提供 CRUD 操作，Repository 内部完成加解密和脱敏。

**涉及文件**:
- `src/server/repositories/crawler-cookie.repository.ts`（新建）

**实现要点**:

参考 `src/server/repositories/ai-model-config.repository.ts` 的模式（DTO 转换在 Repository 内完成）：

```typescript
// 脱敏函数（非导出）
function maskCookieValue(plaintext: string): string {
  if (plaintext.length <= 30) return plaintext.slice(0, 3) + "...";
  return plaintext.slice(0, 20) + "..." + plaintext.slice(-10);
}

class CrawlerCookieRepository {
  // 对外返回 CrawlerCookieDTO（valueRedacted 字段，原文不出现在 DTO 中）
  async findAllByOrganization(organizationId: string): Promise<CrawlerCookieDTO[]>

  // 内部用：原始记录（含加密 value），用于 CrawlerService 读取解密
  async findRawByOrganization(organizationId: string): Promise<Array<{ id: string; value: string }>>

  // 写入时加密
  async create(organizationId: string, plaintextValue: string): Promise<CrawlerCookieDTO>

  // 删除时同时校验 organizationId，防越权
  async delete(id: string, organizationId: string): Promise<boolean>

  // 批量删除：WHERE id IN (...) AND organizationId = ?，返回实际删除数量
  async deleteMany(ids: string[], organizationId: string): Promise<number>
}

export const crawlerCookieRepository = new CrawlerCookieRepository();
```

**关键约束**:
- `findAllByOrganization` 按 `createdAt ASC` 排序（与轮询顺序一致）
- `create` 内部调用 `encryptCookieValue(plaintextValue)` 后存入 `value` 字段
- `findAllByOrganization` 对每条记录先 `decryptCookieValue(record.value)` 后 `maskCookieValue(plain)` 生成 `valueRedacted`
- `findRawByOrganization` 返回原始加密 value，**不**解密（解密在 CrawlerService 调用处进行，避免批量解密浪费）
- `deleteMany` 使用 `prisma.crawlerCookie.deleteMany({ where: { id: { in: ids }, organizationId } })` 并返回 `count`

**完成标准**:
- [ ] `pnpm type-check` 通过
- [ ] 手动测试（或单测）：create 后 findAllByOrganization 能返回脱敏结果
- [ ] deleteMany 传入跨 org 的 id 时，只删当前 org 的记录，返回正确 count
- [ ] 不同 organizationId 数据互相隔离

---

### B-004 (P0) CrawlerCookieService

**描述**: 实现 Cookie 管理的业务逻辑层，包含权限校验（仅 SUPER_ADMIN）、Redis 归零副作用，以及 DTO 组装。

**涉及文件**:
- `src/server/services/crawler-cookie.service.ts`（新建）

**实现要点**:

```typescript
import { crawlerCookieRepository } from "@/server/repositories/crawler-cookie.repository";
import { AppError } from "@/lib/errors";
import type { CrawlerCookieDTO } from "@/types/crawler-cookie";

class CrawlerCookieService {
  // 列表（仅 SUPER_ADMIN 可调用，在 Route Handler 层已校验角色，Service 层不重复校验）
  async list(organizationId: string): Promise<CrawlerCookieDTO[]>

  // 新增
  async create(organizationId: string, plaintextValue: string): Promise<CrawlerCookieDTO>

  // 删除单条 + Redis 归零
  async delete(id: string, organizationId: string): Promise<{ deletedCount: number }>

  // 批量删除 + Redis 归零
  async deleteMany(ids: string[], organizationId: string): Promise<{ deletedCount: number }>

  // 内部：归零 Redis 计数器和指针
  private async resetRedisState(organizationId: string): Promise<void>
}

export const crawlerCookieService = new CrawlerCookieService();
```

**Redis 归零实现**:
- `resetRedisState` 通过 `createPubSubRedisClient()` 获取连接（或复用 CrawlerService 的单例，推荐简单做法是每次按需创建，生产中可接受）。
- **更简单的方案**：在 `CrawlerCookieService` 中直接导入 `env`，若 `env.REDIS_URL` 存在，则 `new IORedis(env.REDIS_URL)` 并调用 `del(counterKey, pointerKey)`，调用后关闭连接或复用。
- 推荐：将 Redis 连接的创建封装成 `getRedisClient()` 懒单例，在 `src/lib/redis.ts` 中导出（见 B-005 说明），Service 直接调用该函数。

**`delete` / `deleteMany` 流程**:
1. 调用 Repository 执行删除（含 org 隔离校验）
2. 若出现 `deletedCount === 0`（且 ids 非空），抛 `AppError("NOT_FOUND", "Cookie 不存在或无权操作", 404)`
3. 调用 `resetRedisState(organizationId)`（即使 Redis 不可用也不影响主流程，try-catch 吞异常并 warn）

**完成标准**:
- [ ] `pnpm type-check` 通过
- [ ] 删除后 Redis 对应 Key 被清除（可通过 Redis CLI 验证）
- [ ] 传入跨 org 的 ids 时，Service 不报错（Repository 层自动过滤），但 deletedCount 为 0 时正确报 NOT_FOUND

---

### B-005 (P0) CrawlerService 改造（Cookie 轮询）

**描述**: 在 `CrawlerService.callCrawlerApi` 中集成 Cookie 计数/轮询逻辑，公开方法签名追加可选 `organizationId`。

**涉及文件**:
- `src/server/services/crawler.service.ts`（修改）
- `src/lib/redis.ts`（修改：导出懒单例 getter）

**`src/lib/redis.ts` 改动**:

追加一个懒单例 getter，供 Service 层复用：

```typescript
let _redisClient: IORedis | null = null;

export function getSharedRedisClient(): IORedis | null {
  if (!env.REDIS_URL) return null;
  if (!_redisClient) {
    _redisClient = new IORedis(env.REDIS_URL);
  }
  return _redisClient;
}
```

**CrawlerService 改动清单**:

1. **`callCrawlerApi` 签名** — `options` 新增 `organizationId?: string`。

2. **`callCrawlerApi` 开头**（在 for-retry 循环前）— 若 `options.organizationId` 存在，调用 `await this.maybeRotateCookie(options.organizationId)`。

3. **新增私有方法 `maybeRotateCookie(organizationId: string)`**:
   ```
   1. redis = getSharedRedisClient()；若为 null 则 return
   2. count = await redis.incr(`crawler:cookie:counter:${organizationId}`)
   3. 若 count % 5 !== 0 则 return
   4. 从 crawlerCookieRepository.findRawByOrganization(organizationId) 获取 cookies
   5. 若 cookies.length === 0 则 return
   6. currentPointer = parseInt(await redis.get(...) ?? "0", 10)
   7. nextPointer = (currentPointer + 1) % cookies.length
   8. await redis.set(`crawler:cookie:pointer:${organizationId}`, String(nextPointer))
   9. plainCookie = decryptCookieValue(cookies[nextPointer].value)
   10. void this.callUpdateCookieApi(plainCookie)   ← 不 await
   ```

4. **新增私有方法 `callUpdateCookieApi(cookie: string)`**:
   ```
   - 若 !env.CRAWLER_API_URL 则直接 return（warn 日志）
   - POST `${env.CRAWLER_API_URL}/api/hybrid/update_cookie`
   - body: JSON.stringify({ service: "douyin_web", cookie })
   - AbortSignal.timeout(3000)
   - 失败时 console.warn("[CrawlerService] update_cookie failed", ...)，不 throw
   - 明文 cookie 不得出现在日志中（只记录错误信息，不记录 cookie 参数）
   ```

5. **公开方法签名** — 在以下方法末尾追加可选 `organizationId?: string`，并将其透传给 `callCrawlerApi` 的 `options.organizationId`：
   - `getSecUserId(url, organizationId?)`
   - `fetchUserProfile(secUserId, organizationId?)`
   - `fetchVideoList(secUserId, cursor?, count?, options?, organizationId?)`
   - `fetchCollectionVideos(input, organizationId?)`
   - `fetchOneVideo(awemeId, options?, organizationId?)`

6. **现有调用点不需要修改** — 所有调用方（BullMQ workers、其他 Service）继续使用无 `organizationId` 的调用，轮询逻辑自动跳过。

**完成标准**:
- [ ] `pnpm type-check` 通过
- [ ] 现有测试（若有）通过，无回归
- [ ] Cookie 池有 2 条记录时，第 5 次带 orgId 的调用触发 `update_cookie`（可通过日志验证）
- [ ] Cookie 池为空时，不触发 `update_cookie`，请求正常
- [ ] `organizationId` 未传时，任何 Redis/DB 操作均不触发

---

### B-006 (P0) API Route Handlers

**描述**: 实现 4 个 API 端点，均要求 session 校验 + `SUPER_ADMIN` 角色。

**涉及文件**:
- `src/app/api/settings/crawler-cookies/route.ts`（新建）
- `src/app/api/settings/crawler-cookies/[id]/route.ts`（新建）

**参考**: `src/app/api/` 下任意现有 Route Handler 文件（如用户或组织管理相关）。

**`route.ts` 实现**:

```typescript
// GET /api/settings/crawler-cookies
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return handleApiError(new AppError("UNAUTHORIZED", "未登录", 401));
    if (session.user.role !== "SUPER_ADMIN") return handleApiError(new AppError("FORBIDDEN", "无权限", 403));
    const items = await crawlerCookieService.list(session.user.organizationId);
    return successResponse(items);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/settings/crawler-cookies
const createSchema = z.object({ value: z.string().min(1, "Cookie 值不能为空") });
export async function POST(request: NextRequest) { ... return successResponse(item, 201); }

// DELETE /api/settings/crawler-cookies （批量）
const deleteSchema = z.object({ ids: z.array(z.string().cuid()).min(1) });
export async function DELETE(request: NextRequest) { ... }
```

**`[id]/route.ts` 实现**:

```typescript
// DELETE /api/settings/crawler-cookies/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) { ... }
```

**角色校验规则**: 本版功能仅限 `SUPER_ADMIN`（与现有 AI 配置保持一致）。非 SUPER_ADMIN 返回 403。

**完成标准**:
- [ ] `pnpm type-check` + `pnpm lint` 通过
- [ ] `GET /api/settings/crawler-cookies` 未登录时返回 401，非 ADMIN 返回 403
- [ ] `POST` 成功创建后返回 201 + 脱敏 DTO
- [ ] `DELETE /api/.../[id]` 删除不属于本 org 的 id 时返回 404
- [ ] `DELETE /api/...` 批量删除，body 缺少 `ids` 时返回 400

---

### B-007 (P0) 类型定义 + management-client 追加

**描述**: 新增共享类型文件，在 `management-client.ts` 中追加 crawler cookie 相关方法，供前端直接导入使用。

**涉及文件**:
- `src/types/crawler-cookie.ts`（新建）
- `src/lib/management-client.ts`（修改）

**`src/types/crawler-cookie.ts`**:

```typescript
export interface CrawlerCookieDTO {
  id: string;
  valueRedacted: string;
  createdAt: string;
}

export interface CreateCrawlerCookieInput {
  value: string;
}

export interface DeleteCrawlerCookiesInput {
  ids: string[];
}
```

**`src/lib/management-client.ts`** 追加（在 `export const managementClient = { ... }` 对象内）:

```typescript
// 需要先 import 类型
listCrawlerCookies(): Promise<CrawlerCookieDTO[]> {
  return apiClient.get<CrawlerCookieDTO[]>("/settings/crawler-cookies");
},
createCrawlerCookie(input: CreateCrawlerCookieInput): Promise<CrawlerCookieDTO> {
  return apiClient.post<CrawlerCookieDTO>("/settings/crawler-cookies", input);
},
deleteCrawlerCookie(id: string): Promise<{ deletedCount: number }> {
  return apiClient.del<{ deletedCount: number }>(`/settings/crawler-cookies/${id}`);
},
deleteCrawlerCookies(input: DeleteCrawlerCookiesInput): Promise<{ deletedCount: number }> {
  return apiClient.del<{ deletedCount: number }>("/settings/crawler-cookies", {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
  } as RequestInit);
},
```

> 注意：`apiClient.del` 当前签名为 `del<T>(path, options?)` — 若不支持 body，需在 `api-client.ts` 中补充 `delWithBody` 或修改 `del` 支持传 options（含 body）。检查 `api-client.ts` 现有签名后决定方案。

**完成标准**:
- [ ] `pnpm type-check` 通过
- [ ] 前端可从 `@/lib/management-client` 正确导入并调用这 4 个方法
- [ ] `CrawlerCookieDTO` 类型与 API 响应 DTO 一致
