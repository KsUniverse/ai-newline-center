# 测试报告 — v0.3.0.2（重构后终测）

> 测试日期：2026-04-04  
> 测试人：Tester Agent  
> 测试版本：v0.3.0.2

---

## 摘要

- 测试功能数：2（Feature-2A、Feature-2B），共 10 条验收标准
- 通过 / 失败 / 需真实环境：10 / 0 / 5（代码可验证的全部通过，另有 5 条需真实抖音账号和扫码设备才能端到端验证）
- 构建检查：
  - `pnpm type-check` ✅
  - `pnpm lint` ✅
  - `pnpm test` ✅（104 tests / 30 files，全部通过）
  - `pnpm build` ✅（需 NEXTAUTH_SECRET ≥ 32 字符，其余 env 使用默认值或占位值可通过）
- 结论：**B — 通过，有非阻塞问题**（代码层面全部符合需求，2 条非阻塞观察项，无阻塞缺陷，可进行真实环境验收）

---

## 验证方式说明

| 验证类型 | 说明 |
|---------|------|
| 自动化测试 | `pnpm test` 覆盖 Service 层逻辑、API 路由、Repository 行为，共 104 个测试 |
| 类型检查 | `pnpm type-check` 全代码库 TypeScript strict 检查 |
| 代码静态审查 | 对照 requirements.md 逐条检查 API 路由、Service、Repository、前端组件 |
| UI 一致性静态检查 | 对照 ui-ux-system.md 检查新增前端组件的色彩、字号、组件、交互模式 |
| ❌ 真实环境扫码 | 需要真实 Playwright / Chromium 运行环境 + 真实抖音账号扫码设备，本轮无法执行 |

---

## 功能验收

### Feature-2A：员工抖音账号扫码登录与自动建号

#### AC-1：员工可在网页内看到二维码，并通过轮询感知状态变化 ✅ 通过（代码审查）

- [x] `account-add-drawer.tsx` 通过 `Sheet` 抽屉展示 `AccountLoginSessionContent`（shadcn/ui 交互模式），自动触发登录会话创建
- [x] `use-douyin-login-session.ts` 持续以 5 秒间隔轮询 `GET /api/douyin-account-login-sessions/{id}`
- [x] `account-login-qrcode-panel.tsx` 覆盖 7 种前端视图状态：IDLE / CREATING_SESSION / QRCODE_READY / SCANNED / SUCCESS / EXPIRED / FAILED
- [x] `account-login-status-copy.ts#mapLoginSessionToViewState` 将服务端 session 状态映射到前端视图状态（CREATED→CREATING_SESSION, CONFIRMED/SUCCESS→SUCCESS, CANCELLED→FAILED）
- [ ] **需真实环境**：实际扫码后能在手机确认前看到「已扫码」状态，手机确认后看到「登录成功」状态

#### AC-2：登录成功且识别到 secUserId 后，系统自动创建 MY_ACCOUNT ✅ 通过（代码审查）

- [x] `douyin-auth.service.ts#finalizeCreateAccount` 调用 `douyinLoginSessionManager.resolveIdentity` 获取 secUserId
- [x] 校验 secUserId 和 rawCookie 均不为空后，调用 `douyinAccountService.createLoggedInAccount` 创建 MY_ACCOUNT
- [x] 账号创建在 Prisma 事务中完成（含 loginSession.attachAccount 和 markSuccess），事务失败会回滚
- [x] 创建成功后异步触发首次全量同步（`syncService.syncAccount`，不阻塞登录流程）
- [ ] **需真实环境**：真实创建账号、确认数据库写入 MY_ACCOUNT 记录

#### AC-3：账号创建后，系统保存独立正式登录态，并可识别后续登录状态 ✅ 通过（代码审查）

- [x] `douyinLoginStateStorageService.moveTempStateToAccount` 将临时文件原子移动到 `organizations/{orgId}/users/{userId}/accounts/{accountId}.json`
- [x] `DouyinAccount.loginStatePath` 写入正式文件路径；`loginStatus` 置为 `LOGGED_IN`；`favoriteCookieHeader` 写入
- [x] `AccountLoginStatusBadge` 在账号列表卡片（`account-card.tsx`）和详情页（`account-detail-header.tsx`）均显示当前 loginStatus
- [x] `DOUYIN_LOGIN_TIMEOUT_MS` 默认 180,000ms；`DOUYIN_LOGIN_PAGE_URL` 默认 `https://creator.douyin.com/`

#### AC-4：同一员工连续新增两个账号时，系统生成两条独立记录与两份独立登录态，不串号 ✅ 通过（代码审查）

- [x] `douyinLoginSessionManager.sessions` 以 `loginSessionId` 为键存储独立 `BrowserContext`，每次创建都是全新 Browser 实例
- [x] `douyinAuthService.abortActiveSessionsForOwner` 在创建新会话前取消同 userId + purpose 的活跃会话，防止并行干扰
- [x] 文件路径按 `accountId` 区分，不同账号的 storageState 物理隔离
- [ ] **需真实环境**：连续录入两个不同抖音账号，确认两条独立账号记录和两个独立 storageState 文件

#### AC-5：未捕获 aweme/favorite 请求时，不创建账号，不误绑定登录态 ✅ 通过（代码审查）

- [x] `resolveIdentity` 只读取 `favoriteSnapshot`（由 `page.on("request")` 事件监听填充），未捕获时返回 `{ secUserId: null, rawCookie: null }`
- [x] `finalizeCreateAccount` 在 `!identity.secUserId` 时抛 `AppError("SEC_USER_ID_UNRESOLVED")`，在 `!identity.rawCookie` 时抛 `AppError("COOKIE_HEADER_UNRESOLVED")`
- [x] catch 块执行 `deleteStateFileQuietly(tempStatePath)` + `finishRuntimeSessionQuietly` + `restoreAccountStatusAfterAbort`，不留半成品
- [x] loginSession 终态为 FAILED，`markFailed` 写入 errorCode，前端展示「登录失败」视图

---

### Feature-2B：登录态持久化、状态展示与收藏同步 Cookie 传递

#### AC-1：每个账号独立展示登录状态，支持失效后重新登录 ✅ 通过（代码审查）

- [x] `AccountLoginStatusBadge` 展示全部 5 种状态（NOT_LOGGED_IN / PENDING / LOGGED_IN / EXPIRED / FAILED），使用 CSS 变量色彩，携带人读描述
- [x] 账号列表 `account-card.tsx` 和账号详情 `account-detail-header.tsx` 均显示 loginStatus
- [x] `AccountSyncSection` 在 `canRelogin`（EMPLOYEE 角色）时显示「更新登录」按钮，触发页面级 `AccountReloginDialog`
- [x] `AccountReloginDialog` 已提升至 `account-detail-page.tsx` 页面级管理（`reloginOpen` / `setReloginOpen` 在页面组件）
- [x] `getReloginActionLabel` 根据当前 loginStatus 生成不同操作文案（未登录→「立即登录」/ 已登录→「更新登录」/ 失效→「重新登录」）
- [x] MY_ACCOUNT 类型守卫：`getAccountDetail()` 服务端对非 MY_ACCOUNT 账号返回 404，详情页仅展示 MY_ACCOUNT 数据

#### AC-2：收藏同步发起 crawler 调用时，使用当前账号绑定的原始 Cookie header 字符串 ✅ 通过（代码审查）

- [x] `sync.service.ts#runCollectionSync` 逐账号读取 `account.favoriteCookieHeader`，传入 `crawlerService.fetchCollectionVideos({ secUserId, cookieHeader })`
- [x] `crawlerService.fetchCollectionVideos` 将 cookieHeader 设置在 HTTP 请求头 `Cookie:` 中传给 crawler API

#### AC-3：crawler 收藏接口只接收 Cookie header 字符串，不接收 storageState 文件 ✅ 通过（代码审查）

- [x] `FetchCollectionVideosInput` 接口定义为 `{ secUserId: string; cookieHeader: string }`，无 storageState 字段
- [x] `callCrawlerApi` 调用时只传 `requestHeaders: { Cookie: input.cookieHeader }`，无文件路径
- [x] `sync.service.test.ts` 中验证了 `fetchCollectionVideosMock` 调用参数 `{ secUserId, cookieHeader }`（见 line 495）

#### AC-4：同一员工下多个账号的登录态彼此隔离 ✅ 通过（代码审查）

- [x] 每条 `DouyinAccount` 行独立存储 `loginStatePath`、`favoriteCookieHeader`、`loginStatus`、`loginStateExpiresAt`
- [x] `douyinAccountRepository.updateLoginStateBinding` 按 `accountId` 精确更新，不跨账号
- [x] relogin 校验 `identity.secUserId === account.secUserId`，扫错号时抛 `RELOGIN_ACCOUNT_MISMATCH`，原账号登录态不被覆盖
- [ ] **需真实环境**：两账号交叉重登录，确认只有目标账号被更新

#### AC-5：登录态不可用时，不误抓取、不误绑定，明确要求重新登录 ✅ 通过（代码审查）

- [x] `runCollectionSync` 检查 `loginStatus !== LOGGED_IN` 时直接 `continue` 跳过该账号
- [x] `!account.favoriteCookieHeader` 时调用 `douyinAccountRepository.markLoginExpired`（写入 EXPIRED + 错误消息），不发起 crawler 调用
- [x] `sync.service.test.ts` 中 `marks account expired when favorite request cookie header is missing` 测试用例已覆盖此路径
- [x] `AccountLoginStatusBadge` 展示「已失效」状态时提示「需要重新扫码绑定」，`AccountSyncSection` 的「更新登录」按钮引导重登录流程

---

## UI 一致性检查

| 检查项 | 结果 | 备注 |
|--------|------|------|
| 色彩使用 CSS 变量 | ✅ | `hsl(var(--success)/0.24)`, `hsl(var(--primary)/0.12)`, `text-destructive` 等全部使用 CSS 变量 token，无硬编码 hex 色值 |
| 字号使用语义 token | ✅ | 新组件使用 `text-2xs`、`text-sm`、`text-base`，未见 `text-[Npx]` 任意值 |
| shadcn/ui 组件使用 | ✅ | `AccountAddDrawer` 使用 `Sheet`；`AccountReloginDialog` 使用 `Dialog`；按钮均使用 `Button` 组件 |
| 交互模式（弹框/抽屉，非页面跳转） | ✅ | 新增账号→Sheet 抽屉；重登录→Dialog 弹框；均无页面跳转 |
| 间距系统（4px 倍数） | ✅ | 使用 `p-4 p-5 p-6 gap-2 gap-3 mt-4 mt-5 mt-6 space-y-5` 等标准 Tailwind 间距 |
| 圆角规范 | ✅ | 卡片区域 `rounded-xl`（12px）、操作区块 `rounded-lg`（8px），符合规范 |
| 空状态 / 加载状态处理 | ✅ | CREATING_SESSION → Loader2 spinner；IDLE/FAILED → ShieldAlert 说明；二维码区域有 `min-h-80` 占位 |
| 暗色主题变量 | ✅ | 无 `dark:` 硬编码切换，全部走 CSS 变量体系，自动适配主题 |

---

## 问题列表

### [T-001] 登录状态 Badge 展示未做前端账号类型守卫（非阻塞）

- **严重度**：Low
- **位置**：`account-detail-header.tsx`、`account-login-status-badge.tsx`
- **描述**：`AccountLoginStatusBadge` 在前端不加 `account.type === 'MY_ACCOUNT'` 条件，所有进入详情页的账号均展示登录状态 Badge。
- **实际影响**：服务端 `getAccountDetail()` 对 BENCHMARK_ACCOUNT 返回 404，前端不会出现 BENCHMARK_ACCOUNT 数据，运行时无问题。
- **预期**：若仅做前端防御性守卫则更健壮。
- **结论**：当前行为符合预期，非阻塞，可做可不做。

### [T-002] `pnpm build` 要求 NEXTAUTH_SECRET ≥ 32 字符（非阻塞，预期行为）

- **严重度**：Low
- **位置**：`src/lib/env.ts`
- **描述**：使用短占位 secret（如 `test`）运行 `pnpm build` 会触发 Zod ZodError 中断构建，提示 `String must contain at least 32 character(s)`。
- **预期**：构建顺利通过（使用 ≥ 32 字符的 secret 可复现）。
- **实际**：使用 `test-secret-for-build-at-least-32-chars-long` 后构建成功。
- **建议**：在 deploy 文档中明确 NEXTAUTH_SECRET 最低 32 字符要求，无需代码改动。

---

## 真实环境验收说明（本轮无法执行）

以下 5 条验收标准需在具备真实 Playwright / Chromium 运行环境和抖音账号的目标环境中执行：

| 编号 | 验收标准 | 阻塞原因 |
|------|---------|---------|
| R-01 | 扫码后状态切换「已扫码待确认」→「登录成功」可见 | 需手机抖音 App 真实扫码 |
| R-02 | 登录成功后数据库写入 MY_ACCOUNT，storageState 文件落盘 | 需真实 DB + Playwright 运行 |
| R-03 | 连续录入两个账号，两条记录独立、两个文件路径不同 | 需双账号真实测试 |
| R-04 | 重登录时扫错号，系统拦截并保持原账号登录态不变 | 需两个真实抖音账号 |
| R-05 | 收藏同步端对端：账号 Cookie 实际传给 crawler 并返回收藏列表 | 需 crawler API + 有收藏的真实账号 |

---

## 自省

### 回顾

1. **requirements.md 验收标准完整性**：AC-5（未捕获 favorite 请求）将 SEC_USER_ID_UNRESOLVED 和 COOKIE_HEADER_UNRESOLVED 合并为一条标准，但实现中是两个独立错误路径，各自有不同的前端文案。建议下次拆分为两条分别验收。

2. **ui-ux-system.md 检查维度**：本次新增了三步进度条 UI（Step 1 / Step 2 / Step 3），该复合 UI 模式在 ui-ux-system.md 中没有对应规范，无法做一致性对标。建议补充步骤类 UI 的使用规范。

### 检查

本次测试发现 T-001（账号类型前端防御性缺失）在代码评审阶段未被标记，建议在 `review-checklist.md` 中补充此类检查维度。

### 提议（需架构师或编排者确认后执行）

以下改动**不在测试角色职责范围内**，仅作提议：

1. **`docs/standards/review-checklist.md`**：在「前端组件」检查节补充：
   > 展示账号类型专属 UI（登录状态 badge、重登录按钮等）时，是否有前端防御性 `account.type === 'MY_ACCOUNT'` 条件，即使服务端已有约束

2. **`docs/product/versions/v0.3.0.2/requirements.md`**（或后续版本附注）：
   > AC-5 建议拆分为两条独立验收标准：① secUserId 未解析时不建号；② rawCookie 未解析时不建号
