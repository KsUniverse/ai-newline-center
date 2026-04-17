# Sidebar Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sidebar’s awkward nested group styling with a cleaner section-title navigation model that matches the project’s brand navigation language.

**Architecture:** Move navigation data to explicit sections, keep destinations as flat clickable items, and update both desktop sidebar and mobile sheet to render the same structure. Add a small navigation test to lock the section composition before touching the visual components.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Vitest

---

### Task 1: Lock Navigation Sections With A Test

**Files:**
- Create: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/shared/layout/app-navigation.test.ts`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/shared/layout/app-navigation.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { getVisibleNavSections } from "@/components/shared/layout/app-navigation";

describe("app navigation", () => {
  it("groups admin-only management items under 系统管理", () => {
    const sections = getVisibleNavSections("SUPER_ADMIN");

    expect(sections.map((section) => section.title)).toEqual(["工作区", "系统管理"]);
    expect(sections[1]?.items.map((item) => item.label)).toEqual([
      "组织管理",
      "用户管理",
      "AI 配置",
      "爬虫 Cookie 管理",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH /opt/homebrew/bin/pnpm test src/components/shared/layout/app-navigation.test.ts`
Expected: FAIL because `getVisibleNavSections` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface AppNavSection {
  title: string;
  items: readonly AppNavItem[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH /opt/homebrew/bin/pnpm test src/components/shared/layout/app-navigation.test.ts`
Expected: PASS

### Task 2: Update Desktop Sidebar To Use Section Titles

**Files:**
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/shared/layout/app-sidebar.tsx`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/shared/layout/app-navigation.ts`

- [ ] **Step 1: Write minimal implementation**

```tsx
{visibleSections.map((section) => (
  <div key={section.title} className="space-y-2">
    <div className="px-2 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
      {section.title}
    </div>
    {section.items.map(...)}
  </div>
))}
```

- [ ] **Step 2: Run type-check**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH /opt/homebrew/bin/pnpm type-check`
Expected: PASS

### Task 3: Update Mobile Navigation To Match

**Files:**
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/shared/layout/app-header.tsx`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/components/shared/layout/app-navigation.ts`

- [ ] **Step 1: Write minimal implementation**

```tsx
{navSections.map((section) => (
  <div key={section.title} className="space-y-2">
    <div className="px-1 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
      {section.title}
    </div>
    {section.items.map(...)}
  </div>
))}
```

- [ ] **Step 2: Run verification**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH /opt/homebrew/bin/pnpm test src/components/shared/layout/app-navigation.test.ts`
Expected: PASS

- [ ] **Step 3: Run final type-check**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH /opt/homebrew/bin/pnpm type-check`
Expected: PASS
