# Sidebar Navigation Design

**Date:** 2026-04-17  
**Scope:** Refine sidebar and mobile navigation hierarchy to remove awkward second-level menu styling

## Goal

Improve the left navigation visually so it better matches the project’s brand workspace language and removes the awkward second-level menu treatment.

## Direction

Use a section-title navigation model instead of the current collapsible tree.

- remove nested group expand/collapse behavior
- keep all clickable destinations as first-class navigation cards
- rename `系统设置` to `系统管理`
- move `组织管理` / `用户管理` / `AI 配置` / `爬虫 Cookie 管理` under the `系统管理` section title

## Visual Rules

- section titles are lightweight labels, not clickable cards
- nav items keep the current primary card language
- mobile navigation mirrors the same information architecture
- collapsed desktop sidebar keeps icon-only entries but preserves section break rhythm

## Files

- `src/components/shared/layout/app-navigation.ts`
- `src/components/shared/layout/app-sidebar.tsx`
- `src/components/shared/layout/app-header.tsx`
- navigation tests if needed

## Verification

- system-management items appear under one section title in expanded desktop sidebar
- no nested tree UI remains
- mobile sheet shows the same sections and item order
- type-check passes
