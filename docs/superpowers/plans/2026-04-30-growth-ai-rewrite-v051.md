# Growth AI Rewrite v0.5.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the lightweight `StyleExperience` loop with the new v0.5.1 publication-binding, learning-case, style-profile, and MySQL retrieval workflow for rewrite generation.

**Architecture:** Upgrade the data model first, then route all publication, learning, and retrieval behavior through dedicated services. Keep existing rewrite generation and video snapshot flows intact where possible, but replace the old learning model end-to-end so the system has a single source of truth.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/MySQL, Vitest, Tailwind, BullMQ, Vercel AI SDK

---

### Task 1: Isolate the feature branch

**Files:**
- Create: none
- Modify: none
- Test: none

- [ ] **Step 1: Create a feature branch**

Run:

```bash
git checkout -b codex/v0.5.1-growth-ai-rewrite
```

Expected: branch switches from `main` to `codex/v0.5.1-growth-ai-rewrite`

- [ ] **Step 2: Verify branch status**

Run:

```bash
git status --short --branch
```

Expected: current branch is `codex/v0.5.1-growth-ai-rewrite`

### Task 2: Lock the new backend bootstrap behavior

**Files:**
- Modify: `src/lib/server-bootstrap.test.ts`
- Modify: `src/lib/server-bootstrap.ts`
- Modify: `instrumentation.ts`
- Test: `src/lib/server-bootstrap.test.ts`

- [ ] **Step 1: Keep the development bootstrap regression test**

Test target:

```typescript
it("skips all background services outside production", async () => {
  const { ensureServerBootstrap } = await import("@/lib/server-bootstrap");

  await ensureServerBootstrap();
  await ensureServerBootstrap();

  expect(startSchedulerMock).not.toHaveBeenCalled();
  expect(startVideoSyncSchedulerMock).not.toHaveBeenCalled();
  expect(startTranscriptionWorkerMock).not.toHaveBeenCalled();
  expect(startRewriteWorkerMock).not.toHaveBeenCalled();
  expect(startCrawlerVideoSyncWorkerMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused bootstrap test**

Run:

```bash
pnpm test src/lib/server-bootstrap.test.ts
```

Expected: PASS

### Task 3: Replace the Prisma learning schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_rewrite_learning_v051/migration.sql`
- Test: `prisma/schema.prisma`

- [ ] **Step 1: Write schema expectations into tests or compile checks**

Check target fields and models:

```prisma
model RewritePublication { ... }
model RewriteLearningCase { ... }
model DouyinAccountStyleProfile { ... }
model RewriteVersion {
  usedLearningCaseIds     Json
  learningContextSnapshot Json?
  promptTemplateVersion   String?
}
```

- [ ] **Step 2: Run Prisma validation before implementation**

Run:

```bash
pnpm prisma validate
```

Expected: FAIL before new schema is added, or PASS only once the new schema is in place

- [ ] **Step 3: Replace `StyleExperience` with the new models**

Implementation goals:

```prisma
enum RewriteLearningCaseStatus {
  ACTIVE
  ARCHIVED
}

enum RewriteLearningEmbeddingStatus {
  PENDING
  COMPLETED
  FAILED
}

model RewritePublication {
  id               String      @id @default(cuid())
  rewriteVersionId String      @unique
  rewriteVersion   RewriteVersion @relation(fields: [rewriteVersionId], references: [id])
  rewriteId        String
  rewrite          Rewrite     @relation(fields: [rewriteId], references: [id])
  targetAccountId  String
  targetAccount    DouyinAccount @relation(fields: [targetAccountId], references: [id])
  publishedVideoId String      @unique
  publishedVideo   DouyinVideo @relation(fields: [publishedVideoId], references: [id])
  organizationId   String
  organization     Organization @relation(fields: [organizationId], references: [id])
  linkedAt         DateTime    @default(now())
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt
}
```

- [ ] **Step 4: Generate the migration**

Run:

```bash
pnpm db:migrate --name rewrite_learning_v051
```

Expected: new migration folder created with SQL for the new models and removed old `StyleExperience` table

- [ ] **Step 5: Regenerate Prisma client**

Run:

```bash
pnpm db:generate
```

Expected: PASS

### Task 4: Add publication repositories and service tests

**Files:**
- Create: `src/server/repositories/rewrite-publication.repository.ts`
- Create: `src/server/services/rewrite-publication.service.ts`
- Create: `src/server/services/rewrite-publication.service.test.ts`
- Modify: `src/server/repositories/video-rewrite-link.repository.ts`

- [ ] **Step 1: Write a failing publication service test**

Add a test for version binding validation:

```typescript
it("rejects binding when the final content is empty", async () => {
  await expect(
    rewritePublicationService.linkPublishedVideo(
      "version-1",
      { publishedVideoId: "video-1" },
      caller,
    ),
  ).rejects.toMatchObject({
    code: "REWRITE_VERSION_EMPTY_FINAL_CONTENT",
  });
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
pnpm test src/server/services/rewrite-publication.service.test.ts
```

Expected: FAIL because the service and validation do not exist yet

- [ ] **Step 3: Implement minimal repository and service behavior**

Implementation targets:

```typescript
async linkPublishedVideo(versionId: string, input: { publishedVideoId: string }, caller: SessionUser) {
  // load version + rewrite + targetAccountId
  // load target video under same targetAccountId
  // validate final content
  // create publication
  // trigger learning-case + style-profile refresh
}
```

- [ ] **Step 4: Re-run the focused test**

Run:

```bash
pnpm test src/server/services/rewrite-publication.service.test.ts
```

Expected: PASS

### Task 5: Add learning-case repositories, scoring, and refresh workflow

**Files:**
- Create: `src/server/repositories/rewrite-learning-case.repository.ts`
- Create: `src/server/services/rewrite-learning-case.service.ts`
- Create: `src/server/services/rewrite-learning-case.service.test.ts`
- Modify: `src/server/services/sync.service.ts`
- Modify: `src/server/services/rewrite-publication.service.ts`

- [ ] **Step 1: Write a failing learning-case refresh test**

Add a test that requires snapshot-derived metrics:

```typescript
it("creates an active learning case with final content and metrics snapshot", async () => {
  const result = await rewriteLearningCaseService.refreshFromPublication("publication-1");

  expect(result?.status).toBe("ACTIVE");
  expect(result?.finalContentSnapshot).toBe("final copy");
  expect(result?.metricsSnapshot).toMatchObject({
    playCount: 1000,
    likeCount: 120,
  });
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
pnpm test src/server/services/rewrite-learning-case.service.test.ts
```

Expected: FAIL because the service does not exist yet

- [ ] **Step 3: Implement minimal refresh and scoring logic**

Implementation targets:

```typescript
function computePerformanceScore(input: LearningMetricsScoreInput): number {
  // first version: smooth absolute score for < 5 cases, percentile path for >= 5 cases
}

async refreshFromPublication(publicationId: string) {
  // load publication + rewriteVersion + workspace/rewrite context
  // load video + snapshots
  // build metrics snapshot
  // build embeddingText
  // upsert learning case
}
```

- [ ] **Step 4: Integrate refresh into snapshot collection**

Integration target:

```typescript
await rewriteLearningCaseService.refreshForPublishedVideo(video.id);
await douyinAccountStyleProfileService.rebuildForAccount(accountId, organizationId);
```

- [ ] **Step 5: Re-run the focused test**

Run:

```bash
pnpm test src/server/services/rewrite-learning-case.service.test.ts
```

Expected: PASS

### Task 6: Add style-profile rebuild service

**Files:**
- Create: `src/server/repositories/douyin-account-style-profile.repository.ts`
- Create: `src/server/services/douyin-account-style-profile.service.ts`
- Create: `src/server/services/douyin-account-style-profile.service.test.ts`

- [ ] **Step 1: Write a failing style-profile test**

Add a test for sample threshold:

```typescript
it("keeps an empty profile when fewer than two active learning cases exist", async () => {
  const profile = await douyinAccountStyleProfileService.rebuildForAccount("account-1", "org-1");

  expect(profile.sampleCount).toBe(1);
  expect(profile.summary).toBeNull();
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
pnpm test src/server/services/douyin-account-style-profile.service.test.ts
```

Expected: FAIL because the service does not exist yet

- [ ] **Step 3: Implement minimal rebuild behavior**

Implementation target:

```typescript
async rebuildForAccount(accountId: string, organizationId: string) {
  // load active cases
  // if < 2: upsert empty profile
  // else: summarize top cases into profile fields
}
```

- [ ] **Step 4: Re-run the focused test**

Run:

```bash
pnpm test src/server/services/douyin-account-style-profile.service.test.ts
```

Expected: PASS

### Task 7: Replace prompt injection with MySQL retrieval

**Files:**
- Create: `src/server/services/rewrite-learning-retrieval.service.ts`
- Create: `src/server/services/rewrite-learning-retrieval.service.test.ts`
- Modify: `src/lib/rewrite-worker.ts`
- Delete: `src/server/services/style-experience.service.ts`
- Delete: `src/server/repositories/style-experience.repository.ts`

- [ ] **Step 1: Write a failing retrieval ranking test**

Add a test for account-scoped MySQL ranking:

```typescript
it("returns top six active learning cases for the target account ranked by similarity and score", async () => {
  const result = await rewriteLearningRetrievalService.retrieveForRewrite({
    organizationId: "org-1",
    targetAccountId: "account-1",
    transcriptText: "benchmark copy",
    annotations: [{ quotedText: "hook", note: "strong opening" }],
    viewpoints: ["opinion one"],
  });

  expect(result.cases).toHaveLength(6);
  expect(result.cases[0].rankScore).toBeGreaterThan(result.cases[1].rankScore);
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
pnpm test src/server/services/rewrite-learning-retrieval.service.test.ts
```

Expected: FAIL because retrieval service does not exist yet

- [ ] **Step 3: Implement minimal retrieval and rewrite-worker integration**

Implementation targets:

```typescript
const learningContext = await rewriteLearningRetrievalService.retrieveForRewrite({
  organizationId: version.rewrite.organizationId,
  targetAccountId: targetAccount.id,
  transcriptText,
  annotations: workspace.annotations,
  viewpoints: orderedFragments.map((fragment) => fragment.content),
});

userPrompt = appendLearningContextToPrompt(userPrompt, learningContext);
```

- [ ] **Step 4: Persist learning snapshot on the version**

Implementation target:

```typescript
await rewriteRepository.updateLearningContext(rewriteVersionId, {
  usedLearningCaseIds: learningContext.cases.map((item) => item.id),
  learningContextSnapshot: learningContext.snapshot,
  promptTemplateVersion: "rewrite-learning-v1",
});
```

- [ ] **Step 5: Re-run the focused test**

Run:

```bash
pnpm test src/server/services/rewrite-learning-retrieval.service.test.ts
```

Expected: PASS

### Task 8: Add rewrite-version publication APIs

**Files:**
- Create: `src/app/api/rewrite-versions/[id]/publication/route.ts`
- Create: `src/app/api/rewrite-versions/[id]/publication/candidates/route.ts`
- Create: `src/app/api/rewrite-versions/[id]/publication/route.test.ts`

- [ ] **Step 1: Write a failing route test**

Add a test for candidate loading:

```typescript
it("returns account-scoped publication candidates for a completed rewrite version", async () => {
  const response = await GET(request, { params: Promise.resolve({ id: "version-1" }) });
  const body = await response.json();

  expect(body.success).toBe(true);
  expect(Array.isArray(body.data)).toBe(true);
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
pnpm test src/app/api/rewrite-versions/[id]/publication/route.test.ts
```

Expected: FAIL because the routes do not exist yet

- [ ] **Step 3: Implement the routes**

Implementation target:

```typescript
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const versionId = (await context.params).id;
  const data = await rewritePublicationService.getPublication(versionId, session.user);
  return Response.json({ success: true, data });
}
```

- [ ] **Step 4: Re-run the focused test**

Run:

```bash
pnpm test src/app/api/rewrite-versions/[id]/publication/route.test.ts
```

Expected: PASS

### Task 9: Add version-panel publication UI

**Files:**
- Create: `src/components/features/rewrites/publication-video-picker-dialog.tsx`
- Modify: `src/components/features/benchmarks/ai-rewrite-panel.tsx`
- Modify: `src/components/features/rewrites/direct-create-panel.tsx`
- Modify: `src/components/features/accounts/video-rewrite-link-section.tsx`
- Modify: `src/types/video-link.ts` or new DTO file

- [ ] **Step 1: Write or update a focused component test if available**

Add a minimal interaction test or view-model assertion around publication state if the surrounding component already has tests.

- [ ] **Step 2: Implement the picker dialog**

Implementation target:

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="max-w-2xl">
    {/* list candidate videos with cover, title, publishedAt, metrics, disabled state */}
  </DialogContent>
</Dialog>
```

- [ ] **Step 3: Integrate the new version-panel controls**

Implementation targets:

```tsx
{activeVersion?.status === "COMPLETED" ? (
  <RewritePublicationSection
    rewriteVersionId={activeVersion.id}
    targetAccountId={rewrite.targetAccountId}
  />
) : null}
```

- [ ] **Step 4: Convert video detail to result-display mode**

Implementation target:

```tsx
<section>
  <p>已关联发布反馈</p>
  {/* summary + unlink only */}
</section>
```

- [ ] **Step 5: Verify with lint and targeted tests**

Run:

```bash
pnpm lint
```

Expected: PASS

### Task 10: Full verification

**Files:**
- Modify: any touched files above
- Test: whole feature verification set

- [ ] **Step 1: Run focused feature tests**

Run:

```bash
pnpm test src/lib/server-bootstrap.test.ts src/server/services/rewrite-publication.service.test.ts src/server/services/rewrite-learning-case.service.test.ts src/server/services/douyin-account-style-profile.service.test.ts src/server/services/rewrite-learning-retrieval.service.test.ts src/app/api/rewrite-versions/[id]/publication/route.test.ts
```

Expected: PASS

- [ ] **Step 2: Run type-check**

Run:

```bash
pnpm type-check
```

Expected: PASS

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS

- [ ] **Step 4: Review git diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only intended v0.5.1 files changed
