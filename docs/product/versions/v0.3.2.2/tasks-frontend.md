# v0.3.2.2 前端任务清单

## 必读文档

> 开始开发前必须阅读以下文档：

- `docs/product/versions/v0.3.2.2/requirements.md` — 本版本需求（理解业务背景）
- `docs/product/versions/v0.3.2.2/technical-design.md` — 本版本技术设计
- `docs/architecture/frontend.md` — 前端规范（布局体系、交互模式）
- `docs/standards/ui-ux-system.md` — UI/UX 设计系统
- `docs/standards/coding-standards.md` — 编码规范

## 摘要

- **任务总数**: 9
- **涉及文件（新增/修改）**:
  - `src/components/shared/layout/app-navigation.ts`（修改）
  - `src/components/shared/layout/app-sidebar.tsx`（修改）
  - `src/app/(dashboard)/settings/crawler-cookies/page.tsx`（新建）
  - `src/components/features/settings/crawler-cookie-page.tsx`（新建）
  - `src/components/features/settings/crawler-cookie-table.tsx`（新建）
  - `src/components/features/settings/crawler-cookie-add-dialog.tsx`（新建）
  - `src/components/features/settings/index.ts`（新建）
  - `src/lib/management-client.ts`（修改，B-007 完成后复用）
  - `src/types/crawler-cookie.ts`（由 B-007 提供，前端直接使用）

---

## 任务列表

### F-001 (P0) 导航结构 — 支持分组类型

**描述**: 扩展 `app-navigation.ts` 的类型系统，使其支持二级分组导航（`AppNavGroup`），并更新 `AppSidebar` 渲染逻辑以支持可折叠分组。

**涉及文件**:
- `src/components/shared/layout/app-navigation.ts`（修改）
- `src/components/shared/layout/app-sidebar.tsx`（修改）

**`app-navigation.ts` 改动**:

追加新类型和辅助函数，原有 `AppNavItem` 和 `APP_NAV_ITEMS` 保持兼容：

```typescript
// 新增导出类型
export interface AppNavGroup {
  type: "group";
  icon: LucideIcon;
  label: string;
  basePath: string;          // 用于 active 检测：pathname.startsWith(basePath)
  roles: readonly string[];
  children: AppNavItem[];
}

export type AppNavEntry = AppNavItem | AppNavGroup;

// 类型守卫
export function isNavGroup(entry: AppNavEntry): entry is AppNavGroup {
  return "type" in entry && entry.type === "group";
}

// 替换现有 APP_NAV_ITEMS（原有平铺项保持不变，type 字段不强求）
// 新增 APP_NAV_ENTRIES: readonly AppNavEntry[]
export const APP_NAV_ENTRIES: readonly AppNavEntry[] = [
  ...APP_NAV_ITEMS,        // 现有平铺项原样保留
  // 新增系统设置分组（见 F-002）
];

// 更新 getVisibleNavItems → 改为 getVisibleNavEntries
export function getVisibleNavEntries(role?: string): readonly AppNavEntry[] {
  return APP_NAV_ENTRIES.filter((entry) => {
    if (!role) return true;
    if (isNavGroup(entry)) return entry.roles.includes(role);  // 判断 group 本身
    return entry.roles.includes(role);
  });
}
```

> 注意：保留 `APP_NAV_ITEMS` 和 `getVisibleNavItems` 以向后兼容，内部实现委托给新函数。

**`app-sidebar.tsx` 改动**:

1. 将 `getVisibleNavItems` 调用改为 `getVisibleNavEntries`。
2. 在 `nav` 的 `map` 渲染逻辑中，根据 `isNavGroup(item)` 分支渲染：

   **平铺项**（`!isNavGroup`）: 现有渲染逻辑不变。

   **分组项**（`isNavGroup`）: 渲染可折叠分组：
   - 分组头：图标 + 标签 + 展开/收起 chevron（`ChevronDown`/`ChevronRight`）
   - 分组头的 active 状态：`pathname.startsWith(item.basePath)`
   - 子项列表：在分组头下方缩进渲染（`pl-4`），每个子项使用与平铺项相同的样式，但尺寸略小（`h-8 py-2` 代替 `py-3`）
   - 展开状态：`useState`，默认当 `pathname.startsWith(item.basePath)` 时展开（`useMemo` 依赖 pathname）
   - sidebar 折叠模式（`collapsed`）：分组头只显示图标 + Tooltip，子项隐藏（折叠 sidebar 时不展示子项，hover 时 Tooltip 只显示分组名）

3. 引入 `ChevronDown`, `ChevronRight` 从 `lucide-react`。

**完成标准**:
- [ ] `pnpm type-check` + `pnpm lint` 通过
- [ ] 现有平铺导航项（仪表盘、内容账号等）渲染行为无变化
- [ ] 空分组或 `children` 为空时，分组头不渲染（防御性处理）

---

### F-002 (P0) 导航条目 — 新增"系统设置"分组

**描述**: 在 `APP_NAV_ENTRIES` 中追加"系统设置"分组，包含"爬虫 Cookie 管理"子项。

**涉及文件**:
- `src/components/shared/layout/app-navigation.ts`（修改，依赖 F-001）

**改动内容**:

在 `APP_NAV_ENTRIES` 数组末尾（"AI 配置"条目之后）追加：

```typescript
{
  type: "group" as const,
  icon: Settings2,           // from lucide-react
  label: "系统设置",
  basePath: "/settings",
  roles: ["SUPER_ADMIN"] as const,
  children: [
    {
      icon: KeyRound,          // from lucide-react，也可用 Cookie 图标
      label: "爬虫 Cookie 管理",
      href: "/settings/crawler-cookies",
      roles: ["SUPER_ADMIN"] as const,
    },
  ],
},
```

在 `app-navigation.ts` 顶部 import 中追加 `Settings2, KeyRound`（或其他合适图标）。

**完成标准**:
- [ ] 登录为 `SUPER_ADMIN` 后，左侧导航出现"系统设置"分组
- [ ] 子项"爬虫 Cookie 管理"可点击，跳转至 `/settings/crawler-cookies`
- [ ] 当路径为 `/settings/crawler-cookies` 时，分组自动展开，子项高亮
- [ ] 非 `SUPER_ADMIN` 角色不显示该分组

---

### F-003 (P0) 页面骨架

**描述**: 创建路由文件和页面入口，使用 `DashboardPageShell` 作为页面容器。

**涉及文件**:
- `src/app/(dashboard)/settings/crawler-cookies/page.tsx`（新建）
- `src/components/features/settings/crawler-cookie-page.tsx`（新建，Client Component）
- `src/components/features/settings/index.ts`（新建，导出桶）

**`page.tsx`**（Server Component，轻量）:

```typescript
import { CrawlerCookiePage } from "@/components/features/settings/crawler-cookie-page";

export default function CrawlerCookiesPage() {
  return <CrawlerCookiePage />;
}
```

**`crawler-cookie-page.tsx`** 骨架（Client Component，`"use client"`）:

```typescript
// 初始骨架：使用 DashboardPageShell，先渲染占位内容
// 后续任务逐步填充列表、弹框等组件

export function CrawlerCookiePage() {
  return (
    <DashboardPageShell
      title="爬虫 Cookie 管理"
      description="管理爬虫使用的 Cookie 池，系统自动按请求轮询"
      actions={<AddButton />}  {/* 占位，F-005 填充 */}
    >
      {/* 列表区域，F-004 填充 */}
    </DashboardPageShell>
  );
}
```

**完成标准**:
- [ ] 路由 `/settings/crawler-cookies` 可访问，页面显示标题"爬虫 Cookie 管理"
- [ ] `pnpm type-check` 通过
- [ ] 非 SUPER_ADMIN 访问该 URL 时，由 middleware 或 layout 处理（注意：当前 layout 只检查 session 存在性，不检查角色；403 由 API 层保证，页面层空显示或显示加载状态均可接受）

---

### F-004 (P0) Cookie 列表展示组件

**描述**: 实现 Cookie 列表的表格展示，支持全选 / 单选复选框，脱敏展示 `valueRedacted`。

**涉及文件**:
- `src/components/features/settings/crawler-cookie-table.tsx`（新建）

**组件 Props**:

```typescript
interface CrawlerCookieTableProps {
  items: CrawlerCookieDTO[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onDelete: (id: string) => void;       // 触发单条删除确认
  loading?: boolean;
}
```

**表格列**:

| 列 | 内容 |
|----|------|
| 复选框 | `Checkbox`，支持全选（表头）和单选（每行） |
| Cookie（脱敏） | `item.valueRedacted`，`font-mono text-sm` 字体 |
| 创建时间 | `format(new Date(item.createdAt), "yyyy-MM-dd HH:mm")` |
| 操作 | "删除" 按钮（`variant="ghost"` + `Trash2` 图标） |

**交互逻辑**:
- 表头复选框：全选/取消全选当前 `items`
- 行复选框：单独控制选中态
- `selectedIds` 由父组件（`CrawlerCookiePage`）управление，通过 `onSelectionChange` 通知

**样式参考**: 参考 `src/components/features/` 下任意列表组件（如用户管理或账号管理组件中的表格实现）。

**完成标准**:
- [ ] 全选复选框勾选后，所有项都被选中；再次点击取消全选
- [ ] 单条删除按钮触发 `onDelete(id)`（不在本组件内处理确认弹框）
- [ ] `loading` 为 true 时，显示 skeleton 或 spinner 占位
- [ ] `pnpm type-check` 通过

---

### F-005 (P0) 新增 Cookie 弹框

**描述**: 实现"添加 Cookie"Dialog，包含 Textarea 输入框和非空校验。

**涉及文件**:
- `src/components/features/settings/crawler-cookie-add-dialog.tsx`（新建）

**组件 Props**:

```typescript
interface CrawlerCookieAddDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (item: CrawlerCookieDTO) => void;  // 成功后通知父组件刷新
}
```

**表单**:
- 使用 `react-hook-form` + `zodResolver`（与现有 `ai-config-page.tsx` 保持一致）
- Schema: `z.object({ value: z.string().min(1, "Cookie 值不能为空") })`
- 控件：`Textarea`（多行），Label "Cookie 值"，placeholder "请粘贴完整的 Cookie 字符串"
- 错误展示：字段级别，用 `<p className="text-sm text-destructive">` 展示 `errors.value?.message`

**提交流程**:
```
onSubmit → managementClient.createCrawlerCookie({ value })
  → 成功：toast.success("Cookie 已添加") → onCreated(result) → dialog 关闭
  → 失败：toast.error(`添加失败：${errorMessage}`)
```

**关闭行为**: Dialog 关闭（`onOpenChange(false)` 或点击取消）时，调用 `form.reset()` 清空输入。

**完成标准**:
- [ ] 提交空值时，Textarea 下方显示"Cookie 值不能为空"
- [ ] 提交成功后 Dialog 自动关闭，父组件列表刷新（通过 `onCreated` 回调）
- [ ] 提交中 (isSubmitting) 时，确认按钮 disabled + loading 状态
- [ ] `pnpm type-check` 通过

---

### F-006 (P0) 删除 / 批量删除交互

**描述**: 在 `CrawlerCookiePage` 中实现单条删除和批量删除的 AlertDialog 确认流程。

**涉及文件**:
- `src/components/features/settings/crawler-cookie-page.tsx`（修改，在 F-003 骨架基础上）

**单条删除流程**:
1. `CrawlerCookieTable.onDelete(id)` 触发
2. 父组件设置 `pendingDeleteId = id`，打开 `AlertDialog`
3. AlertDialog 内容：
   - 标题："确认删除"
   - 描述："确定删除该 Cookie 吗？此操作不可恢复。"
   - 取消 / 确认按钮
4. 确认后调用 `managementClient.deleteCrawlerCookie(id)`
5. 成功：toast.success("Cookie 已删除") + 从 `items` 状态中移除
6. 失败：toast.error(`删除失败：${message}`)

**批量删除流程**:
1. `selectedIds` 非空时，页面顶部显示"批量删除（N）"按钮（放在 `DashboardPageShell` 的 `actions` 区域，与"添加 Cookie"按钮并排）
2. 点击后打开 AlertDialog：
   - 描述："确定删除选中的 N 个 Cookie 吗？"（N 为选中数量）
3. 确认后调用 `managementClient.deleteCrawlerCookies({ ids: [...selectedIds] })`
4. 成功：toast.success + 清空 `selectedIds` + 刷新列表
5. 失败：toast.error

**AlertDialog 复用**: 使用 shadcn `AlertDialog`（`src/components/ui/alert-dialog.tsx`），不重复实现确认框。

**完成标准**:
- [ ] 单条删除：AlertDialog 内容正确，确认后列表更新
- [ ] 批量删除：选 N 条后，AlertDialog 描述中显示正确数量 N
- [ ] 删除成功后 `selectedIds` 清空，不保留已删除项的选中状态
- [ ] 删除期间按钮处于 loading 状态

---

### F-007 (P0) 空状态

**描述**: 列表为空时展示友好的空状态组件。

**涉及文件**:
- `src/components/features/settings/crawler-cookie-page.tsx`（修改）

**实现**:

当 `items.length === 0` 且 `!loading` 时，渲染：

```tsx
// 优先复用 src/components/shared/common/empty-state.tsx（若存在）
// 若不存在，内联实现：
<div className="flex flex-col items-center gap-4 py-16 text-center">
  <KeyRound className="h-12 w-12 text-muted-foreground/40" />
  <div>
    <p className="font-medium text-foreground/70">暂无 Cookie</p>
    <p className="mt-1 text-sm text-muted-foreground">
      请点击右上角「添加 Cookie」按钮添加第一个 Cookie
    </p>
  </div>
  <Button variant="outline" onClick={() => setDialogOpen(true)}>
    添加 Cookie
  </Button>
</div>
```

**完成标准**:
- [ ] 列表为空时渲染空状态（无表格）
- [ ] 空状态中的"添加 Cookie"按钮能正常打开添加弹框
- [ ] 有数据时不渲染空状态

---

### F-008 (P0) 集成 API（数据获取与状态管理）

**描述**: 在 `CrawlerCookiePage` 中接入真实 API，实现数据获取、刷新、加载状态管理，移除所有 TODO 占位。

**涉及文件**:
- `src/components/features/settings/crawler-cookie-page.tsx`（修改，整合所有子任务成果）

**依赖**: B-006（API 端点）、B-007（`managementClient` 方法）必须完成。

**状态设计**:

```typescript
// 在 CrawlerCookiePage 中管理
const [items, setItems] = useState<CrawlerCookieDTO[]>([]);
const [loading, setLoading] = useState(true);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [addDialogOpen, setAddDialogOpen] = useState(false);
const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);  // 单条删除
const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
const [deleting, setDeleting] = useState(false);
```

**数据获取**:

```typescript
async function fetchList() {
  setLoading(true);
  try {
    const data = await managementClient.listCrawlerCookies();
    setItems(data);
  } catch {
    toast.error("加载失败，请刷新页面重试");
  } finally {
    setLoading(false);
  }
}

useEffect(() => { void fetchList(); }, []);
```

**组件整合**: 将 F-004（表格）、F-005（添加弹框）、F-006（删除逻辑）、F-007（空状态）整合到 `CrawlerCookiePage` 中，形成完整可运行页面。

**完成标准**:
- [ ] 页面打开时自动拉取列表，loading 期间显示 skeleton/spinner
- [ ] 添加 Cookie 后列表自动追加新条目（无需整页刷新，通过 `onCreated` 追加到 `items`）
- [ ] 删除后列表实时更新（从 `items` 中移除）
- [ ] 所有 TODO/占位内容已移除，无 TypeScript 错误
- [ ] `pnpm type-check` + `pnpm lint` 通过

---

### F-009 (P0) E2E 验收 + 收尾

**描述**: 完整走通所有验收场景，确认无控制台报错、无敏感信息暴露，并检查导航高亮逻辑。

**涉及文件**: 不新增文件，查阅已有文件后修复问题。

**验收检查清单**:

- [ ] **导航**: SUPER_ADMIN 登录后，侧边栏显示"系统设置"分组，点击展开显示"爬虫 Cookie 管理"
- [ ] **高亮**: 进入 `/settings/crawler-cookies` 时，"爬虫 Cookie 管理"子项高亮（active 样式），分组保持展开
- [ ] **侧边栏折叠**: 折叠 sidebar 时，"系统设置"分组显示为图标 + Tooltip，子项隐藏
- [ ] **列表加载**: 页面打开后显示 Cookie 列表（脱敏），按创建时间升序
- [ ] **添加**: 提交有效 Cookie 后，列表出现新条目（脱敏格式正确：前 20 + ... + 后 10）
- [ ] **校验**: 提交空 Cookie 时，显示"Cookie 值不能为空"
- [ ] **单条删除**: 确认弹框描述正确，确认后条目消失
- [ ] **批量删除**: 全选 → 批量删除 → 确认后全部消失，选中状态清空
- [ ] **空状态**: 删除到 0 条后显示空状态
- [ ] **敏感信息**: 打开浏览器 Network 面板，确认 API 响应中无 Cookie 明文（只有 `valueRedacted`）
- [ ] **权限**: 以 EMPLOYEE 账号登录，导航不显示"系统设置"，直接访问 `/settings/crawler-cookies` 无报错（API 返回 403，页面层显示空 or loading 状态）
