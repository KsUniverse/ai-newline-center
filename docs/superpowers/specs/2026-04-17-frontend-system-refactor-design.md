# Frontend System Refactor Design

**Date:** 2026-04-17  
**Scope:** Global frontend refactor for shared brand language, primitive convergence, and non-behavioral performance cleanup

## Goal

Refactor the frontend so shared primitives, layout shells, and high-frequency management pages follow one consistent brand language and a cleaner layering model without changing user flows, business logic, or API contracts.

## In Scope

- `src/app/globals.css`
- `src/components/ui/*`
- `src/components/shared/*`
- high-frequency management pages in `src/components/features/users/*`, `organizations/*`, `settings/*`
- small cross-cutting cleanup in other feature pages when they benefit from the new shared primitives

## Design Summary

- converge repeated visual language into shared brand constants and management primitives
- keep layout and interaction structure stable while removing repeated class clusters
- tighten button, input, select, and section defaults so more pages inherit the same visual baseline
- add low-risk performance and responsiveness improvements through lighter state churn, fewer duplicated wrappers, and reduced-motion fallbacks

## Constraints

- no backend contract changes
- no route changes
- no interaction model changes
- no new business features

## Verification

- targeted tests for new shared brand helpers
- `pnpm`-equivalent test, lint, and type-check validation via available local Node tooling
- manual regression focus on users, organizations, accounts, and crawler-cookie management surfaces
