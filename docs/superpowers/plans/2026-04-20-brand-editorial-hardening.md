# Brand Editorial Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the shared frontend visual system so the product adopts a flatter, sharper brand editorial style without changing routes, features, or business behavior.

**Architecture:** Execute the redesign from shared style sources outward. First lock the new visual contract with focused tests, then update global tokens and shared primitives, then rewrite the shared brand/layout shells so most pages inherit the harder look automatically, and finally sync the docs plus run full verification.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS 4, shadcn/ui, Vitest, ESLint

---

### Task 1: Lock The New Shared Visual Contract

**Files:**
- Modify: `src/components/shared/common/brand.test.ts`
- Create: `src/components/ui/button.test.ts`

- [ ] **Step 1: Write the failing shared-surface test updates**

```ts
it("keeps primary surfaces aligned with the harder editorial panel language", () => {
  expect(BRAND_SURFACE_CLASS_NAME).toContain("rounded-xl");
  expect(BRAND_SURFACE_CLASS_NAME).toContain("bg-card");
  expect(BRAND_SURFACE_CLASS_NAME).not.toContain("rounded-3xl");
  expect(BRAND_SURFACE_CLASS_NAME).not.toContain("shadow-sm");
});

it("uses tighter, flatter active affordances for nav items", () => {
  expect(getBrandNavItemClassName(true)).toContain("rounded-xl");
  expect(getBrandNavItemClassName(true)).toContain("border-l-2");
  expect(getBrandNavItemClassName(false)).toContain("hover:bg-accent/65");
});
```

- [ ] **Step 2: Add a failing button variant test**

```ts
it("keeps default buttons flat and compact", () => {
  expect(buttonVariants({ variant: "default" })).toContain("rounded-md");
  expect(buttonVariants({ variant: "default" })).not.toContain("shadow-sm");
  expect(buttonVariants({ variant: "outline" })).toContain("border-border/80");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `PATH=/opt/homebrew/bin:$PATH ./node_modules/.bin/vitest run src/components/shared/common/brand.test.ts src/components/ui/button.test.ts`
Expected: FAIL because the current style classes still reflect the older rounded and shadowed language.

### Task 2: Harden Global Tokens And Core Primitives

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/textarea.tsx`
- Modify: `src/components/ui/select.tsx`
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/table.tsx`
- Modify: `src/components/ui/tooltip.tsx`
- Modify: `src/components/ui/dropdown-menu.tsx`
- Modify: `src/components/ui/dialog.tsx`
- Modify: `src/components/ui/sheet.tsx`
- Modify: `src/components/ui/alert-dialog.tsx`
- Modify: `src/components/ui/sonner.tsx`

- [ ] **Step 1: Tighten the global visual tokens**

```css
:root {
  --card: 0 0% 100%;
  --popover: 0 0% 100%;
  --border: 240 7% 86%;
  --input: 240 7% 84%;
  --radius: 0.2rem;
}

body {
  background-image:
    linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--muted) / 0.24) 100%);
}
```

- [ ] **Step 2: Flatten the button and field primitives**

```ts
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors ...",
  {
    variants: {
      variant: {
        default: "border border-primary bg-primary text-primary-foreground hover:bg-primary/92",
        outline: "border border-border/80 bg-background text-foreground hover:bg-accent/65",
      },
    },
  },
);
```

- [ ] **Step 3: Restyle menus and overlays into solid editorial panels**

```ts
className="rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-[0_12px_30px_-24px_rgba(15,23,42,0.45)]"
className="fixed ... rounded-xl border border-border/80 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.5)]"
```

- [ ] **Step 4: Run the focused tests to verify the new contract passes**

Run: `PATH=/opt/homebrew/bin:$PATH ./node_modules/.bin/vitest run src/components/shared/common/brand.test.ts src/components/ui/button.test.ts`
Expected: PASS

### Task 3: Rewrite Shared Brand Surfaces And Layout Shells

**Files:**
- Modify: `src/components/shared/common/brand.ts`
- Modify: `src/components/shared/common/management-primitives.tsx`
- Modify: `src/components/shared/common/surface-section.tsx`
- Modify: `src/components/shared/common/confirm-dialog.tsx`
- Modify: `src/components/shared/layout/app-sidebar.tsx`
- Modify: `src/components/shared/layout/app-header.tsx`
- Modify: `src/components/shared/layout/dashboard-page-shell.tsx`

- [ ] **Step 1: Rewrite the shared brand class contracts**

```ts
export const BRAND_SURFACE_CLASS_NAME =
  "relative overflow-hidden rounded-xl border border-border/80 bg-card";

export const BRAND_INSET_SURFACE_CLASS_NAME =
  "rounded-lg border border-border/75 bg-background";

export function getBrandNavItemClassName(active: boolean) {
  return active
    ? "group flex items-center gap-3 rounded-xl border border-border/90 border-l-2 border-l-primary bg-accent/55 ..."
    : "group flex items-center gap-3 rounded-xl border border-transparent bg-transparent hover:border-border/70 hover:bg-accent/65 ...";
}
```

- [ ] **Step 2: Remove leftover soft-glass panel treatments from shared shells**

```tsx
<header className="flex h-14 shrink-0 items-center justify-between border-b border-border/70 bg-background px-6">
...
<div className="overflow-hidden rounded-xl border border-border/80 bg-card">
```

- [ ] **Step 3: Run focused tests plus type-check on the shared layer**

Run: `PATH=/opt/homebrew/bin:$PATH ./node_modules/.bin/tsc --noEmit -p tsconfig.typecheck.json`
Expected: PASS

### Task 4: Sync Docs And Run Full Verification

**Files:**
- Modify: `docs/standards/ui-ux-system.md`
- Modify: `docs/architecture/frontend.md`

- [ ] **Step 1: Update the docs to describe the new harder visual baseline**

```md
- 基准圆角收紧到 `rounded-md` / `rounded-lg`
- 阴影仅作为浮层提示，不再承担主要层级表达
- 页面和浮层以实底面板 + 清晰描边为主，显著弱化玻璃感
```

- [ ] **Step 2: Run lint**

Run: `PATH=/opt/homebrew/bin:$PATH ./node_modules/.bin/eslint src/app/globals.css src/components/ui src/components/shared docs/standards/ui-ux-system.md docs/architecture/frontend.md`
Expected: PASS

- [ ] **Step 3: Run final test and type-check verification**

Run: `PATH=/opt/homebrew/bin:$PATH ./node_modules/.bin/vitest run src/components/shared/common/brand.test.ts src/components/ui/button.test.ts`
Expected: PASS

Run: `PATH=/opt/homebrew/bin:$PATH ./node_modules/.bin/tsc --noEmit -p tsconfig.typecheck.json`
Expected: PASS
