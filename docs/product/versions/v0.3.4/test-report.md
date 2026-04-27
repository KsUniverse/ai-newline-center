# 测试报告 — v0.3.4

> 测试日期: 2026-04-27
> 测试方法: 代码静态分析
> 测试范围: 拆解结果管理（`/decompositions` 页面全链路）

---

## 摘要

| 项目 | 结果 |
|------|------|
| 测试功能数 | 4 个用户故事（US-001 ~ US-004） |
| AC 总数 | 18 条 |
| 通过 | 13 条 |
| 失败 | 5 条 |
| UI 问题 | 2 个 |
| 构建检查 (`pnpm type-check`) | 通过 ✅ |
| Lint 检查 (`pnpm lint`) | 通过 ✅ |
| **总体结论** | **需修复 ❌** |

---

## 功能验收

### US-001：浏览所有已拆解视频的批注成果

| AC | 描述 | 状态 | 代码证据 |
|----|------|------|---------|
| AC-001 | 列表只展示当前用户 + organizationId 的 AiWorkspace | ✅ 通过 | `ai-workspace.repository.ts:562` — `where: { userId, organizationId, ... }` 双条件过滤 |
| AC-002 | 每行展示封面、标题、账号、批注数、状态徽章、更新时间 | ✅ 通过 | `decomposition-list.tsx:127-202`— 封面9:16/title `line-clamp-2`/账号头像+昵称/Badge批注数/状态span/`formatRelativeTime` |
| AC-003 | 默认 updatedAt 倒序；顶部提供「最近更新」排序下拉 | ❌ 失败（部分）| 默认排序 ✅ `orderBy: [{ updatedAt: "desc" }, { id: "asc" }]`；页面顶部 **无排序下拉控件** — `decompositions-page.tsx` 筛选栏中仅有账号/状态两个控件 |
| AC-004 | Cursor 分页每页 20 条，「加载更多」按钮，无更多时隐藏 | ✅ 通过 | Route: `limit: z.coerce.number()...default(20)`；前端请求 `?limit=20`；`hasMore` 控隐藏逻辑 |
| AC-005 | 无数据时展示空状态插图 + 说明文案 + 跳转对标账号按钮 | ✅ 通过 | `decomposition-list.tsx:88-104` — `TaskEmptyState` "你还没有使用过 AI 工作台" + `<Link href="/benchmarks">前往对标账号</Link>` |
| AC-006 | 侧边栏「拆解列表」导航入口，跳转 `/decompositions` | ✅ 通过 | `app-navigation.ts:52-57` — `{ icon: Layers, label: "拆解列表", href: "/decompositions" }` |

---

### US-002：按对标账号和状态筛选

| AC | 描述 | 状态 | 代码证据 |
|----|------|------|---------|
| AC-001 | 筛选栏两个控件：账号多选下拉 + 状态单选（全部/有批注/无批注）| ✅ 通过 | `decompositions-page.tsx:183-248` — DropdownMenu 多选 + 3 个 Button 单选组 |
| AC-002 | 账号下拉仅列出有工作台记录的账号；**支持关键词搜索过滤** | ❌ 失败（部分）| 账号来源 ✅ `findDistinctBenchmarkAccountsByUser` 按 userId+orgId 过滤；**下拉无搜索输入框** — `DropdownMenuContent` 仅 `DropdownMenuCheckboxItem` 列表 |
| AC-003 | 有批注 = `annotationCount > 0`；无批注 = `annotationCount = 0` | ✅ 通过 | `ai-workspace.repository.ts:574-576` — `annotations: { some: {} }` / `annotations: { none: {} }` |
| AC-004 | 筛选条件叠加；筛选变化后立即重请求 | ✅ 通过 | `decompositions-page.tsx:71-116` — `useEffect` 依赖 `[filterAccountIds, hasAnnotations]`，同时传入两个筛选参数 |
| AC-005 | 已选筛选条件有视觉选中态；提供「清除筛选」 | ✅ 通过 | 账号按钮获得 `border-primary/50`；状态按钮变 `variant="secondary"`；`hasActiveFilters` 控制清除按钮显示 |
| AC-006 | 筛选无结果空状态文案区别于 AC-005 | ✅ 通过 | `decomposition-list.tsx:80-87` — `hasFilters=true` 时展示"没有符合条件的拆解记录" |

---

### US-003：从列表跳转到 AI 工作台

| AC | 描述 | 状态 | 代码证据 |
|----|------|------|---------|
| AC-001 | 点击行跳转至 `/ai-workspace/[videoId]` | ❌ 失败 | `decomposition-list.tsx:130` — `router.push(\`/benchmarks/${item.accountId}\`)` **未带 videoId 参数，且路径为对标账号列表而非 AI 工作台** |
| AC-002 | 跳转后工作台恢复已有转录/批注 | ⬜ 无法验证 | 依赖目标路由的实现（非本版代码范围）；前提 AC-001 已失败 |
| AC-003 | 行悬停高亮反馈 | ✅ 通过 | `decomposition-list.tsx:128` — `hover:bg-accent/30` CSS 类 |

---

### US-004：一键发起仿写

| AC | 描述 | 状态 | 代码证据 |
|----|------|------|---------|
| AC-001 | `annotationCount > 0` 时展示「发起仿写」按钮 | ✅ 通过 | `decomposition-list.tsx:195-205` — `{item.annotationCount > 0 && <Button>发起仿写</Button>}` |
| AC-002 | 点击跳转至 `/ai-workspace/[videoId]?stage=rewrite` | ❌ 失败（路径格式不符）| `decomposition-list.tsx:200` — 实际路径为 `` `/benchmarks/${item.accountId}?videoId=${item.videoId}&stage=rewrite` ``，不符合 AC 规定的 `/ai-workspace/[videoId]?stage=rewrite` |
| AC-003 | 跳转后批注数据与工作台一致 | ⬜ 无法验证 | 依赖目标路由实现 |
| AC-004 | 有进行中 Rewrite 不中断已有进度 | ⬜ 无法验证 | 依赖目标路由实现 |

---

## UI 一致性检查

| 检查项 | 结果 | 备注 |
|--------|------|------|
| 使用 `BRAND_TABLE_WRAPPER_CLASS_NAME` | ✅ | `decomposition-list.tsx:71, 109` 均引用 |
| 使用 `DashboardPageShell` | ✅ | `decompositions-page.tsx:178` |
| 无硬编码 `rounded-2xl` / `rounded-3xl` | ✅ | 两个组件文件中未见禁用圆角值 |
| 无硬编码 `shadow-sm` / `shadow-md` 等 | ✅ | 未见 Tailwind 内置阴影 |
| 无 `text-[13px]` 等任意字号 | ✅ | 均使用语义 token (`text-xs`, `text-sm`) |
| 按钮使用 `Button` 组件 | ✅ | 所有按钮均通过 `<Button>` 渲染 |
| 颜色使用 CSS 变量（非硬编码） | ❌ | `decomposition-list.tsx:177-185` — 状态徽章使用 Tailwind 色板值（`text-green-700`、`bg-green-600/10`、`border-green-600/20`、`dark:text-green-400` 等），而非 `--success` CSS 变量；违反「颜色必须通过 CSS 变量」规范 |
| 移动端有卡片视图（双视图规范）| ❌ | `BRAND_TABLE_WRAPPER_CLASS_NAME` 包含 `hidden md:block`，移动端列表完全隐藏；**无对应移动卡片视图**；违反 UI 规范「数据密集页面默认采用移动卡片 + 桌面表格双视图」 |

---

## 问题列表

### [T-001] US-001-AC-003 — 缺少排序下拉控件
- **严重度**: Low
- **位置**: `decompositions-page.tsx` 筛选栏
- **描述**: 页面顶部未提供「最近更新」排序下拉，仅有筛选控件
- **预期**: 顶部筛选栏包含「最近更新」排序下拉（本版仅一种选项）
- **实际**: 筛选栏仅含「所有账号」多选和状态单选

---

### [T-002] US-002-AC-002 — 账号下拉缺少关键词搜索
- **严重度**: Medium
- **位置**: `decompositions-page.tsx:185-220` DropdownMenu
- **描述**: 账号筛选下拉无搜索输入框，当账号数量较多时无法快速过滤
- **预期**: 下拉项上方有关键词搜索输入框，实时过滤 `filterAccountOptions`
- **实际**: 纯列表 `DropdownMenuCheckboxItem`，无搜索功能

---

### [T-003] US-003-AC-001 — 行点击跳转路径错误（关键缺陷）
- **严重度**: High
- **位置**: `decomposition-list.tsx:130`
- **描述**: 点击行跳转至 `/benchmarks/${item.accountId}`，仅到对标账号列表页，没有定位到具体视频，更未进入 AI 工作台
- **预期**: 跳转至 `/ai-workspace/${item.videoId}` 进入该视频的 AI 工作台
- **实际**: `router.push(\`/benchmarks/${item.accountId}\`)` — 无 videoId，无 stage，进入账号博主列表页

---

### [T-004] US-004-AC-002 — 发起仿写路径格式不符合 AC 规定
- **严重度**: Medium
- **位置**: `decomposition-list.tsx:200-202`
- **描述**: 发起仿写路径为 `/benchmarks/[accountId]?videoId=...&stage=rewrite`，不符合 AC 规定的 `/ai-workspace/[videoId]?stage=rewrite`
- **预期**: `/ai-workspace/${item.videoId}?stage=rewrite`
- **实际**: `` `/benchmarks/${item.accountId}?videoId=${item.videoId}&stage=rewrite` ``
- **备注**: 路径中含 `stage=rewrite` 参数，需求边界中允许架构师决策路由格式，建议架构师确认是否已决策替换路径模式并同步更新 AC

---

### [T-005] UI — 状态徽章使用硬编码 Tailwind 色板
- **严重度**: Low
- **位置**: `decomposition-list.tsx:177-185`
- **描述**: 「有批注」状态徽章使用 `text-green-700 bg-green-600/10 border-green-600/20`，未通过 `--success` CSS 变量
- **预期**: `color: hsl(var(--success))` 等 CSS 变量链路，或封装为共享 Badge variant
- **实际**: 硬编码 Tailwind 绿色色板（暗色模式额外写 `dark:` 前缀变体）

---

### [T-006] UI — 移动端无卡片视图（数据密集页规范）
- **严重度**: Medium
- **位置**: `decomposition-list.tsx:69-71`
- **描述**: `BRAND_TABLE_WRAPPER_CLASS_NAME` 含 `hidden md:block`，移动端整个列表不可见，且无对应卡片视图回退
- **预期**: 遵循 ui-ux-system 规范："数据密集页面默认采用移动卡片 + 桌面表格双视图"
- **实际**: 移动端（< 768px）列表完全隐藏，无内容

---

## 自省

### 回顾
- US-003-AC-001 的 AC 文案与需求边界「非目标」之间存在模糊地带：`/ai-workspace/[videoId]` 页面是否已实现、架构师的路由决策是什么，测试阶段无法单独判定。建议在 requirements.md 中明确技术路由决策，或在架构文档中注明。
- AC-003（排序下拉）的「本版仅此一种排序」措辞暗示可选，但 AC 条件明写「提供下拉」，文案存在歧义。

### 提议（提交用户/架构师确认后执行）

1. **requirements.md** — US-003-AC-001 和 US-004-AC-002：补充「若 `/ai-workspace` 独立路由未建立，允许以 `/benchmarks/[accountId]?videoId=[videoId]` 替代，但行点击必须携带 `videoId`」，避免实现与 AC 歧义
2. **review-checklist.md** — 新增：状态徽章颜色应走 CSS 变量（`--success` / `--destructive`），不允许硬编码 Tailwind 调色板
3. **review-checklist.md** — 新增：使用 `BRAND_TABLE_WRAPPER_CLASS_NAME` 的页面必须同时提供移动卡片视图
