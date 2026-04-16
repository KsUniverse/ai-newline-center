# Dashboard Frontend Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the dashboard video and banned-account sections so they match the benchmark library and benchmark video design language while improving state handling and maintainability.

**Architecture:** Keep `/dashboard` page composition intact and refactor only the section bodies. Split each section into dashboard-local subcomponents so fetch orchestration, filter controls, layout branching, card rendering, and dialog behavior live in focused files, then preserve existing API contracts and optimistic flows with explicit toast-based feedback.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Vitest

---

### Task 1: Add Test Coverage For Dashboard Copy And State Helpers

**Files:**
- Create: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/features/dashboard/dashboard-copy.ts`
- Create: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/features/dashboard/dashboard-copy.test.ts`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/types/benchmark-video.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import {
  getDashboardVideoSectionDescription,
  getVideoTagTone,
  getBringOrderTone,
  getBannedSectionDescription,
} from "@/components/features/dashboard/dashboard-copy";

describe("dashboard copy helpers", () => {
  it("builds the video section description from total count", () => {
    expect(getDashboardVideoSectionDescription(true, 0)).toBe("加载中…");
    expect(getDashboardVideoSectionDescription(false, 12)).toBe("共 12 条，按点赞倒序");
  });

  it("returns semantic tones for tag and bring-order state", () => {
    expect(getVideoTagTone(null)).toBe("muted");
    expect(getVideoTagTone("RECAP")).toBe("primary");
    expect(getBringOrderTone(true)).toBe("success");
    expect(getBringOrderTone(false)).toBe("muted");
  });

  it("builds the banned section description from range and count", () => {
    expect(getBannedSectionDescription("this_week", 0)).toContain("本周");
    expect(getBannedSectionDescription("this_month", 8)).toContain("8");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH /opt/homebrew/bin/pnpm test src/components/features/dashboard/dashboard-copy.test.ts`
Expected: FAIL because `dashboard-copy.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function getDashboardVideoSectionDescription(loading: boolean, total: number): string {
  if (loading) return "加载中…";
  return `共 ${total} 条，按点赞倒序`;
}

export function getVideoTagTone(tag: BenchmarkVideoTag | null): "primary" | "muted" {
  return tag ? "primary" : "muted";
}

export function getBringOrderTone(isBringOrder: boolean): "success" | "muted" {
  return isBringOrder ? "success" : "muted";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH /opt/homebrew/bin/pnpm test src/components/features/dashboard/dashboard-copy.test.ts`
Expected: PASS

### Task 2: Refactor Dashboard Video Section Into Card Grid

**Files:**
- Create: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/features/dashboard/dashboard-video-filter-bar.tsx`
- Create: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/features/dashboard/dashboard-video-grid.tsx`
- Create: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/features/dashboard/dashboard-video-card.tsx`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/features/dashboard/dashboard-video-section.tsx`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/features/dashboard/index.ts`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/features/dashboard/dashboard-home.tsx`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/features/dashboard/dashboard-copy.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("formats large like counts with wan unit", () => {
  expect(formatLikeCount(12600)).toBe("1.3w");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH /opt/homebrew/bin/pnpm test src/components/features/dashboard/dashboard-copy.test.ts`
Expected: FAIL because the helper still returns the previous `1.3w` behavior only after the refactor adds the dashboard helper import path and updated assertions.

- [ ] **Step 3: Write minimal implementation**

```tsx
<div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
  {items.map((video) => (
    <DashboardVideoCard
      key={video.id}
      video={video}
      onTagChange={onTagChange}
      onBringOrderToggle={onBringOrderToggle}
    />
  ))}
</div>
```

```tsx
toast.error("标签更新失败，请稍后重试");
toast.error("带单状态更新失败，请稍后重试");
```

- [ ] **Step 4: Run focused verification**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH /opt/homebrew/bin/pnpm test src/components/features/dashboard/dashboard-copy.test.ts`
Expected: PASS

- [ ] **Step 5: Run type-check for the refactor**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH /opt/homebrew/bin/pnpm type-check`
Expected: PASS

### Task 3: Refactor Dashboard Banned Section Into Compact Dossier Cards

**Files:**
- Create: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/features/dashboard/dashboard-banned-grid.tsx`
- Create: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/features/dashboard/dashboard-banned-card.tsx`
- Create: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/features/dashboard/dashboard-mark-ban-dialog.tsx`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/features/dashboard/dashboard-banned-section.tsx`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/features/dashboard/index.ts`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/features/dashboard/dashboard-copy.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("formats banned time with zero-padded month and minute", () => {
  expect(formatBannedAt("2026-04-16T08:05:00.000Z")).toMatch(/04-16/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH /opt/homebrew/bin/pnpm test src/components/features/dashboard/dashboard-copy.test.ts`
Expected: FAIL until the dashboard helper test file imports the final helper set and the banned-card refactor is wired to the shared copy helpers.

- [ ] **Step 3: Write minimal implementation**

```tsx
<div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
  {items.map((account) => (
    <DashboardBannedCard key={account.id} account={account} onUnban={onUnban} />
  ))}
</div>
```

```tsx
toast.error("封禁列表加载失败，请稍后重试");
toast.error("取消封禁失败，请稍后重试");
toast.error("封禁账号失败，请稍后重试");
```

- [ ] **Step 4: Run focused verification**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH /opt/homebrew/bin/pnpm test src/components/features/dashboard/dashboard-copy.test.ts`
Expected: PASS

### Task 4: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run targeted API client tests**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH /opt/homebrew/bin/pnpm test src/lib/api-client.test.ts`
Expected: PASS

- [ ] **Step 2: Run dashboard helper tests**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH /opt/homebrew/bin/pnpm test src/components/features/dashboard/dashboard-copy.test.ts`
Expected: PASS

- [ ] **Step 3: Run full type-check**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH /opt/homebrew/bin/pnpm type-check`
Expected: PASS
