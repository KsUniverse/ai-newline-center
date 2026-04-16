# Production Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the cron scheduler starts only in production while keeping the transcription worker boot behavior unchanged outside test mode.

**Architecture:** Keep the environment gate in `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/server-bootstrap.ts`, which already decides which background services boot. Validate the behavior through the existing bootstrap Vitest suite instead of changing scheduler internals.

**Tech Stack:** Next.js 15, TypeScript, Vitest

---

### Task 1: Gate Scheduler Startup In Server Bootstrap

**Files:**
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/server-bootstrap.test.ts`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/server-bootstrap.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/server-bootstrap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("skips scheduler outside production but still starts the worker", async () => {
  const { ensureServerBootstrap } = await import("@/lib/server-bootstrap");

  await ensureServerBootstrap();

  expect(startSchedulerMock).not.toHaveBeenCalled();
  expect(startTranscriptionWorkerMock).toHaveBeenCalledTimes(1);
});

it("starts the scheduler in production", async () => {
  vi.stubEnv("NODE_ENV", "production");

  const { resetServerBootstrapForTests, ensureServerBootstrap } = await import(
    "@/lib/server-bootstrap"
  );
  resetServerBootstrapForTests();

  await ensureServerBootstrap();

  expect(startSchedulerMock).toHaveBeenCalledTimes(1);
  expect(startTranscriptionWorkerMock).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/server-bootstrap.test.ts`
Expected: FAIL because the current bootstrap path still starts the scheduler in development.

- [ ] **Step 3: Write minimal implementation**

```ts
const shouldStartScheduler = process.env.NODE_ENV === "production";

if (shouldStartScheduler) {
  startScheduler();
}

startTranscriptionWorker();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/server-bootstrap.test.ts`
Expected: PASS

- [ ] **Step 5: Run a broader type-safe verification**

Run: `pnpm type-check`
Expected: PASS
