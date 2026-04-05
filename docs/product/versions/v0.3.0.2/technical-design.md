# v0.3.0.2 技术设计方案

> 版本: v0.3.0.2  
> 设计日期: 2026-04-04  
> 类型: 功能增强

---

## 摘要

- 涉及模块：Prisma Schema、DouyinAccount Repository、登录会话 Service、Playwright 运行管理、CrawlerService、SyncService、账号新增/重登录前端流程。
- 新增模型：DouyinLoginSession。
- 新增 API：
  - POST /api/douyin-account-login-sessions
  - GET /api/douyin-account-login-sessions/{id}
  - POST /api/douyin-account-login-sessions/{id}/refresh
  - POST /api/douyin-account-login-sessions/{id}/cancel
  - POST /api/douyin-accounts/{id}/relogin
- 本版正式交付：扫码自动建号、账号重登录、账号级登录态持久化、登录状态展示、多账号隔离、收藏同步 Cookie 传递。
- 身份识别唯一来源：aweme/favorite 请求。

---

## 设计收口结论

1. 登录成功后的身份识别只依赖 aweme/favorite 请求中的 sec_user_id 和 cookie。
2. 登录态文件落在服务端私有目录，正式文件按 organizationId / userId / accountId 归档。
3. 收藏同步按账号读取 raw cookie header 调 crawler；不向 crawler 传 storageState 文件。
4. 当前实现按单实例服务进程设计，不做跨进程会话恢复。
5. 所有失败路径都必须清理临时登录态，并保持账号登录状态回滚正确。

---

## 目标与边界

### 本版目标

- 在 www.douyin.com 主站登录弹框内发起抖音扫码登录，前端通过轮询获取二维码与状态变化。
- 登录成功后，服务端以账号维度保存正式 storageState，并可识别其登录状态。
- CREATE_ACCOUNT 场景下，服务端在登录成功后解析 secUserId，解析成功则自动创建 MY_ACCOUNT。
- 已存在账号支持重新登录，登录成功后只重绑该账号自己的登录态。
- 收藏同步按账号读取已绑定的原始 Cookie header 字符串后调用 crawler 收藏接口。

### 本版非目标

- 不回退到 info 接口、DOM、header 或 bodyText 做身份识别兜底。
- 不在前端或客户端本地运行 Playwright / Chromium。
- 不把完整 Cookie、storageState 文件内容或服务器真实文件路径暴露给前端。
- 不引入分布式登录会话协调。

---

## 数据模型变更

### DouyinAccount 扩展字段

新增账号级登录态元信息：
- loginStatus
- loginStatePath
- loginStateUpdatedAt
- loginStateCheckedAt
- loginStateExpiresAt
- loginErrorMessage
- favoriteCookieHeader

职责：
- 表达账号是否具备可用登录态。
- 保存正式 storageState 的私有文件路径。
- 保存当前账号可用于收藏同步的 Cookie header。

### DouyinLoginSession

新增一张表承载一次扫码登录会话：
- id
- userId
- organizationId
- accountId
- purpose
- status
- qrcodeDataUrl
- resolvedSecUserId
- errorCode
- errorMessage
- expiresAt
- startedAt
- finishedAt
- createdAt
- updatedAt

职责：
- 让前端轮询有稳定数据源，而不是直接依赖进程内状态。
- 记录二维码状态、临时登录态路径、终态错误与账号绑定结果。

---

## 状态机设计

### 登录会话状态机

```text
CREATED -> QRCODE_READY -> SCANNED -> CONFIRMED -> SUCCESS
QRCODE_READY -> EXPIRED
QRCODE_READY -> CANCELLED
SCANNED -> FAILED | EXPIRED | CANCELLED
CONFIRMED -> FAILED
```

规则：
1. 登录成功但未捕获 aweme/favorite 请求时，终态为 FAILED，errorCode=SEC_USER_ID_UNRESOLVED 或 COOKIE_HEADER_UNRESOLVED。
2. 任一终态都必须释放 Playwright 资源。
3. 失败、取消、过期场景都必须删除临时登录态文件。

### 账号登录状态机

```text
NOT_LOGGED_IN -> PENDING -> LOGGED_IN
LOGGED_IN -> EXPIRED
PENDING -> FAILED
FAILED -> PENDING
EXPIRED -> PENDING
```

规则：
- 重登录开始时，目标账号置为 PENDING。
- 重登录失败、取消、过期时，需要恢复到原始快照或根据现有正式登录态更新为 FAILED / EXPIRED。
- 新建账号场景只有在账号真正创建成功后才会出现 LOGGED_IN。

---

## 文件存储设计

### 存储根目录

```text
{DOUYIN_LOGIN_STATE_DIR}/
  organizations/{organizationId}/users/{userId}/accounts/{accountId}.json
```

说明：
- organizations/.../accounts/{accountId}.json 用于账号正式登录态。
- 正式文件路径写入 DouyinAccount.loginStatePath。
- 会话运行中的临时 storageState 仅保存在 LoginSessionManager 进程内存中，不落临时文件。

### 存储策略

1. Playwright 登录成功后先将 storageState 保存在 LoginSessionManager 运行态内存中。
2. 自动建号成功时，按 organizationId / userId / accountId 生成正式路径并直接写入账号正式文件。
3. 既有账号重登录成功时，直接覆盖该账号正式路径。
4. CREATE_ACCOUNT 场景下若正式文件已写入但账号创建或绑定失败，必须删除该正式文件并回滚。
5. 失败、取消、过期场景必须清理运行态会话资源，不保留未绑定的临时登录态。

---

## 核心组件设计

### LoginSessionManager

职责：
- 为每个 loginSessionId 创建独立 Browser Context。
- 获取二维码、监听扫码和确认状态。
- 监听 www.douyin.com 主站内的 aweme/favorite 请求并捕获 sec_user_id 与 cookie。
- 登录确认后把 storageState 落到临时文件，并用新的主站 Context 访问 jingxuan 做一次持久化校验。
- 会话结束后统一清理 browser / context / page。

关键策略：
- 默认登录入口使用 www.douyin.com 主站登录弹框。
- 只保留必要的二维码提取逻辑和登录确认逻辑。
- 超时会话由服务端 TTL 主动回收，而不是依赖前端持续轮询。

### DouyinAuthService

职责：
- 创建扫码会话。
- 轮询会话状态。
- 刷新二维码、取消会话。
- 在登录成功后完成自动建号或既有账号重登录。
- 管理临时文件迁移、正式文件绑定和账号状态回滚。

### CrawlerService 与 SyncService

- CrawlerService.fetchCollectionVideos 的服务层签名固定为 fetchCollectionVideos({ cookieHeader, cursor?, count? })。
- SyncService.runCollectionSync() 遍历可同步账号时，只消费账号自己绑定的 favoriteCookieHeader。
- 收藏同步的账号身份来自当前账号绑定的 favoriteCookieHeader，不额外向 crawler 传 secUserId。
- 若账号没有有效 Cookie header，直接将该账号标记为 EXPIRED 并跳过。

---

## API 契约

统一响应格式：

```json
{ "success": true, "data": { ... } }
```

### POST /api/douyin-account-login-sessions

用途：创建新扫码会话。

请求体：

```json
{ "purpose": "CREATE_ACCOUNT" }
```

或：

```json
{ "purpose": "RELOGIN", "accountId": "cuid" }
```

响应字段：
- id
- purpose
- status
- qrcodeDataUrl
- expiresAt
- accountId
- message

### GET /api/douyin-account-login-sessions/{id}

用途：前端轮询状态。

响应字段：
- id
- purpose
- status
- qrcodeDataUrl
- expiresAt
- resolvedSecUserId
- accountId
- errorCode
- errorMessage
- message

### POST /api/douyin-account-login-sessions/{id}/refresh

用途：二维码失效后刷新会话二维码。

### POST /api/douyin-account-login-sessions/{id}/cancel

用途：用户关闭弹窗或主动取消。

### POST /api/douyin-accounts/{id}/relogin

用途：为已存在账号发起重登录。

---

## 权限矩阵

| 操作 | EMPLOYEE | BRANCH_MANAGER | SUPER_ADMIN |
|------|----------|----------------|-------------|
| 创建“新增账号”扫码会话 | 允许，仅限本人 | 不允许代扫 | 不允许代扫 |
| 轮询本人登录会话 | 允许 | 不允许 | 不允许 |
| 刷新 / 取消本人登录会话 | 允许 | 不允许 | 不允许 |
| 为本人账号发起重登录 | 允许 | 不允许代扫 | 不允许代扫 |
| 查看账号登录状态 | 允许查看本人 | 允许查看组织内 | 允许查看全部 |
| 收藏同步读取账号登录态 | 后台任务 | 后台任务 | 后台任务 |

---

## 开发顺序

1. Prisma Schema：补账号登录状态字段与 DouyinLoginSession。
2. Repository：补账号登录态更新与登录会话读写封装。
3. 私有存储与 Playwright 管理：落实运行前提、文件落点和 TTL 回收。
4. DouyinAuthService + API：实现创建 / 轮询 / 刷新 / 取消 / 重登录。
5. 自动建号：接入 DouyinAccountService 的账号创建与正式文件迁移。
6. Crawler + Sync：完成 Cookie header 透传与收藏同步改造。


