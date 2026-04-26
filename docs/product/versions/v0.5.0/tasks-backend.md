# v0.5.0 后端开发文档 - 成长型 AI 仿写

## 必读文档

- `docs/product/versions/v0.5.0/background.md`
- `docs/product/versions/v0.5.0/requirements.md`
- `docs/product/versions/v0.5.0/technical-design.md`
- `docs/product/versions/v0.3.3/technical-design.md`
- `docs/architecture/backend.md`
- `docs/architecture/database.md`
- `docs/architecture/api-conventions.md`
- `docs/standards/coding-standards.md`

---

## 摘要

后端目标是在不破坏 v0.3.3 仿写主链路的前提下，新增发布绑定、学习案例、向量检索、账号画像和 prompt 增强能力。

任务总数: 12

---

## BE-001: Prisma Schema 扩展

**文件**

- 修改: `prisma/schema.prisma`

**内容**

1. 新增枚举：
   - `RewritePublicationStatus`
   - `RewriteLearningCaseStatus`
   - `RewriteEmbeddingStatus`
2. 新增模型：
   - `RewritePublication`
   - `RewriteLearningCase`
   - `DouyinAccountStyleProfile`
3. 扩展 `RewriteVersion`：
   - `usedLearningCaseIds Json @default("[]")`
   - `learningContextSnapshot Json?`
   - `promptTemplateVersion String?`
   - `publication RewritePublication?`
4. 扩展反向关联：
   - `Organization`
   - `User`
   - `DouyinAccount`
   - `DouyinVideo`

**验证**

- `pnpm db:generate`
- `pnpm type-check`

---

## BE-002: 类型定义

**文件**

- 修改: `src/types/ai-workspace.ts`
- 新增: `src/types/rewrite-learning.ts`

**内容**

在 `ai-workspace.ts` 扩展 `RewriteVersionDTO`：

```typescript
publication: RewritePublicationDTO | null;
usedLearningCaseIds: string[];
```

新增 `rewrite-learning.ts`：

```typescript
export interface RewritePublicationDTO {
  id: string;
  rewriteVersionId: string;
  douyinVideoId: string;
  finalContent: string;
  linkedAt: string;
  video: {
    id: string;
    title: string;
    coverUrl: string | null;
    publishedAt: string | null;
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    collectCount: number;
  };
}

export interface RewriteLearningContextSnapshot {
  profile: {
    summary: string | null;
    toneKeywords: string[];
    structurePatterns: string[];
    openingPatterns: string[];
    ctaPatterns: string[];
    avoidPatterns: string[];
    sampleCount: number;
  } | null;
  cases: Array<{
    id: string;
    finalContent: string;
    sourceTranscriptSummary: string | null;
    annotationsSummary: string;
    metricsSummary: string;
    performanceScore: number;
    similarity: number;
  }>;
}
```

**验证**

- 类型被 Repository、Service、Route 引用无错误。

---

## BE-003: Repository 层

**文件**

- 新增: `src/server/repositories/rewrite-publication.repository.ts`
- 新增: `src/server/repositories/rewrite-learning-case.repository.ts`
- 新增: `src/server/repositories/douyin-account-style-profile.repository.ts`
- 修改: `src/server/repositories/rewrite.repository.ts`

**内容**

`rewrite-publication.repository.ts`：

- `findLinkedByVersionId(versionId)`
- `findLinkedByDouyinVideoId(douyinVideoId)`
- `upsertLinked(data, db?)`
- `unlinkByVersionId(versionId, db?)`

`rewrite-learning-case.repository.ts`：

- `findActiveByAccount(accountId, organizationId)`
- `findById(id)`
- `upsertFromPublication(data, db?)`
- `markEmbeddingCompleted(id, embeddingJson)`
- `markEmbeddingFailed(id, errorMessage)`
- `archiveByPublicationId(publicationId, db?)`

`douyin-account-style-profile.repository.ts`：

- `findByAccountId(accountId)`
- `upsertProfile(data)`
- `clearProfile(accountId, organizationId, sampleCount)`

`rewrite.repository.ts`：

- include `versions.publication.video`
- DTO 映射 `publication`
- DTO 映射 `usedLearningCaseIds`

**验证**

- Repository 不直接做权限判断。
- 所有列表查询保留 `organizationId` 过滤入口。

---

## BE-004: 表现分服务

**文件**

- 新增: `src/server/services/rewrite-performance-score.service.ts`
- 新增测试: `src/server/services/rewrite-performance-score.service.test.ts`

**内容**

实现：

```typescript
calculateRewritePerformanceScore(input): number
buildRewriteMetricsSnapshot(video, snapshots): RewriteMetricsSnapshot
```

规则：

- 输出 0-100 整数。
- 播放基础分权重 0.30。
- 互动率分权重 0.45。
- 分享收藏分权重 0.20。
- 增长分权重 0.05。
- `playCount <= 0` 时所有 rate 使用 0。

**验证**

- 0 播放不出现除 0。
- 高互动案例分数高于低互动案例。
- 分数永远在 0-100。

---

## BE-005: AI Gateway embedding

**文件**

- 修改: `prisma/schema.prisma`
- 修改: `src/types/ai-config.ts`
- 修改: `src/server/services/ai-gateway.service.ts`
- 修改: `src/components/features/system-settings/ai-config-page.tsx` 的后端类型依赖由前端任务承接

**内容**

1. `AiStep` 增加 `EMBED`。
2. `aiGateway.embedTexts(values, modelConfigId?)`。
3. 空数组输入返回空 embeddings。
4. 未绑定模型抛 `AI_STEP_NOT_CONFIGURED`。

**验证**

- `ai-gateway.service.test.ts` 覆盖空输入和未配置模型。

---

## BE-006: VectorStoreAdapter

**文件**

- 新增: `src/server/services/vector-store/vector-store-adapter.ts`
- 新增: `src/server/services/vector-store/mysql-vector-store-adapter.ts`
- 新增: `src/server/services/vector-store/qdrant-vector-store-adapter.ts`
- 新增: `src/server/services/vector-store/vector-store.factory.ts`
- 新增测试: `src/server/services/vector-store/mysql-vector-store-adapter.test.ts`

**内容**

默认 `MysqlVectorStoreAdapter`：

- 读取同账号 ACTIVE + COMPLETED embedding 的 learning cases。
- 使用 AI SDK `cosineSimilarity`。
- 返回 Top N。

Qdrant adapter：

- 使用 REST API。
- upsert point。
- archive 时更新 payload status 为 `ARCHIVED`。
- search 时强制过滤 organization/account/status。

**验证**

- MySQL adapter 排序稳定。
- 空案例返回空数组。
- organization/account 不匹配案例不会返回。

---

## BE-007: 学习案例服务

**文件**

- 新增: `src/server/services/rewrite-learning-case.service.ts`
- 新增测试: `src/server/services/rewrite-learning-case.service.test.ts`

**内容**

实现：

- `createOrRefreshFromPublication(publicationId)`
- `buildEmbeddingText(case)`
- `refreshEmbedding(caseId)`
- `archiveByPublication(publicationId)`

`embeddingText` 组成：

1. 对标原文。
2. 拆解摘要。
3. 最终仿写稿。
4. 使用观点。
5. 指标摘要。

**验证**

- finalContent 取 `editedContent ?? generatedContent`。
- fragment 使用快照，不依赖后续 Fragment 修改。
- embedding 失败时状态为 `FAILED`。

---

## BE-008: 账号画像服务

**文件**

- 新增: `src/server/services/douyin-account-style-profile.service.ts`
- 新增测试: `src/server/services/douyin-account-style-profile.service.test.ts`

**内容**

实现：

- `rebuildProfile(targetAccountId, organizationId)`
- `buildProfilePrompt(cases)`

规则：

- ACTIVE case < 2：清空画像，`sampleCount` 写实际数量。
- ACTIVE case >= 2：调用模型生成结构化画像。
- 优先高表现案例，最多输入 20 条。

**验证**

- 样本不足时不调用 AI。
- 样本充足时 upsert profile。
- AI 失败不归档案例。

---

## BE-009: 发布绑定服务

**文件**

- 新增: `src/server/services/rewrite-publication.service.ts`
- 新增测试: `src/server/services/rewrite-publication.service.test.ts`

**内容**

实现：

- `linkPublishedVideo(videoId, versionId, douyinVideoId, caller)`
- `unlinkPublishedVideo(videoId, versionId, caller)`

错误码：

- `WORKSPACE_NOT_FOUND`
- `VERSION_NOT_FOUND`
- `VERSION_NOT_COMPLETED`
- `TARGET_ACCOUNT_REQUIRED`
- `PUBLISHED_VIDEO_NOT_FOUND`
- `PUBLISHED_VIDEO_ACCOUNT_MISMATCH`
- `PUBLISHED_VIDEO_ALREADY_LINKED`
- `REWRITE_CONTENT_EMPTY`

**验证**

- 绑定账号不一致返回 400。
- 他人账号视频返回 403 或 404。
- 重复绑定同一视频返回 409。
- 解绑后 case 归档。

---

## BE-010: BullMQ 学习队列

**文件**

- 修改: `src/lib/bullmq.ts`
- 新增: `src/lib/rewrite-learning-worker.ts`
- 修改: `src/lib/server-bootstrap.ts`

**内容**

新增队列：

- `REWRITE_LEARNING_QUEUE_NAME`
- `RewriteLearningJobData`
- `getRewriteLearningQueue()`

Worker：

1. 刷新 embedding。
2. upsert vector store。
3. 重建账号画像。

**验证**

- REDIS_URL 缺失时跳过启动。
- Worker 防重复注册。

---

## BE-011: 生成链路注入学习上下文

**文件**

- 新增: `src/server/services/rewrite-learning-context.service.ts`
- 修改: `src/lib/rewrite-worker.ts`
- 修改: `src/server/repositories/rewrite.repository.ts`

**内容**

`RewriteLearningContextService`：

- 根据 workspace、targetAccountId、当前输入构造 query text。
- 调 `aiGateway.embedTexts` 生成 query vector。
- 调 `VectorStoreAdapter.searchRewriteCases`。
- 混合 similarity、performanceScore、recency 排序。
- 返回 profile + cases。

`rewrite-worker.ts`：

- 构建 prompt 时注入画像和案例。
- 成功生成后写入 `learningContextSnapshot`、`usedLearningCaseIds`、`promptTemplateVersion`。

**验证**

- 无案例时 prompt 与当前版本兼容。
- 有案例时 prompt 包含历史案例区块。
- usedLearningCaseIds 与 snapshot 一致。

---

## BE-012: API Route

**文件**

- 新增: `src/app/api/ai-workspace/[videoId]/rewrite/versions/[versionId]/published-video/route.ts`
- 修改: `src/app/api/ai-workspace/[videoId]/rewrite/route.test.ts`
- 新增测试: `src/app/api/ai-workspace/[videoId]/rewrite/versions/[versionId]/published-video/route.test.ts`

**内容**

`POST`：

- auth + EMPLOYEE+
- Zod: `{ douyinVideoId: z.string().cuid() }`
- 调 `rewritePublicationService.linkPublishedVideo`

`DELETE`：

- auth + EMPLOYEE+
- 调 `rewritePublicationService.unlinkPublishedVideo`

**验证**

- 401 未登录。
- 400 参数错误。
- 200 绑定成功。
- 200 解绑成功。

---

## 全量验证

后端完成后运行：

```bash
pnpm db:generate
pnpm type-check
pnpm lint
pnpm test
```

如全量测试存在历史失败，需记录失败测试名，并单独运行 v0.5.0 新增测试证明本版本链路通过。

