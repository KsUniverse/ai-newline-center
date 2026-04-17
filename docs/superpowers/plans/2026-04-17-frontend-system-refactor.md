# Frontend System Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify frontend brand presentation and shared component structure without changing business behavior.

**Architecture:** Centralize repeated presentation rules into shared brand constants and management primitives, then reconnect high-frequency pages to those shared units. Keep business state and data flow in existing feature modules while making shared UI layers carry the visual and structural burden.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Vitest

---

### Task 1: Lock shared presentation targets

**Files:**
- Create: `src/components/shared/common/brand.test.ts`
- Create: `src/components/shared/common/brand.ts`

- [ ] **Step 1: Write the failing test**

```ts
expect(getBrandNavItemClassName(true)).toContain("bg-primary/10");
expect(BRAND_SURFACE_CLASS_NAME).toContain("rounded-3xl");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec vitest run src/components/shared/common/brand.test.ts`
Expected: FAIL because `brand.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export const BRAND_SURFACE_CLASS_NAME = "...";
export function getBrandNavItemClassName(active: boolean) {
  return active ? "..." : "...";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec vitest run src/components/shared/common/brand.test.ts`
Expected: PASS

### Task 2: Reconnect shared layout and UI primitives

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/select.tsx`
- Modify: `src/components/shared/common/surface-section.tsx`
- Modify: `src/components/shared/layout/app-header.tsx`
- Modify: `src/components/shared/layout/app-sidebar.tsx`

- [ ] **Step 1: Move repeated presentation classes into shared constants**
- [ ] **Step 2: Update shared layout to consume the new nav/state helpers**
- [ ] **Step 3: Tighten button/input/select defaults to the project brand baseline**
- [ ] **Step 4: Add reduced-motion fallback and base rendering cleanup in globals**

### Task 3: Reconnect management feature surfaces

**Files:**
- Create: `src/components/shared/common/management-primitives.tsx`
- Modify: `src/components/features/users/*`
- Modify: `src/components/features/organizations/*`
- Modify: `src/components/features/settings/crawler-cookie-page.tsx`
- Modify: `src/components/features/accounts/accounts-page.tsx`

- [ ] **Step 1: Extract shared management header, field shell, note, stat card, and status pill primitives**
- [ ] **Step 2: Update users and organizations dialog/drawer/list/page surfaces to use them**
- [ ] **Step 3: Wrap crawler cookie management into the same page-section language**
- [ ] **Step 4: Apply compact action button convergence to touched pages**

### Task 4: Sync docs and verify

**Files:**
- Modify: `docs/architecture/frontend.md`
- Modify: `docs/standards/ui-ux-system.md`

- [ ] **Step 1: Document the new stable management-surface pattern**
- [ ] **Step 2: Run targeted tests**
- [ ] **Step 3: Run type-check and lint**
- [ ] **Step 4: Report findings, risks, and remaining cleanup candidates**
