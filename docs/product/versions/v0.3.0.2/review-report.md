# v0.3.0.2 评审报告（重构后终审）

> 状态: 通过 ✅ (2026-04-04)

---

## 评审结论

本次评审覆盖 v0.3.0.2 全部 29 个变更文件，包括后端 13 个文件、前端 14 个文件及 Prisma Schema / 类型定义 2 个文件。

- **零 Critical / High 问题**
- 1 Medium（规范遵循，无安全或正确性风险）
- 4 Low（均属编码规范层面，不影响运行时行为）
- 编译 / 类型 / 测试全部通过

**结论：允许合入主干，Medium / Low 问题可在后续迭代修复。**

---

## 验证摘要

| 检查项 | 结果 |
|--------|------|
| `pnpm type-check` | ✅ 通过，无编译错误 |
| `pnpm lint` | ✅ 通过，无 ESLint 警告 / 错误 |
| `pnpm test` | ✅ 通过，30 个文件 / 104 个用例全部绿灯 |

---

## 问题列表

| # | 文件 | 严重度 | 描述 | 修复建议 |
|---|------|--------|------|----------|
| M-001 | `src/server/services/douyin-login-state-storage.service.ts:107` | Medium | `JSON.parse(content) as Partial<DouyinStorageState>` 使用无注释的类型断言；cookies 数组内部条目结构未做 runtime 校验，若文件被手动篡改或写入异常则行为不可预期 | 添加注释说明断言理由（`// file written by system itself, shape known at write-time`）；可选用 Zod schema 对 cookies 条目做 runtime parse |
| L-001 | `src/server/services/sync.service.ts`（`runCollectionSync` 方法） | Low | `account.secUserId as string` 类型断言缺少注释，编码规范要求 `as` 断言须附说明 | 添加注释：`// requireSecUserId: true in query ensures non-null` |
| L-002 | `src/server/services/crawler.service.ts:270` | Low | `console.info(...)` 在每次 crawler API 调用时输出 response code，高频同步场景下产生大量日志噪音，属编码规范"无 console.log（开发调试遗留）"项 | 移除或替换为结构化日志；若作为运维可观测日志保留，需添加注释说明意图 |
| L-003 | `src/server/services/douyin-auth.service.ts:297` | Low | fire-and-forget 后台同步的 `.catch()` 中使用 `console.error`，属同一编码规范条目 | 添加注释：`// intentional: fire-and-forget sync errors are non-fatal` |
| L-004 | `src/components/features/accounts/account-login-qrcode-panel.tsx`，`account-login-session-content.tsx` | Low | 两个含 onClick / 函数 props 的交互组件未显式声明 `"use client"`。当前仅被客户端组件导入故运行正常，但若未来被误引入服务端上下文将静默失败 | 添加 `"use client"` 声明，与同目录 `account-add-drawer.tsx` 风格保持一致 |

---

## 逐维度评审结果

### 1. 编译与类型安全 ✅

- TypeScript strict 全量通过，无 `any`，无 `@ts-ignore`。
- Zod schema（Route Handler 层）与前端 `types/douyin-account.ts` 保持一致。
- `as` 断言仅出现 2 处（M-001、L-001），均为与外部文件 / 查询约束交互的必要用法，功能安全但缺少注释。

### 2. 逻辑正确性 ✅

- **状态机完整性**：登录会话全部终态（SUCCESS / FAILED / EXPIRED / CANCELLED）均正确路由到清理逻辑（删临时文件 + Playwright 释放 + 账号状态回滚），无泄漏路径。
- **relogin 状态恢复**：`reloginAccountStateSnapshots` 内存快照机制正确；服务重启时通过 fallback 路径（读 DB loginStatus / loginStatePath）处理回滚，与"单进程不做跨进程恢复"约定一致。
- **幂等取消**：`cancelSession` 对 CANCELLED 状态不重复写库；快照在首次 restore 后删除，二次调用为 no-op。
- **自动建号原子性**：`finalizeCreateAccount` 通过 `prisma.$transaction` 保证账号创建 + 会话关联 + 会话标记的原子性；失败时正式文件被删除，无半成品残留。
- **重登录账号匹配校验**：`finalizeRelogin` 对 `secUserId` 一致性做三层检查（账号有 secUserId → 身份已解析 → 身份一致），扫错号不会覆盖正式登录态。
- **Cookie 透传**：`CrawlerService.fetchCollectionVideos` 签名与 `SyncService.runCollectionSync` 消费路径一致，Cookie 仅在服务端账号维度流转，不暴露给前端。
- **Cookie 为空跳过逻辑**：`runCollectionSync` 在 `favoriteCookieHeader` 为 null 时将账号标记为 EXPIRED 并跳过，不裸调用 crawler，与设计文档一致。

### 3. 架构合规性 ✅（一处已确认为全局惯例）

- Route Handler 严格遵循"解析 → 验证 → Service → 返回"模型，无层越调用。
- `DouyinAuthService` 直接 import `prisma` 仅用于 `prisma.$transaction` 事务协调，事务内部全部通过 Repository 操作。经核查 `organization.service.ts` 同样采用此模式，属全局公认惯例，**不计为违规**。
- `DouyinLoginSessionRepository.findById` 在 `organizationId` 层面过滤；`getOwnedSession` 再做 `userId` 二级校验——双层隔离符合设计要求。
- `findLoginStateMeta` 在 `restoreAccountStatusAfterAbort` 中调用时未传 `organizationId`，但调用前 session 所有权已经过 `getOwnedSession(organizationId + userId)` 验证，链路安全，可接受。
- 前端组件均通过 `apiClient` / `douyinLoginSessionClient` 访问 API，无裸 `fetch`。
- 全部共享 DTO 类型定义在 `src/types/douyin-account.ts`，前后端复用。

### 4. API 规范 ✅

- POST 创建类接口（`/douyin-account-login-sessions`、`/douyin-accounts/{id}/relogin`）返回 201。
- GET 查询接口返回 200（默认）。
- 统一响应格式 `{ success, data }` / `{ success, error }` 由 `handleApiError` / `successResponse` 保证。
- 所有路由参数 `id` 经 `paramsSchema = z.object({ id: z.string().cuid() })` 校验，防恶意输入。
- 权限检查：所有路由先 `auth()` 再 `requireRole(..., EMPLOYEE)`，符合技术设计权限矩阵。

### 5. 安全性 ✅

- **路径遍历防护**：`ensureInsideRoot()` 通过 `path.resolve` + `path.relative` 双重校验，读 / 写 / 删 / 移文件操作全部前置调用，正确阻断路径遍历攻击（OWASP A01）。
- **public 目录保护**：`ensurePrivateRoot()` 显式拦截将 `rootDir` 设置到 `public/` 下的配置，防止登录态文件被静态文件服务暴露（OWASP A02）。
- **登录态内容不泄露前端**：`DouyinLoginSessionDTO` 无 `loginStatePath`、`favoriteCookieHeader`、storageState 内容，符合"不把 Cookie 或文件路径暴露给前端"约定。
- **Prisma 参数化查询**：全部通过 ORM，无 SQL 注入风险（OWASP A03）。

### 6. 编码规范

- 文件命名 kebab-case ✅，组件 PascalCase ✅，Hook `use` 前缀 ✅，导入顺序 ✅。
- 问题见 L-001 ～ L-004（类型断言无注释、console.* 调试残留、缺少 `"use client"` 声明）。

### 7. UI/UX 一致性 ✅

- `AccountLoginStatusBadge`：使用 `Badge` + CSS 变量，无硬编码色值。
- `AccountLoginQrcodePanel`：颜色全部使用 `hsl(var(--success/warning/primary/destructive))` CSS 变量，间距遵循 4px 倍数体系。
- `AccountAddDrawer` 通过 `Sheet`，`AccountReloginDialog` 通过 `Dialog`，符合弹框优先交互规范。
- `AccountDetailHeader` 中重登录入口在 `canRelogin`（EMPLOYEE 角色）条件控制下，UI 权限与后端对齐。
- Prisma `DouyinLoginSession` 含 `id / createdAt / updatedAt` 必备字段及合理索引（`organizationId, status` 复合索引支持活跃会话查询）✅。

---

## 已确认关闭的风险（延续前次评审）

1. 登录成功判定与 `secUserId` 解析为 fail-closed，拿不到可靠身份时会话失败，不自动建号。
2. `CREATE_ACCOUNT` 采用"文件迁移后进入数据库事务"模式，不再残留半成品账号。
3. Playwright 会话具备服务端 TTL 清理与失败释放，不依赖前端持续轮询才能回收资源。
4. 收藏同步不会将无登录态账号误标为 EXPIRED（改为仅在 `loginStatus !== LOGGED_IN` 时跳过，cookie 为空时才执行标记）。
5. `RELOGIN` 已增加扫码账号与目标账号的 `secUserId` 一致性校验，扫错号不覆盖正式登录态。

---

## 自省

### 1. 回顾

本次评审发现了两个值得关注的跨版本模式：

1. **Prisma 查询约束与 TypeScript 类型不对齐**：`requireSecUserId: true` 等查询约束无法自动缩窄返回类型，导致后续代码被迫使用 `as string` 注解。当前既无项目级注释规约也无辅助函数封装，存在扩散风险。
2. **运维日志与调试日志语义模糊**：`sync.service.ts`、`crawler.service.ts`、`douyin-auth.service.ts` 均存在 `console.*` 调用，部分是有意义的批量同步可观测日志，部分是调试残留。`review-checklist.md` 对这两类未作区分，评审时产生歧义。

### 2. 检查

`review-checklist.md` 和 `coding-standards.md` 存在以下遗漏 / 模糊：

- `coding-standards.md` 中 `console.log` 规则未区分"调试日志（应移除）"与"服务端运维日志（可保留但需统一格式）"。
- `review-checklist.md` 中"Service 不直接调用 Prisma"未说明 `$transaction` 豁免场景，导致评审者需查阅现有代码才能判断是否合规。
- `coding-standards.md` 中 `as` 断言规则未说明 Prisma 查询约束穿透场景的处理建议。

### 3. 提议

以下文档修改建议，提交用户确认后由架构师 / 编排者执行：

| 文档 | 修改摘要 |
|------|----------|
| `docs/standards/coding-standards.md` | 在 `console.log` 规则下增加"运维日志"说明（可保留但需 `[ClassName]` 前缀注释）；在 `as` 规则下增加 Prisma 查询约束豁免说明 |
| `docs/standards/review-checklist.md` | 架构合规性"Service 不直接调用 Prisma"条目增加注脚：`prisma.$transaction` 用于跨 Repository 原子协调，为全局公认惯例，不计为违规 |
