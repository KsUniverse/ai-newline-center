# v0.5.1 技术设计 — 成长型 AI 仿写

> 版本: v0.5.1
> 设计日期: 2026-04-30
> 依赖文档: requirements.md

## 必读文档

- `docs/product/versions/v0.5.1/requirements.md`
- `docs/product/PRD.md`
- `docs/architecture/OVERVIEW.md`
- `docs/architecture/backend.md`
- `docs/architecture/frontend.md`
- `docs/standards/coding-standards.md`
- `docs/standards/review-checklist.md`

---

## 1. 架构决策

### 1.1 经验模型升级

现有轻量 `StyleExperience` 方案不再作为正式实现目标。本版本统一升级为三层模型：

1. `RewritePublication`：版本与发布视频的绑定关系
2. `RewriteLearningCase`：可检索、可注入 Prompt 的学习案例
3. `DouyinAccountStyleProfile`：账号聚合画像

这三层分别负责“关系”“样本”“画像”，职责清晰，便于后续扩展评分、候选推荐和多后端检索。

### 1.2 绑定粒度

绑定以 **`RewriteVersion`** 为粒度，而不是 `Rewrite`。因为发布反馈对应的是某一次具体最终稿，而不是整条仿写任务的抽象集合。

### 1.3 绑定约束

本版本按以下规则实现：

1. 一个 `DouyinVideo` 最多只有一个有效发布绑定
2. 一个 `RewriteVersion` 最多只有一个有效发布绑定
3. 解绑不删除记录，而是通过 `status` 标记失效

### 1.4 案例生成时机

绑定成功后立即尝试生成学习案例；若快照不足则先保留绑定，待后续 `runVideoSnapshotCollection()` 刷新案例。

### 1.5 检索后端

本版本只交付 MySQL 应用层检索：

1. embedding 以 JSON 存储在 MySQL
2. 应用层拉取同账号有效案例
3. 应用层计算 cosine similarity 与排序

Qdrant 只保留接口抽象和 fallback 策略，不打通真实连接。

### 1.6 风格画像策略

`DouyinAccountStyleProfile` 由有效案例聚合生成：

1. 样本数 `< 2` 时，仅保留空画像
2. 样本数 `>= 2` 时生成摘要和结构字段
3. 画像生成失败不阻断绑定与仿写主链路

### 1.7 Prompt 注入策略

Prompt 在现有区块基础上增加三段：

1. 账号风格画像
2. 历史高表现案例
3. 本次需继承经验

注入发生在 `rewrite-worker` 构建 Prompt 阶段，并在 `RewriteVersion` 上记录快照字段，保证可追溯。

---

## 2. 数据库设计

### 2.1 废弃目标

当前 `StyleExperience` 相关 schema、repository、service、few-shot 注入路径将被新模型替换。

### 2.2 新增模型：RewritePublication

```prisma
enum RewritePublicationStatus {
  LINKED
  UNLINKED
}

model RewritePublication {
  id               String                   @id @default(cuid())
  rewriteVersionId String
  rewriteVersion   RewriteVersion           @relation(fields: [rewriteVersionId], references: [id])
  rewriteId        String
  rewrite          Rewrite                  @relation(fields: [rewriteId], references: [id])
  targetAccountId  String
  targetAccount    DouyinAccount            @relation(fields: [targetAccountId], references: [id])
  publishedVideoId String
  publishedVideo   DouyinVideo              @relation(fields: [publishedVideoId], references: [id])
  organizationId   String
  organization     Organization             @relation(fields: [organizationId], references: [id])
  linkedAt         DateTime                 @default(now())
  status           RewritePublicationStatus @default(LINKED)
  createdAt        DateTime                 @default(now())
  updatedAt        DateTime                 @updatedAt

  @@unique([rewriteVersionId, status])
  @@unique([publishedVideoId, status])
  @@index([targetAccountId, status])
  @@index([organizationId, status])
  @@map("rewrite_publications")
}
```

> 实现时如果 Prisma 对带 `status` 的复合唯一约束不便表达“单条有效绑定”，可退化为：
> - `rewriteVersionId @unique`
> - `publishedVideoId @unique`
> - 解绑后直接删除绑定记录
>
> 但 service 层仍需对外暴露“逻辑解绑”的语义，并同步归档学习案例。

### 2.3 新增模型：RewriteLearningCase

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

model RewriteLearningCase {
  id                         String                         @id @default(cuid())
  rewriteVersionId           String                         @unique
  rewriteVersion             RewriteVersion                 @relation(fields: [rewriteVersionId], references: [id])
  rewriteId                  String
  rewrite                    Rewrite                        @relation(fields: [rewriteId], references: [id])
  publicationId              String
  publication                RewritePublication             @relation(fields: [publicationId], references: [id])
  targetAccountId            String
  targetAccount              DouyinAccount                  @relation(fields: [targetAccountId], references: [id])
  organizationId             String
  organization               Organization                   @relation(fields: [organizationId], references: [id])
  sourceBenchmarkVideoId     String?
  sourceTranscriptSnapshot   String?                        @db.LongText
  sourceAnnotationsSnapshot  Json                           @default("[]")
  generatedContentSnapshot   String?                        @db.LongText
  editedContentSnapshot      String?                        @db.LongText
  finalContentSnapshot       String                         @db.LongText
  usedFragmentSnapshot       Json                           @default("[]")
  metricsSnapshot            Json
  performanceScore           Int                            @default(0)
  embeddingText              String?                        @db.LongText
  embeddingJson              Json?
  embeddingStatus            RewriteLearningEmbeddingStatus @default(PENDING)
  status                     RewriteLearningCaseStatus      @default(ACTIVE)
  createdAt                  DateTime                       @default(now())
  updatedAt                  DateTime                       @updatedAt

  @@index([targetAccountId, status, performanceScore])
  @@index([organizationId, status])
  @@map("rewrite_learning_cases")
}
```

### 2.4 新增模型：DouyinAccountStyleProfile

```prisma
model DouyinAccountStyleProfile {
  id                String        @id @default(cuid())
  targetAccountId   String        @unique
  targetAccount     DouyinAccount @relation(fields: [targetAccountId], references: [id])
  organizationId    String
  organization      Organization  @relation(fields: [organizationId], references: [id])
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

### 2.5 现有模型扩展

#### RewriteVersion

新增字段：

```prisma
usedLearningCaseIds     Json    @default("[]")
learningContextSnapshot Json?
promptTemplateVersion   String?
publication             RewritePublication?
learningCase            RewriteLearningCase?
```

#### Rewrite

新增反向关联：

```prisma
publications  RewritePublication[]
learningCases RewriteLearningCase[]
```

#### DouyinVideo

新增反向关联：

```prisma
publications RewritePublication[]
```

#### DouyinAccount

新增反向关联：

```prisma
styleProfile   DouyinAccountStyleProfile?
publications   RewritePublication[]
learningCases  RewriteLearningCase[]
```

#### Organization

新增反向关联：

```prisma
rewritePublications      RewritePublication[]
rewriteLearningCases     RewriteLearningCase[]
douyinAccountStyleProfiles DouyinAccountStyleProfile[]
```

---

## 3. 后端设计

### 3.1 Repository

新增或改造：

1. `rewrite-publication.repository.ts`
2. `rewrite-learning-case.repository.ts`
3. `douyin-account-style-profile.repository.ts`
4. `vector-retrieval.repository.ts` 或同职责 service 抽象

保留并复用：

1. `video-rewrite-link.repository.ts` 的查询思路，但功能将迁移到 `RewritePublication`
2. `rewrite.repository.ts`
3. `video-snapshot.repository.ts`

### 3.2 Service

新增：

1. `rewrite-publication.service.ts`
2. `rewrite-learning-case.service.ts`
3. `douyin-account-style-profile.service.ts`
4. `rewrite-learning-retrieval.service.ts`

职责划分：

- `RewritePublicationService`
  - 绑定/解绑发布视频
  - 权限与可绑定校验
  - 触发学习案例与画像刷新

- `RewriteLearningCaseService`
  - 生成/刷新案例快照
  - 计算 `performanceScore`
  - 生成 embedding 文本
  - 更新 `embeddingStatus`

- `DouyinAccountStyleProfileService`
  - 基于有效案例重建画像
  - 样本不足时清空或保留空画像

- `RewriteLearningRetrievalService`
  - 构建本次查询向量文本
  - 执行 MySQL cosine similarity
  - 组合排序与裁剪 top-N
  - 未来对接 Qdrant 时作为统一入口

### 3.3 API

新增版本维度绑定接口：

1. `GET /api/rewrite-versions/[id]/publication`
2. `POST /api/rewrite-versions/[id]/publication`
3. `DELETE /api/rewrite-versions/[id]/publication`
4. `GET /api/rewrite-versions/[id]/publication/candidates`

返回统一遵循：

```typescript
{ success: boolean, data?: T, error?: { code: string, message: string } }
```

### 3.4 快照采集集成

在 `sync.service.ts` 的视频快照采集链路末尾：

1. 找出与当前视频相关的有效 `RewritePublication`
2. 刷新对应 `RewriteLearningCase`
3. 刷新账号画像

单条失败只打日志，不阻断整体快照任务。

---

## 4. 前端设计

### 4.1 仿写版本区域

需要同时覆盖：

1. `src/components/features/benchmarks/ai-rewrite-panel.tsx`
2. `src/components/features/rewrites/direct-create-panel.tsx`

在当前版本为 `COMPLETED` 时：

1. 展示“关联已发布视频”
2. 已绑定时展示视频摘要和核心指标
3. 支持解绑

### 4.2 候选视频选择弹框

可基于现有 `RewritePickerDialog` 模式新增：

1. `publication-video-picker-dialog.tsx`
2. 候选源为目标账号下视频
3. 展示封面、标题、发布时间和关键指标
4. 已被其他有效绑定的视频置灰

### 4.3 视频详情页

现有 `video-rewrite-link-section.tsx` 调整为“发布关联结果展示区”：

1. 显示关联到的仿写版本与状态
2. 支持从结果区解绑
3. 不再作为主绑定入口

### 4.4 DTO

新增：

1. `RewritePublicationDTO`
2. `RewritePublicationCandidateDTO`
3. `RewriteLearningSummaryDTO`

并在 `RewriteVersionDTO` 或对应页面模型中追加：

1. 当前绑定摘要
2. 学习状态摘要

---

## 5. 检索与 Prompt 设计

### 5.1 查询文本

用于 embedding / similarity 的查询文本由以下内容拼接：

1. 对标原文
2. 拆解摘要
3. 临时素材
4. 目标账号信息

### 5.2 案例排序

对候选案例计算：

```text
rankScore = similarity * 0.55
          + normalizedPerformanceScore * 0.35
          + recencyScore * 0.10
```

取 top 6。

### 5.3 Prompt 区块

在现有 Prompt 上追加：

```text
【目标账号历史风格画像】
...

【同账号历史高表现仿写案例】
案例 1 ...

【本次生成需继承的经验】
1. ...
2. ...
```

### 5.4 写回 RewriteVersion

生成前或生成时记录：

1. `usedLearningCaseIds`
2. `learningContextSnapshot`
3. `promptTemplateVersion = "rewrite-learning-v1"`

---

## 6. 实现阶段

### 阶段 1：Schema 与文档切换

1. 引入三个新模型和相关字段
2. 删除 `StyleExperience` 相关 schema 与依赖
3. 生成 Prisma migration

### 阶段 2：后端主链路

1. 发布绑定 API
2. 学习案例生成
3. 画像构建
4. MySQL 检索与 Prompt 注入

### 阶段 3：前端入口

1. 工作台版本区绑定
2. 直接创作版本区绑定
3. 视频详情结果区改造

### 阶段 4：回归与降级

1. 无案例回退
2. embedding 失败回退
3. 向量后端抽象和 MySQL fallback

---

## 7. 风险

| 风险 | 评级 | 缓解措施 |
|------|------|----------|
| 领域模型从轻量版升级，改动面较大 | High | 先统一 schema 与 service 边界，再逐层替换 |
| 老 `StyleExperience` 测试数据无法复用 | Medium | 本版本明确不迁移历史测试数据，允许重建 |
| MySQL 应用层 cosine similarity 性能有限 | Medium | 首版只按同账号过滤后计算，后续再切 Qdrant |
| Prompt 注入内容过长 | Medium | top 6 上限 + 内容摘要截断 |
| 画像生成质量不足 | Low | 画像生成失败不阻断主流程，且少于 2 条样本不注入 |
