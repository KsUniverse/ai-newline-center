# AI Direct Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v0.3.3.1 AI direct creation entry where each direct creation starts a `Rewrite` task and repeated generation inside that task creates multiple `RewriteVersion` records.

**Architecture:** Extend the existing v0.3.3 rewrite stack instead of adding a parallel subsystem. Backend owns `Rewrite` schema/API/service/worker changes and shared DTO contract; frontend owns the `/rewrites/new` route, direct creation UI, page state, polling, and navigation entry. The API contract is `POST /api/rewrites/direct/generate` with optional `rewriteId`: absent creates a DIRECT task and version 1; present appends a version to that task.

**Tech Stack:** Next.js 15 App Router, TypeScript strict mode, Prisma 6 + MySQL, BullMQ, Vitest, React 19, Tailwind CSS 4, shadcn/ui, lucide-react.

---

## File Map

### Backend Worker Write Set

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_direct_rewrite_mode/migration.sql`
- Modify: `src/types/ai-workspace.ts`
- Modify: `src/lib/bullmq.ts`
- Modify: `src/lib/rewrite-worker.ts`
- Modify: `src/server/repositories/rewrite.repository.ts`
- Modify: `src/server/services/rewrite.service.ts`
- Modify/Test: `src/server/services/rewrite.service.test.ts`
- Create: `src/app/api/rewrites/direct/generate/route.ts`
- Create: `src/app/api/rewrites/direct/[rewriteId]/route.ts`
- Create: `src/app/api/rewrites/direct/[rewriteId]/versions/[versionId]/route.ts`

### Frontend Worker Write Set

- Create/Test: `src/lib/hooks/use-direct-create-local-state.ts`
- Create: `src/components/features/rewrites/direct-create-panel.tsx`
- Create: `src/components/features/rewrites/direct-create-page.tsx`
- Create: `src/app/(dashboard)/rewrites/new/page.tsx`
- Modify: `src/components/shared/layout/app-navigation.ts`

### Integration Owner Write Set

- Resolve any merge conflicts between backend/frontend outputs.
- Update `docs/product/versions/v0.3.3.1/tasks-backend.md` and `docs/product/versions/v0.3.3.1/tasks-frontend.md` checkboxes after verification.

---

## Parallel Dispatch Rules

- Backend and frontend workers can run in parallel.
- Backend owns `src/types/ai-workspace.ts`; frontend must not edit it.
- Frontend may define page-local request/response helper types until backend DTO changes are integrated.
- Both workers must follow TDD: write or update failing tests first, run them and observe failure, then implement.
- No worker may revert unrelated existing changes.

---

## Task 1: Backend Direct Rewrite Contract

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_direct_rewrite_mode/migration.sql`
- Modify: `src/types/ai-workspace.ts`
- Modify: `src/lib/bullmq.ts`
- Modify: `src/server/repositories/rewrite.repository.ts`
- Modify/Test: `src/server/services/rewrite.service.ts`
- Modify/Test: `src/server/services/rewrite.service.test.ts`

- [ ] **Step 1: Write failing service tests**

Add tests to `src/server/services/rewrite.service.test.ts` before production edits:

```ts
it("creates a new DIRECT rewrite task and version when rewriteId is omitted", async () => {
  findUniqueAccountMock.mockResolvedValue({ id: "acc_1" });
  findByIdRawMock.mockResolvedValue({ id: "model_1" });
  createDirectMock.mockResolvedValue({ id: "rewrite_1" });
  createVersionMock.mockResolvedValue({ id: "version_1", versionNumber: 1 });

  const result = await rewriteService.generateDirect(
    {
      targetAccountId: "acc_1",
      modelConfigId: "model_1",
      usedFragmentIds: ["frag_1"],
      userInputContent: "补充素材",
      topic: "创作主题",
    },
    mockCaller,
  );

  expect(result).toEqual({
    rewriteId: "rewrite_1",
    rewriteVersionId: "version_1",
    versionNumber: 1,
  });
  expect(createDirectMock).toHaveBeenCalledWith(
    {
      targetAccountId: "acc_1",
      organizationId: "org_1",
      userId: "user_1",
      topic: "创作主题",
    },
    expect.anything(),
  );
  expect(addJobMock).toHaveBeenCalledWith("generate-rewrite", {
    rewriteVersionId: "version_1",
    organizationId: "org_1",
    userId: "user_1",
    mode: "direct",
  });
});

it("appends a new version to an existing DIRECT rewrite task", async () => {
  findUniqueAccountMock.mockResolvedValue({ id: "acc_1" });
  findByIdRawMock.mockResolvedValue({ id: "model_1" });
  findByIdAndUserMock.mockResolvedValue({ id: "rewrite_1", mode: "DIRECT" });
  updateDirectTaskContextMock.mockResolvedValue({ id: "rewrite_1" });
  createNextVersionMock.mockResolvedValue({ id: "version_2", versionNumber: 2 });

  const result = await rewriteService.generateDirect(
    {
      rewriteId: "rewrite_1",
      targetAccountId: "acc_1",
      modelConfigId: "model_1",
      usedFragmentIds: [],
      topic: "新的主题",
    },
    mockCaller,
  );

  expect(result.versionNumber).toBe(2);
  expect(updateDirectTaskContextMock).toHaveBeenCalledWith(
    "rewrite_1",
    { topic: "新的主题", targetAccountId: "acc_1" },
    expect.anything(),
  );
});

it("rejects appending to a DIRECT rewrite task owned by another user", async () => {
  findUniqueAccountMock.mockResolvedValue({ id: "acc_1" });
  findByIdRawMock.mockResolvedValue({ id: "model_1" });
  findByIdAndUserMock.mockResolvedValue(null);

  await expect(
    rewriteService.generateDirect(
      {
        rewriteId: "rewrite_other",
        targetAccountId: "acc_1",
        modelConfigId: "model_1",
        usedFragmentIds: [],
        topic: "主题",
      },
      mockCaller,
    ),
  ).rejects.toMatchObject({ code: "REWRITE_NOT_FOUND" });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm vitest run src/server/services/rewrite.service.test.ts
```

Expected: FAIL because `generateDirect`, repository mocks, and direct repository methods do not exist yet.

- [ ] **Step 3: Implement schema and generated types**

Update `prisma/schema.prisma`:

```prisma
enum RewriteMode {
  WORKSPACE
  DIRECT
}

model Rewrite {
  id              String           @id @default(cuid())
  workspaceId     String?          @unique
  mode            RewriteMode      @default(WORKSPACE)
  topic           String?          @db.Text
  targetAccountId String?
  organizationId  String
  userId          String
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  workspace     AiWorkspace?     @relation(fields: [workspaceId], references: [id])
  targetAccount DouyinAccount?   @relation(fields: [targetAccountId], references: [id], onDelete: SetNull)
  organization  Organization     @relation(fields: [organizationId], references: [id])
  user          User             @relation(fields: [userId], references: [id])
  versions      RewriteVersion[]

  @@index([organizationId])
  @@index([userId])
  @@index([mode, userId])
  @@map("rewrites")
}
```

Create a Prisma migration with equivalent SQL:

```sql
ALTER TABLE `rewrites` MODIFY `workspaceId` VARCHAR(191) NULL;
ALTER TABLE `rewrites` ADD COLUMN `mode` ENUM('WORKSPACE', 'DIRECT') NOT NULL DEFAULT 'WORKSPACE';
ALTER TABLE `rewrites` ADD COLUMN `topic` TEXT NULL;
CREATE INDEX `rewrites_mode_userId_idx` ON `rewrites`(`mode`, `userId`);
```

Run:

```bash
pnpm db:generate
```

- [ ] **Step 4: Implement DTO and queue contract**

Update `src/types/ai-workspace.ts`:

```ts
export type RewriteMode = "WORKSPACE" | "DIRECT";

export interface RewriteDTO {
  id: string;
  workspaceId: string | null;
  mode: RewriteMode;
  topic: string | null;
  targetAccountId: string | null;
  organizationId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  versions: RewriteVersionDTO[];
  targetAccount: {
    id: string;
    nickname: string;
    avatar: string;
    signature: string | null;
  } | null;
}

export interface DirectGenerateRewriteInput {
  rewriteId?: string;
  targetAccountId: string;
  modelConfigId: string;
  usedFragmentIds: string[];
  userInputContent?: string;
  topic: string;
}
```

Update `src/lib/bullmq.ts`:

```ts
export interface RewriteJobData {
  rewriteVersionId: string;
  workspaceId?: string;
  organizationId: string;
  userId: string;
  mode: "workspace" | "direct";
}
```

- [ ] **Step 5: Implement repository and service**

Add repository methods:

```ts
export interface CreateDirectRewriteData {
  targetAccountId: string;
  organizationId: string;
  userId: string;
  topic: string;
}

async createDirect(data: CreateDirectRewriteData, db: DatabaseClient = prisma): Promise<Rewrite> {
  return db.rewrite.create({
    data: {
      workspaceId: null,
      mode: "DIRECT",
      topic: data.topic,
      targetAccountId: data.targetAccountId,
      organizationId: data.organizationId,
      userId: data.userId,
    },
  });
}

async updateDirectTaskContext(
  id: string,
  data: { topic: string; targetAccountId: string },
  db: DatabaseClient = prisma,
): Promise<Rewrite> {
  return db.rewrite.update({
    where: { id },
    data: { topic: data.topic, targetAccountId: data.targetAccountId },
  });
}
```

Add `RewriteService.generateDirect()` using the contract in `technical-design.md`, mark queue failures through `markVersionFailed`, and return `{ rewriteId, rewriteVersionId, versionNumber }`.

- [ ] **Step 6: Run tests and verify GREEN**

Run:

```bash
pnpm vitest run src/server/services/rewrite.service.test.ts
pnpm type-check
```

Expected: both exit 0.

---

## Task 2: Backend Direct API and Worker

**Files:**
- Modify/Test: `src/lib/rewrite-worker.ts`
- Create: `src/app/api/rewrites/direct/generate/route.ts`
- Create: `src/app/api/rewrites/direct/[rewriteId]/route.ts`
- Create: `src/app/api/rewrites/direct/[rewriteId]/versions/[versionId]/route.ts`

- [ ] **Step 1: Write failing route/worker tests where local patterns exist**

If adding route tests, follow existing `src/app/api/ai-workspace/[videoId]/rewrite/route.test.ts` style and verify:

```ts
expect(rewriteService.generateDirect).toHaveBeenCalledWith(
  {
    rewriteId: "rw_1",
    targetAccountId: "acc_1",
    modelConfigId: "model_1",
    usedFragmentIds: [],
    topic: "主题",
  },
  session.user,
);
```

Run the specific test file and observe RED.

- [ ] **Step 2: Implement routes**

Create `generate/route.ts`:

```ts
const directGenerateSchema = z.object({
  rewriteId: z.string().cuid().optional(),
  targetAccountId: z.string().cuid(),
  modelConfigId: z.string().cuid(),
  usedFragmentIds: z.array(z.string().cuid()).default([]),
  userInputContent: z.string().max(2000).optional(),
  topic: z.string().trim().min(1).max(500),
});
```

Each route must use `auth()`, `requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN)`, `successResponse`, and `handleApiError`.

- [ ] **Step 3: Implement worker direct branch**

`mode === "direct"` must:

- load `RewriteVersion` with `rewrite.targetAccount`
- read `rewrite.topic`
- load fragments by `usedFragmentIds`, filtered by `organizationId` and `deletedAt: null`
- build prompt without workspace/transcript/annotations
- call `aiGateway.generateRewrite`
- call `rewriteRepository.markVersionCompleted`

The workspace branch keeps existing behavior and receives `mode: "workspace"` from existing service queue jobs.

- [ ] **Step 4: Run focused backend verification**

Run:

```bash
pnpm vitest run src/server/services/rewrite.service.test.ts
pnpm type-check
```

Expected: exit 0.

---

## Task 3: Frontend Direct Create State and UI

**Files:**
- Create/Test: `src/lib/hooks/use-direct-create-local-state.ts`
- Create: `src/components/features/rewrites/direct-create-panel.tsx`
- Create: `src/components/features/rewrites/direct-create-page.tsx`
- Create: `src/app/(dashboard)/rewrites/new/page.tsx`
- Modify: `src/components/shared/layout/app-navigation.ts`

- [ ] **Step 1: Write failing localStorage tests**

Create a focused test for the hook module if local hook tests are available. Desired behavior:

```ts
expect(loadDirectCreateLocalState()).toEqual({
  currentRewriteId: null,
  fragmentIds: [],
  userInputContent: "",
  topic: "",
  modelConfigId: null,
  targetAccountId: null,
});

saveDirectCreateLocalState({
  currentRewriteId: "rw_1",
  fragmentIds: ["frag_1"],
  userInputContent: "素材",
  topic: "主题",
  modelConfigId: "model_1",
  targetAccountId: "acc_1",
});

expect(loadDirectCreateLocalState().currentRewriteId).toBe("rw_1");
```

Run the test and observe RED because the module does not exist.

- [ ] **Step 2: Implement localStorage helpers**

Create `src/lib/hooks/use-direct-create-local-state.ts` with:

```ts
export const DIRECT_CREATE_STORAGE_KEY = "ai_direct_create_state";

export interface DirectCreateLocalState {
  currentRewriteId: string | null;
  fragmentIds: string[];
  userInputContent: string;
  topic: string;
  modelConfigId: string | null;
  targetAccountId: string | null;
}
```

Expose load/save and a React hook wrapper. The loader must handle missing `window`, missing storage, and invalid JSON by returning defaults.

- [ ] **Step 3: Implement panel**

Create a client component with props for accounts, model configs, selected fragments, versions, active version, loading states, and callbacks. It must:

- use `ViewpointPicker`
- disable input controls while generating
- disable「创作」when topic, target account, or model is empty
- pass `currentRewriteId` to generate callback for append behavior
- clear task state when「新建任务」is clicked
- display `editedContent ?? generatedContent` in textarea
- debounce edit save for completed versions

- [ ] **Step 4: Implement page and route**

Create `/rewrites/new` page using `DashboardPageShell`. The page must:

- load `/douyin-accounts?limit=100`
- load `/ai-config/settings`
- restore `currentRewriteId` from localStorage and GET `/api/rewrites/direct/[rewriteId]`
- POST `/api/rewrites/direct/generate`
- poll GET every 2s while any active version is `GENERATING`
- PATCH edited content to `/api/rewrites/direct/[rewriteId]/versions/[versionId]`

- [ ] **Step 5: Add navigation**

Update `src/components/shared/layout/app-navigation.ts`:

```ts
import { PenLine } from "lucide-react";
```

Add item in workspace section:

```ts
{
  icon: PenLine,
  label: "直接创作",
  href: "/rewrites/new",
  roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
  section: "workspace",
}
```

- [ ] **Step 6: Run focused frontend verification**

Run:

```bash
pnpm type-check
pnpm lint
```

Expected: exit 0.

---

## Integration Verification

- [ ] Run `pnpm db:generate`.
- [ ] Run `pnpm type-check`.
- [ ] Run `pnpm lint`.
- [ ] Run focused Vitest suites:

```bash
pnpm vitest run src/server/services/rewrite.service.test.ts
```

- [ ] Start app with `pnpm dev` and manually visit `/rewrites/new` if verification time permits.

---

## Self-Review

- Spec coverage: covers data model, API, service/repository, worker, page, localStorage, navigation, and multi-version task semantics.
- Placeholder scan: no TBD/TODO placeholders are required for workers.
- Type consistency: `rewriteId` is optional in `DirectGenerateRewriteInput`; `currentRewriteId` is frontend local state; direct queue jobs use `mode: "direct"` and omit `workspaceId`.
