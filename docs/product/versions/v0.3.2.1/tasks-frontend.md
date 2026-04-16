# v0.3.2.1 前端任务清单

## 必读文档
- `docs/product/versions/v0.3.2.1/requirements.md`
- `docs/product/versions/v0.3.2.1/technical-design.md`
- `docs/architecture/frontend.md`
- `docs/standards/ui-ux-system.md`
- `.github/instructions/frontend.instructions.md`

## 前置条件
后端 T-001 ~ T-009 全部完成后再开始前端实现。

## 任务清单

### T-010: 前端类型定义

**描述**
新建 `src/types/benchmark-video.ts`（如不存在），定义：
- `BenchmarkVideoTag` 枚举（从 `@prisma/client` re-export 或单独定义字符串联合类型）
- `BENCHMARK_VIDEO_TAG_LABELS` 显示映射
- `DashboardVideoItem` 接口
- `BannedAccountItem` 接口
- `DateRangeToken` 类型：`'today' | 'yesterday' | 'this_week' | 'this_month'`

**涉及文件**
- `src/types/benchmark-video.ts`（新建）

---

### T-011: DashboardVideoSection 组件

**描述**
新建 `src/components/features/dashboard/dashboard-video-section.tsx`（Client Component）

**功能**
- Section 标题："短视频列表"（eyebrow: "Video Monitor"）
- 筛选栏：
  - 日期 Tab：今日 / 昨日 / 本周（默认今日）
  - 标签 Select：全部 / 各预设标签（使用 shadcn/ui Select）
  - 带单 Select：全部 / 带单 / 不带单
- 视频列表（grid 或 table）每条展示：
  - 封面图（固定 64×64 圆角，封面加载失败显示灰色占位）
  - 标题（2 行截断）
  - 所属账号昵称（小字）
  - 点赞数（格式化，如 12300 → 1.2w）
  - 发布时间（相对时间格式）
  - 自定义标签 Badge（无标签时显示灰色 "—"，有标签时显示对应中文名并可点击弹下拉切换）
  - 带单状态 Badge（带单=green badge，不带单=gray badge，可点击切换）
- "加载更多"按钮（nextCursor 存在时显示）
- 空状态提示（无数据时）

**状态管理**
- `dateRange: 'today' | 'yesterday' | 'this_week'`
- `customTag: BenchmarkVideoTag | ''`（空字符串=全部）
- `isBringOrder: 'all' | 'true' | 'false'`
- `items: DashboardVideoItem[]`
- `nextCursor: string | null`
- `loading: boolean`
- `loadingMore: boolean`

**乐观更新逻辑**
- `handleTagChange(videoId, newTag)`: 先 setItems更新，再 PATCH，失败时还原
- `handleBringOrderToggle(videoId)`: 同上

**涉及文件**
- `src/components/features/dashboard/dashboard-video-section.tsx`（新建）

---

### T-012: DashboardBannedSection 组件

**描述**
新建 `src/components/features/dashboard/dashboard-banned-section.tsx`（Client Component）

**功能**
- Section 标题："封禁账号"（eyebrow: "Ban Monitor"）
- 顶部操作栏：日期 Tab（今日/昨日/本周/本月，默认本周）+ "标记封禁"按钮
- 账号列表每条展示：
  - 头像（32×32 圆形）
  - 昵称
  - 抖音号（无则显示"—"）
  - 封禁时间（MM-DD HH:mm 格式）
  - "取消封禁"按钮（outline, small）
- 空状态提示

**标记封禁弹框（MarkBanDialog）**
- 使用 shadcn/ui Dialog
- 内嵌搜索输入框 + 搜索结果列表（调用 `/api/benchmarks/search?q=...`）
- 选择账号后显示确认按钮，点击确认调用 `PATCH /api/benchmarks/[id]/ban {isBanned: true}`
- 弹框关闭后刷新列表

**乐观更新**
- 取消封禁：立即从 items 中移除该条，再 PATCH，失败时还原（重新 fetch）

**涉及文件**
- `src/components/features/dashboard/dashboard-banned-section.tsx`（新建）

---

### T-013: 更新 DashboardHome，集成两个新 Section

**描述**
修改 `src/components/features/dashboard/dashboard-home.tsx`：
- 在现有 Quick Entry Section 下方追加 `<DashboardVideoSection />` 和 `<DashboardBannedSection />`
- 两个组件 lazy import（使用 `dynamic` 或直接 import，无需 SSR 数据）

**涉及文件**
- `src/components/features/dashboard/dashboard-home.tsx`
- `src/components/features/dashboard/index.ts`（更新导出，如需）

---

### T-014: API Client 扩展

**描述**
在 `src/lib/api-client.ts` 中追加 dashboard 相关方法（在现有 `apiClient` 对象上扩展或抽成独立函数）：

```ts
// 仪表盘视频列表
getDashboardVideos(params: DashboardVideoQueryParams): Promise<DashboardVideosResult>

// 仪表盘封禁账号
getDashboardBannedAccounts(params: { dateRange: string }): Promise<{ items: BannedAccountItem[] }>

// 更新视频标签
updateBenchmarkVideoTag(id: string, customTag: BenchmarkVideoTag | null): Promise<void>

// 切换带单
updateBenchmarkVideoBringOrder(id: string, isBringOrder: boolean): Promise<void>

// 封禁/取消封禁
updateBenchmarkAccountBan(id: string, isBanned: boolean): Promise<void>

// 搜索账号
searchBenchmarkAccounts(q: string, limit?: number): Promise<{ items: SearchAccountItem[] }>
```

**涉及文件**
- `src/lib/api-client.ts`

---

## 自省要求
完成后在本文件底部写「前端自省」：
- 组件实现与任务描述的差异
- shadcn/ui 组件使用中的注意事项
- 遗留给集成阶段的 TODO 项
