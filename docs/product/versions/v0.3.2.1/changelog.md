# v0.3.2.1 Changelog

## 版本信息

| 属性 | 值 |
|------|----|
| **版本号** | v0.3.2.1 |
| **发布日期** | 2026-04-16 |
| **基于** | v0.3.2 |
| **分支** | feature/v0.3.2.1 |

## 变更内容

### 新增功能

- **仪表盘 — 短视频列表 Section**（F-Dashboard-1）
  - 展示对标账号视频列表，支持按标签/带单状态筛选
  - 支持为视频设置自定义标签（精彩内容/学习参考/带单视频/低质内容）
  - 支持标记/取消"带单"状态
  - 分页加载，默认每页 20 条

- **仪表盘 — 封禁账号 Section**（F-Dashboard-2）
  - 展示被标记为封禁的对标账号列表
  - 支持切换账号封禁状态（封禁↔正常）
  - 展示封禁时间

### 数据库变更

- `BenchmarkVideo` 新增字段：
  - `customTag` (`BenchmarkVideoTag?` enum)：人工自定义标签
  - `isBringOrder` (`Boolean`, 默认 `false`)：是否带单
- `BenchmarkAccount` 新增字段：
  - `isBanned` (`Boolean`, 默认 `false`)：是否封禁
  - `bannedAt` (`DateTime?`)：封禁时间

### API 新增

- `GET /api/dashboard/benchmark-videos` — 仪表盘视频列表（分页 + 筛选）
- `PATCH /api/dashboard/benchmark-videos/[awemeId]/tag` — 更新视频标签
- `GET /api/dashboard/banned-accounts` — 封禁账号列表（分页）
- `PATCH /api/dashboard/benchmark-accounts/[secUserId]/ban` — 切换封禁状态

## 已知问题

无

## 升级说明

需执行数据库迁移以添加新字段：

```bash
pnpm db:migrate
```
