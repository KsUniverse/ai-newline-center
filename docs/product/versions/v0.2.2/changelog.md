# Changelog — v0.2.2

> 发布日期: 2026-04-04  
> 状态: Released

## 摘要

- 完成 F-002-1「收藏同步」后端实现
- 完成 F-002-2「对标账号管理」后端实现
- 统一账号域实现风格：`MY_ACCOUNT` / `BENCHMARK_ACCOUNT` 改为共享 Repository 查询构建 + 语义方法封装
- 将“抽象优先、统一风格优先、避免复制式实现、实现后回写文档”同步到 `docs/` 与 `.github/` 指令体系

## 后端功能

### 收藏同步

- 新增 `COLLECTION_SYNC_CRON` 环境变量
- `CrawlerService.fetchCollectionVideos()` 改为结构化返回 `{ items, hasMore, cursor }`
- `SyncService` 新增 `runCollectionSync()`
- `scheduler.ts` 注册第 4 个定时任务，并增加收藏同步防重入

### 对标账号管理

- 新增 `BenchmarkAccountService`
- 新增 `/api/benchmarks/*` 路由组：
  - `GET/POST /api/benchmarks`
  - `POST /api/benchmarks/preview`
  - `GET /api/benchmarks/archived`
  - `GET/DELETE /api/benchmarks/{id}`
  - `GET /api/benchmarks/{id}/videos`
- 新增 `BenchmarkAccountDTO`、`BenchmarkAccountDetailDTO`

## 实现风格统一

- `DouyinAccountRepository` 补充共享查询构建逻辑，避免 `MY_ACCOUNT` / `BENCHMARK_ACCOUNT` 各自复制近似查询
- `DouyinAccountService` 抽出共享预览映射逻辑
- 收藏同步与对标账号管理沿用统一的错误处理、分页和权限校验风格

## 文档与提示词同步

### 文档

- 更新 `docs/architecture/*`：补充抽象优先、统一风格优先、同领域共享查询构建
- 更新 `docs/standards/*`：补充避免复制式实现、评审检查项、文档同步要求
- 更新 `docs/workflow/PROCESS.md`：把这些原则前移到设计、开发、自省阶段
- 更新 `docs/product/*`：补充 PRD 扩展原则、ROADMAP 提醒、v0.2.2 前后端任务策略

### GitHub Copilot 指令

- 更新 `.github/agents/*`
- 更新 `.github/instructions/*`
- 使 Copilot 与项目文档在“抽象优先、统一风格优先、避免复制式实现”上保持一致

## 验证

- `pnpm type-check` ✅
- `pnpm lint` ✅
- `pnpm test` ⚠️ 当前环境 `vitest` 启动阶段被 `esbuild spawn EPERM` 阻断，未完成执行
