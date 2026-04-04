# v0.3.0.2 后端任务清单

## 必读文档

- docs/product/versions/v0.3.0.2/requirements.md
- docs/product/versions/v0.3.0.2/technical-design.md
- docs/architecture/backend.md
- docs/architecture/database.md
- docs/architecture/api-conventions.md
- docs/standards/coding-standards.md

## 摘要

| 属性 | 值 |
|------|----|
| 任务总数 | 8 |
| 涉及模块 | Prisma Schema、Repository、DouyinAuthService、LoginSessionManager、私有登录态存储、CrawlerService、SyncService、Route Handlers |
| 优先级 | BE-001 ~ BE-007 为 P0，BE-008 为 P1 |
| 执行顺序约束 | 先完成 Schema / Repository / 运行前提，再做登录会话与 API，最后改收藏同步 |

---

## 任务列表

### BE-001: 扩展数据模型，补账号登录状态字段与登录会话表 ✅

文件：
- prisma/schema.prisma

详情：
- 在 DouyinAccount 上新增账号级登录态字段。
- 新增 DouyinAccountLoginStatus 枚举。
- 新增 DouyinLoginSession 模型，用于承载二维码、临时登录态、终态错误和账号绑定结果。

验收：
1. Schema 能表达会话生命周期与账号登录态。
2. DouyinLoginSession 能关联 User、Organization，并可选关联已有账号。
3. 不保留与当前主流程无关的历史字段。

---

### BE-002: 补 Repository 层封装，收敛账号登录态与会话读写 ✅

文件：
- src/server/repositories/douyin-account.repository.ts
- src/server/repositories/douyin-login-session.repository.ts

详情：
- 账号 Repository 负责读取与更新登录态元信息。
- DouyinLoginSessionRepository 负责 create、findById、findActiveByOwner、updateStatus、updateQrcode、updateResolvedIdentity、attachAccount、markFailed、markExpired、markCancelled、markSuccess。

验收：
1. Service 层无需直接调用 Prisma 访问登录会话表。
2. 查询继续遵守 organizationId 隔离。

---

### BE-003: 新增私有登录态存储与 Playwright 运行管理 ✅

文件：
- src/server/services/douyin-login-state-storage.service.ts
- src/server/services/douyin-login-session-manager.ts
- src/lib/env.ts

详情：
- 统一管理临时 / 正式 storageState 路径。
- 为每个 loginSessionId 维护独立 Browser Context。
- 在首次创建登录会话前校验 Chromium 可启动、私有目录存在且可写。
- 默认登录入口走 creator.douyin.com。

验收：
1. 每个 loginSessionId 只对应一个独立 Browser Context。
2. 正式登录态文件落在私有目录。
3. 运行环境不满足时，后端能尽早返回明确错误。
4. 超时会话会由服务端主动回收。

---

### BE-004: 新增 DouyinAuthService，封装扫码会话、轮询、刷新、取消与重登录 ✅

文件：
- src/server/services/douyin-auth.service.ts
- src/app/api/douyin-account-login-sessions/route.ts
- src/app/api/douyin-account-login-sessions/[id]/route.ts
- src/app/api/douyin-account-login-sessions/[id]/refresh/route.ts
- src/app/api/douyin-account-login-sessions/[id]/cancel/route.ts
- src/app/api/douyin-accounts/[id]/relogin/route.ts

详情：
- 创建会话并准备二维码。
- 轮询会话状态。
- 刷新二维码、取消会话。
- 对已有账号发起重登录。
- 在登录成功后写入临时 storageState。

验收：
1. 路由层不直接访问 Prisma、文件系统或 Playwright。
2. 前端可直接基于 status / qrcodeDataUrl / expiresAt / errorCode 完成轮询。
3. RELOGIN 只允许员工操作自己的账号。

---

### BE-005: 接入自动建号与账号重绑 ✅

文件：
- src/server/services/douyin-account.service.ts
- src/server/services/douyin-auth.service.ts

详情：
- CREATE_ACCOUNT 会话在登录成功后从 aweme/favorite 请求解析 secUserId 与 cookie。
- 解析成功时自动创建 MY_ACCOUNT，并把临时登录态迁移为正式文件。
- 解析失败时会话终态为 FAILED，不创建账号，不保留临时文件。
- RELOGIN 会话成功时只覆盖原账号自己的正式登录态文件。

验收：
1. 自动建号成功时，可创建账号并绑定正式登录态。
2. 无法识别 secUserId 时，不误建号、不误绑定登录态。
3. 扫错账号重登录时，不会覆盖目标账号登录态。

---

### BE-006: 固定 aweme/favorite request cookie -> Cookie header 契约 ✅

文件：
- src/server/services/crawler.service.ts
- src/server/services/douyin-login-session-manager.ts

详情：
- 登录成功时监听 aweme/favorite 请求，直接提取 request header 中的完整 cookie 原值。
- crawlerService.fetchCollectionVideos 的服务层签名固定为 fetchCollectionVideos({ secUserId, cookieHeader })。
- crawler 不接收 storageState 文件、文件路径或文件内容对象。

验收：
1. 业务层只传递 cookieHeader 语义，不直接拼 crawler 请求细节。
2. 收藏同步只读取账号绑定的原始 Cookie header。

---

### BE-007: 改造收藏同步，按账号使用 Cookie header 调 crawler ✅

文件：
- src/server/services/sync.service.ts
- src/server/repositories/douyin-account.repository.ts

详情：
- 遍历 findAllMyAccountsForCollection() 返回的账号。
- 读取该账号自己绑定的 favoriteCookieHeader。
- 调用 crawlerService.fetchCollectionVideos({ secUserId, cookieHeader })。
- 账号无登录态、Cookie 缺失或 crawler 返回失效时，更新该账号 loginStatus = EXPIRED 并跳过。

验收：
1. 收藏同步真实调用时使用的是当前账号的 Cookie header。
2. 一个员工多个账号时，重登录、失效和同步互不污染。
3. 登录态不可用时，系统跳过当前账号而不是借用其他账号继续抓取。

---

### BE-008: 补测试、日志与上线自检 [部分完成]

文件：
- 登录会话服务测试
- API 路由测试
- 收藏同步测试
- crawler service 测试

详情：
- 覆盖会话创建、轮询、刷新、取消。
- 覆盖自动建号成功 / 失败。
- 覆盖重登录覆盖原账号登录态。
- 覆盖 aweme/favorite request cookie -> Cookie header 解析。
- 覆盖收藏同步多账号隔离。

验收：
1. P0 主流程有回归保护。
2. 日志中不打印完整 Cookie 或 storageState 原文。
3. 上线前可通过自检快速发现运行环境不满足 Playwright 前提。

---

## 自省报告

1. 私有登录态存储已经沉淀为独立后端能力，可继续复用到同类站点登录场景。
2. LoginSessionManager 已从试错期的泛化解析收敛到当前真实主链路，维护成本更低。
3. 当前会话模型足以支撑本版能力，不再保留额外扩展字段。
4. 本次文档已同步收口到真实实现，不再描述未交付的旧路径。

---

## Phase 5 集成联调报告

> 执行日期：2026-04-04  
> 执行角色：后端开发

### 1. 全量检查

| 检查项 | 结果 | 说明 |
|--------|------|------|
| `pnpm type-check` | ✅ 通过 | 0 个 TypeScript 错误 |
| `pnpm lint` | ✅ 通过 | 0 个 ESLint 错误 |
| `pnpm test` | ✅ 通过 | 30 个测试文件，104 个测试用例全部通过 |

### 2. TODO: [INTEGRATE] 标注检查

全代码库搜索 `// TODO: [INTEGRATE]` 注释，**无命中**。所有集成点已完成，无待替换 mock。

### 3. 关键路径验证

| 路径 | 结果 | 实现方法名 |
|------|------|-----------|
| `POST /api/douyin-account-login-sessions` → Service | ✅ 通过 | `douyinAuthService.createSession` |
| `GET /api/douyin-account-login-sessions/[id]` → Service | ✅ 通过 | `douyinAuthService.getSession`（等价于 pollSession） |
| `POST /api/douyin-account-login-sessions/[id]/refresh` → Service | ✅ 通过 | `douyinAuthService.refreshSession` |
| `POST /api/douyin-account-login-sessions/[id]/cancel` → Service | ✅ 通过 | `douyinAuthService.cancelSession` |
| `POST /api/douyin-accounts/[id]/relogin` → Service | ✅ 通过 | `douyinAuthService.relogin`（等价于 createReloginSession） |
| `SyncService.runCollectionSync` → `favoriteCookieHeader` → `CrawlerService.fetchCollectionVideos` | ✅ 通过 | 读取 `account.favoriteCookieHeader`，传 `{ secUserId, cookieHeader }` |

备注：两处方法名与技术设计文档存在轻微偏差（`getSession` vs `pollSession`，`relogin` vs `createReloginSession`），为开发阶段合理收敛，功能语义完全一致。

### 4. 数据流验证

| 字段 | 存在于前端 DTO | 说明 |
|------|--------------|------|
| `loginStatus` | ✅ | `DouyinAccountDTO` 含此字段，`DouyinAccountDetailDTO` 继承 |
| `loginStateUpdatedAt` | ✅ | 同上 |
| `loginStateCheckedAt` | ✅ | 同上 |
| `loginStateExpiresAt` | ✅ | 同上 |
| `loginErrorMessage` | ✅ | 同上 |
| `favoriteCookieHeader` | ⛔ 不在前端 DTO | **设计正确**：按技术设计"不把完整 Cookie 暴露给前端"，该字段仅存在于 Repository `loginStateMetaSelect` 供 SyncService 内部使用 |

账号详情路由 `GET /api/douyin-accounts/[id]` → `douyinAccountService.getAccountDetail` → `mapDouyinAccountDetailToDto` 可正确返回所有登录状态字段。

### 5. 前端集成状态确认

- `AccountDetailPageView`：使用真实 `apiClient.get` 调用 `/douyin-accounts/{id}`，无 mock ✅
- `AccountReloginDialog`：已提升至页面级（`account-detail-page.tsx`），由 `reloginOpen` state 管理 ✅
- `AccountDetailHeader`：通过 `onReloginOpen` 回调委托，自身不持有 relogin 状态 ✅
- `AccountLoginStatusCard`：对应组件文件标注为废弃，`index.ts` 不导出，符合设计 ✅

### 6. 修复记录

本次集成联调中**未发现需要修复的问题**，代码已处于可交付状态。

### 7. 最终结论

✅ **可进入 Phase 6 代码评审**

所有关键路径完整，类型安全，测试全绿，无遗留 TODO 标注，前后端集成闭环。

---

## Phase 5 自省报告

### Step 1: 回顾

- 本次集成联调零修复，说明 Phase 3 实现质量较高，前后端契约对齐良好。
- `favoriteCookieHeader` 不暴露给前端 DTO 是一个值得在架构规范中显式说明的安全边界：敏感凭证类字段只能在 Service 层内部流转，不得出现在客户端 DTO 中。
- 方法命名（`getSession` vs `pollSession`）与设计文档存在轻微偏差，虽不影响功能，但会增加维护时的理解成本。

### Step 2: 检查

- `docs/architecture/backend.md`：当前无针对"敏感字段不入 DTO"的规范条目，建议补充。
- `docs/standards/coding-standards.md`：可补充"Cookie / storageState 等敏感凭证字段不得出现在前端 DTO"条目。
- `docs/architecture/api-conventions.md`：无需变更。

### Step 3: 提议

| 文档 | 建议修改内容 |
|------|------------|
| `docs/architecture/backend.md` | 在"数据安全"或"DTO 规范"节补充：凭证类字段（Cookie header、storageState 路径等）只允许在 Service/Repository 层流转，禁止映射到对外 DTO。 |
| `docs/standards/coding-standards.md` | 补充条目：`favoriteCookieHeader`、`loginStatePath` 等服务端内部字段不得出现在 `*DTO` 类型定义中。 |
