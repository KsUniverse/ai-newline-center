# Video Sync Cadence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change active-account video sync cadence so newly published videos lower short-term polling, then ramp frequency back up as the next learned publish window approaches.

**Architecture:** Keep the existing planner/queue/worker pipeline unchanged and update only the profile cadence logic in `account-video-sync-profile.service.ts`. Use tests in `account-video-sync-profile.service.test.ts` to define the new timing behavior before implementation, preserving low-activity and failure backoff rules.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Define The New Cadence In Tests

**Files:**
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/account-video-sync-profile.service.test.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/account-video-sync-profile.service.test.ts`

- [ ] **Step 1: Add failing tests for post-publish cooldown and staged ramp-up**
- [ ] **Step 2: Run the focused test file and verify the new expectations fail**

### Task 2: Implement The Cadence Update

**Files:**
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/account-video-sync-profile.service.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/account-video-sync-profile.service.test.ts`

- [ ] **Step 1: Update next-sync calculation to lower cadence after success and ramp up near the next window**
- [ ] **Step 2: Keep low-activity, cooldown, and failure behavior unchanged**
- [ ] **Step 3: Run the focused cadence test file and verify it passes**

### Task 3: Verify Broader Stability

**Files:**
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/account-video-sync-profile.service.test.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/sync.service.test.ts`

- [ ] **Step 1: Run related sync/profile tests**
- [ ] **Step 2: Run type-check**
