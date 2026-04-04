# Changelog — v0.3.0.2

> 发布日期: 2026-04-04  
> 状态: ✅ 已发布

## 摘要

本版本实现员工抖音账号扫码登录与账号级 Cookie 持久化能力，包含扫码建号、重登录保护、登录态展示与收藏同步 Cookie 透传四个核心能力点。

## Feature-2A — 员工抖音账号扫码登录与自动建号

- 添加账号时通过 Playwright 打开抖音登录页，展示二维码供员工扫码
- 前端轮询登录状态，支持 7 种视图状态（IDLE/CREATING/QRCODE\_READY/SCANNED/SUCCESS/EXPIRED/FAILED）
- 扫码成功后监听 `aweme/favorite` 请求捕获 `secUserId` 和 Cookie header
- 通过 Prisma 事务自动创建 `MY_ACCOUNT` 型账号，并将临时登录态文件迁移为账号正式登录态
- Fail-closed：`secUserId` 无法可靠提取时会话失败，不自动建号
- 并发防串号：每个员工同时不超过 1 个活跃登录会话

## Feature-2B — 登录态持久化、状态展示与收藏同步 Cookie 透传

- 账号登录态存储为服务端 `storageState` JSON 文件，安全目录隔离（禁止写入 public/）
- 账号详情页展示登录状态 Badge （LOGGED\_IN / EXPIRED / NOT\_LOGGED\_IN / ERROR）
- `AccountLoginStatusCard` 展示登录状态详情（时间戳、错误信息、重登录入口），仅对 `MY_ACCOUNT` 展示
- 重登录（`AccountReloginDialog`）强制校验扫码账号与目标账号 `secUserId` 一致，扫错账号不会覆盖登录态
- 收藏同步按账号读取登录态文件解析出完整 Cookie header，透传给 crawler API
- 无登录态账号在收藏同步中被跳过，不误标为 EXPIRED

## 主要技术变更

- 新增 `DouyinLoginSession` 模型（登录会话表）
- `DouyinAccount` 新增 `loginStatus`、`loginStatePath`、`loginStateUpdatedAt`、`loginStateCheckedAt`、`loginStateExpiresAt`、`loginErrorMessage`、`favoriteCookieHeader` 字段
- 5 个新增 API 路由：创建会话、轮询状态、刷新二维码、取消会话、重登录
- 新增 `DouyinAuthService`、`DouyinLoginSessionManager`、`DouyinLoginStateStorageService` 三个服务

