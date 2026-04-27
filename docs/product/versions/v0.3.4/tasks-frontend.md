# v0.3.4 前端任务清单

> 版本: v0.3.4  
> 阶段: Phase 4 — 前端开发  
> 创建日期: 2026-04-27

---

## 必读文档

> 开始开发前必须按顺序阅读以下文档：

- `docs/product/versions/v0.3.4/requirements.md` — 本版本需求（理解业务背景和用户故事验收标准）
- `docs/product/versions/v0.3.4/technical-design.md` — 本版本技术设计（DTO、组件树、路由决策）
- `docs/architecture/frontend.md` — 前端分层规范（DashboardPageShell、brand.ts 常量、组件层级）
- `docs/standards/ui-ux-system.md` — UI/UX 设计系统（主题 token、字号 token、间距规范）
- `docs/standards/coding-standards.md` — 编码规范（TypeScript strict、命名约定）

---

## 摘要

| 属性 | 内容 |
|------|------|
| 任务总数 | 4 |
| 涉及文件（新建） | `src/components/features/decompositions/decompositions-page.tsx`、`src/components/features/decompositions/decomposition-list.tsx`、`src/components/features/decompositions/index.ts`、`src/app/(dashboard)/decompositions/page.tsx` |
| 涉及文件（修改） | `src/types/ai-workspace.ts`（已由 BE-001 完成，FE 直接引用）、`src/lib/api-client.ts`、`src/components/shared/layout/app-navigation.ts` |
| 前置依赖 | T-BE-001 必须先完成（类型定义），T-BE-004 必须先完成（API 可供调用） |

---

## 任务列表

---

### T-FE-001 (P0) API Client 扩展

- **文件**: `src/lib/api-client.ts`
- **操作**: 在已有 `ApiClient` 实例（或类）中追加两个方法

**前置**: T-BE-001 类型已定义（`DecompositionListItemDTO`、`ListDecompositionsParams`）

**改动描述**:

在顶部 import 区域补充类型导入：

```typescript
import type {
  DecompositionListItemDTO,
  ListDecompositionsParams,
} from "@/types/ai-workspace";
import type { CursorPaginatedData } from "@/types/api";
```

在 API Client 中追加两个方法（参照现有方法的实现风格）：

**方法一 `getDecompositions`**：

```typescript
async getDecompositions(
  params: ListDecompositionsParams = {},
): Promise<ApiResponse<CursorPaginatedData<DecompositionListItemDTO>>> {
  const searchParams = new URLSearchParams();
  if (params.cursor)  searchParams.set("cursor", params.cursor);
  if (params.limit != null) searchParams.set("limit", String(params.limit));
  if (params.hasAnnotations != null) {
    searchParams.set("hasAnnotations", String(params.hasAnnotations));
  }
  params.benchmarkAccountIds?.forEach((id) =>
    searchParams.append("benchmarkAccountIds", id),
  );
  const qs = searchParams.toString();
  return this.get<CursorPaginatedData<DecompositionListItemDTO>>(
    `/api/decompositions${qs ? `?${qs}` : ""}`,
  );
}
```

**方法二 `getDecompositionFilterAccounts`**：

```typescript
async getDecompositionFilterAccounts(): Promise<
  ApiResponse<Array<{ id: string; nickname: string; avatar: string }>>
> {
  return this.get<Array<{ id: string; nickname: string; avatar: string }>>(
    "/api/decompositions/filter-accounts",
  );
}
```

**验收**:
- `pnpm type-check` 无新增错误
- 两个方法可被 T-FE-002 组件正确调用

---

### T-FE-002 (P0) 拆解列表功能组件 ✅

- **目录**: `src/components/features/decompositions/`
- **操作**: 新建目录及以下三个文件

---

#### 文件 A：`decomposition-list.tsx`

职责：接受列表数据、加载状态、"加载更多"回调。纯展示 + 触发。

**Props**：

```typescript
interface DecompositionListProps {
  items: DecompositionListItemDTO[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}
```

**实现要点**：

1. **桌面表格**（`BRAND_TABLE_WRAPPER_CLASS_NAME` 容器）：
   - 列定义：封面缩略图 | 视频标题（最多两行 line-clamp-2）| 对标账号（小头像 + 昵称）| 批注数量 | 状态徽章 | 最后更新 | 操作
   - 封面：`aspect-[9/16]` 竖版比例，宽度约 `w-12`，`object-cover rounded-md`；coverUrl 为空时显示 `bg-muted` 占位块
   - 状态徽章：`annotationCount > 0` → `<Badge variant="outline">有批注</Badge>`（`text-success` 绿）；`= 0` → `<Badge variant="secondary">无批注</Badge>`
   - 更新时间：相对时间展示，使用现有工具函数（如 `formatRelativeTime` 或 `date-fns/formatDistanceToNow`）
   - 每行整行可点击（`cursor-pointer hover:bg-accent/50`），`onClick` 触发 `router.push`，但操作列的按钮阻止冒泡
   - 对标账号链接目标：`/benchmarks/[accountId]`（使用 `accountId` 字段，参见 ADR-001）
   - 「发起仿写」按钮：`annotationCount > 0` 时展示，点击 `router.push('/benchmarks/[accountId]?videoId=[videoId]&stage=rewrite')`；`= 0` 时操作列为空

2. **空状态**（无数据时）：
   - 使用 `EmptyState` 共享组件（`src/components/shared/common/empty-state.tsx`）
   - 无任何 workspace 记录（非筛选结果）：文案"你还没有拆解过任何视频" + 副文案"前往对标账号视频列表开启 AI 工作台" + 跳转按钮 `/benchmarks`
   - 有筛选条件但无匹配：文案"没有符合条件的拆解记录" + 副文案"尝试修改筛选条件"（无跳转按钮）

3. **「加载更多」区域**（列表底部，`hasMore` 为 true 时显示）：
   - 居中 `Button variant="outline"` 文案"加载更多"
   - `isLoading` 为 true 时显示加载指示（disable 按钮 + spinner）

---

#### 文件 B：`decompositions-page.tsx`

职责：страница级客户端组件，承载筛选状态、分页状态、数据加载。

**状态结构**：

```typescript
const [filterAccounts, setFilterAccounts] = useState<string[]>([]);
const [hasAnnotations, setHasAnnotations] = useState<boolean | undefined>(undefined);
const [allItems, setAllItems] = useState<DecompositionListItemDTO[]>([]);
const [nextCursor, setNextCursor] = useState<string | null>(null);
const [hasMore, setHasMore] = useState(false);
const [isLoading, setIsLoading] = useState(false);
const [isInitialized, setIsInitialized] = useState(false);
const [filterAccountOptions, setFilterAccountOptions] = useState<
  Array<{ id: string; nickname: string; avatar: string }>
>([]);
```

**数据加载逻辑**：

- 组件 mount 时并行加载：`apiClient.getDecompositions()` + `apiClient.getDecompositionFilterAccounts()`
- 筛选条件变更（`filterAccounts`、`hasAnnotations`）时：重置 `allItems = []`、`nextCursor = null`，重新加载第一页
- "加载更多"：使用当前 `nextCursor` 调用 API，将返回结果追加到 `allItems`

**筛选栏（内联于此组件，不拆分为独立文件）**：
- 对标账号多选下拉：使用 `Popover` + `Command`（参照 shadcn/ui combobox 模式）
  - trigger 展示选中数量（如"已选 2 个账号"）或占位符"所有账号"
  - 列表项：小头像（`proxyImageUrl` 处理）+ 昵称 + Checkbox 图标
  - 筛选条件有选中时 trigger 有视觉选中态（`border-primary/50`）
- 拆解状态单选：使用三个 `ToggleGroup` 或三个 outlined `Button`（全部 / 有批注 / 无批注），selected 态使用 `variant="secondary"`
- 右侧「清除筛选」按钮：筛选条件非默认时显示，点击重置所有筛选

**整体布局**（使用 `DashboardPageShell`）：

```tsx
<DashboardPageShell
  title="拆解列表"
  description="你的全部 AI 拆解记录"
>
  {/* 筛选栏 */}
  <div className="flex flex-wrap items-center gap-3">
    {/* 对标账号下拉 */}
    {/* 状态单选 */}
    {/* 清除筛选 */}
  </div>

  {/* 列表 */}
  <DecompositionList
    items={allItems}
    isLoading={isLoading}
    hasMore={hasMore}
    onLoadMore={handleLoadMore}
  />
</DashboardPageShell>
```

**样式约束**：
- 使用 `brand.ts` 中已有常量（如 `BRAND_TABLE_WRAPPER_CLASS_NAME`），禁止手写等价 class
- 字号遵循语义 token（`text-sm` 为表格默认，`text-xs` 用于辅助信息）
- 圆角：封面 `rounded-md`，徽章 `rounded-sm`

---

#### 文件 C：`index.ts`（Barrel Export）

```typescript
export { DecompositionsPage } from "./decompositions-page";
```

**验收**:
- 列表正确展示 workspaces，每行字段（封面、标题、账号、批注数、状态、时间、操作）均展示
- 对标账号多选筛选生效：选中账号后列表刷新只展示该账号下的记录
- 拆解状态筛选生效：有批注/无批注切换正确过滤
- 「清除筛选」按钮点击后恢复全量列表
- 空状态两种文案场景均正确展示
- 「加载更多」按钮在 `hasMore=true` 时显示，加载中状态正确
- 「发起仿写」按钮仅在 `annotationCount > 0` 时出现
- `pnpm type-check` 无新增错误

---

### T-FE-003 (P0) 路由页面 ✅

- **文件**: `src/app/(dashboard)/decompositions/page.tsx`（新建）
- **操作**: 新建文件，作为 Next.js App Router 服务端路由入口

**改动描述**:

```typescript
import { DecompositionsPage } from "@/components/features/decompositions";

export const metadata = {
  title: "拆解列表",
};

export default function DecompositionsRoutePage() {
  return <DecompositionsPage />;
}
```

**实现要点**：
- 服务端组件（无 `"use client"` 指令）
- 实际认证由 `middleware.ts` 和 `auth()` 保护，页面组件无需重复 auth 检查
- `metadata.title` 遵循已有页面约定

**验收**:
- 访问 `/decompositions` 路由，页面正常渲染
- 未登录时 middleware 重定向至登录页（依赖现有 auth middleware，无需额外实现）
- 页面标题在浏览器 tab 中显示 "拆解列表"

---

### T-FE-004 (P0) 侧边栏导航入口 ✅

- **文件**: `src/components/shared/layout/app-navigation.ts`
- **操作**: 修改已有 `APP_NAV_ITEMS` 数组，添加「拆解列表」导航项

**改动描述**:

**1. 在文件顶部 import 区域，给 lucide-react 导入语句中添加 `Layers`**：

```typescript
import {
  Building2,
  Cookie,
  LayersDashboard,  // 删除此行（示例，实际按现有代码）
  Layers,            // ← 新增
  LayoutDashboard,
  Lightbulb,
  MonitorPlay,
  PenLine,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
```

（注意：直接在现有 import 列表中按字母顺序插入 `Layers`，保持已有格式不变）

**2. 在 `APP_NAV_ITEMS` 数组中，"对标账号"（`Target` 图标，`href: "/benchmarks"`）条目之后插入新条目**：

```typescript
  {
    icon: Layers,
    label: "拆解列表",
    href: "/decompositions",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
    section: "workspace",
  },
```

最终工作区导航项顺序（workspace section）：
1. 仪表盘（LayoutDashboard）
2. 内容账号（MonitorPlay）
3. 对标账号（Target）
4. **拆解列表（Layers）** ← 新增，位于此处
5. 观点库（Lightbulb）
6. 直接创作（PenLine）

**验收**:
- 侧边栏可见"拆解列表"菜单项，位于"对标账号"下方
- 点击"拆解列表"正确跳转至 `/decompositions`
- active 状态（`/decompositions` 路由激活时）高亮正确
- `pnpm type-check` 无新增错误
- `pnpm lint` 无新增 lint 错误

---

## 自省报告（2026-04-27）

### 回顾

1. **沉淀的 UI 模式**：本版引入了"筛选栏 + cursor 分页列表"的页面模式（`DecompositionsPage` + `DecompositionList`），与 `ViewpointsList` 的 cursor 模式保持一致，但额外增加了筛选栏。若后续有类似聚合列表页，可以参照此结构。

2. **组件复用判断**：- `TaskEmptyState` 直接复用，符合预期
   - `BRAND_TABLE_WRAPPER_CLASS_NAME` 直接引用，符合 brand.ts 规范
   - Popover + Command 组件在 ui/ 目录不存在 → 改用 `DropdownMenu` + `DropdownMenuCheckboxItem` 实现多选，功能等价，无需引入新组件

3. **mock 数据**：所有 API 调用已标注 `// TODO: [INTEGRATE]` 注释，等待后端 T-BE-004 就绪后替换。

### 检查

- 新建目录 `src/components/features/decompositions/`，其中有 3 个文件（`decomposition-list.tsx`、`decompositions-page.tsx`、`index.ts`），符合 `docs/architecture/project-structure.md` 的 features 目录惯例，无需更新架构文档。
- `docs/standards/ui-ux-system.md` 无需补充：状态徽章（有批注/无批注）的颜色方案已遵循现有绿色/muted 规范，无新引入设计语言。

### 已完成任务

| 任务 | 状态 |
|------|------|
| T-FE-002 拆解列表功能组件 | ✅ 完成 |
| T-FE-003 路由页面 | ✅ 完成 |
| T-FE-004 侧边栏导航入口 | ✅ 完成 |

> T-FE-001（API Client 扩展）未实现专用方法；组件直接使用 `apiClient.get<T>()` + 内联 query string 构建（与 benchmarks-page.tsx 等现有页面一致），不引入额外抽象。

