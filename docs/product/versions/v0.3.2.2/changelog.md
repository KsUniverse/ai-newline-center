# v0.3.2.2 Changelog

发布日期: 2025-01-27

## 新增功能

### 系统设置 — 爬虫 Cookie 管理
- 新增「系统设置」导航分组（超管可见，支持折叠）
- 新增子菜单「爬虫 Cookie」管理页面（仅 SUPER_ADMIN 访问）
- 支持添加多个爬虫 Cookie（AES-256-GCM 加密存储）
- 支持单条删除 / 批量删除 Cookie
- 列表展示 Cookie 前20字符（脱敏展示）及创建时间

### 爬虫 Cookie 轮换逻辑
- 每次请求通过 Redis INCR 维护计数器（`crawler:cookie:counter:{orgId}`）
- 每累计 5 次请求自动切换下一个 Cookie
- 调用爬虫 `/api/hybrid/update_cookie`（service: douyin_web）同步激活新 Cookie
- Cookie 删除后自动重置 Redis 状态（指针归零）

## 技术变更

- 新增 `CrawlerCookie` 数据库表（`crawler_cookies`）及迁移文件
- 新增 `src/lib/crypto.ts` — AES-256-GCM 加解密工具
- 新增 Repository: `crawler-cookie.repository.ts`
- 新增 Service: `crawler-cookie.service.ts`
- 修改 `crawler.service.ts` — 添加 Cookie 轮换逻辑
- 新增 API 路由: `GET/POST/DELETE /api/settings/crawler-cookies`、`DELETE /api/settings/crawler-cookies/[id]`
- 新增前端页面组件: `CrawlerCookiePage`、`CrawlerCookieTable`、`CrawlerCookieAddDialog`
- 更新导航: 支持 `AppNavGroup` 分组结构，侧栏支持折叠分组

## 修复

- middleware 新增 `/settings/:path*` 覆盖，未登录用户访问设置页直接跳转 `/login`
- 导航在 session 加载中 (`status: "loading"`) 不再闪现受限菜单项
- `parseInt` NaN 防御 + Cookie 池为空时的边界守卫

## 环境变量

需新增（必填）：
```
CRAWLER_COOKIE_ENCRYPTION_KEY=<64位十六进制字符串>
```
