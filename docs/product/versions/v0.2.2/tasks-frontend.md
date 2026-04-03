# v0.2.2 前端任务清单

## 必读文档

> 开始开发前必须阅读以下文档：

- `docs/product/versions/v0.2.2/requirements.md` — 本版本需求（交互流程、权限表、验收标准）
- `docs/product/versions/v0.2.2/technical-design.md` — 本版本技术设计（路由结构、组件树、API 契约）
- `docs/architecture/frontend.md` — 前端组件体系（弹框优先、组件层次、页面结构规范）
- `docs/standards/ui-ux-system.md` — UI/UX 设计系统（色彩、字号、间距、交互模式）
- `docs/standards/coding-standards.md` — 编码规范

**参考现有实现**（开发前务必通读）：
- `src/app/(dashboard)/accounts/page.tsx` — 列表页参考（账号卡片 + 视频网格 + 分页）
- `src/app/(dashboard)/accounts/[id]/page.tsx` — 详情页参考
- `src/components/features/accounts/account-add-drawer.tsx` — Drawer 参考
- `src/components/features/accounts/account-card.tsx` — 卡片参考
- `src/components/shared/layout/app-sidebar.tsx` — 侧边栏（需修改）

---

## 摘要

- 任务总数: 9
- 修改现有文件: 1（app-sidebar.tsx）
- 新建页面: 3（`/benchmarks`, `/benchmarks/archived`, `/benchmarks/[id]`）
- 新建组件: 7（`src/components/features/benchmarks/` 目录）
- 前置依赖: BE-009（BenchmarkAccountDTO、BenchmarkAccountDetailDTO 类型必须先完成）

---

## 任务列表

---

- [ ] **FE-001**: (P0) 在侧边栏新增「对标账号」导航入口
  - 文件: `src/components/shared/layout/app-sidebar.tsx`
  - 详情:
    - 在 `NAV_ITEMS` 数组中，「我的账号」条目**之后**插入：
      ```typescript
      {
        icon: Target,   // 从 lucide-react 导入 Target
        label: "对标账号",
        href: "/benchmarks",
        roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
      },
      ```
    - 在文件顶部 lucide-react 导入中追加 `Target`
    - 路由激活判断：`pathname === "/benchmarks" || pathname.startsWith("/benchmarks/")`（与现有 `/accounts` 逻辑一致）

---

- [ ] **FE-002**: (P0) 创建对标账号主列表页 `/benchmarks`
  - 文件: `src/app/(dashboard)/benchmarks/page.tsx`（新建）
  - 详情:
    - `"use client"` 组件，模式参照 `accounts/page.tsx`
    - **页面结构**（按 `docs/architecture/frontend.md` 列表页标准模式）：
      - Header 区：标题「对标账号」+ 描述「管理你的对标博主，通过收藏自动同步或手动添加」
      - Header 右侧：「查看已归档 →」文字链按钮（`variant="link" className="text-sm text-muted-foreground"` + `Link href="/benchmarks/archived"`）和 「+ 添加对标账号」按钮
      - 内容区：`BenchmarkCardGrid`（加载中/空状态/列表），底部分页控件
      - `BenchmarkAddDrawer`（Sheet，`open` state 控制）

    - **数据获取**：
      - `GET /api/benchmarks?page={page}&limit=20`
      - 响应类型：`PaginatedData<BenchmarkAccountDTO>`
      - 列表刷新用 `refreshKey` state（成功添加后 +1）

    - **分页**：与 `accounts/page.tsx` 保持一致（ChevronLeft / ChevronRight 按钮 + 页码文字）

    - **权限**：无特殊处理，所有角色均可见本组织对标账号

---

- [ ] **FE-003**: (P0) 创建归档列表页 `/benchmarks/archived`
  - 文件: `src/app/(dashboard)/benchmarks/archived/page.tsx`（新建）
  - 详情:
    - `"use client"` 组件
    - **页面结构**：
      - Header 区：「← 返回对标账号」链接（`ArrowLeft` + `Link href="/benchmarks"`）+ 标题「已归档对标账号」
      - 内容区：`BenchmarkCardGrid`（传入 `archived={true}`，卡片显示归档时间，无归档操作入口）
      - 空状态：BenchmarkEmptyState（archived 模式，文案「暂无归档账号」）

    - **数据获取**：
      - `GET /api/benchmarks/archived?page={page}&limit=20`
      - 响应类型：`PaginatedData<BenchmarkAccountDTO>`（含 `deletedAt`）

    - **区别**：归档列表卡片不显示「···」归档菜单

---

- [ ] **FE-004**: (P0) 创建对标账号详情页 `/benchmarks/[id]`
  - 文件: `src/app/(dashboard)/benchmarks/[id]/page.tsx`（新建）
  - 详情:
    - `"use client"` 组件，参照 `accounts/[id]/page.tsx`
    - 页面从 `useParams` 获取 `id`

    - **数据获取**：
      - `GET /api/benchmarks/{id}` → `BenchmarkAccountDetailDTO`
      - `GET /api/benchmarks/{id}/videos?page={page}&limit=20` → `PaginatedData<DouyinVideoDTO>`

    - **页面结构**：
      - 顶部：`BenchmarkDetailHeader`（博主信息卡 + 归档按钮/归档标记）
      - 内容：`BenchmarkVideoList`（视频网格 + 分页）

    - **归档按钮逻辑**（在 `BenchmarkDetailHeader` 中）：
      - 显示条件：`account.userId == session?.user?.id && account.deletedAt == null`
      - 点击 → 触发 `ConfirmDialog`，确认后调用 `DELETE /api/benchmarks/{id}`
      - 成功后 toast「已归档」+ 跳转到 `/benchmarks`（`router.push("/benchmarks")`）

    - **已归档状态**：
      - 若 `account.deletedAt != null`，Header 区域显示 `Badge（variant="secondary"）`「已归档 · {formatDate(deletedAt)}」
      - 不显示归档按钮
      - 视频列表正常展示（数据保留，只读）

    - **URL 兼容性**：`/benchmarks/[id]` 路由同时处理活跃和已归档账号详情。归档列表页的卡片点击也指向 `/benchmarks/[id]`（不需要单独的 `/benchmarks/archived/[id]` 路由）。

---

- [ ] **FE-005**: (P0) 创建 `BenchmarkAddDrawer` 组件
  - 文件: `src/components/features/benchmarks/benchmark-add-drawer.tsx`（新建）
  - 详情:
    - 参照 `account-add-drawer.tsx` 结构，修改以下内容：
      - **预览接口**：`POST /api/benchmarks/preview`（替换 `/api/douyin-accounts/preview`）
      - **提交接口**：`POST /api/benchmarks`（替换 `/api/douyin-accounts`）
      - Sheet 标题：「添加对标账号」
      - Sheet 描述：「输入抖音博主主页链接，系统将自动获取博主信息」

    - **错误提示文案**（区别于 MY_ACCOUNT Drawer）：
      - `BENCHMARK_EXISTS`：「该对标博主已存在，可在列表中直接查看」
      - `BENCHMARK_ARCHIVED`：「该对标博主已被归档，请前往已归档列表查看」
      - `ACCOUNT_EXISTS_AS_MY`：「该账号已作为我的账号被添加」
      - 其他：「获取账号信息失败，请检查链接是否正确」

    - 接口定义：
      ```typescript
      interface BenchmarkAddDrawerProps {
        open: boolean;
        onOpenChange: (open: boolean) => void;
        onSuccess: () => void;
      }
      ```

---

- [ ] **FE-006**: (P0) 创建 `BenchmarkCard` + `BenchmarkCardGrid` 组件
  - 文件:
    - `src/components/features/benchmarks/benchmark-card.tsx`（新建）
    - `src/components/features/benchmarks/benchmark-card-grid.tsx`（新建）
  - 详情:

    **`BenchmarkCard`**：
    - 参照 `account-card.tsx` 布局风格
    - 展示字段：头像（`proxyImageUrl`）、昵称、粉丝数（`formatNumber`）、作品数、创建者姓名（`account.creatorName`，使用 `text-xs text-muted-foreground`）
    - 若 `archived={true}`（归档列表），额外显示归档时间：`text-2xs text-muted-foreground`
    - **「···」菜单**（仅在非归档模式 + `account.userId == currentUserId` 时显示）：
      - 使用 `DropdownMenu` + `DropdownMenuItem`（「归档」，`className="text-destructive"`）
      - 点击「归档」→ 调用 `onArchive(account.id)` 回调（由父页面处理 ConfirmDialog）
    - 卡片点击 → `router.push(\`/benchmarks/${account.id}\`)`
    - Props 接口：
      ```typescript
      interface BenchmarkCardProps {
        account: BenchmarkAccountDTO;
        archived?: boolean;
        currentUserId?: string;
        onArchive?: (id: string) => void;
      }
      ```

    **`BenchmarkCardGrid`**：
    - 简单 Grid 容器，遍历渲染 `BenchmarkCard`
    - Props 接口：
      ```typescript
      interface BenchmarkCardGridProps {
        accounts: BenchmarkAccountDTO[];
        archived?: boolean;
        currentUserId?: string;
        onArchive?: (id: string) => void;
      }
      ```

---

- [ ] **FE-007**: (P0) 创建 `BenchmarkDetailHeader` + `BenchmarkEmptyState` 组件
  - 文件:
    - `src/components/features/benchmarks/benchmark-detail-header.tsx`（新建）
    - `src/components/features/benchmarks/benchmark-empty-state.tsx`（新建）
  - 详情:

    **`BenchmarkDetailHeader`**：
    - 参照 `account-detail-header.tsx`
    - 展示：头像、昵称、粉丝数、作品数、简介、创建者标签（「由 {creatorName} 添加」）
    - 归档状态 Badge（`account.deletedAt != null`）：`<Badge variant="secondary">已归档 · {date}</Badge>`
    - 归档按钮（`account.userId == currentUserId && !account.deletedAt`）：`<Button variant="outline" size="sm" onClick={onArchive}>归档</Button>`
    - Props:
      ```typescript
      interface BenchmarkDetailHeaderProps {
        account: BenchmarkAccountDetailDTO;
        currentUserId?: string;
        onArchive?: () => void;
      }
      ```

    **`BenchmarkEmptyState`**：
    - Props: `{ archived?: boolean; onAdd?: () => void }`
    - 普通模式：图标 + 「还没有对标账号」+ 「可手动添加或通过抖音收藏自动同步」+ 「添加对标账号」按钮（调 `onAdd`）
    - 归档模式：图标 + 「暂无已归档账号」（无按钮）

---

- [ ] **FE-008**: (P0) 创建 `BenchmarkVideoList` + `BenchmarkVideoGridCard` 组件
  - 文件:
    - `src/components/features/benchmarks/benchmark-video-list.tsx`（新建）
    - `src/components/features/benchmarks/benchmark-video-grid-card.tsx`（新建）
  - 详情:

    **`BenchmarkVideoGridCard`**：
    - 参照 `video-grid-card.tsx`
    - **差异**：在卡片右上角或左下角增加「未拆解」Badge：
      ```tsx
      <Badge variant="outline" className="text-2xs text-muted-foreground">
        未拆解
      </Badge>
      ```
    - v0.2.2 此 Badge 固定显示「未拆解」（为 v0.3.x 拆解功能占位，无交互）

    **`BenchmarkVideoList`**：
    - Grid 布局容器 + 分页控件
    - Props: `{ videos: DouyinVideoDTO[]; total: number; page: number; onPageChange: (page: number) => void; loading?: boolean }`

---

- [ ] **FE-009**: (P0) 创建 `src/components/features/benchmarks/index.ts` barrel export
  - 文件: `src/components/features/benchmarks/index.ts`（新建）
  - 详情: 导出所有 benchmark 功能组件：
    ```typescript
    export { BenchmarkAddDrawer } from "./benchmark-add-drawer";
    export { BenchmarkCard } from "./benchmark-card";
    export { BenchmarkCardGrid } from "./benchmark-card-grid";
    export { BenchmarkDetailHeader } from "./benchmark-detail-header";
    export { BenchmarkEmptyState } from "./benchmark-empty-state";
    export { BenchmarkVideoGridCard } from "./benchmark-video-grid-card";
    export { BenchmarkVideoList } from "./benchmark-video-list";
    ```

---

## 归档确认流程说明

主列表页（`/benchmarks`）的卡片归档操作使用**两步确认**：

1. 点击「···」→「归档」→ 父页面 state `archiveTargetId` 设为该账号 ID
2. 渲染 `AlertDialog`（来自 shadcn/ui），文案：
   > 「归档后，该博主的账号和视频数据均保留但会从主列表隐藏。确认归档？」
   > \[取消\] \[确认归档\]（`variant="destructive"`）
3. 确认 → `DELETE /api/benchmarks/{archiveTargetId}` → `toast.success("已归档")` → 列表刷新（`refreshKey + 1`）

---

## 组件间 API 调用汇总

| 操作 | 接口 | 调用位置 |
|------|------|---------|
| 预览对标账号 | `POST /api/benchmarks/preview` | `BenchmarkAddDrawer` |
| 手动添加对标账号 | `POST /api/benchmarks` | `BenchmarkAddDrawer` |
| 主列表查询 | `GET /api/benchmarks?page=&limit=` | `/benchmarks/page.tsx` |
| 归档列表查询 | `GET /api/benchmarks/archived?page=&limit=` | `/benchmarks/archived/page.tsx` |
| 详情查询 | `GET /api/benchmarks/{id}` | `/benchmarks/[id]/page.tsx` |
| 视频列表查询 | `GET /api/benchmarks/{id}/videos?page=&limit=` | `/benchmarks/[id]/page.tsx` |
| 归档操作 | `DELETE /api/benchmarks/{id}` | `/benchmarks/[id]/page.tsx` 和 `/benchmarks/page.tsx` |

所有接口均通过 `apiClient.get/post/delete` 调用（`src/lib/api-client.ts`）。

---

## 建议开发顺序

```
FE-009（barrel export 骨架）
    ↓
FE-006（BenchmarkCard + BenchmarkCardGrid）
    ↓
FE-007（BenchmarkDetailHeader + BenchmarkEmptyState）
    ↓
FE-008（BenchmarkVideoList + BenchmarkVideoGridCard）
    ↓
FE-005（BenchmarkAddDrawer）
    ↓
FE-002（主列表页 /benchmarks）
    ↓
FE-003（归档列表页 /benchmarks/archived）
    ↓
FE-004（详情页 /benchmarks/[id]）
    ↓
FE-001（侧边栏新增导航入口）
```
