# v0.5.1 需求文档 — 成长型 AI 仿写

> 版本: v0.5.1
> 里程碑: v0.5.x（成长型 AI 创作闭环）
> 创建日期: 2026-04-30
> 依赖版本: v0.5.0（视频数据趋势图 + 视频-文案关联）

---

## 1. 版本定位

v0.5.1 在现有 AI 仿写基础上，补齐“采用稿发布反馈 -> 账号学习 -> 下次生成注入”的闭环。

本版本不改变用户从对标视频进入 AI 工作台的主路径，也不改变单次生成一个 `RewriteVersion` 的交互。新增的是后台学习能力、账号级风格画像和轻量发布绑定入口，使目标账号的仿写质量可以随案例积累持续提升。

> 说明：本版本正式范围以本文档为准，替代此前仅围绕 `StyleExperience` 的轻量方案。

---

## 2. 用户目标

### 2.1 员工

1. 我希望把某个 AI 仿写版本和我真实发布的视频绑定起来，让系统知道这篇稿子最终发布后的表现。
2. 我希望下一次给同一个账号仿写时，AI 能参考该账号过去表现好的仿写案例，而不是每次都重新猜风格。
3. 我希望绑定发布视频的操作足够轻，不影响当前写稿流程。
4. 我希望绑定错了可以解绑，避免错误样本污染账号风格。

### 2.2 管理者

1. 我希望系统的数据闭环能沉淀账号级经验，降低员工重复试错。
2. 我希望第一版不引入自动发布风险。
3. 我希望后续可以基于这些案例扩展自动评分、候选推荐、提示词优化和模型优化。

---

## 3. 核心原则

1. **数据为主**：学习效果主要来自真实发布数据，而不是人工主观评分。
2. **人工为辅**：第一版人工只负责绑定和纠错。
3. **样本纯净**：只学习已绑定的仿写案例，不从普通历史视频冷启动。
4. **隐式生效**：账号画像后台使用，不在第一版增加学习看板。
5. **可追溯**：每次生成记录使用过的画像、案例、Prompt 版本和模型。
6. **可回退**：无案例、embedding 失败或向量检索不可用时，仿写生成仍按现有逻辑可用。
7. **单一事实源**：本版本以 `RewritePublication` / `RewriteLearningCase` / `DouyinAccountStyleProfile` 为正式领域模型，不再新增第二套经验模型并存。

---

## 4. 核心概念

| 概念 | 说明 |
|------|------|
| `RewritePublication` | 仿写版本与真实发布视频的绑定记录 |
| `RewriteLearningCase` | 可被检索、注入 Prompt 的账号级学习案例 |
| `DouyinAccountStyleProfile` | 由多个学习案例聚合而成的账号风格画像 |
| 最终稿 | `RewriteVersion.editedContent ?? RewriteVersion.generatedContent` |
| 有效案例 | `RewriteLearningCase.status = ACTIVE` 的案例 |
| 学习上下文 | 画像摘要 + 检索出的历史案例 + 本次继承经验摘要 |

---

## 5. 功能清单

### F-050-A: 发布视频绑定（P0）

**描述**：用户可以将一个已完成的 `RewriteVersion` 绑定到目标账号下已同步的真实 `DouyinVideo`。

#### 入口

在仿写版本区域中，当当前版本状态为 `COMPLETED` 时展示“关联已发布视频”操作。

- 工作台仿写：AI 工作台右侧版本面板
- 直接创作：直接创作页面的版本面板

视频详情页保留关联结果展示与解绑能力，但不再作为主绑定入口。

#### 可绑定条件

1. 当前版本状态为 `COMPLETED`。
2. 当前版本所属 `Rewrite.targetAccountId` 不为空。
3. 可选视频必须属于该 `targetAccountId`。
4. 可选视频必须未被其他有效发布绑定占用。
5. 当前用户必须有该目标账号权限。
6. 当前版本必须存在可学习的最终稿内容。

#### 交互

1. 用户点击“关联已发布视频”。
2. 打开弹框，展示目标账号下已同步视频列表。
3. 列表按 `publishedAt desc` 排序。
4. 每项展示封面、标题、发布时间、播放、点赞、评论、分享。
5. 用户选择一个视频并确认。
6. 系统创建或更新 `RewritePublication`。
7. 系统异步生成或刷新 `RewriteLearningCase`。
8. 当前版本区域展示已关联视频摘要。

#### 解绑

已绑定版本展示“解除关联”操作。用户确认后：

1. `RewritePublication.status` 置为 `UNLINKED`。
2. 对应 `RewriteLearningCase.status` 置为 `ARCHIVED`。
3. 系统重建该账号 `DouyinAccountStyleProfile`。
4. 当前版本恢复可绑定状态。

---

### F-050-B: 学习案例沉淀（P0）

**描述**：每次绑定真实发布视频后，系统把仿写版本沉淀为账号级学习案例。

#### 案例内容

`RewriteLearningCase` 至少包含：

1. `rewriteVersionId`
2. `rewriteId`
3. `targetAccountId`
4. `organizationId`
5. `sourceBenchmarkVideoId`
6. `publishedVideoId`
7. `sourceTranscriptSnapshot`
8. `sourceAnnotationsSnapshot`
9. `generatedContentSnapshot`
10. `editedContentSnapshot`
11. `finalContentSnapshot`
12. `usedFragmentSnapshot`
13. `metricsSnapshot`
14. `performanceScore`
15. `embeddingText`
16. `embeddingJson`
17. `embeddingStatus`
18. `status`

#### 最终稿规则

`finalContentSnapshot = editedContent ?? generatedContent`

如果最终稿为空，绑定接口返回 400，提示“当前版本没有可学习的文案内容”。

#### 指标快照

指标快照来自 `DouyinVideo` 和 `VideoSnapshot`：

1. 当前播放、点赞、评论、分享、收藏、赞赏、推荐。
2. 最新快照时间。
3. 首个快照到最新快照的播放增长。
4. 点赞率、评论率、分享率、收藏率。

#### 刷新时机

1. 绑定成功后立即尝试生成或刷新案例。
2. 后续视频快照采集任务继续刷新已绑定案例的指标与分数。
3. 解绑后该案例不再参与后续生成。

---

### F-050-C: 表现分计算（P0）

**描述**：系统为每个学习案例计算 `performanceScore`，用于后续案例检索排序。

#### 分数范围

`performanceScore` 为 `0-100` 的整数。

#### 输入指标

1. `playCount`
2. `likeCount`
3. `commentCount`
4. `shareCount`
5. `collectCount`
6. `admireCount`
7. `recommendCount`
8. 快照播放增长
9. 发布时间距当前的时间衰减

#### 账号内样本不足时

当同一 `targetAccountId` 有效学习案例少于 `5` 条时，使用平滑后的绝对互动率计算：

```text
score = basePlayScore * 0.30
      + engagementRateScore * 0.45
      + shareCollectScore * 0.20
      + growthScore * 0.05
```

#### 账号内样本充足时

当有效学习案例不少于 `5` 条时，使用账号内分位归一化：

1. 播放量按账号内分位。
2. 互动率按账号内分位。
3. 分享收藏率按账号内分位。
4. 近期增长按账号内分位。

---

### F-050-D: 向量 RAG 检索（P0）

**描述**：每次生成仿写前，系统根据本次对标原文、拆解、临时素材和目标账号，从历史学习案例中检索相似高表现案例。

#### 本版本交付范围

本版本正式交付 **MySQL 检索主链路**。`Qdrant` 作为后续可选后端，仅保留抽象与降级策略，不要求本轮打通。

#### MySQL 检索

1. embedding 存储为 JSON。
2. 应用层读取同账号有效案例。
3. 使用 cosine similarity 计算相似度。
4. 与 `performanceScore`、时间衰减组合排序。

#### 预留的可选后端

当未来启用 `REWRITE_VECTOR_BACKEND=qdrant` 时：

1. collection 名称为 `rewrite_learning_cases`
2. payload 包含 `organizationId`、`targetAccountId`、`caseId`、`performanceScore`、`status`
3. 检索必须按 `organizationId` 和 `targetAccountId` 过滤

#### 检索数量

每次生成最多注入 `6` 个案例。

排序公式：

```text
rankScore = similarity * 0.55
          + normalizedPerformanceScore * 0.35
          + recencyScore * 0.10
```

---

### F-050-E: 账号风格画像（P0）

**描述**：系统按目标账号聚合有效学习案例，生成隐式 `DouyinAccountStyleProfile`。

#### 画像字段

1. `summary`
2. `toneKeywords`
3. `structurePatterns`
4. `openingPatterns`
5. `ctaPatterns`
6. `avoidPatterns`
7. `sampleCount`
8. `lastBuiltAt`

#### 更新触发

1. 绑定发布视频成功后
2. 解绑发布视频成功后
3. 学习案例指标刷新后

#### 可用条件

有效学习案例数大于等于 `2` 条时生成画像。少于 `2` 条时保留空画像，下次生成只注入案例，不注入画像摘要。

---

### F-050-F: 仿写生成增强（P0）

**描述**：`RewriteWorker` 在构建 Prompt 时注入学习上下文。

#### 新增 Prompt 区块

1. `【目标账号历史风格画像】`
2. `【同账号历史高表现仿写案例】`
3. `【本次生成需继承的经验】`

#### 生成规则

1. 保持现有对标原文、拆解、观点、临时素材区块。
2. 有画像时注入画像摘要。
3. 有案例时按排序注入最多 `6` 个案例。
4. 每个案例包含原文案摘要、拆解摘要、最终发布文案、关键指标和表现分。
5. 明确要求模型学习结构和表达规律，不复制历史文案原句。

#### 快照记录

创建或完成 `RewriteVersion` 时记录：

1. `usedLearningCaseIds`
2. `learningContextSnapshot`
3. `promptTemplateVersion = "rewrite-learning-v1"`

---

## 6. 页面流程

```text
用户生成仿写版本
  -> 用户编辑最终稿
  -> 用户发布到抖音
  -> 系统同步目标账号视频
  -> 用户回到仿写版本
  -> 点击关联已发布视频
  -> 选择真实 DouyinVideo
  -> 后台生成学习案例和画像
  -> 下一次同账号仿写自动读取学习上下文
```

---

## 7. 空状态与错误提示

1. 目标账号无已同步视频：弹框展示“该账号暂无可关联视频，请先同步账号视频”
2. 视频已被其他版本绑定：该视频置灰并展示“已被其他仿写版本关联”
3. 当前版本无内容：接口返回 400，前端展示“当前版本没有可学习的文案内容”
4. embedding 生成失败：学习案例保留，`embeddingStatus=FAILED`，不影响绑定成功
5. 向量检索后端不可用：后端降级 MySQL 检索，并记录错误日志

---

## 8. 验收标准

1. 已完成的仿写版本可以绑定目标账号下已同步视频。
2. 绑定后版本区域展示发布视频摘要和核心指标。
3. 解绑后学习案例不再参与下一次生成。
4. 绑定成功后生成 `RewriteLearningCase`。
5. 有效案例满足条件后生成 `DouyinAccountStyleProfile`。
6. 同账号再次仿写时，生成上下文包含历史案例快照。
7. 无学习案例时，仿写功能保持现有行为。
8. MySQL 向量检索可按同账号隔离案例。
9. 预留的向量后端不可用时不阻塞仿写主链路。
10. 文档定义的能力在后端和前端任务文档中都有承接。

---

## 9. 范围界定（不在本版本）

1. 不实现经验的手动编辑/删除管理页面
2. 不实现学习案例的独立看板
3. 不实现真实 Qdrant 接入与运维配置
4. 不对现有历史仿写做批量数据迁移或初始化
