# v0.3.0.1 前端任务清单

## 必读文档

> 开始开发前必须阅读以下文档：

- `docs/product/versions/v0.3.0.1/requirements.md` — 本版本需求（理解业务背景与 Feature-1 验收标准）
- `docs/product/versions/v0.3.0.1/technical-design.md` — 本版本技术设计（含 Hook 设计和 UI 说明）
- `docs/architecture/frontend.md` — 前端组件体系规范
- `docs/standards/ui-ux-system.md` — UI/UX 设计系统（Linear 暗色主题规范）
- `docs/standards/coding-standards.md` — 编码规范

## 摘要

| 属性 | 值 |
|------|----|
| 任务总数 | 5 |
| 涉及文件 | 新建 1 个 Hook 文件，修改 4 个页面组件 |
| 优先级 | FE-001 为基础，FE-002 ~ FE-005 均为 P1 |
| 执行顺序约束 | FE-001 必须先于 FE-002 ~ FE-005 |

---

## 任务列表

---

### FE-001: (P1) 创建 `useAutoRefresh` Hook

**文件**：`src/lib/hooks/use-auto-refresh.ts`（新建文件，如目录不存在则一并创建）

**详情**：

创建自动刷新 Hook，供四个页面组件共用：

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 每隔 intervalMs 毫秒自动调用 callback。
 * isRefreshing 在 callback 触发后约 800ms 内为 true，可用于驱动旋转动画。
 */
export function useAutoRefresh(intervalMs: number, callback: () => void) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  // 持有最新 callback 的 ref，避免 setInterval 捕获旧闭包
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    callbackRef.current();
    const timer = setTimeout(() => setIsRefreshing(false), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, refresh]);

  return { isRefreshing };
}
```

**设计要点**：
- `callbackRef` 模式：`intervalMs` 变化时重建 interval，但 `callback` 变化时不重建（避免因父组件每次渲染产生的新函数引用导致频繁重置计时器）
- `isRefreshing` 仅控制图标动画，不控制数据 loading 状态（数据 loading 由各页面的 `loading` state 负责）
- `setInterval` 在组件 unmount 时通过 cleanup 函数 `clearInterval` 自动清除，无内存泄漏

**验收**：
- Hook 文件存在，TypeScript 编译通过，无 `any`
- 多次调用 `useAutoRefresh(60_000, cb)` 时，每次 interval 重置均正确 cleanup

---

### FE-002: (P1) 账号列表页（`AccountsPageView`）接入自动刷新

**文件**：`src/components/features/accounts/accounts-page.tsx`

**详情**：

**步骤 1**：导入 Hook 和新增 icon、Tooltip 相关组件：

```typescript
import { RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";
import { cn } from "@/lib/utils";
```

**步骤 2**：在 `AccountsPageView` 函数体中，在现有 `const [refreshKey, setRefreshKey] = useState(0);` 之后添加：

```typescript
const { isRefreshing } = useAutoRefresh(60_000, () => setRefreshKey((k) => k + 1));
```

**步骤 3**：在 `DashboardPageShell` 的 `actions` prop 中，在现有「添加账号」按钮`<Button ...>`之前插入刷新图标：

```tsx
actions={
  <div className="flex items-center gap-2">
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <RefreshCw
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground/50 shrink-0",
              isRefreshing && "animate-spin",
            )}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>每 60 秒自动刷新</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
    {isEmployee && (
      <Button size="sm" onClick={() => setDrawerOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" />
        添加账号
      </Button>
    )}
  </div>
}
```

> 注意：`actions` 当前的写法需先确认实际 JSX 结构后对齐插入位置，不要删除现有按钮逻辑。

**验收**：
1. 页面挂载 60 秒后，账号列表和视频列表自动重新请求
2. `RefreshCw` 图标在触发刷新时进入旋转动画（约 800ms），完成后静止
3. 图标颜色低调（`text-muted-foreground/50`），不影响主操作区布局
4. 添加账号 Drawer 打开时，自动刷新不重置 Drawer 状态

---

### FE-003: (P1) 我的账号详情页（`AccountDetailPageView`）接入自动刷新

**文件**：`src/components/features/accounts/account-detail-page.tsx`

**详情**：

此页面当前**没有** `refreshKey` state，需要手动添加。

**步骤 1**：新增导入：

```typescript
import { RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";
import { cn } from "@/lib/utils";
```

**步骤 2**：在 state 声明区域新增 `refreshKey`：

```typescript
const [refreshKey, setRefreshKey] = useState(0);
```

**步骤 3**：在 `refreshKey` 声明之后，添加 Hook 调用：

```typescript
const { isRefreshing } = useAutoRefresh(60_000, () => setRefreshKey((k) => k + 1));
```

**步骤 4**：将 `refreshKey` 加入两个 `useEffect` 的依赖数组：
- `loadAccount` 所在 `useEffect` 的依赖数组：`[status, accountId, refreshKey]`
- `loadVideos` 所在 `useEffect` 的依赖数组：`[status, accountId, videoPage, refreshKey]`

**步骤 5**：在页面头部的按钮区域（ArrowLeft 返回按钮旁或右侧），添加刷新图标（参考 FE-002 的 Tooltip + RefreshCw 写法，颜色和尺寸保持一致）。此页面无 `DashboardPageShell`，需找到包含「返回」和「归档」按钮的 Header 区域，在该区域的 flex 容器末尾添加图标。

**验收**：
1. 详情页挂载 60 秒后，账号信息和视频列表自动刷新
2. 视频详情 Dialog 打开时，自动刷新数据更新不关闭 Dialog
3. 路由切换离开详情页后，不再产生后台 fetch 请求（cleanup 有效）

---

### FE-004: (P1) 对标账号列表页（`BenchmarksPageView`）接入自动刷新

**文件**：`src/components/features/benchmarks/benchmarks-page.tsx`

**详情**：

此页面已有 `refreshKey` 机制，改动最小。

**步骤 1**：新增导入（与 FE-002 相同，添加 `RefreshCw`、`Tooltip*`、`useAutoRefresh`、`cn`）。

**步骤 2**：找到现有 `const [refreshKey, setRefreshKey] = useState(0);`，在其之后添加：

```typescript
const { isRefreshing } = useAutoRefresh(60_000, () => setRefreshKey((k) => k + 1));
```

**步骤 3**：在 `DashboardPageShell` 的 `actions` prop 中，在「添加对标账号」`<Button>` 之前插入刷新图标（参考 FE-002 写法）。

**验收**：
1. 页面挂载 60 秒后，对标账号卡片列表自动更新（Bug-1 修复后新增的博主卡片自动出现）
2. 「添加对标账号」Drawer 打开时，刷新完成不关闭 Drawer
3. 归档确认 Dialog 打开时，刷新不关闭 Dialog

---

### FE-005: (P1) 对标账号详情页（`BenchmarkDetailPageView`）接入自动刷新

**文件**：`src/components/features/benchmarks/benchmark-detail-page.tsx`

**详情**：

此页面当前**没有** `refreshKey` state，步骤与 FE-003 类似。

**步骤 1**：新增导入（同 FE-003）。

**步骤 2**：新增 state：

```typescript
const [refreshKey, setRefreshKey] = useState(0);
```

**步骤 3**：添加 Hook 调用：

```typescript
const { isRefreshing } = useAutoRefresh(60_000, () => setRefreshKey((k) => k + 1));
```

**步骤 4**：将 `refreshKey` 加入两个 `useEffect` 的依赖数组：
- `loadAccount` 所在 `useEffect`：`[status, accountId, refreshKey]`
- `loadVideos` 所在 `useEffect`：`[status, accountId, videoPage, refreshKey]`

**步骤 5**：在页面顶部返回按钮区域（含「归档」按钮的 Header flex 容器）的末尾添加刷新图标（参考 FE-002 写法）。

**验收**：
1. 详情页挂载 60 秒后，账号信息和视频列表自动更新
2. Bug-3 验收：对标账号详情页在视频同步定时器执行后自动出现视频列表（无需手动刷新）
3. 视频转录 Slide-over 打开时，刷新不重置面板状态
4. 路由切换离开后，无后台 fetch 请求残留

---

## 自省报告（2026-04-04）

### 完成状态

| 任务 | 状态 |
|------|------|
| FE-001: 创建 `useAutoRefresh` Hook | ✅ |
| FE-002: 账号列表页接入自动刷新 | ✅ |
| FE-003: 账号详情页接入自动刷新 | ✅ |
| FE-004: 对标账号列表页接入自动刷新 | ✅ |
| FE-005: 对标账号详情页接入自动刷新 | ✅ |

### 回顾

**沉淀的共享 UI 模式**：`useAutoRefresh` Hook + `RefreshCw` Tooltip 组合是可复用的刷新指示器模式，五个页面均使用相同的 `h-3.5 w-3.5 text-muted-foreground/50 animate-spin` 样式和「每 60 秒自动刷新」Tooltip 文案。若后续有更多页面需要此功能，可考虑封装为 `<AutoRefreshIndicator isRefreshing={...} />` 共享组件。

**复用情况**：无复制式页面扩散，FE-003 和 FE-005 的改动结构完全对称，FE-002 和 FE-004 的 `actions prop` 改动结构也完全对称。

**未发现 DOC-ISSUE**：技术设计方案与实际代码结构完全对齐，无需标注文档问题。

### 检查

- `docs/architecture/frontend.md`：新增了 `src/lib/hooks/` 目录（`use-auto-refresh.ts`），该目录在架构文档中未明确列出，但符合前端架构规范中「自定义 Hook 放在 lib/ 下」的约定，无需修改架构文档。
- `docs/standards/ui-ux-system.md`：`RefreshCw` 图标 + `TooltipProvider` 组合是首次在本项目中引入的「自动刷新指示器」交互模式，可在设计系统文档中补充记录。

### 同步建议

建议在 `docs/standards/ui-ux-system.md` 中补充「自动刷新指示器」组件规范：
- 图标：`RefreshCw`，尺寸 `h-3.5 w-3.5`，颜色 `text-muted-foreground/50`
- 动画：刷新触发时 `animate-spin`，持续 800ms
- Tooltip 文案：「每 X 秒自动刷新」
- 位置：页面标题操作区（`DashboardPageShell` 的 `actions` prop 左侧），或详情页返回按钮右侧
