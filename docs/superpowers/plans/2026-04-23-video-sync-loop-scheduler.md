# Video Sync Loop Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace only the video sync cron trigger with a database-driven long-running scheduler loop that waits for the nearest `nextSyncAt`, enqueues due video sync jobs, and writes production-only randomized next execution times.

**Architecture:** Keep cadence decisions in `account-video-sync-profile.service.ts`, keep execution in the existing crawler video sync worker, and introduce one dedicated loop service that wakes according to database state instead of a fixed cron. Remove only the `Video sync` cron registration from `scheduler.ts` and start the new loop from server bootstrap.

**Tech Stack:** TypeScript, Vitest, BullMQ, Prisma

---

### Task 1: Add Test Coverage For Loop Scheduling

**Files:**
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/scheduler.test.ts`
- Create: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/video-sync-scheduler.test.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/video-sync-scheduler.test.ts`

- [ ] **Step 1: Add failing tests showing video sync is no longer cron-registered**
- [ ] **Step 2: Add failing tests for nearest-nextSyncAt sleep / due-batch enqueue behavior**
- [ ] **Step 3: Run focused tests and verify they fail for the missing loop implementation**

### Task 2: Implement The Video Sync Loop Service

**Files:**
- Create: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/video-sync-scheduler.ts`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/repositories/account-video-sync-profile.repository.ts`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/sync.service.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/video-sync-scheduler.test.ts`

- [ ] **Step 1: Add repository helpers for nearest due-time lookup and bounded due-profile fetch**
- [ ] **Step 2: Implement a long-running loop that waits for nearest `nextSyncAt` and enqueues due profiles**
- [ ] **Step 3: Keep planner-compatible enqueue behavior but expose it for loop consumption**
- [ ] **Step 4: Run focused loop tests and verify they pass**

### Task 3: Wire Bootstrap And Remove Video Cron

**Files:**
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/scheduler.ts`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/server-bootstrap.ts`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/server-bootstrap.test.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/scheduler.test.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/server-bootstrap.test.ts`

- [ ] **Step 1: Remove only the video sync cron registration**
- [ ] **Step 2: Start the new video sync loop from server bootstrap**
- [ ] **Step 3: Run scheduler/bootstrap tests and verify they pass**

### Task 4: Add Production-Only Jitter To Next Sync Times

**Files:**
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/account-video-sync-profile.service.ts`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/account-video-sync-profile.service.test.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/account-video-sync-profile.service.test.ts`

- [ ] **Step 1: Add failing tests for deterministic non-production cadence and bounded production jitter**
- [ ] **Step 2: Implement production-only randomized nextSyncAt generation around the target interval**
- [ ] **Step 3: Run cadence tests and verify they pass**

### Task 5: Verify End-To-End Stability

**Files:**
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/video-sync-scheduler.test.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/scheduler.test.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/server-bootstrap.test.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/account-video-sync-profile.service.test.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/sync.service.test.ts`

- [ ] **Step 1: Run the related sync scheduler/profile test suite**
- [ ] **Step 2: Run type-check**
