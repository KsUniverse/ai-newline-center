# Brand Editorial Hardening Design

**Date:** 2026-04-20  
**Scope:** Global frontend visual redesign toward a flatter, sharper, editorial control-surface style

## Goal

Rework the entire frontend visual system from a soft, rounded, lightly floating SaaS surface language into a flatter and more hard-edged brand editorial workspace while preserving the current information architecture, interaction model, business logic, and brand recognizability.

## User Direction

The approved direction is:

- keep a branded editorial feel rather than a cold generic admin theme
- aggressively reduce heavy rounding and visible shadow weight
- keep some rounding so the interface does not become harsh or brutalist
- replace floating/glassy softness with clearer panel boundaries, cleaner blocks, and firmer layout structure

## In Scope

- `src/app/globals.css`
- `src/components/ui/*`
- `src/components/shared/layout/*`
- `src/components/shared/common/*`
- shared visual constants in `src/components/shared/common/brand.ts`
- high-traffic dashboard pages and page shells that inherit the global style system
- documentation updates in `docs/standards/ui-ux-system.md` and `docs/architecture/frontend.md`

## Out of Scope

- route changes
- feature flow changes
- API or backend changes
- form field semantics
- data model changes
- new product features

## Design Summary

The redesign will shift the product from a soft card-and-glass workspace into a branded editorial control surface. The new system will rely on border definition, disciplined spacing, and stronger panel composition rather than blur, oversized radii, and stacked shadows. The result should feel more professional, more intentional, and more tool-like, while still retaining the product's branded identity and light visual atmosphere.

## Visual Direction

### 1. Core Aesthetic

The target look is "brand editorial hardening":

- flatter overall presentation
- sharper geometry with moderated rounding
- restrained but still recognizable brand color accents
- cleaner separation between background, panels, tools, and overlays
- stronger sense of page composition over floating card decoration

This is intentionally not a generic enterprise gray theme and not a brutalist redesign. It should still feel designed, but with the softness removed.

### 2. Rounding Strategy

Rounding will be tightened across the system:

- global radius token reduced from the current baseline
- buttons and inputs default to `rounded-md`
- small icon shells and compact pills move toward `rounded-md` or restrained `rounded-lg`
- core panels, cards, and field groups move from `rounded-2xl` / `rounded-3xl` toward `rounded-lg` or `rounded-xl`
- only a few special shells may retain larger radii where needed for hierarchy or ergonomics

This creates a firmer silhouette across the UI without making controls feel sharp or uncomfortable.

### 3. Shadow Strategy

Shadows will stop acting as the primary layer signal.

- standard panels use either no shadow or an almost imperceptible shallow shadow
- hover states avoid vertical "lift" styling
- overlays use lighter, tighter shadows than today
- layering is communicated through border contrast, background solidity, and interior sectioning instead of soft floating depth

The intended feeling is "assembled panels on a board," not "cards hovering in air."

### 4. Transparency and Blur

Glass effects will be strongly reduced.

- headers, menus, dialogs, and sheets become more opaque
- `backdrop-blur` becomes minimal or is removed in most shared primitives
- atmospheric gradients remain possible in page backgrounds, but no longer define component surfaces
- overlays should read as solid tools, not translucent floating glass

### 5. Brand Color Use

Brand identity remains present but more disciplined.

- primary color stays as the key accent and focus signal
- active, selected, and focused states use brand color through edge treatment, fills, and small emphasis zones
- large soft glows, hazy color fields, and diffuse tinting are reduced
- supporting color remains semantic rather than decorative

The product should still feel like the same brand, just more edited and more mature.

## Component Language

### Buttons

Buttons will move from rounded floating controls to compact editorial tools.

- primary buttons become denser, flatter, and more solid
- outline and ghost buttons rely on border clarity and surface change rather than soft hover fills
- button hover states emphasize contrast and intent, not lift
- pressed/active states should feel grounded and tactile

### Inputs, Selects, and Textareas

Field controls will become structured slots rather than soft capsules.

- more solid background surfaces
- clearer border definition
- smaller radius
- focus states centered on ring or border precision instead of glow softness
- icon-bearing field shells inherit the same firmer geometry

### Dropdowns, Dialogs, Sheets, Alert Dialogs

Shared overlays will shift to hard-edged panels.

- background opacity increases toward near-solid surfaces
- blur decreases sharply
- header, body, and footer separation becomes more legible
- close buttons and secondary tool affordances become smaller and more technical
- modal layering is communicated through structure and contrast, not heavy shadow mass

### Status Pills, Badges, and Icon Shells

Small surface elements will be tightened so they no longer read as decorative candy pieces.

- pills become more compact and slightly firmer
- icon shells use smaller radii and clearer edge treatment
- semantic badges remain readable but less plush

### Tables and Toolbars

List-heavy views should feel closer to editorial tooling.

- table wrappers become clearer panel containers
- row hover states are more restrained
- table headers and filter bars adopt toolbar-like structure
- pagination and list controls align with the harder shared button language

## Layout and Surface System

### Sidebar

The sidebar becomes a brand tool rail instead of a soft card stack.

- reduce oversized rounding on brand card, nav items, and user card
- reduce decorative glow and gradient weight
- active nav states rely more on border, inset fill, and directional emphasis
- collapsed and expanded states share the same harder shape logic

### Header

The top bar becomes a clean editorial toolbar.

- less blur
- less visible translucency
- more compact visual chrome
- strong alignment with the new button, filter, and compact action patterns

### Dashboard Page Shell

The page shell remains structurally the same but visually harder.

- keep eyebrow, title, description, and action placement
- restyle back navigation chip and page actions into tighter tool-like controls
- depend more on typography and spacing than on soft wrappers

### Primary Panels and Inset Surfaces

All shared surface constants in `brand.ts` will be rewritten around the new geometry.

- primary surfaces become firmer editorial panels
- inset surfaces become flatter sub-panels
- management sections, notes, metric cards, and table wrappers all inherit one consistent panel language
- the system should eliminate the current mix of large radii plus repeated `shadow-sm`

### Empty, Note, and Warning States

Informational surfaces become structured annotations instead of soft helper cards.

- semantic accents remain
- edge treatment and panel composition do more of the work
- warning and destructive states remain clear without becoming visually inflated

## Motion Direction

Motion should reinforce structure rather than softness.

- reduce scale-heavy entrance styling
- prefer short translation and opacity transitions
- remove any sense that panels "float in"
- preserve reduced-motion support

## Implementation Strategy

The redesign should be executed from shared sources outward, not page-by-page first.

### Phase 1: Global Tokens

- update radius, border, background, overlay, and atmospheric token usage in `globals.css`
- reduce visual reliance on blur and gradient haze
- preserve typography scale and existing semantic color tokens unless a specific adjustment is required for contrast

### Phase 2: Shared Primitives

- restyle `button.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`
- restyle `dropdown-menu.tsx`, `dialog.tsx`, `sheet.tsx`, `alert-dialog.tsx`, `tooltip.tsx`, `badge.tsx`, `table.tsx`
- keep primitive APIs stable

### Phase 3: Shared Brand and Layout Shells

- rewrite the stable class contracts in `src/components/shared/common/brand.ts`
- align `management-primitives.tsx`, `surface-section.tsx`, `confirm-dialog.tsx`, and layout shells with the new panel system
- restyle `app-sidebar.tsx`, `app-header.tsx`, and `dashboard-page-shell.tsx`

### Phase 4: Page-Level Regression Pass

- validate representative surfaces such as login, dashboard, list pages, detail pages, and management overlays
- remove page-level class combinations that reintroduce the old soft language

### Phase 5: Documentation Sync

- update `docs/standards/ui-ux-system.md` to reflect the new baseline
- update `docs/architecture/frontend.md` where it describes the shared frontend visual system

## Constraints

- maintain the current route map and information architecture
- do not change API contracts or backend behavior
- keep existing feature workflows intact
- prefer shared primitive changes over page-local overrides
- avoid introducing a second competing visual system

## Risks

- a token-only pass could leave page-level leftovers that still feel soft
- an overly aggressive flattening pass could lose brand recognition or make the UI feel sterile
- page-level one-off overrides may fight the new shared baseline if not cleaned up

## Success Criteria

The redesign is successful when:

- the product no longer reads as rounded floating glass cards
- most UI surfaces inherit the new harder look without page-specific hacks
- button, field, overlay, navigation, and panel geometry feel consistent
- the interface keeps its brand identity while feeling more mature and tool-like
- docs match the shipped implementation

## Verification

- run lint and type-check after shared style updates
- review representative pages across auth, dashboard, list, detail, and modal-heavy surfaces
- confirm dark mode remains visually coherent after the hardening pass
- confirm reduced-motion behavior still works as expected
- verify no behavioral regressions were introduced while restyling shared primitives
