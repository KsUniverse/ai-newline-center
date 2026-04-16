# Dashboard Frontend Refinement Design

**Date:** 2026-04-16  
**Scope:** Refine the `v0.3.2.1` dashboard frontend to align with the existing benchmark library and benchmark video visual language

## Goal

Refine the dashboard frontend so the two new sections feel like first-class parts of the existing product instead of isolated feature blocks.

This refinement has three explicit goals:

- improve visual consistency with the established dashboard, benchmark library, and benchmark video card language
- improve component structure and local maintainability
- improve interaction quality with clearer loading, empty, error, and optimistic-update feedback

## In Scope

This spec covers the dashboard frontend only:

- `/dashboard` page composition
- dashboard short-video section
- dashboard banned-account section
- local component structure inside `src/components/features/dashboard/*`
- small supporting type or client updates only if required by the UI refactor

Out of scope:

- backend API contract changes
- global layout or sidebar redesign
- benchmark library page redesign
- shared primitive redesign in `src/components/ui/*` unless the work reveals a clear reusable bug

## Existing Context

The current dashboard already uses the correct high-level page shell:

- `DashboardPageShell`
- `SurfaceSection`
- compact page-level pills

The main gap is inside the section bodies:

- `DashboardVideoSection` uses a vertical row list instead of the project’s stronger video-card pattern
- `DashboardBannedSection` uses a lightweight row list that does not match the benchmark dossier card language
- several failure states are silent, which weakens UX and makes optimistic updates feel brittle
- both sections currently keep layout, fetch orchestration, and row/card rendering too tightly coupled

## Design Summary

Keep the dashboard page structure intact, but redesign the two section bodies using the project’s existing visual references:

- `短视频列表` follows the existing benchmark video card direction
- `封禁账号` follows a compact version of the benchmark account dossier card direction

This is intentionally a refinement, not a redesign.

## Page-Level Layout

`DashboardHome` remains a lightweight dashboard page:

- keep the current `DashboardPageShell`
- keep the current section order
- keep the existing “task-first” page tone
- do not add a new overview hero

The main page change is to make both sections feel visually related:

- consistent top spacing and motion cadence
- section actions remain compact and utility-driven
- section bodies shift from rows to card grids

## Short Video Section

### Visual Direction

The short-video section should visually inherit from `benchmark-video-grid-card.tsx`.

Core decisions:

- switch from vertical rows to a card grid
- desktop target is five cards per row
- preserve cover-first browsing
- preserve lightweight management actions for tag and bring-order state

The card should feel close to the benchmark video card, but slightly simplified for dashboard usage:

- large cover area remains the primary anchor
- title, account nickname, and metrics remain easy to scan
- tag and bring-order state should appear as light overlays or compact status chips, not as a separate right-side action column
- the section still behaves like an operations view, so inline updates remain available

### Information Hierarchy

Each video card should prioritize:

1. cover
2. title
3. account nickname
4. like count and publish time
5. custom tag state
6. bring-order state

This keeps the visual rhythm aligned with the benchmark video grid while still supporting dashboard operations.

### Section Controls

The top action bar keeps the current filters:

- date range
- custom tag
- bring-order state

But the controls should be visually tightened so they read as compact dashboard controls rather than isolated custom widgets.

### Interaction Rules

Keep optimistic updates for:

- tag change
- bring-order toggle

But refine the behavior:

- update the card immediately
- on request failure, roll back the local state
- show explicit toast feedback on failure

Loading, empty, and pagination behavior:

- replace plain loading text with card-grid skeletons
- keep the empty state task-oriented and lightweight
- keep “load more” when `nextCursor` exists

## Banned Account Section

### Visual Direction

The banned-account section should follow a compact version of `benchmark-card.tsx`.

This means:

- move from a vertical row list to a card grid
- preserve the dossier-card surface language
- keep the information intentionally lighter than the full benchmark library card

The dashboard version should not become a second benchmark library.

### Information Hierarchy

Each banned-account card should contain only the information needed for quick review:

- avatar
- nickname
- douyin number
- banned time
- banned status

Optional supporting copy can be used if needed, but follower metrics and broader dossier metadata should stay out of this dashboard card.

### Interaction Rules

The section keeps:

- date-range filter only
- no manual mark-ban or unban actions
- dashboard acts as a read-only view over scheduler-produced `bannedAt` data

## Component Structure

The current single-file sections should be decomposed into smaller dashboard-local units.

Target structure:

- `dashboard-video-section.tsx`
  - section state + data orchestration
- `dashboard-video-filter-bar.tsx`
  - date/tag/bring-order controls
- `dashboard-video-grid.tsx`
  - grid layout + skeleton/empty/list branching
- `dashboard-video-card.tsx`
  - cover-first dashboard video card

- `dashboard-banned-section.tsx`
  - section state + data orchestration
- `dashboard-banned-grid.tsx`
  - grid layout + skeleton/empty/list branching
- `dashboard-banned-card.tsx`
  - compact dossier-style banned account card

The goal is to separate:

- data loading
- filter state
- presentation layout
- card-level interaction

This should make future dashboard-specific UI changes easier without pushing unrelated logic into one large component file.

## Error And State Feedback

Current silent failures should be replaced with explicit but lightweight feedback.

Required refinements:

- fetch failures should show toast feedback
- optimistic-update failures should roll back and show toast feedback
- loading should use visual skeletons matching the final layout
- empty states should remain concise and task-oriented

The page should never fail silently for a visible user action.

## Styling Constraints

This refinement must preserve the project’s current frontend standards:

- continue using `DashboardPageShell` and `SurfaceSection`
- continue using shared primitives from `src/components/ui/*`
- continue using CSS-variable-driven Tailwind classes
- prefer the established benchmark card and benchmark video card language over inventing a new dashboard-specific skin

No new visual system should be introduced here.

## Testing And Verification

Implementation should be verified with:

- targeted frontend tests if existing local coverage patterns support them
- at minimum, type-check validation after refactor
- manual verification that both sections render correctly in loading, empty, populated, and optimistic-update flows

Regression focus:

- existing dashboard shell remains unchanged
- video filters still trigger correct reloads
- load-more still appends correctly
- tag and bring-order optimistic updates still behave correctly
- banned-account section still filters correctly by `bannedAt`

## Risks

### Risk 1: Over-copying benchmark components

If the implementation copies full benchmark library cards too literally, the dashboard may become visually heavy.

Decision:

- inherit the visual language, but keep dashboard cards lighter and more task-focused

### Risk 2: Refactor expands too far

If reuse becomes the main goal, the change may spill into stable benchmark pages.

Decision:

- keep this refactor dashboard-local unless a tiny extraction clearly reduces duplication with low risk

### Risk 3: Interaction polish regresses behavior

Changing layout and decomposition at the same time can accidentally break existing fetch or optimistic-update behavior.

Decision:

- preserve API contracts and state flows
- verify filters, load more, and mutation rollback explicitly
