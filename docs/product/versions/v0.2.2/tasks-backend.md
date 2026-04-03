# v0.2.2 后端任务清单

## 必读文档

> 开始开发前必须阅读以下文档：

- `docs/product/versions/v0.2.2/requirements.md` — 本版本需求（业务背景与验收标准）
- `docs/product/versions/v0.2.2/technical-design.md` — 本版本技术设计（API 契约、算法、类型定义）
- `docs/architecture/backend.md` — 后端三层架构规范（Route Handler → Service → Repository）
- `docs/architecture/database.md` — 数据库设计规范（软删除、organizationId 隔离）
- `docs/architecture/api-conventions.md` — API 设计规范（路径、响应格式、错误码）
- `docs/standards/coding-standards.md` — 编码规范

---

## 摘要

- 任务总数: 10
- Schema 变更: **无**（DouyinAccount.deletedAt 已存在，无需新字段）
- 新增服务: `benchmark-account.service.ts`
- 改造服务: `crawler.service.ts`（fetchCollectionVideos 返回类型）、`sync.service.ts`（新增 runCollectionSync）、`scheduler.ts`（第 4 个 cron）、`env.ts`（新增环境变量）
- 新增 API 路由: `/api/benchmarks/`（6 个 handler）
- 类型变更: `src/types/douyin-account.ts`（新增 2 个 DTO 类型）
- 实现策略: **抽象优先**。`DouyinAccount` 相关查询优先抽取共享 where/include 构建，再暴露 benchmark 语义方法

---

## 任务列表

---

- [ ] **BE-001**: (P0) 新增 `COLLECTION_SYNC_CRON` 环境变量
  - 文件: `src/lib/env.ts`
  - 详情:
    - 在 `envSchema` 的 `z.object({...})` 中新增一行：
      ```typescript
      COLLECTION_SYNC_CRON: z.string().optional(),
      ```
    - 位置：紧接 `VIDEO_SNAPSHOT_CRON` 之后

---

- [ ] **BE-002**: (P0) 改造 `fetchCollectionVideos`，返回结构化类型
  - 文件: `src/server/services/crawler.service.ts`
  - 详情:
    1. 在文件顶部**新增**接口定义（替换现有 `CrawlerCollectionResult = Record<string, unknown>`）：

       ```typescript
       interface CrawlerCollectionItem {
         awemeId: string | null;
         authorSecUserId: string | null;
         collectedAt: Date | null;
       }

       interface CrawlerCollectionResult {
         items: CrawlerCollectionItem[];
         hasMore: boolean;
         cursor: number;
       }
       ```

    2. **改造** `fetchCollectionVideos` 方法实现：
       - 调用爬虫 API：`/api/douyin/web/fetch_user_collection_videos`，参数 `sec_user_id`
       - 先打印完整 raw 响应（`console.info`），再实施字段映射
       - 收藏列表数组：`pickArray(raw, ["aweme_list", "collect_list", "video_list"])`
       - 每条 item 映射：
         - `awemeId`：`pickString(item, ["aweme_id", "awemeId"])`
         - 收藏时间：`pickNumber(item, ["collect_time", "favorited_time", "create_time"])` → `new Date(v * 1000)`（Unix 秒时间戳），若为 null 则返回 null
         - 博主对象：`pickRecord(item, ["author", "author_info"]) ?? {}`
         - `authorSecUserId`：`pickString(authorObj, ["sec_user_id", "sec_uid"])`
       - `hasMore`：`pickBoolean(raw, ["has_more"])` → `?? false`
       - `cursor`：`pickNumber(raw, ["max_cursor", "cursor"])` → `?? 0`
       - **[PENDING-CRAWLER-DETAIL]**：先实际调用一次爬虫，观察 JSON 响应，按实际结构调整 Key 候选列表

    3. 返回 `CrawlerCollectionResult` 类型对象

---

- [ ] **BE-003**: (P0) 新增对标账号所需的 Repository 方法
  - 文件: `src/server/repositories/douyin-account.repository.ts`
  - 详情: 在 `DouyinAccountRepository` 类中新增以下方法，并优先抽取共享查询构建逻辑（如 `buildWhere`、共享 `include` 常量）：

    **a. `findAllMyAccountsForCollection()`**
    ```typescript
    // 用于收藏同步：查询所有 MY_ACCOUNT，secUserId 非空，未删除
    async findAllMyAccountsForCollection(): Promise<DouyinAccount[]>
    // WHERE: type = MY_ACCOUNT AND secUserId IS NOT NULL AND deletedAt IS NULL
    // ORDER BY: createdAt ASC
    ```

    **b. `findBySecUserIdIncludingDeleted(secUserId: string)`**
    ```typescript
    // 查询含已归档记录（不过滤 deletedAt），用于收藏同步去重检查
    async findBySecUserIdIncludingDeleted(secUserId: string): Promise<DouyinAccount | null>
    // WHERE: secUserId = ?（不加 deletedAt 过滤）
    ```

    **c. 新增 `FindManyBenchmarksParams` 接口和 `findManyBenchmarks` 方法**
    ```typescript
    export interface FindManyBenchmarksParams {
      organizationId?: string;
      includeArchived?: boolean; // false → deletedAt IS NULL；true → deletedAt IS NOT NULL
      page: number;
      limit: number;
    }

    // 返回类型: DouyinAccount with user（需新增 DouyinBenchmarkWithUser 类型）
    async findManyBenchmarks(params: FindManyBenchmarksParams): Promise<{
      items: DouyinBenchmarkWithUser[];
      total: number;
      page: number;
      limit: number;
    }>
    ```
    - `DouyinBenchmarkWithUser`：`Prisma.DouyinAccountGetPayload<{ include: { user: { select: { id: true; name: true } } } }>`
    - WHERE 条件：`type = BENCHMARK_ACCOUNT`，`organizationId = ?`（若有），`deletedAt IS NULL`/`IS NOT NULL`（按 includeArchived）
    - 包含 `include: { user: { select: { id: true, name: true } } }`

    **d. `createBenchmark(data)`**
    ```typescript
    // type 在此方法内部固定为 BENCHMARK_ACCOUNT，防止误传
    async createBenchmark(data: {
      profileUrl: string;
      secUserId: string;
      nickname: string;
      avatar: string;
      bio?: string | null;
      signature?: string | null;
      followersCount: number;
      followingCount: number;
      likesCount: number;
      videosCount: number;
      douyinNumber?: string | null;
      ipLocation?: string | null;
      age?: number | null;
      province?: string | null;
      city?: string | null;
      verificationLabel?: string | null;
      verificationIconUrl?: string | null;
      verificationType?: number | null;
      userId: string;
      organizationId: string;
    }): Promise<DouyinAccount>
    // data.type 固定写入 DouyinAccountType.BENCHMARK_ACCOUNT
    ```

    **e. `findBenchmarkById(id)`**
    ```typescript
    // 不过滤 deletedAt，用于详情页和归档操作（含已归档账号）
    async findBenchmarkById(id: string): Promise<DouyinBenchmarkWithUser | null>
    // WHERE: id = ?（无 deletedAt 条件）
    // include: user { select: { id, name } }
    ```

    **f. `archiveBenchmark(id)`**
    ```typescript
    async archiveBenchmark(id: string): Promise<DouyinAccount>
    // UPDATE SET deletedAt = new Date()
    // WHERE: id = ?
    ```

---

- [ ] **BE-004**: (P0) 创建 `BenchmarkAccountService`
  - 文件: `src/server/services/benchmark-account.service.ts`（新建）
  - 详情: 创建 `BenchmarkAccountService` 类，导出 `benchmarkAccountService` 单例

    **a. `previewBenchmark(caller, profileUrl)`**
    - 与 `DouyinAccountService.previewAccount` 逻辑完全一致
    - **权限**：任意角色均可调用（员工、负责人、超管均可添加对标账号）
    - 调用 `crawlerService.getSecUserId(profileUrl)` + `crawlerService.fetchUserProfile(secUserId)`
    - 返回 `AccountPreview`

    **b. `createBenchmark(caller, data)`**
    - **权限**：任意角色均可
    - 去重检查（顺序执行）：
      1. `douyinAccountRepository.findBySecUserIdIncludingDeleted(data.secUserId)`
         - 若找到且 `deletedAt == null` → `throw new AppError("BENCHMARK_EXISTS", "该对标博主已存在", 409)`
         - 若找到且 `deletedAt != null` → `throw new AppError("BENCHMARK_ARCHIVED", "该对标博主已被归档，请前往归档列表查看", 409)`
      2. `douyinAccountRepository.findByProfileUrl(data.profileUrl)`（现有方法，不过滤 deletedAt）
         - 若找到且 type == MY_ACCOUNT → `throw new AppError("ACCOUNT_EXISTS_AS_MY", "该账号已作为我的账号被添加", 409)`
    - 调用 `douyinAccountRepository.createBenchmark({ ...data, userId: caller.id, organizationId: caller.organizationId })`
    - 返回创建的账号记录

    **c. `listBenchmarks(caller, params: { page, limit })`**
    - 根据角色决定 `organizationId` 过滤：
      - EMPLOYEE → `organizationId = caller.organizationId`
      - BRANCH_MANAGER → `organizationId = caller.organizationId`
      - SUPER_ADMIN → 不过滤
    - 调用 `douyinAccountRepository.findManyBenchmarks({ organizationId, includeArchived: false, ...params })`
    - 将 `DouyinBenchmarkWithUser` 映射为 `BenchmarkAccountDTO`（含 `creatorName = item.user.name`）

    **d. `listArchivedBenchmarks(caller, params: { page, limit })`**
    - 与 `listBenchmarks` 逻辑一致，但传 `includeArchived: true`

    **e. `getBenchmarkDetail(caller, id)`**
    - 调用 `douyinAccountRepository.findBenchmarkById(id)`
    - 若账号不存在 → 404
    - 权限检查：
      - EMPLOYEE / BRANCH_MANAGER：若 `account.organizationId != caller.organizationId` → 403
      - SUPER_ADMIN：可访问全部
    - 注意：归档账号可正常访问（详情页存在 `/benchmarks/archived/[id]` 或 `/benchmarks/[id]`）
    - 映射为 `BenchmarkAccountDetailDTO`（含 `deletedAt`、`lastSyncedAt`）

    **f. `archiveBenchmark(caller, id)`**
    - 调用 `douyinAccountRepository.findBenchmarkById(id)`
    - 若未找到 → 404
    - 若 `account.deletedAt != null` → 404（已归档不可再次归档）
    - 若 `account.userId != caller.id` → `throw new AppError("FORBIDDEN", "只能归档自己创建的对标账号", 403)`
    - 调用 `douyinAccountRepository.archiveBenchmark(id)`
    - 返回 `{ id, deletedAt }`

    **g. `listBenchmarkVideos(caller, benchmarkId, params)`**
    - 先调用 `getBenchmarkDetail(caller, benchmarkId)` 完成权限验证
    - 调用 `douyinVideoRepository.findByAccountId({ accountId: benchmarkId, ...params })`

---

- [ ] **BE-005**: (P0) 新增 `SyncService.runCollectionSync()`
  - 文件: `src/server/services/sync.service.ts`
  - 详情: 在 `SyncService` 类中新增 `runCollectionSync()` 方法（**防重入由 scheduler.ts 的 flag 保证，此方法本身无需感知**）

    ```
    async runCollectionSync(): Promise<void>
    ```

    实现逻辑：
    1. 调用 `douyinAccountRepository.findAllMyAccountsForCollection()` 获取所有待扫描的 MY_ACCOUNT
    2. 计算 `windowStart = new Date(Date.now() - 60 * 60 * 1000)`
    3. for 循环逐账号处理，每个账号 try/catch：
       - `crawlerService.fetchCollectionVideos(account.secUserId!)` → 失败时 `console.error` + continue
       - 遍历 `result.items`，按时间窗口过滤和停止（遇到 `item.collectedAt < windowStart` → break）
       - 对每个有效 item：
         - `item.authorSecUserId == null` → warn + continue
         - `douyinAccountRepository.findBySecUserIdIncludingDeleted(item.authorSecUserId)` → 找到则 skip
         - `crawlerService.fetchUserProfile(item.authorSecUserId)` → 失败时 error + continue
         - `douyinAccountRepository.createBenchmark({...profile, userId: account.userId, organizationId: account.organizationId})`
         - catch Prisma `P2002`（唯一约束冲突，并发幂等）→ continue
         - 其他异常 → error + continue（不中断整体）
    4. 整体 try/catch：意外异常记录后不向上抛出（防止 cron 崩溃）

---

- [ ] **BE-006**: (P0) 注册第 4 个定时器（收藏同步）
  - 文件: `src/lib/scheduler.ts`
  - 详情:
    1. 在 `startScheduler()` 函数内，现有 3 个 `cron.schedule` 调用**之后**，新增：
       ```typescript
       const collectionSyncCron = env.COLLECTION_SYNC_CRON ?? "*/5 * * * *";

       let collectionSyncRunning = false;

       cron.schedule(collectionSyncCron, () => {
         if (collectionSyncRunning) {
           console.warn("[Scheduler] Collection sync already running, skipping...");
           return;
         }
         collectionSyncRunning = true;
         void syncService.runCollectionSync().finally(() => {
           collectionSyncRunning = false;
         });
       });
       ```
    2. `collectionSyncRunning` 声明在 `startScheduler()` **内部**（非模块级），因为 `initialized` flag 已保证 `startScheduler()` 只执行一次，内部声明的变量天然单例。

---

- [ ] **BE-007**: (P0) 创建 `/api/benchmarks` 路由（列表 + 创建）
  - 文件:
    - `src/app/api/benchmarks/route.ts`（新建）
    - `src/app/api/benchmarks/preview/route.ts`（新建）
    - `src/app/api/benchmarks/archived/route.ts`（新建）
  - 详情:

    **`route.ts`（GET 列表 + POST 创建）**：
    - `GET`：`requireRole(session, SUPER_ADMIN, BRANCH_MANAGER, EMPLOYEE)` → `listBenchmarksSchema` 验证 → `benchmarkAccountService.listBenchmarks(session.user, params)` → `successResponse(result)`
    - `POST`：`requireRole(session, SUPER_ADMIN, BRANCH_MANAGER, EMPLOYEE)` → `createBenchmarkSchema` 验证 → `benchmarkAccountService.createBenchmark(session.user, data)` → `successResponse(account, 201)`

    **`preview/route.ts`（POST 预览）**：
    - schema: `z.object({ profileUrl: z.string().url().regex(...) })`
    - `benchmarkAccountService.previewBenchmark(session.user, body.profileUrl)` → `successResponse(preview)`

    **`archived/route.ts`（GET 归档列表）**：
    - 与 `route.ts` GET 逻辑一致，调用 `benchmarkAccountService.listArchivedBenchmarks(session.user, params)`

---

- [ ] **BE-008**: (P0) 创建 `/api/benchmarks/[id]` 路由（详情 + 归档）
  - 文件:
    - `src/app/api/benchmarks/[id]/route.ts`（新建）
    - `src/app/api/benchmarks/[id]/videos/route.ts`（新建）
  - 详情:

    **`[id]/route.ts`（GET 详情 + DELETE 归档）**：
    - `GET`：获取 `params.id` → `benchmarkAccountService.getBenchmarkDetail(session.user, id)` → `successResponse(detail)`
    - `DELETE`：获取 `params.id` → `benchmarkAccountService.archiveBenchmark(session.user, id)` → `successResponse(result)`

    **`[id]/videos/route.ts`（GET 视频列表）**：
    - schema: `z.object({ page: ..., limit: ... })`
    - `benchmarkAccountService.listBenchmarkVideos(session.user, id, params)` → `successResponse(result)`

---

- [ ] **BE-009**: (P0) 在 `src/types/douyin-account.ts` 中新增 DTO 类型
  - 文件: `src/types/douyin-account.ts`
  - 详情: 在文件末尾追加：
    ```typescript
    export interface BenchmarkAccountDTO extends DouyinAccountDTO {
      creatorName: string;
      deletedAt: string | null;
    }

    export interface BenchmarkAccountDetailDTO extends BenchmarkAccountDTO {
      lastSyncedAt: string | null;
    }
    ```

---

- [ ] **BE-010**: (P0) 修改 `douyin-account.repository.ts` 中现有 `findByProfileUrl` 方法
  - 文件: `src/server/repositories/douyin-account.repository.ts`
  - 详情:
    - 现有 `findByProfileUrl` 过滤了 `deletedAt: null`。但用于 createBenchmark 的去重检查（判断 profileUrl 是否已作为 MY_ACCOUNT 存在）需要**不过滤 deletedAt**
    - 修改方式：在现有方法上**新增一个 `includingDeleted` 可选参数**（默认 false 保持向后兼容）：
      ```typescript
      async findByProfileUrl(
        profileUrl: string,
        includingDeleted = false,
        db: DatabaseClient = prisma,
      ): Promise<DouyinAccount | null>
      ```
    - 若 `includingDeleted = true`，WHERE 条件去掉 `deletedAt: null`
    - `benchmarkAccountService.createBenchmark` 中调用时传 `includingDeleted: true`

---

## 依赖关系图

```
BE-001 (env)
    └─► BE-006 (scheduler)

BE-002 (crawler fetchCollectionVideos)
    └─► BE-005 (sync runCollectionSync)

BE-003 (repository 新增方法)
    ├─► BE-004 (benchmark-account.service)
    │       ├─► BE-007 (api/benchmarks route)
    │       └─► BE-008 (api/benchmarks/[id] route)
    └─► BE-005 (sync runCollectionSync)

BE-009 (types)
    ├─► BE-004 (service 映射使用)
    └─► 前端开发（共享类型）

BE-010 (findByProfileUrl 修改)
    └─► BE-004 (createBenchmark 去重检查)
```

**建议开发顺序**：BE-009 → BE-001 → BE-002 → BE-003 → BE-010 → BE-004 → BE-005 → BE-006 → BE-007 → BE-008

---

## 集成联调报告（Phase 5）

**完成时间**: 2026-04-04

### 检查结果
- type-check: ✅
- lint: ✅

### 发现问题

1. **`[INTEGRATE]` 注释未清理**（已修复）
   - 5 处 `// TODO: [INTEGRATE]` / `/* TODO: [INTEGRATE] */` 注释残留于以下文件：
     - `src/components/features/benchmarks/benchmarks-page.tsx`
     - `src/components/features/benchmarks/benchmarks-archived-page.tsx`
     - `src/components/features/benchmarks/benchmark-detail-page.tsx`（2 处）
     - `src/components/features/benchmarks/benchmark-video-list.tsx`
   - 前端实际已调用真实 API，注释属于旧阶段标注，已全部删除。

2. **`POST /api/benchmarks` 响应体契约轻微偏差**（无影响，已记录）
   - 技术设计约定响应类型为 `BenchmarkAccountDTO`，实际 `createBenchmark` 服务方法返回 `{ id, profileUrl, secUserId }`（精简结构）。
   - 前端调用处 `apiClient.post<BenchmarkAccountDTO>(...)` 未使用返回值，不影响功能，type-check 通过。
   - 属于轻微契约偏差，不引入运行时错误，不作修改（避免过度改动已通过验证的代码）。

### API 路径一致性（全部验证通过）
| 接口 | 后端路由文件 | 前端调用路径 | 结果 |
|------|-------------|-------------|------|
| `POST /api/benchmarks/preview` | `api/benchmarks/preview/route.ts` | `/benchmarks/preview` | ✅ |
| `POST /api/benchmarks` | `api/benchmarks/route.ts` | `/benchmarks` | ✅ |
| `GET /api/benchmarks` | `api/benchmarks/route.ts` | `/benchmarks?page=&limit=` | ✅ |
| `GET /api/benchmarks/archived` | `api/benchmarks/archived/route.ts` | `/benchmarks/archived?page=&limit=` | ✅ |
| `GET /api/benchmarks/[id]` | `api/benchmarks/[id]/route.ts` | `/benchmarks/${id}` | ✅ |
| `DELETE /api/benchmarks/[id]` | `api/benchmarks/[id]/route.ts` | `/benchmarks/${id}` | ✅ |
| `GET /api/benchmarks/[id]/videos` | `api/benchmarks/[id]/videos/route.ts` | `/benchmarks/${id}/videos?page=&limit=` | ✅ |

### 类型一致性（全部验证通过）
- `BenchmarkAccountDTO`：已在 `src/types/douyin-account.ts` 定义并导出 ✅
- `BenchmarkAccountDetailDTO`：已在 `src/types/douyin-account.ts` 定义并导出 ✅
- 前端组件均正确引用上述类型，无 import 错误 ✅

### 未修复问题
无。
