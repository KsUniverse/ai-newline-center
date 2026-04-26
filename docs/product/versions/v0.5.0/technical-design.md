# v0.5.0 技术设计 - 成长型 AI 仿写

> 版本: v0.5.0
> 创建日期: 2026-04-26
> 范围: 数据闭环、向量 RAG、账号风格画像、发布视频绑定、仿写 prompt 增强

---

## 1. 总体架构

v0.5.0 复用现有分层架构：

```
Page / Feature Component
  -> apiClient
  -> Route Handler
  -> Service
  -> Repository
  -> Prisma / VectorStoreAdapter
  -> BullMQ Worker
  -> AiGateway
```

新增学习链路不绕过 Service/Repository。所有前台接口必须通过 `auth()` 获取 session，并在 Service 层校验 `organizationId`、`userId` 和目标账号归属。

---

## 2. 数据模型

### 2.1 新增枚举

```prisma
enum RewritePublicationStatus {
  LINKED
  UNLINKED
}

enum RewriteLearningCaseStatus {
  ACTIVE
  ARCHIVED
}

enum RewriteEmbeddingStatus {
  PENDING
  COMPLETED
  FAILED
}
```

### 2.2 `RewritePublication`

用于绑定仿写版本和真实发布视频。

```prisma
model RewritePublication {
  id               String                   @id @default(cuid())
  rewriteVersionId String                   @unique
  rewriteVersion   RewriteVersion           @relation(fields: [rewriteVersionId], references: [id])
  targetAccountId  String
  targetAccount    DouyinAccount            @relation(fields: [targetAccountId], references: [id])
  douyinVideoId    String
  douyinVideo      DouyinVideo              @relation(fields: [douyinVideoId], references: [id])
  organizationId   String
  organization     Organization             @relation(fields: [organizationId], references: [id])
  userId           String
  user             User                     @relation(fields: [userId], references: [id])
  finalContent     String                   @db.LongText
  status           RewritePublicationStatus @default(LINKED)
  linkedAt         DateTime                 @default(now())
  unlinkedAt       DateTime?
  createdAt        DateTime                 @default(now())
  updatedAt        DateTime                 @updatedAt

  learningCase     RewriteLearningCase?

  @@index([targetAccountId, status])
  @@index([organizationId])
  @@index([douyinVideoId])
  @@map("rewrite_publications")
}
```

约束：

- 一个 `RewriteVersion` 同时最多一个有效绑定。
- 一个 `DouyinVideo` 同时最多绑定一个有效 `RewritePublication`，由 Service 层校验。
- 解绑不物理删除，保留审计记录。

### 2.3 `RewriteLearningCase`

用于存储可检索案例。

```prisma
model RewriteLearningCase {
  id                         String                    @id @default(cuid())
  publicationId              String                    @unique
  publication                RewritePublication         @relation(fields: [publicationId], references: [id])
  rewriteVersionId           String
  targetAccountId            String
  organizationId             String
  sourceBenchmarkVideoId     String?
  publishedVideoId           String
  sourceTranscriptSnapshot   String?                   @db.LongText
  sourceAnnotationsSnapshot  Json
  generatedContentSnapshot   String?                   @db.LongText
  editedContentSnapshot      String?                   @db.LongText
  finalContentSnapshot       String                    @db.LongText
  usedFragmentSnapshot       Json
  metricsSnapshot            Json
  performanceScore           Int
  embeddingText              String                    @db.LongText
  embeddingJson              Json?
  embeddingStatus            RewriteEmbeddingStatus    @default(PENDING)
  embeddingErrorMessage      String?                   @db.Text
  status                     RewriteLearningCaseStatus @default(ACTIVE)
  createdAt                  DateTime                  @default(now())
  updatedAt                  DateTime                  @updatedAt

  @@index([targetAccountId, status, performanceScore])
  @@index([organizationId])
  @@index([rewriteVersionId])
  @@map("rewrite_learning_cases")
}
```

### 2.4 `DouyinAccountStyleProfile`

用于保存账号隐式画像。

```prisma
model DouyinAccountStyleProfile {
  id                String        @id @default(cuid())
  targetAccountId   String        @unique
  targetAccount     DouyinAccount @relation(fields: [targetAccountId], references: [id])
  organizationId    String
  summary           String?       @db.Text
  toneKeywords      Json          @default("[]")
  structurePatterns Json          @default("[]")
  openingPatterns   Json          @default("[]")
  ctaPatterns       Json          @default("[]")
  avoidPatterns     Json          @default("[]")
  sampleCount       Int           @default(0)
  lastBuiltAt       DateTime?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@index([organizationId])
  @@map("douyin_account_style_profiles")
}
```

### 2.5 扩展 `RewriteVersion`

```prisma
model RewriteVersion {
  // existing fields...
  usedLearningCaseIds     Json @default("[]")
  learningContextSnapshot Json?
  promptTemplateVersion   String?
  publication             RewritePublication?
}
```

### 2.6 扩展反向关联

- `Organization`: `rewritePublications`、`douyinAccountStyleProfiles`
- `User`: `rewritePublications`
- `DouyinAccount`: `rewritePublications`、`styleProfile`
- `DouyinVideo`: `rewritePublications`
- `RewriteVersion`: `publication`

---

## 3. 向量检索设计

### 3.1 `VectorStoreAdapter`

```typescript
export interface RewriteCaseVectorPayload {
  caseId: string;
  organizationId: string;
  targetAccountId: string;
  performanceScore: number;
  status: "ACTIVE" | "ARCHIVED";
}

export interface RewriteCaseSearchResult {
  caseId: string;
  similarity: number;
}

export interface VectorStoreAdapter {
  upsertRewriteCase(input: {
    caseId: string;
    vector: number[];
    payload: RewriteCaseVectorPayload;
  }): Promise<void>;

  archiveRewriteCase(caseId: string): Promise<void>;

  searchRewriteCases(input: {
    organizationId: string;
    targetAccountId: string;
    queryVector: number[];
    limit: number;
  }): Promise<RewriteCaseSearchResult[]>;
}
```

### 3.2 MySQL 默认实现

`MysqlVectorStoreAdapter` 不新建外部服务，直接读 `RewriteLearningCase.embeddingJson`。

检索步骤：

1. 查询同 `organizationId + targetAccountId + ACTIVE + embeddingStatus=COMPLETED` 的案例。
2. 解析 `embeddingJson` 为 `number[]`。
3. 用 `cosineSimilarity(queryVector, caseVector)` 计算相似度。
4. 返回 Top N。

该实现适合账号内小样本场景。每个账号学习案例达到数千条后，再切换 Qdrant。

### 3.3 Qdrant 可选实现

环境变量：

```env
REWRITE_VECTOR_BACKEND=qdrant
QDRANT_URL=http://127.0.0.1:6333
QDRANT_API_KEY=
QDRANT_REWRITE_COLLECTION=rewrite_learning_cases
```

Qdrant collection：

- `name`: `rewrite_learning_cases`
- `distance`: `Cosine`
- `payload`: `organizationId`、`targetAccountId`、`caseId`、`performanceScore`、`status`

所有查询必须带：

```json
{
  "must": [
    { "key": "organizationId", "match": { "value": "..." } },
    { "key": "targetAccountId", "match": { "value": "..." } },
    { "key": "status", "match": { "value": "ACTIVE" } }
  ]
}
```

---

## 4. AI 网关扩展

### 4.1 `AiStep`

新增：

```typescript
type AiStep = "TRANSCRIBE" | "DECOMPOSE" | "REWRITE" | "EMBED";
```

Prisma 枚举同步增加 `EMBED`。

### 4.2 `AiGateway.embedTexts`

```typescript
interface EmbedTextsResult {
  modelConfigId: string;
  modelName: string;
  embeddings: number[][];
}

async embedTexts(values: string[], modelConfigId?: string): Promise<EmbedTextsResult>
```

行为：

1. 解析 `EMBED` 绑定模型。
2. 使用 `createOpenAI({ apiKey, baseURL })`。
3. 调用 AI SDK `embedMany`。
4. 空输入直接返回空数组。
5. 模型未配置返回 `AI_STEP_NOT_CONFIGURED`。

---

## 5. Service 边界

### 5.1 `rewrite-publication.service.ts`

职责：

1. 绑定 `RewriteVersion` 和 `DouyinVideo`。
2. 解绑发布视频。
3. 校验权限和归属。
4. 创建学习案例。
5. 投递学习案例 embedding 和画像重建任务。

关键方法：

```typescript
linkPublishedVideo(videoId, versionId, douyinVideoId, caller)
unlinkPublishedVideo(videoId, versionId, caller)
```

绑定校验顺序：

1. 通过 `videoId + caller.id` 查 `AiWorkspace`。
2. 查 `RewriteVersion`，确认属于该 workspace。
3. 确认 version 状态为 `COMPLETED`。
4. 确认 `Rewrite.targetAccountId` 存在。
5. 查 `DouyinVideo`，include `account`。
6. 确认 `douyinVideo.accountId === rewrite.targetAccountId`。
7. 确认账号 `organizationId` 与 caller 一致。
8. 确认视频未被其他 LINKED publication 使用。
9. 提取最终稿。
10. upsert `RewritePublication`。

### 5.2 `rewrite-learning-case.service.ts`

职责：

1. 从 publication 构建 learning case。
2. 计算表现分。
3. 生成 embedding 文本。
4. 调用 `AiGateway.embedTexts`。
5. 写入 MySQL embedding。
6. 同步 `VectorStoreAdapter`。

### 5.3 `douyin-account-style-profile.service.ts`

职责：

1. 查询同账号 ACTIVE learning cases。
2. 样本数少于 2 时生成空画像。
3. 样本数不少于 2 时调用 REWRITE 模型生成结构化画像。
4. upsert `DouyinAccountStyleProfile`。

画像生成使用 `generateObject` 或 `generateText + JSON.parse`。优先使用 `generateObject`，schema 固定为：

```typescript
{
  summary: string;
  toneKeywords: string[];
  structurePatterns: string[];
  openingPatterns: string[];
  ctaPatterns: string[];
  avoidPatterns: string[];
}
```

---

## 6. BullMQ 任务

### 6.1 新增队列

```typescript
export const REWRITE_LEARNING_QUEUE_NAME = "rewrite-learning";

export interface RewriteLearningJobData {
  learningCaseId: string;
  organizationId: string;
  targetAccountId: string;
}
```

### 6.2 Worker 流程

```
load learning case
  -> build embedding text
  -> embedTexts
  -> update embeddingJson/status
  -> vectorStore.upsertRewriteCase
  -> rebuild style profile
```

失败策略：

- embedding 失败：`embeddingStatus=FAILED`，写入错误。
- 画像生成失败：保留 learning case，不影响绑定。
- Worker 最多尝试 3 次，指数退避。

---

## 7. Prompt 增强

### 7.1 上下文构建

新增 `rewrite-learning-context.service.ts`：

```typescript
interface RewriteLearningContext {
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

### 7.2 Prompt 区块

有画像时：

```
【目标账号历史风格画像】
{summary}
语气关键词：...
常见结构：...
常见开头：...
常见收束：...
应避免：...
```

有案例时：

```
【同账号历史高表现仿写案例】
案例 1（表现分 86，相似度 0.82）：
- 对标原文摘要：...
- 拆解要点：...
- 最终发布文案：...
- 发布反馈：播放 12000，点赞 650，评论 42，分享 30，收藏 88
```

生成要求追加：

```
请学习历史案例中的结构、节奏和表达偏好，但不要复制历史文案原句。
如果历史案例与本次对标视频冲突，以本次对标视频结构和本次观点素材为准。
```

### 7.3 快照写入

`RewriteVersion.learningContextSnapshot` 保存完整 `RewriteLearningContext`。

`RewriteVersion.usedLearningCaseIds` 保存参与本次 prompt 的 case ids。

---

## 8. API 设计

### 8.1 绑定发布视频

```
POST /api/ai-workspace/[videoId]/rewrite/versions/[versionId]/published-video
```

Request:

```typescript
{
  douyinVideoId: string;
}
```

Response:

```typescript
{
  publication: {
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
  };
}
```

### 8.2 解绑发布视频

```
DELETE /api/ai-workspace/[videoId]/rewrite/versions/[versionId]/published-video
```

Response:

```typescript
{
  unlinked: true;
}
```

### 8.3 目标账号视频选择

复用现有：

```
GET /api/douyin-accounts/[id]/videos?page=1&limit=20
```

前端只能传当前版本 `targetAccountId`。

### 8.4 扩展 GET Rewrite

`RewriteVersionDTO` 增加：

```typescript
publication: {
  id: string;
  douyinVideoId: string;
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
} | null;
usedLearningCaseIds: string[];
```

---

## 9. 权限与安全

1. `DouyinVideo` 无 `organizationId` 字段，必须通过 `DouyinVideo.account.organizationId` 校验。
2. 绑定视频时必须校验视频账号等于 `Rewrite.targetAccountId`。
3. `RewriteLearningCase` 查询必须带 `organizationId` 和 `targetAccountId`。
4. Qdrant payload 必须包含 `organizationId` 和 `targetAccountId`，检索必须过滤。
5. embedding 文本包含业务文案，不写入日志。
6. AI key 继续沿用现有 `AiModelConfig` 管理方式。

---

## 10. 降级策略

1. 无学习案例：使用 v0.3.3 prompt。
2. 无 embedding 配置：跳过检索，使用账号画像和当前输入。
3. embedding 失败：保留案例，标记 FAILED，不影响绑定。
4. Qdrant 失败：降级 MySQL 检索。
5. 画像生成失败：保留历史画像，不阻塞仿写。

---

## 11. 测试范围

1. `RewritePublicationService` 权限与归属测试。
2. `RewriteLearningCaseService` 表现分与快照测试。
3. `MysqlVectorStoreAdapter` cosine 排序测试。
4. `RewriteLearningContextService` 无案例、有案例、有画像测试。
5. `RewriteWorker` prompt 包含学习上下文测试。
6. API route 401、403、400、200 测试。
7. 前端绑定弹框、解绑确认、版本 publication 展示测试。

