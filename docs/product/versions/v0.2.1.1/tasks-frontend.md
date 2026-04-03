# v0.2.1.1 前端任务清单

> 版本: v0.2.1.1  
> 创建日期: 2026-04-03

---

## 必读文档

> 开始开发前必须阅读以下文档：

- `docs/product/versions/v0.2.1.1/requirements.md` — 本版本需求（理解业务背景和 UI 布局图）
- `docs/product/versions/v0.2.1.1/technical-design.md` — 本版本技术设计（组件树 + 数据流 + 类型定义）
- `docs/architecture/frontend.md` — 前端组件体系规范
- `docs/standards/ui-ux-system.md` — UI/UX 设计系统（**必须严格遵循**）
- `docs/standards/coding-standards.md` — 编码规范
- `.github/instructions/frontend.instructions.md` — 前端开发指令

---

## 摘要

- **任务总数**: 4
- **涉及文件**:
  - `src/types/douyin-account.ts`（类型更新）
  - `src/app/(dashboard)/accounts/page.tsx`（改版重构）
  - `src/components/features/accounts/account-row.tsx`（新建）
  - `src/components/features/accounts/account-row-card.tsx`（新建）
  - `src/components/features/accounts/video-grid.tsx`（新建）
  - `src/components/features/accounts/video-grid-card.tsx`（新建）
  - `src/components/features/accounts/video-filter-bar.tsx`（新建）
  - `src/components/features/accounts/index.ts`（更新 barrel export）

---

## 任务列表

### FE-001: (P0) 账号首页改版 — 布局重构

**描述**: 将现有账号首页从纯账号卡片网格布局改版为三段式布局：顶部账号水平行 + 筛选排序栏 + 视频网格。保留现有 AccountAddDrawer 功能。

**涉及文件**:
- `src/app/(dashboard)/accounts/page.tsx`（重构）
- `src/components/features/accounts/account-row.tsx`（新建）
- `src/components/features/accounts/account-row-card.tsx`（新建）
- `src/components/features/accounts/index.ts`（更新导出）

**实现要点**:

1. **页面布局重构** (`accounts/page.tsx`):
   - 标题区：保留现有标题/描述逻辑（按角色切换），保留"添加账号"按钮
   - 账号行：横向展示所有账号卡片（精简版），点击跳转详情
   - 筛选栏：账号筛选 + 标签筛选 + 排序切换（使用 VideoFilterBar 组件，FE-003）
   - 视频网格：调用 `GET /api/videos` 展示视频卡片（使用 VideoGrid 组件，FE-002）
   - 分页：底部分页组件，与 API page/limit 联动
   - 空状态：无视频时显示空状态组件

2. **数据获取**:
   ```
   // 两个并行请求
   GET /api/douyin-accounts?page=1&limit=100  → accounts（顶部账号行 + 筛选器选项）
   GET /api/videos?page=1&limit=20&sort=publishedAt&order=desc  → videos（视频网格）
   ```

3. **状态管理** (页面内 useState):
   - `accounts: DouyinAccountDTO[]` — 账号列表
   - `videos: DouyinVideoWithAccountDTO[]` — 视频列表
   - `total: number` — 视频总数
   - `page: number` — 当前页码
   - `filterAccountId: string | undefined` — 账号筛选
   - `filterTag: string | undefined` — 标签筛选
   - `sort: "publishedAt" | "likeCount"` — 排序字段
   - `loading: boolean` — 加载状态
   - `drawerOpen: boolean` — 添加抽屉状态

4. **筛选/排序变化**: 重置 page 为 1，重新调用 `GET /api/videos`

5. **AccountRow 组件** (`account-row.tsx`):
   - 横向滚动容器: `flex gap-3 overflow-x-auto`
   - 遍历 accounts 渲染 `AccountRowCard`
   - 员工角色最后一个为"添加"按钮（虚线边框 + Plus 图标）

6. **AccountRowCard 组件** (`account-row-card.tsx`):
   - 精简版账号卡片，适合水平排列
   - 头像 + 昵称 + 粉丝数
   - 点击跳转到 `/accounts/{id}`（使用 `router.push`）
   - 宽度约束: `min-w-[200px]` 或 `w-[200px]`
   - 高度紧凑: `py-3`

7. **动画**: 使用 `animate-in-up` 系列类，标题区 d0、账号行 d1、筛选栏 d2、视频网格 d3

**验收标准**:
- [x] 账号首页展示三段式布局：账号行 + 筛选栏 + 视频网格
- [x] 账号行水平展示所有账号卡片，可横向滚动
- [x] 点击账号卡片跳转到详情页
- [x] 员工角色可见"添加账号"按钮和账号行末尾添加按钮
- [x] 视频网格默认按发布时间倒序展示
- [x] 页面加载时有骨架屏 (skeleton)
- [x] 无视频时显示空状态
- [x] 分页正常工作
- [x] `animate-in-up` 入场动画交错显示
- [x] 遵循 `max-w-6xl mx-auto` 内容限宽

---

### FE-002: (P0) VideoGridCard 组件 — 3:4 视频卡片 + hover 播放

**描述**: 实现 3:4 比例的视频网格卡片组件，支持封面展示、底部渐变遮罩信息和鼠标 hover 自动播放。

**涉及文件**:
- `src/components/features/accounts/video-grid.tsx`（新建，网格容器）
- `src/components/features/accounts/video-grid-card.tsx`（新建，单个卡片）
- `src/components/features/accounts/index.ts`（更新导出）

**实现要点**:

1. **VideoGrid 容器** (`video-grid.tsx`):
   ```tsx
   <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
     {videos.map(video => (
       <VideoGridCard key={video.id} video={video} onClick={() => onVideoClick(video)} />
     ))}
   </div>
   ```

2. **VideoGridCard** (`video-grid-card.tsx`):
   - **比例**: `aspect-[3/4]`，使用 `relative overflow-hidden rounded-lg`
   - **封面**: `<img>` 元素，`absolute inset-0 h-full w-full object-cover`
   - **hover 视频播放**:
     - 使用 `useRef<HTMLVideoElement>` 管理视频元素
     - `onMouseEnter`: 播放视频，封面淡出
     - `onMouseLeave`: 暂停视频，重置 currentTime=0，封面淡入
     - 无 videoUrl 时不渲染 `<video>` 元素
     - 视频属性: `muted loop playsInline`

   - **底部渐变遮罩**:
     ```tsx
     <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
       <p className="truncate text-sm font-medium text-white">{video.title}</p>
       <div className="mt-1 flex items-center justify-between text-sm text-white/80">
         <span className="flex items-center gap-1">
           <Heart className="h-3.5 w-3.5" />
           {formatNumber(video.likeCount)}
         </span>
         <span className="tabular-nums tracking-tight">
           {formatDateTime(video.publishedAt)}
         </span>
       </div>
     </div>
     ```

   - **标签展示**: 在卡片左上角，最多显示 2 个 tag badge（仅当 `tags.length > 0`）
     ```tsx
     <div className="absolute top-2 left-2 flex gap-1">
       {video.tags.slice(0, 2).map(tag => (
         <span key={tag} className="inline-flex items-center rounded-sm px-2 py-0.5 text-2xs font-medium bg-black/50 text-white/90 backdrop-blur-sm">
           {tag}
         </span>
       ))}
     </div>
     ```

   - **无封面 fallback**: 显示背景色 + Film 图标居中

3. **hover 播放性能优化**: 
   - 同一时间只有一个视频在播放
   - 方案: 在 VideoGrid 层维护 `playingVideoId` state，传递给每个 Card
   - `onMouseEnter` 设置当前 videoId，其他 Card 自动暂停

4. **点击事件**: 点击卡片触发 `onClick` 回调（后续迭代可跳转到视频详情）

5. **时间格式**: `yyyy-MM-dd HH:mm`（使用现有 `formatDateTime` 工具函数）

**验收标准**:
- [x] 视频卡片为 3:4 比例（`aspect-[3/4]`）
- [x] 封面图铺满卡片（`object-cover`）
- [x] 底部半透明渐变遮罩显示标题、点赞数、发布时间
- [x] 点赞数使用 Heart 图标 + 格式化数字
- [x] 发布时间格式 `yyyy-MM-dd HH:mm`
- [x] 鼠标 hover 时自动播放视频（有 videoUrl 时），封面淡出
- [x] 鼠标离开时暂停播放，回到封面
- [x] 无 videoUrl 时 hover 无播放效果
- [x] 同一时间只有一个视频在播放
- [x] 有标签时左上角显示 badge（最多 2 个）
- [x] 无封面时显示 fallback 占位
- [x] 响应式: 2 列(默认) → 3 列(md) → 4 列(lg)
- [x] 遵循暗色主题色彩变量

---

### FE-003: (P0) VideoFilterBar 筛选排序栏

**描述**: 实现视频列表的筛选排序栏，支持按账号筛选、按标签筛选、排序方式切换。

**涉及文件**:
- `src/components/features/accounts/video-filter-bar.tsx`（新建）
- `src/components/features/accounts/index.ts`（更新导出）

**实现要点**:

1. **组件 Props**:
   ```typescript
   interface VideoFilterBarProps {
     accounts: DouyinAccountDTO[];
     availableTags: string[];
     accountId: string | undefined;
     tag: string | undefined;
     sort: "publishedAt" | "likeCount";
     onAccountChange: (accountId: string | undefined) => void;
     onTagChange: (tag: string | undefined) => void;
     onSortChange: (sort: "publishedAt" | "likeCount") => void;
   }
   ```

2. **布局**: `flex items-center gap-3`

3. **账号筛选** (左侧):
   - 使用 shadcn `Select` 组件
   - 选项: "全部账号" + accounts.map(a => a.nickname)
   - 选择时触发 `onAccountChange`
   - `SelectTrigger` 规格: `w-40 h-8 text-sm`

4. **标签筛选** (左侧，紧随账号筛选后):
   - 使用 shadcn `Select` 组件
   - 仅当 `availableTags.length > 0` 时渲染
   - 选项: "全部标签" + availableTags
   - `SelectTrigger` 规格: `w-32 h-8 text-sm`

5. **排序切换** (右侧，`ml-auto`):
   - 使用 shadcn `Select` 组件
   - 选项: "最新发布"(publishedAt) / "最多点赞"(likeCount)
   - `SelectTrigger` 规格: `w-32 h-8 text-sm`

6. **标签数据来源**: 从视频列表中提取所有唯一 tags（在父组件中计算后传入）。由于本版本 tags 默认为空，筛选器默认无选项（正常行为）

7. **"全部" 值处理**: Select 的 value 使用 `"all"` 表示不筛选，选择时转换为 `undefined` 传给父组件:
   ```typescript
   onValueChange={(val) => onAccountChange(val === "all" ? undefined : val)}
   ```

**验收标准**:
- [x] 筛选栏横向排列，账号/标签在左侧，排序在右侧
- [x] 账号筛选: 显示所有账号昵称，可选"全部账号"清除筛选
- [x] 标签筛选: 仅当有可用标签时显示
- [x] 排序切换: 最新发布 / 最多点赞
- [x] 选中值能双向同步（受控组件）
- [x] 使用 shadcn Select 组件，不自造下拉
- [x] 符合 UI/UX 规范（h-8 高度，text-sm 字号）
- [x] 无标签可选时，标签筛选器隐藏（而非显示空列表）

---

### FE-004: (P0) 类型定义更新

**描述**: 更新 `src/types/douyin-account.ts` 中的共享类型定义，新增 tags 字段和跨账号视频 DTO。

**涉及文件**:
- `src/types/douyin-account.ts`

**实现要点**:

1. **AccountPreview 新增 secUserId**:
   ```typescript
   export interface AccountPreview {
     profileUrl: string;
     secUserId: string;       // 新增
     nickname: string;
     avatar: string;
     bio: string | null;
     followersCount: number;
     videosCount: number;
   }
   ```

2. **DouyinVideoDTO 新增 tags**:
   ```typescript
   export interface DouyinVideoDTO {
     // ... 现有字段 ...
     tags: string[];            // 新增
   }
   ```

3. **新增 DouyinVideoWithAccountDTO**:
   ```typescript
   export interface DouyinVideoWithAccountDTO extends DouyinVideoDTO {
     accountNickname: string;
     accountAvatar: string;
   }
   ```

4. **确保现有组件兼容**: 现有 VideoList 和 VideoDetailDialog 使用 DouyinVideoDTO，新增 `tags` 属性后不影响（新增字段，非破坏性变更）

**验收标准**:
- [x] `AccountPreview` 包含 `secUserId: string` 字段
- [x] `DouyinVideoDTO` 包含 `tags: string[]` 字段
- [x] `DouyinVideoWithAccountDTO` 已定义，继承 `DouyinVideoDTO` 并新增 accountNickname, accountAvatar
- [x] 类型文件无 TypeScript 编译错误
- [x] 现有组件不因类型变更而报错

---

## 自省报告

> 执行日期: 2026-04-03

### 1. 回顾

- `formatDateTime` 工具函数原仅返回日期（yyyy/MM/dd），本次按技术设计要求改为 `yyyy-MM-dd HH:mm`，影响 `video-list.tsx` 和 `video-detail-dialog.tsx` 的时间显示（改进，非破坏性）。
- `DouyinVideoDTO` 中 `tags: string[]` 字段在 FE-004 标记为已完成时实际缺失，本次补充。同时修复了 `video.service.ts` 中 DTO 映射缺少 `tags` 字段导致的类型错误（后端遗漏）。
- `ui-ux-system.md` 规范覆盖了本次使用到的所有场景，无未定义的组件样式。

### 2. 检查

- 新增 5 个组件: `AccountRow`, `AccountRowCard`, `VideoGrid`, `VideoGridCard`, `VideoFilterBar`
- `docs/architecture/frontend.md` 组件树描述无需修改（features/accounts/ 下新增组件属于业务功能自然增长）
- `docs/standards/ui-ux-system.md` 无需补充（视频卡片的 3:4 比例 + 底部渐变遮罩是本版本特定布局，非通用设计系统规范）

### 3. 提议

- **无文档修改需求**: 本次实现完全遵循已有设计系统规范，未引入新的通用组件模式。
- **[DOC-ISSUE]**: `video.service.ts` 后端 DTO 映射缺少 `tags` 字段，已在前端任务中顺带修复。建议后端任务清单补充此项检查。
