# v0.3.2.1 需求文档

## 基本信息

| 属性 | 值 |
|------|----|
| **版本号** | v0.3.2.1 |
| **里程碑** | v0.3.x — AI 拆解 + 碎片观点 |
| **依赖版本** | v0.3.2（碎片观点库） |
| **功能点数** | 2 |
| **优先级分布** | P0(2) |
| **主题** | 仪表盘改造 |

## 版本定位

在 v0.3.2 碎片观点库之后，本版作为补丁迭代，将仪表盘从纯快速入口升级为运营数据中心，新增短视频列表（含标签/带单管理）和封禁账号追踪两个数据 Section，让团队在首页即可完成日常监控与打标操作。

---

## 摘要

- **版本目标**：改造仪表盘，增加对标视频打标和封禁账号监控能力
- **功能数量**：2 个
- **交付内容**：
  - `BenchmarkVideo` 新增 `customTag`、`isBringOrder` 字段 + 仪表盘视频列表 Section
  - `BenchmarkAccount` 新增 `isBanned`、`bannedAt` 字段 + 仪表盘封禁账号 Section

---

## 边界结论

### 范围内

- 仪表盘新增"短视频列表" Section（筛选 + 排序 + 打标操作）
- 仪表盘新增"封禁账号" Section（筛选 + toggle 封禁状态）
- 数据库新增对应字段 + API 端点
- 所有操作限当前组织（organizationId 隔离）

### 非目标（不在本版实现）

- 批量打标 / 批量标记封禁
- BenchmarkVideo 详情页改造
- 封禁账号自动同步（人工标记，非爬虫感知）
- 统计图表 / 趋势分析
- 导出功能

---

## 数据模型变更

### BenchmarkVideo 新增字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `customTag` | `BenchmarkVideoTag?` (enum) | `null` | 人工自定义标签，可为空 |
| `isBringOrder` | `Boolean` | `false` | 是否带单（人工标记） |

**枚举 `BenchmarkVideoTag` 预设值**：

| 枚举值 | 显示文本 |
|--------|----------|
| `LIMIT_UP` | 涨停榜 |
| `DRAGON_TIGER` | 龙虎榜 |
| `OVERNIGHT` | 隔夜单 |
| `DARK_POOL` | 暗盘资金 |
| `THEME_REVIEW` | 题材梳理 |
| `THREE_DRAGONS` | 三只妖龙 |
| `NOON_REVIEW` | 午评 |
| `RECAP` | 复盘 |

### BenchmarkAccount 新增字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `isBanned` | `Boolean` | `false` | 是否被平台封禁（人工标记） |
| `bannedAt` | `DateTime?` | `null` | 封禁时间，标记封禁时自动记录当前时间；取消封禁时清空 |

---

## 功能详细需求

### F-Dashboard-1：仪表盘短视频列表（P0）

**用户故事**

作为运营人员，我希望在仪表盘上看到对标账号发布的短视频列表，并能快速打上标签、标记带单状态，方便追踪内容质量和带货情况，无需跳转到对标账号详情页。

**页面位置**

仪表盘（`/dashboard`）现有"Quick Entry"快捷入口 Section 下方，新增"短视频列表" Section。

**默认展示**

- 默认排序：`likeCount` 倒序
- 默认筛选：今日（`publishedAt` 在今日范围内）
- 每页 20 条，使用 **cursor 分页**（基于 `likeCount` DESC + `id`），支持"加载更多"按钮（非无限滚动）

**列表字段**

每条视频展示：
1. **封面图**（`coverUrl`，固定尺寸缩略图，加载失败显示占位符）
2. **标题**（`title`，最多 2 行截断，超出省略）
3. **所属账号昵称**（`account.nickname`）
4. **点赞数**（`likeCount`，格式化为 w 单位，如 1.2w）
5. **发布时间**（`publishedAt`，相对时间，如"3小时前"）
6. **自定义标签**（`customTag`，枚举显示文，无标签时显示"—"占位）
7. **带单状态**（`isBringOrder`，Badge 展示：带单 / 无）

**筛选项**

| 筛选维度 | 选项 | 说明 |
|----------|------|------|
| 日期范围 | 今日 / 昨日 / 本周 | 按 `publishedAt`，`publishedAt` 为 null 的记录不出现在列表 |
| 自定义标签 | 全部 / 各枚举值 | 按 `customTag` 精确匹配；"全部"不过滤 |
| 带单状态 | 全部 / 带单 / 不带单 | 按 `isBringOrder`；"全部"不过滤 |

筛选项以 Tab / Select 形式呈现（日期用 Tab，标签和带单用 Select），切换后重置到第一页。

**操作**

1. **切换自定义标签**：点击该条视频的标签区域，弹出下拉菜单，列出全部预设标签 + "清除标签"选项；选择后立即更新，无需确认弹框。
2. **切换带单状态**：点击带单 Badge，立即 toggle `isBringOrder`（乐观更新，失败时还原）。

**API 端点**

- `GET /api/dashboard/benchmark-videos`：列表查询（支持 `dateRange`、`customTag`、`isBringOrder`、`cursor`、`limit` 参数）
- `PATCH /api/benchmark-videos/[id]/tag`：更新 `customTag`（body: `{ customTag: string | null }`）
- `PATCH /api/benchmark-videos/[id]/bring-order`：更新 `isBringOrder`（body: `{ isBringOrder: boolean }`）

**验收标准**

1. 仪表盘加载后，短视频列表默认展示今日（按 `publishedAt`）且按 `likeCount` 倒序的记录
2. 切换日期筛选 Tab，列表数据即时更新
3. 按标签 / 带单状态筛选，结果准确（空结果时展示空状态提示）
4. 点击标签区域，下拉列出所有预设标签 + 清除选项；选择后当行标签立即变更
5. 点击带单 Badge，状态立即切换（带单⇄无），刷新后状态持久
6. "加载更多"按钮正常工作，cursor 分页不重复、不丢失数据
7. 所有操作受 organizationId 隔离，跨组织数据不可见

---

### F-Dashboard-2：仪表盘封禁账号列表（P0）

**用户故事**

作为运营人员，我希望在仪表盘上手动标记被平台封禁的对标账号，并按时间维度筛选，快速了解近期封禁情况，评估竞品账号的健康状态。

**页面位置**

仪表盘（`/dashboard`）短视频列表 Section 下方，新增"封禁账号" Section。

**默认展示**

- 默认筛选：本周（`bannedAt` 在本周范围内）
- 展示已标记封禁（`isBanned = true`）且 `bannedAt` 在筛选范围内的账号
- 无分页（日/周/月维度数量有限，直接全量展示，最多 100 条）

**列表字段**

每条账号展示：
1. **头像**（`avatar`，圆形，加载失败显示占位符）
2. **昵称**（`nickname`）
3. **抖音号**（`douyinNumber`，无则显示"—"）
4. **封禁时间**（`bannedAt`，格式：`MM-DD HH:mm`）
5. **操作**：取消封禁按钮（点击后 `isBanned` → false，`bannedAt` → null，该条从列表消失）

**筛选项**

| 选项 | 说明 |
|------|------|
| 今日 | `bannedAt` 在今天 0:00–23:59 |
| 昨日 | `bannedAt` 在昨天 0:00–23:59 |
| 本周 | `bannedAt` 在本自然周（周一起始） |
| 本月 | `bannedAt` 在本自然月 |

筛选以 Tab 形式呈现，切换后列表即时更新。

**标记封禁入口**

本 Section 顶部提供一个"标记封禁"按钮，点击后弹出简单对话框：
- 内容：从当前组织的 BenchmarkAccount 中搜索（按昵称/抖音号模糊匹配），选择一个账号
- 确认后：`isBanned` → true，`bannedAt` → 当前时间
- 若账号已是封禁状态，则提示"该账号已被标记为封禁"
- 对话框使用已有的 Dialog 组件

**API 端点**

- `GET /api/dashboard/banned-accounts`：查询封禁账号列表（支持 `dateRange` 参数）
- `PATCH /api/benchmark-accounts/[id]/ban`：标记/取消封禁（body: `{ isBanned: boolean }`，服务端自动处理 `bannedAt`）

**验收标准**

1. 仪表盘加载后，封禁账号列表默认展示本周被标记封禁的账号
2. 切换日期 Tab，列表数据即时更新
3. 点击"标记封禁"，弹框支持按昵称/抖音号搜索并选择账号；确认后账号出现在当前筛选列表（若时间范围匹配）
4. 点击"取消封禁"，该条立即从列表消失，数据库中 `isBanned` = false，`bannedAt` = null
5. 无封禁记录时展示空状态提示
6. 所有操作受 organizationId 隔离
