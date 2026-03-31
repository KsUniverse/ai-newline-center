# 前端架构规范

> 摘要：Linear 风格布局（紧凑侧边栏 + 列表/详情分栏）。弹框/抽屉/Slide-over 优先，减少页面跳转。shadcn/ui 组件库 + Zustand 状态管理。暗色主题为主，支持亮色切换。外部提供 UI/UX 品牌设计文档，前端需严格遵循。

## 品牌设计引用

> **重要**: 前端开发必须参照 `docs/standards/ui-ux-system.md` 中的设计系统规范。
> 如有外部提供的品牌设计文档，以该文档为准，ui-ux-system.md 同步更新。

## 布局体系 (Linear 风格)

```
┌──────────────────────────────────────────────────────┐
│ ┌────────┐ ┌────────────────────────────────────────┐│
│ │        │ │ Header (面包屑 + 页面操作按钮)          ││
│ │ Side   │ ├─────────────────┬──────────────────────┤│
│ │ bar    │ │                 │                      ││
│ │        │ │   列表区域       │   详情/编辑面板       ││
│ │ 紧凑   │ │   (主内容)       │   (Slide-over)       ││
│ │ 图标+  │ │                 │                      ││
│ │ 文字   │ │                 │                      ││
│ │        │ │                 │                      ││
│ └────────┘ └─────────────────┴──────────────────────┘│
└──────────────────────────────────────────────────────┘
```

### 布局组件

```typescript
// src/components/shared/layout/app-layout.tsx
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <AppHeader />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
```

### Sidebar 规范

- **宽度**: 收起 `w-16` / 展开 `w-60`
- **结构**: Logo → 主导航 → 分隔线 → 次要导航 → 底部用户区
- **交互**: 图标始终可见，展开时显示文字标签
- **高亮**: 当前页面对应菜单项高亮

## 交互模式 — 弹框优先

**核心原则**: 除了顶级模块切换使用路由导航，其他操作尽量在当前页面内完成。

| 场景 | 交互方式 | 组件 |
|------|---------|------|
| 创建/编辑表单 | 抽屉 (Drawer) | `Sheet` from shadcn |
| 查看详情 | Slide-over 右侧面板 | 自定义 `SlidePanel` |
| 确认操作 | 弹框 (Dialog) | `AlertDialog` from shadcn |
| 删除/危险操作 | 确认弹框 | `AlertDialog` with destructive |
| 筛选/设置 | 弹出面板 (Popover) | `Popover` from shadcn |
| 列表项快捷操作 | 下拉菜单 | `DropdownMenu` from shadcn |

### Slide-over Panel 模板

```typescript
// src/components/shared/common/slide-panel.tsx
"use client";

import { cn } from "@/lib/utils";

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg";
}

const widthMap = { sm: "w-[400px]", md: "w-[560px]", lg: "w-[720px]" };

export function SlidePanel({ open, onClose, title, children, width = "md" }: SlidePanelProps) {
  return (
    <div className={cn(
      "fixed inset-y-0 right-0 z-50 border-l border-border bg-background shadow-lg",
      "transition-transform duration-300 ease-in-out",
      widthMap[width],
      open ? "translate-x-0" : "translate-x-full"
    )}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
```

## 组件层次

```
src/components/
├── ui/                    # L1: shadcn/ui 原子组件 (不手动修改)
│   ├── button.tsx
│   ├── input.tsx
│   └── ...
├── shared/                # L2: 通用组合组件 (跨功能复用)
│   ├── layout/
│   │   ├── app-layout.tsx     # 主布局壳
│   │   ├── app-sidebar.tsx    # 侧边栏
│   │   └── app-header.tsx     # 顶部栏
│   └── common/
│       ├── slide-panel.tsx    # 右侧滑出面板
│       ├── loading-spinner.tsx
│       ├── error-boundary.tsx
│       ├── empty-state.tsx
│       └── confirm-dialog.tsx
└── features/              # L3: 业务功能组件 (按功能模块组织)
    └── [feature-name]/
        ├── [component].tsx
        └── index.ts       # barrel export
```

## 页面结构

```typescript
// src/app/(dashboard)/users/page.tsx — 列表页标准模式
import { UserList } from "@/components/features/user";

export default function UsersPage() {
  return (
    <div className="flex h-full flex-col">
      {/* 页面标题区 */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">用户管理</h1>
          <p className="text-sm text-muted-foreground">管理本组织下的所有用户</p>
        </div>
        <Button onClick={() => setDrawerOpen(true)}>新建用户</Button>
      </div>
      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-6">
        <UserList />
      </div>
    </div>
  );
}
```

## 状态管理 (Zustand)

```typescript
// src/stores/auth.store.ts
import { create } from "zustand";
import type { User } from "@/types/user";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
}));
```

## API 调用

```typescript
// src/lib/api-client.ts
import type { ApiResponse } from "@/types/api";

const BASE_URL = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const json: ApiResponse<T> = await response.json();
  if (!json.success) {
    throw new Error(json.error?.message ?? "请求失败");
  }
  return json.data!;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};
```

### SSE 订阅

```typescript
// src/lib/sse-client.ts
export function subscribeSSE(
  taskId: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: Error) => void,
) {
  const eventSource = new EventSource(`/api/tasks/${taskId}/stream`);
  eventSource.onmessage = (event) => onChunk(event.data);
  eventSource.addEventListener("done", () => { eventSource.close(); onDone(); });
  eventSource.onerror = () => { eventSource.close(); onError(new Error("SSE 连接中断")); };
  return () => eventSource.close();
}
```

## 主题切换

使用 `next-themes` 管理暗色/亮色切换：

```typescript
// src/app/layout.tsx
import { ThemeProvider } from "next-themes";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

在 `globals.css` 中定义 `:root` (亮色) 和 `.dark` (暗色) 两套 CSS 变量。

## 规则

1. **弹框优先**: 创建/编辑/详情操作用 Drawer/SlidePanel/Dialog，不跳转页面
2. **组件职责**: page.tsx 只做布局编排，业务逻辑放在 features/ 组件中
3. **"use client"**: 仅在需要 hooks/事件/浏览器 API 时添加，默认 Server Component
4. **Props 接口**: 每个组件必须定义 Props 接口，使用 named export
5. **样式**: 只用 Tailwind utility classes，禁止内联 style、禁止 CSS modules
6. **API 调用**: 统一通过 `apiClient`，禁止直接 fetch；AI 流式用 `subscribeSSE`
7. **状态**: 服务端数据用 Server Component 直接获取；客户端交互状态用 Zustand
8. **导入**: 功能组件通过 barrel export (`index.ts`) 导出
9. **品牌遵循**: 严格按照 `docs/standards/ui-ux-system.md` 中的设计规范实现
