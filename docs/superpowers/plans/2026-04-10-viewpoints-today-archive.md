# Viewpoints Today/Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `fragments` 缺表阻塞，并把观点库改造成“主页面只看今日观点、历史独立归档页、仿写仅可选今日观点”的交互与查询体系。

**Architecture:** 保持 `Fragment` 作为唯一数据模型，不新增“今日/历史”持久字段，而是基于 `createdAt` 和 `Asia/Shanghai` 自然日计算 scope。后端扩展 `GET /viewpoints` 的 `scope` 过滤；前端主页面固定请求 `today`，新增归档页请求 `history` 并按日期分组；AI 仿写阶段复用同一接口但只拉 `today`。数据库问题不通过代码兜底，先应用现有 Prisma migration。

**Tech Stack:** Next.js 15 App Router、TypeScript、Prisma 6、Vitest、Tailwind CSS 4、shadcn/ui

---

### Task 1: 恢复本地数据库结构并验证 `fragments` 表存在

**Files:**
- Modify: 无
- Test: 无

- [ ] **Step 1: 查看 Prisma migration 状态**

Run:

```bash
pnpm prisma migrate status
```

Expected:

```text
The following migration(s) have not yet been applied:
20260410130917_add_fragments
```

- [ ] **Step 2: 应用已有 migration 修复缺表问题**

Run:

```bash
pnpm db:migrate
```

Expected:

```text
Applying migration `20260410130917_add_fragments`
```

- [ ] **Step 3: 直接验证 `fragments` 表已存在**

Run:

```powershell
@'
SHOW TABLES LIKE 'fragments';
'@ | pnpm prisma db execute --stdin --schema prisma/schema.prisma
```

Expected:

```text
fragments
```

- [ ] **Step 4: 用最小请求验证观点创建不再触发 `P2021`**

Run:

```powershell
@'
fetch("http://localhost:3000/api/viewpoints", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ contents: ["数据库恢复验证观点"] }),
}).then(async (res) => {
  console.log(res.status);
  console.log(await res.text());
});
'@ | node -
```

Expected:

```text
201
```

如果这里仍失败，先停下并检查 `.env` 指向的数据库是否就是当前开发库。

---

### Task 2: 先写失败测试，定义 `today/history` 查询契约

**Files:**
- Create: `src/server/services/fragment-time-scope.ts`
- Create: `src/server/services/fragment-time-scope.test.ts`
- Modify: `src/types/fragment.ts`
- Modify: `src/server/services/fragment.service.test.ts`
- Modify: `src/app/api/viewpoints/route.test.ts`
- Test: `src/server/services/fragment-time-scope.test.ts`
- Test: `src/server/services/fragment.service.test.ts`
- Test: `src/app/api/viewpoints/route.test.ts`

- [ ] **Step 1: 扩展共享类型，先把 scope 放进接口契约**

Update [`src/types/fragment.ts`](/D:/code/ai-newline-center/src/types/fragment.ts):

```ts
export type FragmentScope = "today" | "history";

export interface ListFragmentsParams {
  q?: string;
  cursor?: string;
  limit?: number;
  scope?: FragmentScope;
}
```

- [ ] **Step 2: 为上海自然日边界写失败测试**

Create [`src/server/services/fragment-time-scope.test.ts`](/D:/code/ai-newline-center/src/server/services/fragment-time-scope.test.ts):

```ts
import { describe, expect, it } from "vitest";

import { getShanghaiDayBounds } from "@/server/services/fragment-time-scope";

describe("getShanghaiDayBounds", () => {
  it("returns UTC bounds for the current Shanghai calendar day", () => {
    const bounds = getShanghaiDayBounds(new Date("2026-04-10T03:15:00.000Z"));

    expect(bounds).toEqual({
      start: new Date("2026-04-09T16:00:00.000Z"),
      end: new Date("2026-04-10T16:00:00.000Z"),
    });
  });
});
```

- [ ] **Step 3: 为 service 写失败测试，锁定默认 `today` 和显式 `history`**

Add to [`src/server/services/fragment.service.test.ts`](/D:/code/ai-newline-center/src/server/services/fragment.service.test.ts):

```ts
it("defaults listFragments scope to today", async () => {
  findManyMock.mockResolvedValue({
    items: [],
    nextCursor: null,
    hasMore: false,
  });

  await fragmentService.listFragments(
    {
      id: "manager_1",
      account: "manager",
      name: "负责人",
      role: UserRole.BRANCH_MANAGER,
      organizationId: "org_1",
    },
    {},
  );

  expect(findManyMock).toHaveBeenCalledWith({
    organizationId: "org_1",
    q: undefined,
    cursor: undefined,
    limit: 20,
    scope: "today",
  });
});

it("passes explicit history scope to the repository", async () => {
  findManyMock.mockResolvedValue({
    items: [],
    nextCursor: null,
    hasMore: false,
  });

  await fragmentService.listFragments(
    {
      id: "manager_1",
      account: "manager",
      name: "负责人",
      role: UserRole.BRANCH_MANAGER,
      organizationId: "org_1",
    },
    { scope: "history", limit: 10 },
  );

  expect(findManyMock).toHaveBeenCalledWith({
    organizationId: "org_1",
    q: undefined,
    cursor: undefined,
    limit: 10,
    scope: "history",
  });
});
```

- [ ] **Step 4: 为 API route 写失败测试，锁定 query schema**

Add to [`src/app/api/viewpoints/route.test.ts`](/D:/code/ai-newline-center/src/app/api/viewpoints/route.test.ts):

```ts
it("defaults scope to today when omitted", async () => {
  authMock.mockResolvedValue({
    user: {
      id: "user_1",
      name: "Alice",
      account: "alice",
      role: UserRole.EMPLOYEE,
      organizationId: "org_1",
    },
  });
  listFragmentsMock.mockResolvedValue({
    items: [],
    nextCursor: null,
    hasMore: false,
  });

  const { GET } = await import("@/app/api/viewpoints/route");
  const response = await GET(new Request("http://localhost/api/viewpoints"));

  expect(response.status).toBe(200);
  expect(listFragmentsMock).toHaveBeenCalledWith(
    expect.objectContaining({ id: "user_1" }),
    {
      q: undefined,
      cursor: undefined,
      limit: 20,
      scope: "today",
    },
  );
});

it("accepts history scope and rejects invalid scope values", async () => {
  authMock.mockResolvedValue({
    user: {
      id: "user_1",
      name: "Alice",
      account: "alice",
      role: UserRole.EMPLOYEE,
      organizationId: "org_1",
    },
  });
  listFragmentsMock.mockResolvedValue({
    items: [],
    nextCursor: null,
    hasMore: false,
  });

  const { GET } = await import("@/app/api/viewpoints/route");

  const historyResponse = await GET(
    new Request("http://localhost/api/viewpoints?scope=history&limit=10"),
  );
  expect(historyResponse.status).toBe(200);
  expect(listFragmentsMock).toHaveBeenCalledWith(
    expect.objectContaining({ id: "user_1" }),
    {
      q: undefined,
      cursor: undefined,
      limit: 10,
      scope: "history",
    },
  );

  const invalidScopeResponse = await GET(
    new Request("http://localhost/api/viewpoints?scope=all"),
  );
  expect(invalidScopeResponse.status).toBe(400);
});
```

- [ ] **Step 5: 运行测试，确认它们先失败**

Run:

```bash
pnpm test -- src/server/services/fragment-time-scope.test.ts src/server/services/fragment.service.test.ts src/app/api/viewpoints/route.test.ts
```

Expected:

```text
FAIL
```

失败点应集中在：

- `getShanghaiDayBounds` 尚未实现
- `scope` 尚未进入 service 和 route

- [ ] **Step 6: 提交测试契约**

```bash
git add src/types/fragment.ts src/server/services/fragment-time-scope.test.ts src/server/services/fragment.service.test.ts src/app/api/viewpoints/route.test.ts
git commit -m "test: define viewpoint today and history scope contract"
```

---

### Task 3: 实现后端 `scope` 过滤与上海时区日期边界

**Files:**
- Create: `src/server/services/fragment-time-scope.ts`
- Modify: `src/server/repositories/fragment.repository.ts`
- Modify: `src/server/services/fragment.service.ts`
- Modify: `src/app/api/viewpoints/route.ts`
- Modify: `src/types/fragment.ts`
- Test: `src/server/services/fragment-time-scope.test.ts`
- Test: `src/server/services/fragment.service.test.ts`
- Test: `src/app/api/viewpoints/route.test.ts`

- [ ] **Step 1: 实现上海自然日边界工具**

Create [`src/server/services/fragment-time-scope.ts`](/D:/code/ai-newline-center/src/server/services/fragment-time-scope.ts):

```ts
import type { FragmentScope } from "@/types/fragment";

function getDatePart(parts: Intl.DateTimeFormatPart[], type: "year" | "month" | "day"): number {
  const value = parts.find((part) => part.type === type)?.value;

  if (!value) {
    throw new Error(`Missing ${type} in Shanghai date parts`);
  }

  return Number(value);
}

export function getShanghaiDayBounds(now = new Date()): { start: Date; end: Date } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = getDatePart(parts, "year");
  const month = getDatePart(parts, "month");
  const day = getDatePart(parts, "day");

  return {
    start: new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0)),
    end: new Date(Date.UTC(year, month - 1, day + 1, -8, 0, 0, 0)),
  };
}

export function resolveFragmentCreatedAtFilter(scope: FragmentScope, now = new Date()) {
  const { start, end } = getShanghaiDayBounds(now);

  if (scope === "history") {
    return {
      lt: start,
    };
  }

  return {
    gte: start,
    lt: end,
  };
}
```

- [ ] **Step 2: 让 repository 接受 scope，并把时间过滤并入 Prisma where**

Update [`src/server/repositories/fragment.repository.ts`](/D:/code/ai-newline-center/src/server/repositories/fragment.repository.ts):

```ts
import { resolveFragmentCreatedAtFilter } from "@/server/services/fragment-time-scope";
import type { FragmentScope } from "@/types/fragment";

export interface FindManyFragmentsParams {
  organizationId: string;
  q?: string;
  cursor?: string;
  limit: number;
  scope: FragmentScope;
}

private buildWhere(params: {
  organizationId: string;
  q?: string;
  cursor?: string;
  scope: FragmentScope;
}): Prisma.FragmentWhereInput {
  const where: Prisma.FragmentWhereInput = {
    organizationId: params.organizationId,
    deletedAt: null,
    createdAt: resolveFragmentCreatedAtFilter(params.scope),
    ...(params.q ? { content: { contains: params.q } } : {}),
  };

  if (!params.cursor) {
    return where;
  }

  const cursor = this.decodeCursor(params.cursor);
  const cursorCreatedAt = new Date(cursor.c);

  return {
    ...where,
    AND: [
      {
        OR: [
          { createdAt: { lt: cursorCreatedAt } },
          {
            AND: [
              { createdAt: cursorCreatedAt },
              { id: { lt: cursor.i } },
            ],
          },
        ],
      },
    ],
  };
}
```

- [ ] **Step 3: 让 service 默认 scope 为 `today`**

Update [`src/server/services/fragment.service.ts`](/D:/code/ai-newline-center/src/server/services/fragment.service.ts):

```ts
const result = await fragmentRepository.findMany({
  organizationId: caller.organizationId,
  q: params.q,
  cursor: params.cursor,
  limit: params.limit ?? 20,
  scope: params.scope ?? "today",
});
```

- [ ] **Step 4: 扩展 API route 的 query schema**

Update [`src/app/api/viewpoints/route.ts`](/D:/code/ai-newline-center/src/app/api/viewpoints/route.ts):

```ts
const listFragmentsSchema = z.object({
  q: z.string().max(200).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  scope: z.enum(["today", "history"]).default("today"),
});
```

- [ ] **Step 5: 运行测试，确认后端契约通过**

Run:

```bash
pnpm test -- src/server/services/fragment-time-scope.test.ts src/server/services/fragment.service.test.ts src/app/api/viewpoints/route.test.ts src/app/api/viewpoints/[id]/route.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 6: 提交后端实现**

```bash
git add src/server/services/fragment-time-scope.ts src/server/repositories/fragment.repository.ts src/server/services/fragment.service.ts src/app/api/viewpoints/route.ts src/types/fragment.ts src/server/services/fragment-time-scope.test.ts src/server/services/fragment.service.test.ts src/app/api/viewpoints/route.test.ts
git commit -m "feat: add today and history scopes for viewpoints"
```

---

### Task 4: 改造观点库页面为“今日观点池”，并新增历史归档页

**Files:**
- Create: `src/app/(dashboard)/viewpoints/archived/page.tsx`
- Create: `src/components/features/viewpoints/viewpoints-archived-page-view.tsx`
- Create: `src/components/features/viewpoints/viewpoints-grouping.ts`
- Create: `src/components/features/viewpoints/viewpoints-grouping.test.ts`
- Modify: `src/components/features/viewpoints/index.ts`
- Modify: `src/components/features/viewpoints/viewpoints-page-view.tsx`
- Modify: `src/components/features/viewpoints/viewpoints-list.tsx`
- Test: `src/components/features/viewpoints/viewpoints-grouping.test.ts`

- [ ] **Step 1: 为历史归档的“按日期分组”写失败测试**

Create [`src/components/features/viewpoints/viewpoints-grouping.test.ts`](/D:/code/ai-newline-center/src/components/features/viewpoints/viewpoints-grouping.test.ts):

```ts
import { describe, expect, it } from "vitest";

import { groupHistoricalViewpointsByDate } from "@/components/features/viewpoints/viewpoints-grouping";

describe("groupHistoricalViewpointsByDate", () => {
  it("groups history items by Shanghai calendar day in descending order", () => {
    const groups = groupHistoricalViewpointsByDate([
      {
        id: "fragment_2",
        content: "4 月 9 日晚观点",
        organizationId: "org_1",
        createdByUserId: "user_1",
        createdByUser: { id: "user_1", name: "Alice" },
        createdAt: "2026-04-09T13:00:00.000Z",
      },
      {
        id: "fragment_1",
        content: "4 月 9 日早观点",
        organizationId: "org_1",
        createdByUserId: "user_1",
        createdByUser: { id: "user_1", name: "Alice" },
        createdAt: "2026-04-09T01:00:00.000Z",
      },
      {
        id: "fragment_3",
        content: "4 月 8 日观点",
        organizationId: "org_1",
        createdByUserId: "user_1",
        createdByUser: { id: "user_1", name: "Alice" },
        createdAt: "2026-04-08T03:00:00.000Z",
      },
    ]);

    expect(groups.map((group) => group.key)).toEqual(["2026-04-09", "2026-04-08"]);
    expect(groups[0]?.items).toHaveLength(2);
    expect(groups[1]?.items).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 实现分组工具**

Create [`src/components/features/viewpoints/viewpoints-grouping.ts`](/D:/code/ai-newline-center/src/components/features/viewpoints/viewpoints-grouping.ts):

```ts
import type { FragmentDTO } from "@/types/fragment";

export interface ViewpointDateGroup {
  key: string;
  label: string;
  items: FragmentDTO[];
}

function toShanghaiDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function toShanghaiDateLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0));

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

export function groupHistoricalViewpointsByDate(items: FragmentDTO[]): ViewpointDateGroup[] {
  const map = new Map<string, FragmentDTO[]>();

  for (const item of items) {
    const key = toShanghaiDateKey(item.createdAt);
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }

  return Array.from(map.entries())
    .sort((left, right) => (left[0] < right[0] ? 1 : -1))
    .map(([key, groupedItems]) => ({
      key,
      label: toShanghaiDateLabel(key),
      items: groupedItems,
    }));
}
```

- [ ] **Step 3: 新增历史归档页面入口与 page view**

Create [`src/app/(dashboard)/viewpoints/archived/page.tsx`](/D:/code/ai-newline-center/src/app/(dashboard)/viewpoints/archived/page.tsx):

```ts
import { ViewpointsArchivedPageView } from "@/components/features/viewpoints";

export default function ViewpointsArchivedPage() {
  return <ViewpointsArchivedPageView />;
}
```

Create [`src/components/features/viewpoints/viewpoints-archived-page-view.tsx`](/D:/code/ai-newline-center/src/components/features/viewpoints/viewpoints-archived-page-view.tsx):

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";

import type { CursorPaginatedData } from "@/types/api";
import type { FragmentDTO } from "@/types/fragment";
import { apiClient } from "@/lib/api-client";
import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { TaskEmptyState } from "@/components/shared/common/task-empty-state";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { groupHistoricalViewpointsByDate } from "./viewpoints-grouping";

export function ViewpointsArchivedPageView() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FragmentDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiClient
      .get<CursorPaginatedData<FragmentDTO>>(
        `/viewpoints?scope=history&limit=40${query ? `&q=${encodeURIComponent(query)}` : ""}`,
      )
      .then((result) => {
        setItems(result.items);
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "历史观点加载失败");
      })
      .finally(() => setLoading(false));
  }, [query]);

  const groups = useMemo(() => groupHistoricalViewpointsByDate(items), [items]);

  return (
    <DashboardPageShell
      eyebrow="Viewpoint Archive"
      title="历史归档"
      description="按日期回看组织内过往观点记录。"
      backHref="/viewpoints"
      backLabel="返回今日观点"
      maxWidth="wide"
    >
      <MetaPillList
        items={[
          { label: `历史 ${items.length} 条`, tone: "primary" },
          { label: "按日期归档展示" },
        ]}
      />

      <Input
        type="search"
        placeholder="搜索历史观点..."
        onChange={(event) => setQuery(event.target.value)}
        className="max-w-sm rounded-2xl border-border/60 bg-background/80"
      />

      {loading ? null : groups.length === 0 ? (
        <TaskEmptyState
          icon={History}
          eyebrow="Archive Memory"
          title="历史归档暂时为空"
          description={query ? "没有匹配的历史观点" : "当前还没有历史观点可供回看。"}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} className="rounded-3xl border border-border/60 bg-card/82 p-5 shadow-sm">
              <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">
                {group.label}
              </p>
              <div className="mt-3 space-y-3">
                {group.items.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-border/60 bg-background/80 px-4 py-4">
                    <p className="text-sm leading-7 text-foreground/90">{item.content}</p>
                    <p className="mt-2 text-xs text-muted-foreground/70">
                      {item.createdByUser.name}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}

          {hasMore ? (
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const result = await apiClient.get<CursorPaginatedData<FragmentDTO>>(
                  `/viewpoints?scope=history&limit=40&cursor=${nextCursor ?? ""}${query ? `&q=${encodeURIComponent(query)}` : ""}`,
                );
                setItems((prev) => [...prev, ...result.items]);
                setNextCursor(result.nextCursor);
                setHasMore(result.hasMore);
              }}
            >
              加载更多历史观点
            </Button>
          ) : null}
        </div>
      )}
    </DashboardPageShell>
  );
}
```

- [ ] **Step 4: 改造主页面为“今日观点池”并增加历史入口**

Update [`src/components/features/viewpoints/viewpoints-page-view.tsx`](/D:/code/ai-newline-center/src/components/features/viewpoints/viewpoints-page-view.tsx):

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { History, Plus } from "lucide-react";

import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { Button } from "@/components/ui/button";

import { ViewpointsAddDialog } from "./viewpoints-add-dialog";
import { ViewpointsList } from "./viewpoints-list";

export function ViewpointsPageView() {
  const { data: session } = useSession();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const currentUserId = session?.user?.id ?? "";
  const currentUserRole = session?.user?.role ?? "EMPLOYEE";

  return (
    <DashboardPageShell
      eyebrow="Viewpoints"
      title="今日观点池"
      description="只展示今天新增、今天可引用的观点内容。"
      maxWidth="wide"
      actions={
        <>
          <Button variant="outline" size="sm" className="h-8 rounded-md px-3 text-sm" asChild>
            <Link href="/viewpoints/archived">
              <History className="mr-1.5 h-3.5 w-3.5" />
              历史归档
            </Link>
          </Button>
          <Button type="button" size="sm" className="h-8 rounded-md px-3 text-sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            添加观点
          </Button>
        </>
      }
    >
      <MetaPillList
        items={[
          { label: "仅展示今天新增", tone: "primary" },
          { label: "历史内容已归档" },
        ]}
      />

      <ViewpointsList
        key={refreshKey}
        scope="today"
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
      />

      <ViewpointsAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCreated={() => setRefreshKey((current) => current + 1)}
      />
    </DashboardPageShell>
  );
}
```

Update [`src/components/features/viewpoints/viewpoints-list.tsx`](/D:/code/ai-newline-center/src/components/features/viewpoints/viewpoints-list.tsx):

```ts
import type { FragmentScope } from "@/types/fragment";

interface ViewpointsListProps {
  scope: FragmentScope;
  currentUserId: string;
  currentUserRole: string;
}
```

and in the fetch:

```ts
const params = new URLSearchParams({ limit: "20", scope });
```

and update the empty-state copy:

```tsx
title={scope === "today" ? "今天还没有新增观点" : "暂无观点"}
description={
  query
    ? `没有找到包含「${query}」的${scope === "today" ? "今日观点" : "观点"}`
    : scope === "today"
      ? "点击「添加观点」开始录入今天的观点。"
      : "当前暂无观点。"
}
```

- [ ] **Step 5: 导出新页面组件**

Update [`src/components/features/viewpoints/index.ts`](/D:/code/ai-newline-center/src/components/features/viewpoints/index.ts):

```ts
export { ViewpointsPageView } from "./viewpoints-page-view";
export { ViewpointsArchivedPageView } from "./viewpoints-archived-page-view";
```

- [ ] **Step 6: 运行分组测试并做页面人工验证**

Run:

```bash
pnpm test -- src/components/features/viewpoints/viewpoints-grouping.test.ts
pnpm type-check
```

Manual verification:

1. 打开 `/viewpoints`
2. 确认主页面标题为“今日观点池”
3. 确认右上角可进入 `/viewpoints/archived`
4. 在归档页确认列表按日期分组，且返回按钮正常

- [ ] **Step 7: 提交页面改造**

```bash
git add src/app/(dashboard)/viewpoints/archived/page.tsx src/components/features/viewpoints/viewpoints-archived-page-view.tsx src/components/features/viewpoints/viewpoints-grouping.ts src/components/features/viewpoints/viewpoints-grouping.test.ts src/components/features/viewpoints/index.ts src/components/features/viewpoints/viewpoints-page-view.tsx src/components/features/viewpoints/viewpoints-list.tsx
git commit -m "feat: split viewpoints into today page and archive page"
```

---

### Task 5: 限制仿写只引用今日观点，并升级为可点选卡片列表

**Files:**
- Modify: `src/components/features/benchmarks/ai-workspace-rewrite-stage.tsx`
- Test: 无新增自动化测试

- [ ] **Step 1: 先把请求范围收窄为 `today`**

Update [`src/components/features/benchmarks/ai-workspace-rewrite-stage.tsx`](/D:/code/ai-newline-center/src/components/features/benchmarks/ai-workspace-rewrite-stage.tsx):

```ts
const params = new URLSearchParams({ limit: "50", scope: "today" });
if (fragmentQuery) params.set("q", fragmentQuery);
```

- [ ] **Step 2: 把标题与空状态改成“今日观点参考”语义**

Replace the current copy block with:

```tsx
<p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
  今日观点参考
</p>
```

and:

```tsx
<p className="py-4 text-center text-xs text-muted-foreground/50">
  {fragmentQuery ? "今天没有匹配的观点" : "今日暂无可引用观点，请先前往观点库录入"}
</p>
```

- [ ] **Step 3: 将 checkbox 行升级为可点选卡片**

Replace the current list item with:

```tsx
{fragments.map((fragment) => {
  const selected = selectedFragmentIds.includes(fragment.id);

  return (
    <button
      key={fragment.id}
      type="button"
      onClick={() => onFragmentToggle(fragment.id)}
      className={`w-full rounded-2xl border px-3 py-3 text-left transition-all ${
        selected
          ? "border-primary/30 bg-primary/6 shadow-sm"
          : "border-border/60 bg-background/70 hover:border-primary/25 hover:bg-primary/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 h-8 w-1 rounded-full ${
            selected ? "bg-primary/70" : "bg-border/70"
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs leading-5 text-foreground/90">
            {fragment.content}
          </p>
          <p className="mt-2 text-2xs text-muted-foreground/70">
            {fragment.createdByUser.name}
          </p>
        </div>
      </div>
    </button>
  );
})}
```

- [ ] **Step 4: 保留已选数量 pill 与清空动作，不再显示多余 checkbox 控件**

Keep:

```tsx
{selectedFragmentIds.length > 0 && (
  <Badge
    variant="secondary"
    className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs shadow-sm"
  >
    已选 {selectedFragmentIds.length} 条
  </Badge>
)}
```

and:

```tsx
<Button
  type="button"
  variant="ghost"
  size="sm"
  className="h-6 rounded-lg px-2 text-xs text-muted-foreground/70 hover:text-foreground"
  onClick={onFragmentsClear}
>
  清空
</Button>
```

- [ ] **Step 5: 运行类型检查并人工验证仿写交互**

Run:

```bash
pnpm type-check
```

Manual verification:

1. 进入任一 AI workspace 的 rewrite 阶段
2. 确认右下角标题变为“今日观点参考”
3. 确认搜索和列表都不再返回历史观点
4. 确认点击卡片即可选中/取消
5. 确认“清空”按钮可重置所选观点

- [ ] **Step 6: 提交仿写区改造**

```bash
git add src/components/features/benchmarks/ai-workspace-rewrite-stage.tsx
git commit -m "feat: limit rewrite references to today's viewpoints"
```

---

### Task 6: 同步文档并完成最终验证

**Files:**
- Modify: `docs/standards/ui-ux-system.md`
- Modify: `docs/architecture/frontend.md`

- [ ] **Step 1: 在 UI/UX 规范中补充“短文本按日归档页”模式**

Add to [`docs/standards/ui-ux-system.md`](/D:/code/ai-newline-center/docs/standards/ui-ux-system.md) a short paragraph under list/detail content patterns:

```md
### 归档型短文本库

对于观点、记录、线索等短文本库，历史页优先使用“按日期分组的归档清单”，而不是延续实体档案卡片。页面仍复用 `DashboardPageShell` 与 compact pills，但正文区改为日期分组 + 轻量 surface 列表，以突出回看节奏和时间线。
```

- [ ] **Step 2: 在前端架构文档中补充 viewpoints archive 的模式说明**

Add to [`docs/architecture/frontend.md`](/D:/code/ai-newline-center/docs/architecture/frontend.md):

```md
对于“今天可操作、历史可回看”的内容库，前台入口页应只承载当天工作集，历史内容进入独立 archive page。观点库是该模式的基线案例：主页面固定 today scope，archive page 负责 history scope，并按日期分组渲染。
```

- [ ] **Step 3: 运行最终验证**

Run:

```bash
pnpm test -- src/server/services/fragment-time-scope.test.ts src/server/services/fragment.service.test.ts src/app/api/viewpoints/route.test.ts src/app/api/viewpoints/[id]/route.test.ts src/components/features/viewpoints/viewpoints-grouping.test.ts
pnpm type-check
pnpm lint
```

Expected:

```text
PASS
```

- [ ] **Step 4: 做最终人工回归**

Manual checklist:

1. `/viewpoints` 只显示今日观点
2. `/viewpoints/archived` 显示历史观点并按日期分组
3. 新增观点后，今日页立即可见
4. AI rewrite 阶段只显示今日观点
5. 删除观点不影响历史页的日期分组渲染

- [ ] **Step 5: 提交文档与收尾**

```bash
git add docs/standards/ui-ux-system.md docs/architecture/frontend.md
git commit -m "docs: document viewpoint archive interaction pattern"
```

---

## Self-Review

### Spec coverage

- 缺表报错：Task 1
- `today/history` 查询契约：Task 2、Task 3
- 主页面仅展示今日观点：Task 4
- 历史归档页：Task 4
- 仿写只允许今日观点：Task 5
- 文档同步：Task 6

### Placeholder scan

- 无 `TODO` / `TBD`
- 所有任务都给出了明确文件路径
- 所有验证步骤都提供了具体命令

### Type consistency

- `FragmentScope` 在 `types`、route、service、repository 中统一使用
- 历史分组函数统一消费 `FragmentDTO`
- AI rewrite 阶段继续复用现有 `/viewpoints` 接口，只新增 `scope=today`

## Execution Handoff

Plan complete and saved to [`docs/superpowers/plans/2026-04-10-viewpoints-today-archive.md`](/D:/code/ai-newline-center/docs/superpowers/plans/2026-04-10-viewpoints-today-archive.md). Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
