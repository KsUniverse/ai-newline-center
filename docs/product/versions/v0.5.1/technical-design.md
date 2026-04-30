# v0.5.1 技术设计 — 经验反馈闭环（AI 风格训练）

> 版本: v0.5.1
> 设计日期: 2026-04-30
> 依赖文档: requirements.md

## 必读文档（后端、评审、测试）

- `docs/product/versions/v0.5.1/requirements.md`
- `docs/architecture/OVERVIEW.md`
- `docs/architecture/backend.md`
- `docs/standards/coding-standards.md`
- `docs/standards/review-checklist.md`
- `prisma/schema.prisma`（关注 StyleExperience 新增模型）
- `src/lib/rewrite-worker.ts`（few-shot 注入改动）
- `src/server/services/sync.service.ts`（experience 生成触发点）

---

## 1. 架构决策

### 1.1 StyleExperience 绑定维度

绑定到**账号（DouyinAccount）**维度，非 User 维度。  
PRD 明确："风格维度绑定到抖音账号（非员工）"。一个员工可管理多个账号，各账号风格独立。

### 1.2 经验生成触发点

在 `sync.service.ts` 的 `runVideoSnapshotCollection()` 末尾，遍历已同步快照的 myVideos，对满足条件（有关联仿写 + 有最终稿 + 有快照）的视频调用 `styleExperienceService.upsertForVideo(videoId)`。

**不在关联时触发**：关联时视频可能没有快照数据，经验缺乏数据表现无意义。

### 1.3 few-shot 注入位置

注入到 **user prompt** 末尾（追加区块）。System prompt 表达角色定位，user prompt 携带上下文数据，few-shot 示例属于上下文数据。

### 1.4 经验条数

每次注入最多 **3 条**，按 `qualityScore` 降序排序。

### 1.5 质量评分算法

```
qualityScore = playsCount + (likesCount × 10) + (commentsCount × 5) + (sharesCount × 3)
```

不做归一化；作为相对排序分值，直接降序取 top-N。

---

## 2. 数据库设计

### 2.1 新增模型：StyleExperience

```prisma
model StyleExperience {
  id             String        @id @default(cuid())
  accountId      String
  account        DouyinAccount @relation(fields: [accountId], references: [id])
  rewriteId      String
  rewrite        Rewrite       @relation(fields: [rewriteId], references: [id])
  videoId        String
  video          DouyinVideo   @relation(fields: [videoId], references: [id])
  aiContent      String        @db.Text
  finalContent   String        @db.Text
  playsCount     Int
  likesCount     Int
  commentsCount  Int
  sharesCount    Int
  qualityScore   Float
  organizationId String
  organization   Organization  @relation(fields: [organizationId], references: [id])
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@unique([rewriteId, videoId])
  @@index([accountId, qualityScore])
  @@index([organizationId])
  @@map("style_experiences")
}
```

**唯一约束** `(rewriteId, videoId)` 确保 upsert 语义的幂等性。

### 2.2 反向关联（需同步修改的模型）

- `DouyinAccount` → `styleExperiences StyleExperience[]`
- `Rewrite` → `styleExperiences StyleExperience[]`
- `DouyinVideo` → `styleExperience StyleExperience?`（一视频一经验）
- `Organization` → `styleExperiences StyleExperience[]`

---

## 3. 后端实现清单

### 3.1 Prisma Schema

**文件**: `prisma/schema.prisma`  
**改动**: 添加 `StyleExperience` 模型 + 四个模型的反向关联字段

**数据库同步**: `pnpm db:push`（开发环境）

### 3.2 Repository

**文件**: `src/server/repositories/style-experience.repository.ts`（新建）

| 方法 | 签名 | 说明 |
|------|------|------|
| `upsert` | `(data: UpsertData, db?) => Promise<StyleExperience>` | 按 rewriteId+videoId 唯一约束 upsert |
| `findTopByAccountId` | `(accountId, organizationId, limit, db?) => Promise<StyleExperience[]>` | 按 qualityScore 降序取 top-N |
| `findByRewriteId` | `(rewriteId, db?) => Promise<StyleExperience \| null>` | 检查某仿写是否有经验（供 API 使用） |

### 3.3 Service

**文件**: `src/server/services/style-experience.service.ts`（新建）

| 方法 | 说明 |
|------|------|
| `upsertForVideo(videoId)` | 核心逻辑：查询 VideoRewriteLink → 最终稿 → 最新 Snapshot → 计算分值 → upsert |
| `getFewShotExamples(accountId, organizationId, limit)` | 供 rewrite-worker 调用，返回格式化文本或 null |

### 3.4 Sync Service 集成

**文件**: `src/server/services/sync.service.ts`  
**改动**: 在 `runVideoSnapshotCollection()` 末尾，对 myVideos 批量调用 `styleExperienceService.upsertForVideo`

```typescript
// 伪代码
for (const video of myVideos) {
  try {
    await styleExperienceService.upsertForVideo(video.id);
  } catch (error) {
    console.error("Failed to generate style experience:", { videoId: video.id, error });
  }
}
```

### 3.5 Rewrite Worker 集成

**文件**: `src/lib/rewrite-worker.ts`  
**改动**: 在构建 userPrompt 后、调用 AI 前，注入 few-shot 区块

```typescript
// 伪代码
const fewShotBlock = await styleExperienceService.getFewShotExamples(
  targetAccount.id,
  callerOrganizationId, // 通过 version.rewrite.organizationId 获取
  3,
);
if (fewShotBlock) {
  userPrompt = userPrompt + "\n\n" + fewShotBlock;
}
```

`getFewShotExamples` 返回格式化文本块或 `null`（无经验时）。

### 3.6 Rewrite Service + Repository 更新（用于前端展示）

**文件**: `src/server/repositories/rewrite.repository.ts`  
**改动**: `findMineWithFinalVersion` 增加 `styleExperiences` include（取最新一条）

**文件**: `src/server/services/rewrite.service.ts`  
**改动**: `listMineWithFinalVersion` 响应中追加 `experienceSummary` 字段

---

## 4. 前端实现清单

### 4.1 类型定义

**文件**: `src/types/video-link.ts`（追加）  
新增 `RewriteListItemDTO` 类型（含 `experienceSummary` 字段）

### 4.2 仿写列表 API（已有）

`/api/rewrites/mine` 返回数据追加 `experienceSummary` 字段：
```typescript
experienceSummary: {
  playsCount: number;
  likesCount: number;
} | null
```

### 4.3 "直接创作"面板

**文件**: `src/components/features/rewrites/direct-create-panel.tsx`  
**改动**: 在仿写卡片区域，若 `experienceSummary` 存在则显示经验徽章

---

## 5. 接口契约

本版本不新增独立 API 端点。经验信息通过现有的 `/api/rewrites/mine` 扩展字段传递。

---

## 6. 数据流图

```
[定时器 10min]
    ↓
runVideoSnapshotCollection()
    ↓ (遍历 myVideos)
upsertForVideo(videoId)
    ↓ 查 VideoRewriteLink
    ↓ 查 isFinalVersion RewriteVersion
    ↓ 查最新 VideoSnapshot
    ↓ 计算 qualityScore
    ↓ upsert StyleExperience

[用户发起仿写]
    ↓
RewriteWorker.process()
    ↓ 构建 systemPrompt + userPrompt
    ↓ styleExperienceService.getFewShotExamples(accountId)
    ↓ 追加 few-shot 块到 userPrompt
    ↓ aiGateway.generateRewrite()

[仿写列表页加载]
    ↓
GET /api/rewrites/mine
    ↓ findMineWithFinalVersion(包含 styleExperiences)
    ↓ 返回 experienceSummary
    ↓ 前端显示"已积累经验"徽章
```

---

## 7. 任务拆分

详见 `tasks-backend.md` 和 `tasks-frontend.md`。

---

## 8. 技术风险

| 风险 | 评级 | 缓解措施 |
|------|------|----------|
| 快照定时器中经验生成失败影响主流程 | Low | try/catch 包裹，只记录日志不抛出 |
| rewriteWorker 注入 few-shot 后 token 超限 | Low | 3 条上限 + 内容前 500 字截断（可选，当前版本不做） |
| upsert 并发写入冲突 | Very Low | 唯一约束保证幂等，Prisma upsert 使用 `@@unique` |
