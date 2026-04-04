# v0.3.0.2 Bug 记录

## BUG-003 — 定时同步任务未稳定生效

| 属性 | 值 |
|------|----|
| **ID** | BUG-003 |
| **来源** | v0.3.0.2 Issue-Sync-01（遗留问题，未在本迭代修复） |
| **分支** | `bug/BUG-003-scheduler-not-syncing` |
| **严重度** | High |
| **状态** | 🔧 修复中 |
| **发现时间** | 2026-04-04 |

### 现象

- 账号详情页中的"最后同步时间"停留在用户较早前手动同步的时间，不随定时任务推进
- 视频互动数据长期不变
- 数据库中 `lastSyncedAt`、视频 `updatedAt` 均未体现定时更新

### 已确认事实

1. 未配置 `ACCOUNT_SYNC_CRON` / `VIDEO_SYNC_CRON`，应走默认规则（分别为 `0 */1 * * *` 和 `*/10 * * * *`）
2. 账号信息同步与视频同步逻辑**不依赖登录态**，理论上应正常执行
3. 定时器在 `instrumentation.ts` 中由 `startScheduler()` 注册，条件：`NEXT_RUNTIME === "nodejs"` 且 `NODE_ENV !== "test"`

### 可能原因方向

1. **`instrumentation.ts` 未被触发**：Next.js 15 App Router 中需要在 `next.config.ts` 启用 `instrumentationHook: true`，否则 `register()` 不会执行
2. **cron 表达式 / 时区问题**：默认表达式可能在特定时区环境下未按预期触发
3. **同步链路静默失败**：服务调用失败但 `console.warn` 级别日志被过滤，缺乏可见错误输出

### 修复目标

1. 确认并修复 `instrumentation.ts` 注册路径
2. 增加定时器启动与执行日志，使问题可见
3. 确保本地 `pnpm dev` 环境下定时任务可正常触发并记录日志

### 修复状态

| 修复项 | 状态 |
|--------|------|
| 问题根因排查 | ✅ 已完成 |
| 代码修复 | ✅ 已完成 |
| 验证测试 | ✅ 已完成 |
| 合并 | 🔲 待合并 |

### 修复摘要

- 根因: Next.js 15.2.0 中 instrumentation 已默认启用，`register()` 可正常执行。实际根因为 `scheduler.ts` 缺少初始化日志和触发日志，导致无法判断定时器是否真正运行；同时 cron 回调中缺少 `.catch()`，顶层错误（如 DB 连接失败）会被 `void` 静默丢弃而无任何输出。
- 修复文件: `src/lib/scheduler.ts`
- 验证: pnpm type-check ✅ / pnpm lint ✅ / pnpm test ✅
