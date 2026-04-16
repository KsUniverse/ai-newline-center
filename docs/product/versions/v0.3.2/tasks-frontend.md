# v0.3.2 前端任务清单

## 必读文档

> 开始开发前必须阅读以下文档：

- `docs/product/versions/v0.3.2/requirements.md` — 本版本需求（理解业务背景）
- `docs/product/versions/v0.3.2/technical-design.md` — 本版本技术设计（**主要参考**）
- `docs/architecture/frontend.md` — 前端组件体系
- `docs/standards/ui-ux-system.md` — UI/UX 设计系统
- `docs/standards/coding-standards.md` — 编码规范

**参考现有实现**：

- `src/components/features/users/users-page.tsx` — 列表页结构参考（DashboardPageShell + 弹窗 + 列表）
- `src/components/features/users/user-list.tsx` — 列表组件风格参考
- `src/components/features/users/user-dialog.tsx` — Dialog 弹窗实现参考
- `src/components/shared/common/confirm-dialog.tsx` — 删除确认 Dialog 参考
- `src/components/shared/layout/dashboard-page-shell.tsx` — 页面壳用法
- `src/components/shared/layout/app-navigation.ts` — 导航条目定义
- `src/components/features/benchmarks/ai-workspace-rewrite-stage.tsx` — 仿写阶段（需扩展）
- `src/components/features/benchmarks/ai-workspace-controller.ts` — 工作台 state（需扩展）

---

## 摘要

- 任务总数: 6
- 核心目标:
  - 交付 `/viewpoints` 观点库管理页（列表 + 搜索 + 批量录入 + 删除）
  - 导航新增「观点库」入口
  - 仿写阶段内嵌观点选择区（搜索 + 多选）
  - `useAiWorkspaceController` 新增 `selectedFragmentIds` state

---

## 任务列表

- [x] **FE-001**: (P0) 新增共享类型与导航入口

  - 文件:
    - `src/types/fragment.ts`（与后端 BE-002 共用，前端侧确认文件存在即可，如已创建则跳过）
    - `src/components/shared/layout/app-navigation.ts`
  - 详情:

    **`app-navigation.ts` 新增导航条目**（位置在 `/benchmarks` 之后、`/organizations` 之前）:
    ```typescript
    // 新增 import
    import { Lightbulb } from "lucide-react";

    // 新增条目（插入到 Target/benchmarks 条目之后）
    {
      icon: Lightbulb,
      label: "观点库",
      href: "/viewpoints",
      roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
    },
    ```

  - 验证: 侧边栏可见「观点库」入口，点击跳转 `/viewpoints`

---

- [x] **FE-002**: (P0) 新增观点库页面路由入口

  - 文件:
    - `src/app/(dashboard)/viewpoints/page.tsx`（新增）
  - 详情:
    ```typescript
    import { ViewpointsPageView } from "@/components/features/viewpoints";

    export default function ViewpointsPage() {
      return <ViewpointsPageView />;
    }
    ```
  - 约束: 页面文件仅做渲染委托，不含业务逻辑

---

- [x] **FE-003**: (P0) 实现批量录入弹窗 `ViewpointsAddDialog`

  - 文件: `src/components/features/viewpoints/viewpoints-add-dialog.tsx`（新增）
  - 详情:
    1. 使用 `Dialog`（`src/components/ui/dialog.tsx`）封装
    2. Props: `open: boolean`、`onOpenChange: (open: boolean) => void`、`onCreated: () => void`
    3. 内容区: `Textarea`（`rows={8}`），placeholder：`输入观点内容，一行一条，支持批量录入`
    4. 提交逻辑:
       - 按 `\n` 分割，trim 每条，过滤空行，不超过 50 条（前端校验，超出 toast 提示切分）
       - 调用 `apiClient.post<CreateFragmentsResult>('/viewpoints', { contents })`
       - 成功：`toast.success('已添加 N 条观点')`，`onCreated()` 刷新列表，关闭弹窗
       - 错误：`toast.error('...')` 提示
    5. 提交时按钮显示 loading 状态，禁止重复提交
    6. 弹窗关闭时重置 textarea 内容
  - 视觉约束: 风格与 `user-dialog.tsx` 保持一致，使用现有 `Dialog/Button/Textarea` 原语

---

- [x] **FE-004**: (P0) 实现观点列表组件 `ViewpointsList`

  - 文件: `src/components/features/viewpoints/viewpoints-list.tsx`（新增）
  - 详情:
    1. Props:
       - `currentUserId: string`
       - `currentUserRole: string`
       - `onRefreshNeeded?: () => void`（父组件触发重置）
    2. 内部 state: `query`（搜索词）、`items`（FragmentDTO[]）、`nextCursor`、`hasMore`、`loading`
    3. **搜索框**: Input，`onChange` 防抖 300ms，搜索词变化时重置列表（清空 items + cursor）重新加载
    4. **数据加载**: 封装 `loadPage(cursor?, reset?)` 函数，调用 `apiClient.get<CursorPaginatedData<FragmentDTO>>('/viewpoints', { params: { q, cursor, limit: 20 } })`
       - `reset=true` 时清空 items，cursor 为空
       - `reset=false` 时追加 items，cursor 为上一次返回的 nextCursor
    5. **无限滚动**: 列表底部放 `<div ref={sentinelRef} />` + `IntersectionObserver`，进入视口时调用 `loadPage(nextCursor)`（`hasMore && !loading` 时才触发）
    6. **观点卡片**（内联或拆出子组件）:
       - `content` 文本，`line-clamp-3`，样式参考拆解卡片风格
       - 创建者姓名 + 相对时间（`Intl.RelativeTimeFormat` 或 `new Date(...).toLocaleDateString`）
       - 删除按钮：显示条件 `item.createdByUserId === currentUserId || ['BRANCH_MANAGER', 'SUPER_ADMIN'].includes(currentUserRole)`
       - 删除通过内联 `ConfirmDialog` 确认，确认后 `apiClient.delete('/viewpoints/:id')`，成功后从 items 中移除该条
    7. **空状态**: 使用 `TaskEmptyState`（参考 user-list.tsx 中 `EmptyState` 用法）
    8. **骨架/加载**: 首屏 loading 展示 3 条骨架卡片（`animate-pulse` + 灰色矩形占位）
  - 视觉约束: 卡片风格与系统其他表面一致，使用 `rounded-2xl / border-border/60 / bg-card/82 / shadow-sm`

---

- [x] **FE-005**: (P0) 实现观点库页面视图 `ViewpointsPageView`

  - 文件:
    - `src/components/features/viewpoints/viewpoints-page-view.tsx`（新增）
    - `src/components/features/viewpoints/index.ts`（新增，统一导出）
  - 详情:

    **`viewpoints-page-view.tsx`**:
    1. `"use client"` 组件
    2. 使用 `DashboardPageShell`（`title="观点库"`，`description="全公司共享的碎片观点，支持录入与搜索引用"`）
    3. `actions` slot 放「添加观点」Button（`<Plus />` 图标 + `variant="default"`）
    4. Body 渲染 `ViewpointsList`，通过 `key={refreshKey}` 控制刷新（`onCreated` 回调 `setRefreshKey(k => k + 1)`）
    5. 管理 `addDialogOpen` state，控制 `ViewpointsAddDialog` 开关
    6. 从 `useSession()` 取 `session.user.id` 和 `session.user.role` 传给 `ViewpointsList`

    **`index.ts`**:
    ```typescript
    export { ViewpointsPageView } from "./viewpoints-page-view";
    ```

  - 验证:
    - `/viewpoints` 页面正常渲染，无报错
    - 「添加观点」按钮可点击，弹窗正常打开/关闭
    - 提交后列表刷新

---

- [x] **FE-006**: (P0) 扩展 AI 工作台仿写阶段的观点选择区

  - 文件:
    - `src/components/features/benchmarks/ai-workspace-controller.ts`（扩展）
    - `src/components/features/benchmarks/ai-workspace-rewrite-stage.tsx`（扩展）
    - `src/components/features/benchmarks/ai-workspace-shell.tsx`（可能需要传参透传）
  - 详情:

    **`ai-workspace-controller.ts` 扩展**:
    1. 新增 state（在现有 state 声明之后追加）:
       ```typescript
       const [selectedFragmentIds, setSelectedFragmentIds] = useState<string[]>([]);
       ```
    2. 在 `resetToInitialWorkspace` 的 `startTransition` 中追加:
       ```typescript
       setSelectedFragmentIds([]);
       ```
    3. 新增 handler（保持与现有 handler 风格一致的 `useCallback`）:
       ```typescript
       const handleFragmentToggle = useCallback((id: string) => {
         setSelectedFragmentIds((prev) =>
           prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
         );
       }, []);

       const handleFragmentsClear = useCallback(() => {
         setSelectedFragmentIds([]);
       }, []);
       ```
    4. 在 `useAiWorkspaceController` 返回值中追加:
       ```typescript
       selectedFragmentIds,
       handleFragmentToggle,
       handleFragmentsClear,
       ```

    **`ai-workspace-rewrite-stage.tsx` 扩展**:
    1. 在 `AiWorkspaceRewriteStageProps` 接口中追加三个新 prop（现有 props 保持不变）:
       ```typescript
       selectedFragmentIds: string[];
       onFragmentToggle:    (id: string) => void;
       onFragmentsClear:    () => void;
       ```
    2. 组件函数参数解构中追加这三个 prop
    3. 在组件底部（现有 `grid` 第二行区域，或视实际 DOM 结构在 `section` 结尾处）新增「观点参考」区域:
       - 区块标题行: 文字「观点参考」+ `已选 N 条` Badge + 「清空」Button（type="button"，仅当 selectedFragmentIds.length > 0 时显示）
       - 搜索 Input（debounce 300ms），内部 state 管理 `fragmentQuery`
       - 调用 `apiClient.get<CursorPaginatedData<FragmentDTO>>('/viewpoints', { params: { q: fragmentQuery, limit: 50 } })` 加载观点列表（搜索词变化时重新加载，不做无限滚动，固定 50 条）
       - 可滚动结果列表（`max-h-48 overflow-y-auto`）：每条 Checkbox + 文本（`line-clamp-2`），勾选时调用 `onFragmentToggle(item.id)`，`checked={selectedFragmentIds.includes(item.id)}`
       - 使用 `Checkbox` 原语（`src/components/ui/checkbox.tsx`）
    4. 确保不改变任何现有 prop 的行为，不修改现有 JSX 结构

    **`ai-workspace-shell.tsx`**:
    - 从 `controller` 取 `selectedFragmentIds / handleFragmentToggle / handleFragmentsClear`
    - 透传到 `AiWorkspaceRewriteStage`（找到该组件渲染位置，追加这三个 prop 传入）

  - 验证:
    - `pnpm type-check` 通过（重点检查 Props 类型变更无遗漏传参）
    - 仿写阶段底部可见「观点参考」区域
    - 勾选后 Badge 正确显示「已选 N 条」
    - 清空后 Badge 消失
    - 切换视频后选中状态重置

---

## 视觉约束

- 所有新组件必须沿用项目现有 token（`border-border/60 / bg-card/82 / text-foreground / text-muted-foreground` 等），禁止硬编码颜色
- 圆角优先使用 `rounded-2xl` ~ `rounded-3xl`
- 卡片风格与 `ai-workspace-decomposition-panel.tsx` 中的拆解卡片保持一致
- 搜索 Input 使用 `src/components/ui/input.tsx`
- Dialog 使用 `src/components/ui/dialog.tsx`
- Checkbox 使用 `src/components/ui/checkbox.tsx`

## 完成标准

- [x] `pnpm lint` 无报错
- [x] `pnpm type-check` 全部通过
- [x] 侧边导航可见「观点库」，点击进入 `/viewpoints`
- [x] 观点库页面正常渲染，批量录入弹窗可用，删除带确认
- [x] 搜索防抖正常工作（300ms），无 input 过快导致竞态
- [x] 无限滚动加载下一页正常工作
- [x] 仿写阶段可见「观点参考」区域，搜索+多选+清空功能正常
- [x] 切换视频后 `selectedFragmentIds` 重置为空
