# v0.2.0 前端任务清单

> 版本: v0.2.0
> 责任角色: @frontend
> 技术方案: [technical-design.md](technical-design.md)

## 必读文档

开始前按序阅读：
1. [docs/INDEX.md](../../../INDEX.md) — 项目状态
2. [docs/product/versions/v0.2.0/requirements.md](requirements.md) — 本版本需求（理解业务背景）
3. [docs/product/versions/v0.2.0/technical-design.md](technical-design.md) — 本版本技术设计
4. [docs/architecture/OVERVIEW.md](../../../architecture/OVERVIEW.md) — 架构总览
5. [docs/architecture/frontend.md](../../../architecture/frontend.md) — 前端组件体系
6. [docs/architecture/api-conventions.md](../../../architecture/api-conventions.md) — API 设计规范
7. [docs/standards/ui-ux-system.md](../../../standards/ui-ux-system.md) — UI/UX 设计系统（严格遵循）
8. [docs/standards/coding-standards.md](../../../standards/coding-standards.md) — 编码规范

---

## 摘要

- **任务总数**: 12
- **新增文件**: ~12 个
- **修改文件**: 2 个（`app-sidebar.tsx`, `middleware.ts`）

---

## 任务列表

### FE-001 — 共享类型定义 (P0)

**新建文件**: `src/types/douyin-account.ts`

定义以下接口（详见技术方案 §7.1）：

- [x] `DouyinAccountDTO` — 账号列表项类型
- [x] `DouyinAccountDetailDTO` — 账号详情类型（含 `user: { id, name }`）
- [x] `AccountPreview` — 爬虫预览返回类型
- [x] `DouyinVideoDTO` — 视频列表项类型

**要点**:
- 参照 `src/types/organization.ts` 的风格
- 所有时间字段使用 `string` 类型（JSON 序列化后）
- `type` 字段使用字面量联合类型 `"MY_ACCOUNT" | "BENCHMARK_ACCOUNT"`

---

### FE-002 — 图片代理工具函数 (P0)

**修改文件**: `src/lib/utils.ts`

- [x] 新增 `proxyImageUrl(originalUrl: string): string` 函数
  - 返回 `/api/proxy/image?url=${encodeURIComponent(originalUrl)}`
  - 若 `originalUrl` 为空或 falsy，返回空字符串

**要点**:
- 用于所有抖音 CDN 图片显示场景（头像、视频封面）
- 轻量函数，放在 `utils.ts` 中复用

---

### FE-003 — Sidebar 更新 + Middleware 更新 (P0)

**修改文件**:
- `src/components/shared/layout/app-sidebar.tsx`
- `src/middleware.ts`

Sidebar 变更：
- [x] 在 `NAV_ITEMS` 中新增「我的账号」菜单项
  - 图标: `MonitorPlay`（from lucide-react）
  - label: `"我的账号"`
  - href: `/accounts`
  - roles: `["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"]`
- [x] 放置在「仪表盘」之后、「组织管理」之前

Middleware 变更：
- [x] `config.matcher` 数组中新增 `"/accounts/:path*"`

---

### FE-004 — 账号空状态组件 (P0)

**新建文件**: `src/components/features/accounts/account-empty-state.tsx`

- [x] 当没有账号时显示引导性空状态
- [x] 包含：图标（`MonitorPlay` 或 `Plus`）、标题（"还没有添加账号"）、描述文字、添加按钮（可选，仅 EMPLOYEE 可见）
- [x] Props: `onAdd?: () => void`（点击添加按钮回调，传入时显示按钮）
- [x] 遵循 `ui-ux-system.md` 空状态设计规范

---

### FE-005 — 账号卡片组件 (P0)

**新建文件**: `src/components/features/accounts/account-card.tsx`

- [x] 展示单个抖音账号信息卡片
- [x] 内容：头像（通过 `proxyImageUrl` 代理）、昵称、粉丝数（格式化为 x.x 万）、作品数
- [x] Props: `account: DouyinAccountDTO`, `onClick: () => void`
- [x] 卡片具有 hover 效果（`hover:bg-muted/30 transition-colors cursor-pointer`）
- [x] 遵循 Linear 美学规范：
  - 卡片使用 `border border-border/60 rounded-lg bg-card` 样式
  - 头像使用 `rounded-full` 且合理尺寸（如 `h-12 w-12`）
  - 数字使用 `tabular-nums tracking-tight`

---

### FE-006 — 账号卡片 Grid 组件 (P0)

**新建文件**: `src/components/features/accounts/account-card-grid.tsx`

- [x] Grid 布局展示账号卡片
- [x] Props: `accounts: DouyinAccountDTO[]`, `onCardClick: (account: DouyinAccountDTO) => void`
- [x] 响应式 Grid：`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`
- [x] 加载中状态：骨架屏卡片（可选，v0.2.0 不强制要求）

---

### FE-007 — 添加账号 Drawer (P0)

**新建文件**: `src/components/features/accounts/account-add-drawer.tsx`

- [x] 基于 shadcn `Sheet`（右侧滑出 Drawer）
- [x] 两阶段交互（详见技术方案 §3.6 状态机）：
  - **Step 1 — 输入**: URL 输入框 + "获取账号信息"按钮
    - URL 前端格式校验（正则匹配抖音主页链接）
    - 不合法时 inline 错误提示
  - **Step 2 — 预览**: 账号预览卡片（头像、昵称、粉丝数、作品数、简介）+ "添加"按钮
    - 预览信息来自 POST `/api/douyin-accounts/preview` 响应
- [x] 状态处理：
  - FETCHING: loading spinner + 按钮 disabled
  - ERROR: 错误提示（如"获取账号信息失败，请检查链接是否正确"）+ "重试"按钮
  - SUBMITTING: "添加"按钮 loading 状态
  - 成功: Toast 提示 + 关闭 Drawer
- [x] 关闭 Drawer 时重置所有状态
- [x] Props: `open: boolean`, `onOpenChange: (open: boolean) => void`, `onSuccess: () => void`

**API 调用**:
- 预览: `apiClient.post<AccountPreview>("/douyin-accounts/preview", { profileUrl })`
- 添加: `apiClient.post<DouyinAccountDTO>("/douyin-accounts", { ...preview })`

---

### FE-008 — 账号列表页 (P0)

**新建文件**: `src/app/(dashboard)/accounts/page.tsx`

- [x] `"use client"` 页面组件
- [x] 页面标题区：
  - EMPLOYEE: "我的账号"
  - BRANCH_MANAGER: "本公司账号"
  - SUPER_ADMIN: "所有账号"
- [x] "添加账号"按钮：仅 EMPLOYEE 角色可见
- [x] 数据加载：`apiClient.get<PaginatedData<DouyinAccountDTO>>("/douyin-accounts?page=1&limit=100")`
- [x] 状态管理（useState）：`accounts`, `loading`, `drawerOpen`
- [x] 组合组件：
  - `AccountCardGrid`（有数据时）
  - `AccountEmptyState`（无数据时，EMPLOYEE 显示添加按钮）
  - `AccountAddDrawer`（Drawer）
- [x] 点击卡片 → `router.push("/accounts/${account.id}")`
- [x] 添加成功后 → 重新加载列表
- [x] 遵循标准页面结构（见 `frontend.md` 页面结构模板）
- [x] 入场动画：主容器 `animate-in-up`

---

### FE-009 — 账号详情头部组件 (P0)

**新建文件**: `src/components/features/accounts/account-detail-header.tsx`

- [x] 展示账号详细信息
- [x] 内容：
  - 头像（`proxyImageUrl`，较大尺寸如 `h-16 w-16`）
  - 昵称（`text-xl font-semibold`）
  - 简介（`text-sm text-muted-foreground`）
  - 数据指标行：粉丝数、作品数（格式化数字，用分隔排列）
- [x] Props: `account: DouyinAccountDetailDTO`
- [x] 遵循 Linear 美学：紧凑排版、数字 `tabular-nums`

---

### FE-010 — 视频列表组件 (P0)

**新建文件**: `src/components/features/accounts/video-list.tsx`

- [x] 表格形式展示视频列表
- [x] 表格列：封面缩略图 | 标题 | 发布时间 | 播放量 | 点赞数 | 评论数 | 转发数
  - 封面图使用 `proxyImageUrl` 代理，尺寸约 `h-10 w-16 object-cover rounded`
  - 数字列使用 `tabular-nums tracking-tight`
  - 时间列格式化显示
- [x] 点击行 → 打开视频详情 Dialog（`onVideoClick` 回调）
- [x] 空状态："暂无视频，账号信息正在同步中"
- [x] 分页控件：对接 `PaginatedData` 的 page/total/limit
- [x] Props: `videos: DouyinVideoDTO[]`, `total: number`, `page: number`, `limit: number`, `onPageChange: (page: number) => void`, `onVideoClick: (video: DouyinVideoDTO) => void`, `loading: boolean`
- [x] 遵循 `ui-ux-system.md` 数据表格标准样式

---

### FE-011 — 视频详情 Dialog (P0)

**新建文件**: `src/components/features/accounts/video-detail-dialog.tsx`

- [x] 基于 shadcn `Dialog` 展示视频完整信息
- [x] 内容：
  - 封面大图（`proxyImageUrl`）
  - 标题（完整显示）
  - 发布时间
  - 数据指标：播放量、点赞数、评论数、转发数（网格排列）
  - 视频原始链接（可点击跳转，`target="_blank"`）
- [x] Props: `video: DouyinVideoDTO | null`, `open: boolean`, `onOpenChange: (open: boolean) => void`
- [x] Dialog 宽度 `max-w-lg`

---

### FE-012 — 账号详情页 (P0)

**新建文件**: `src/app/(dashboard)/accounts/[id]/page.tsx`

- [x] `"use client"` 页面组件
- [x] 从 URL 参数获取 `id`
- [x] 数据加载（并行）：
  - 账号详情：`apiClient.get<DouyinAccountDetailDTO>("/douyin-accounts/${id}")`
  - 视频列表：`apiClient.get<PaginatedData<DouyinVideoDTO>>("/douyin-accounts/${id}/videos?page=1&limit=20")`
- [x] 组合组件：
  - `AccountDetailHeader`（账号信息区）
  - `VideoList`（视频列表）
  - `VideoDetailDialog`（视频详情弹窗）
- [x] 状态管理：`account`, `videos`, `loading`, `videoPage`, `selectedVideo`, `videoDialogOpen`
- [x] 分页切换 → 重新加载视频列表
- [x] 返回按钮：页面顶部可返回 `/accounts`
- [x] 加载失败或账号不存在 → 展示错误状态或 404
- [x] 入场动画：主容器 `animate-in-up`

---

### FE-013 — Barrel Export (P0)

**新建文件**: `src/components/features/accounts/index.ts`

- [x] 统一导出所有 accounts 下的组件：
  - `AccountCard`
  - `AccountCardGrid`
  - `AccountAddDrawer`
  - `AccountDetailHeader`
  - `AccountEmptyState`
  - `VideoList`
  - `VideoDetailDialog`

---

## 完成标准

- [x] 所有 FE-001 ~ FE-013 任务完成
- [x] `pnpm type-check` 无错误
- [x] `pnpm lint` 无错误
- [ ] `pnpm dev` 可正常启动
- [ ] 路由可访问：`/accounts`, `/accounts/[id]`
- [ ] Sidebar "我的账号"菜单项正确显示
- [ ] EMPLOYEE 角色：可添加账号（完整 Drawer 流程）、可查看自己的账号列表和详情
- [ ] BRANCH_MANAGER / SUPER_ADMIN：可查看对应范围的账号列表（无"添加"按钮）
- [ ] 空状态在无账号时正确展示
- [ ] 视频列表在 v0.2.0 为空，展示空状态提示
- [ ] 图片通过代理正确显示
- [ ] 重复添加同一链接有错误提示

---

## 自省报告（前端开发完成后填写）

### 实现总结

**完成状态**: FE-001 ~ FE-013 全部完成，`pnpm type-check` 和 `pnpm lint` 均通过。

**新增文件** (10个):
- `src/components/features/accounts/account-empty-state.tsx`
- `src/components/features/accounts/account-card.tsx`
- `src/components/features/accounts/account-card-grid.tsx`
- `src/components/features/accounts/account-add-drawer.tsx`
- `src/components/features/accounts/account-detail-header.tsx`
- `src/components/features/accounts/video-list.tsx`
- `src/components/features/accounts/video-detail-dialog.tsx`
- `src/components/features/accounts/index.ts`
- `src/app/(dashboard)/accounts/page.tsx`
- `src/app/(dashboard)/accounts/[id]/page.tsx`

**修改文件** (3个):
- `src/lib/utils.ts` — 新增 `proxyImageUrl`、`formatNumber`、`formatDateTime` 工具函数
- `src/components/shared/layout/app-sidebar.tsx` — 新增「我的账号」菜单项（MonitorPlay 图标）
- `src/middleware.ts` — matcher 新增 `/accounts/:path*`

### 决策说明

1. **FE-001 类型复用**: `src/types/douyin-account.ts` 已由后端创建，类型定义完整，直接复用无需修改。
2. **工具函数扩展**: 除 `proxyImageUrl` 外，额外新增 `formatNumber`（格式化为「x.x万」）和 `formatDateTime`（日期格式化），供多个组件复用。这属于 FE-002 范围内的合理扩展。
3. **账号卡片使用 `<button>` 标签**: 而非 `<div onClick>`，更符合语义化和无障碍标准。
4. **骨架屏加载**: 列表页和详情页均实现了骨架屏加载态，提升用户体验。
5. **详情页数据加载**: 账号详情和视频列表分开两个 `useEffect` 加载，视频列表随分页变化独立刷新。

### 遇到的问题

- TypeScript strict 模式下 `Record<string, T>` 索引访问返回 `T | undefined`，使用 `switch` 函数替代 Record 索引解决。

### 对文档/规范的建议

1. **`docs/architecture/frontend.md`**: 组件树描述可补充 `accounts/` 模块的组件列表。
2. **`docs/standards/ui-ux-system.md`**: 未定义「视频详情 Dialog」中数据指标网格的具体规范，当前实现采用 4 列等宽网格 + 居中小卡片样式。
3. **任务清单计数**: 文档摘要写「任务总数: 12」但实际有 13 个任务（FE-001~FE-013），建议修正。
