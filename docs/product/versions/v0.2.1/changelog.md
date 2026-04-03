# Changelog — v0.2.1

> 发布日期: 2026-04-03
> 分支: feature/v0.2.1 → main

## 新增功能

### 账号信息定时同步 (F-001-2)

- **账号信息同步定时器** (F-001-2a)：全局扫描所有 DouyinAccount，每 6 小时自动同步昵称/粉丝数/头像等基础字段
- **视频增量同步定时器** (F-001-2b)：全局扫描所有 DouyinAccount，每 1 小时增量抓取新视频 + 更新数据指标，最多 3 页，全量 upsert 幂等写入
- **手动触发同步** (F-001-2c)：账号详情页「立即同步」按钮，EMPLOYEE 可触发自己的账号同步，带 loading/成功/失败 toast 反馈
- **同步状态展示** (F-001-2d)：账号详情页显示「最后同步时间」（相对时间格式：刚刚 / N 分钟前 / N 小时前 / MM-DD HH:mm / 尚未同步）

## 技术实现

- **定时任务架构**：`instrumentation.ts` → `startScheduler()`，`initialized` 标志防重复注册，node-cron 实现
- **环境变量**：`CRAWLER_API_URL`、`REDIS_URL`、`ACCOUNT_SYNC_CRON`、`VIDEO_SYNC_CRON` — 均可选，有默认值
- **构建修复**：`env.ts` 添加 `NEXT_PHASE !== "phase-production-build"` 守卫，避免 `pnpm build` 因缺少 `CRAWLER_API_URL` 失败
- **schema 变更**：`DouyinAccount` 新增 `lastSyncedAt DateTime?` 字段

## 新增 API

| Method | 路径 | 权限 | 说明 |
|--------|------|------|------|
| POST | `/api/douyin-accounts/[id]/sync` | EMPLOYEE (自己的账号) | 手动触发同步 |

## 评审修复

| ID | 类型 | 描述 |
|----|------|------|
| H-001 | High | 手动同步 API 补全 organizationId 数据隔离（跨组织访问返回 404 而非 403，消除信息泄露） |
| M-001 | Medium | `syncAccountInfo` 改为返回 `Promise<Date>`，消除对象突变回传状态的反模式 |
| M-002 | Medium | `AccountDetailHeader` 添加 `"use client"` 指令 |
| L-001~L-003 | Low | 导入顺序规范、instrumentation.ts 注释说明 |
