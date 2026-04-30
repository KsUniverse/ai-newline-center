# v0.5.1 后端任务 — 经验反馈闭环

## 必读文档

- `docs/product/versions/v0.5.1/requirements.md`
- `docs/product/versions/v0.5.1/technical-design.md`
- `docs/architecture/OVERVIEW.md`
- `docs/architecture/backend.md`
- `docs/standards/coding-standards.md`
- `prisma/schema.prisma`
- `src/lib/rewrite-worker.ts`
- `src/server/services/sync.service.ts`
- `src/server/repositories/video-rewrite-link.repository.ts`
- `src/server/repositories/video-snapshot.repository.ts`
- `src/server/repositories/rewrite.repository.ts`

---

## 任务清单

### T1: 更新 Prisma Schema

**文件**: `prisma/schema.prisma`

1. 添加 `StyleExperience` 模型（见 technical-design.md §2.1）
2. 添加反向关联到以下模型：
   - `DouyinAccount` → `styleExperiences StyleExperience[]`
   - `Rewrite` → `styleExperiences StyleExperience[]`
   - `DouyinVideo` → `styleExperience StyleExperience?`（optional，一对一）
   - `Organization` → `styleExperiences StyleExperience[]`
3. 执行 `pnpm db:push` 同步数据库

### T2: 创建 StyleExperience Repository

**文件**: `src/server/repositories/style-experience.repository.ts`（新建）

实现三个方法：
- `upsert(data, db?)` — Prisma upsert by `(rewriteId, videoId)` 复合唯一键
- `findTopByAccountId(accountId, organizationId, limit, db?)` — qualityScore DESC
- `findByRewriteId(rewriteId, db?)` — 返回该仿写的经验记录或 null

### T3: 创建 StyleExperience Service

**文件**: `src/server/services/style-experience.service.ts`（新建）

实现两个方法：
- `upsertForVideo(videoId: string): Promise<void>` — 核心逻辑：
  1. 查 VideoRewriteLink（含 rewrite.targetAccountId + rewrite.organizationId）
  2. 若无关联 → return（无操作）
  3. 查 isFinalVersion=true 的 RewriteVersion（取最新一条）
  4. 若无最终稿 → return
  5. 查最新 VideoSnapshot（limit 1，按 timestamp desc）
  6. 若无快照 → return
  7. 计算 qualityScore = playsCount + (likesCount * 10) + (commentsCount * 5) + (sharesCount * 3)
  8. upsert StyleExperience

- `getFewShotExamples(accountId: string, organizationId: string, limit: number): Promise<string | null>` — 格式化示例：
  1. findTopByAccountId(accountId, organizationId, limit)
  2. 若空 → return null
  3. 格式化文本块（见 requirements.md §3.2 注入格式）

### T4: 集成到 sync.service.ts

**文件**: `src/server/services/sync.service.ts`

在 `runVideoSnapshotCollection()` 末尾，遍历 myVideos 调用 `styleExperienceService.upsertForVideo(video.id)`，单个失败不影响整体：

```typescript
for (const video of myVideos) {
  try {
    await styleExperienceService.upsertForVideo(video.id);
  } catch (error) {
    console.error("[StyleExperience] Failed to upsert experience:", {
      videoId: video.id,
      error,
    });
  }
}
```

### T5: 集成到 rewrite-worker.ts

**文件**: `src/lib/rewrite-worker.ts`

在 Step 4（Build prompts）完成后、Step 5（Call AI gateway）前，注入 few-shot：

```typescript
// 查目标账号所属组织ID（从 version.rewrite 中获取）
const organizationId = version.rewrite.organizationId;
const fewShotBlock = await styleExperienceService.getFewShotExamples(
  targetAccount.id,   // accountId
  organizationId,
  3,
);
if (fewShotBlock) {
  userPrompt = userPrompt + "\n\n" + fewShotBlock;
}
```

注意：`version.rewrite` 的 include 需要包含 `organizationId`（现有查询已含此字段）。

### T6: 更新 Rewrite Repository（供前端展示）

**文件**: `src/server/repositories/rewrite.repository.ts`

`findMineWithFinalVersion` 增加 `styleExperiences` include：
```typescript
styleExperiences: {
  orderBy: { qualityScore: "desc" },
  take: 1,
  select: { playsCount: true, likesCount: true },
},
```

### T7: 更新 Rewrite Service（供前端展示）

**文件**: `src/server/services/rewrite.service.ts`

`listMineWithFinalVersion` 返回值追加 `experienceSummary` 字段：
```typescript
experienceSummary: styleExperience
  ? { playsCount: styleExperience.playsCount, likesCount: styleExperience.likesCount }
  : null,
```

---

## 自省报告（完成后填写）
