# Changelog — v0.2.1.1

> 发布日期: 2026-04-04  
> 分支: feature/v0.2.1.1 → main

## 新增功能

### 爬虫真实 API 对接 (F-CRAWLER-1 ~ F-CRAWLER-5)

- **CrawlerService 重写**：替换所有 mock 实现为真实爬虫 REST API 调用（5 个接口）：
  - `/api/douyin/web/get_sec_user_id` — URL → secUserId
  - `/api/douyin/web/handler_user_profile` — secUserId → 账号资料
  - 视频列表接口 — secUserId → 视频列表
  - `/api/douyin/web/fetch_user_collection_videos` — 收藏视频列表（骨架）
  - `/api/douyin/web/fetch_one_video` — 单条视频快照数据
  - 所有接口响应完整打印 JSON 日志（日志驱动字段映射）
  - 请求 30s 超时 + 2 次线性退避重试

- **secUserId 引入**：`DouyinAccount` 新增 `secUserId String @unique` 字段；添加账号改为两步流程（URL → secUserId → profile）；存量账号首次同步时自动回填

- **视频同步策略升级**：首次同步取前 10 条；增量同步每批 4 条，遇到 DB 已存在的 videoId 即停止；安全上限 10 批（最多 40 条）

- **VideoSnapshot 快照采集**：新增 `VideoSnapshot` 数据模型（videoId/timestamp/播放量/点赞/评论/转发）；新增视频快照定时器，每 10 分钟调用 `fetch_one_video` 采集全量视频数据，写入快照记录不覆盖历史

- **StorageService 骨架**：新增 `StorageService`，定义 `downloadAndStore(url, category)` 接口，当前仅打印待下载日志，不实际执行下载

### 账号首页改版 (F-HOME-1)

- **三段式布局**：将原来纯账号卡片网格改版为：顶部账号水平滚动行 → 筛选排序栏 → 视频网格
- **跨账号视频网格**：新增 GET `/api/videos` 端点，汇总当前用户权限范围内所有账号的视频；按角色自动隔离数据（员工仅自己、负责人本公司、超管全部）
- **3:4 视频卡片**：新组件 `VideoGridCard`，aspect-[3/4] 比例，封面铺满，底部渐变遮罩展示标题/♥点赞/发布时间（yyyy-MM-dd HH:mm）
- **hover 自动播放**：鼠标悬停自动播放视频（muted loop），离开暂停回到封面；同一时间最多一个视频播放
- **筛选排序**：按账号筛选 + 按标签筛选（无标签时隐藏）+ 排序切换（最新发布 / 最多点赞）

## 数据模型变更

| 变更 | 说明 |
|------|------|
| `DouyinAccount` +`secUserId` | 抖音用户安全 ID，`@unique`，用于所有后续接口调用 |
| `DouyinVideo` +`tags` | 标签数组 `String[]`，默认空数组，后续迭代填充 |
| 新增 `VideoSnapshot` | 视频数据快照模型，支持时序数据存储 |

## 新增 API

| Method | 路径 | 权限 | 说明 |
|--------|------|------|------|
| GET | `/api/videos` | 所有角色 | 跨账号视频列表（支持 page/limit/accountId/tag/sort/order） |

## 新增组件

| 组件 | 说明 |
|------|------|
| `VideoGridCard` | 3:4 视频网格卡片，hover 播放 |
| `VideoGrid` | 响应式视频网格容器（2→3→4 列） |
| `VideoFilterBar` | 账号/标签/排序筛选栏 |
| `AccountRow` | 水平滚动账号行容器 |
| `AccountRowCard` | 精简账号卡片 |

## 技术实现

- 新增环境变量: `VIDEO_SNAPSHOT_CRON`（默认 `*/10 * * * *`）
- 新增服务: `VideoService`, `StorageService`, `VideoSnapshotRepository`
- `DouyinVideoRepository.findAllActive()` 新增过滤软删除账号关联的视频

## 评审修复

| ID | 类型 | 描述 |
|----|------|------|
| H-001 | High | `findAllActive` 新增过滤软删除账号，避免无效爬虫采集 |
| M-002 | Medium | `upsertByVideoId` update 分支补全 `publishedAt` + `tags` 字段 |
| L-001 | Low | 视频播放失败时回退到封面显示 |
| L-002 | Low | 更新 `.env.example` 中 CRAWLER_API_URL 注释 |
| T-001 | Low | 补充 `useEffect` 依赖 `onHoverEnd` |

## 测试

- 测试数量: 64（新增 10 个用例）
- 测试通过率: 64/64（100%）
- Build: 通过（无类型错误）
