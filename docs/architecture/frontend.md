# 前端架构规范

> 摘要：基于 Next.js App Router 的组件化架构。shadcn/ui 基础组件 + 业务功能组件 + 通用组件三层体系。Zustand 管理客户端状态。

## 组件层次

```
src/components/
├── ui/                    # L1: shadcn/ui 原子组件 (不手动修改)
│   ├── button.tsx
│   ├── input.tsx
│   └── ...
├── shared/                # L2: 通用组合组件 (跨功能复用)
│   ├── layout/
│   │   ├── app-header.tsx
│   │   ├── app-sidebar.tsx
│   │   └── app-footer.tsx
│   └── common/
│       ├── loading-spinner.tsx
│       ├── error-boundary.tsx
│       ├── empty-state.tsx
│       └── confirm-dialog.tsx
└── features/              # L3: 业务功能组件 (按功能模块组织)
    └── [feature-name]/
        ├── [component].tsx
        └── index.ts       # barrel export
```

## 组件编写规范

```typescript
// src/components/features/user/user-card.tsx
"use client"; // 仅在需要客户端交互时添加

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { User } from "@/types/user";

interface UserCardProps {
  user: User;
  onSelect?: (userId: string) => void;
}

export function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => onSelect?.(user.id)}
    >
      <CardHeader>
        <CardTitle className="text-base">{user.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <Badge variant="secondary">{user.role}</Badge>
      </CardContent>
    </Card>
  );
}
```

## 页面结构

```typescript
// src/app/(dashboard)/users/page.tsx
import { UserList } from "@/components/features/user";

export default function UsersPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">用户管理</h1>
      <UserList />
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

## 规则

1. **组件职责**: 页面(page.tsx)只做布局编排，业务逻辑放在 features/ 组件中
2. **"use client"**: 仅在需要 hooks/事件/浏览器 API 时添加，默认 Server Component
3. **Props 接口**: 每个组件必须定义 Props 接口，使用 named export
4. **样式**: 只用 Tailwind utility classes，禁止内联 style、禁止 CSS modules
5. **API 调用**: 统一通过 `apiClient`，禁止直接 fetch
6. **状态**: 服务端数据用 Server Component 直接获取；客户端交互状态用 Zustand
7. **导入**: 功能组件通过 barrel export (`index.ts`) 导出
