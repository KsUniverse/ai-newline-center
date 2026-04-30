# v0.5.1 需求文档 — 经验反馈闭环（AI 风格训练）

> 版本: v0.5.1
> 里程碑: v0.5.x（发布复盘）
> 创建日期: 2026-04-30
> 依赖版本: v0.5.0（视频-文案关联 VideoRewriteLink + 视频快照 VideoSnapshot）

---

## 1. 版本定位

v0.5.1 实现 PRD M-006 发布复盘的最后一个功能点：
- **F-006-3**: 经验反馈闭环（AI 风格训练）

将"AI 仿写稿 + 人工最终修正稿 + 视频发布数据"三者打通，构成账号维度的学习经验，让后续同账号的仿写自动注入历史优秀案例（few-shot learning）。

---

## 2. 核心概念

| 概念 | 说明 |
|------|------|
| **StyleExperience** | 经验记录：一条绑定到账号的 few-shot 示例 |
| **AI 原稿** | `RewriteVersion.generatedContent`（AI 生成的原始文案） |
| **人工最终稿** | `RewriteVersion.editedContent` or `generatedContent`（`isFinalVersion=true` 的版本内容） |
| **数据表现摘要** | 视频关联后最新 `VideoSnapshot` 的播放/点赞/评论/转发数字 |
| **质量评分** | 基于播放量的简单归一化分值（见 §5） |

---

## 3. F-006-3：经验反馈闭环

### 3.1 经验记录自动生成

**触发时机**：视频快照采集任务（每 10 分钟一次）完成时，对"已关联仿写且有最终稿"的视频触发经验生成。

> **决策 A — 触发时机**
> 选择方案：**有 VideoSnapshot 后自动生成/更新**（非关联时立即生成）
> 理由：关联时可能视频还没有快照数据，应以"有数据"为条件才有意义。快照采集定时器是天然的触发点，重复执行时使用 upsert 语义，避免重复创建。

**触发条件**（需同时满足）：
1. `DouyinVideo` 有 `VideoRewriteLink`（已关联仿写）
2. 对应 `Rewrite` 有 `isFinalVersion=true` 的 `RewriteVersion`
3. 该视频有至少一条 `VideoSnapshot` 记录

**生成动作**：
- 取最新 `VideoSnapshot` 数据作为数据表现摘要
- 用最终稿版本的内容（`editedContent ?? generatedContent`）作为人工修正稿
- 用同一版本的 `generatedContent` 作为 AI 原稿
- 计算质量评分（见 §5）
- upsert `StyleExperience`（若已存在则更新数据表现摘要和评分）

### 3.2 few-shot 注入

**注入时机**：仿写 Worker 生成 Prompt 时

> **决策 B — Prompt 注入位置**
> 选择方案：**注入到 user prompt 中**（非 system prompt）
> 理由：few-shot 示例是上下文内容，放 system prompt 会使其变成"永久背景指令"，语义上不准确；user prompt 中的历史示例更符合 few-shot 的语义，且易于控制格式和数量。

**注入逻辑**：
1. 从 `StyleExperience` 中查询同账号的历史经验
2. 按质量评分降序取前 **3 条**（`§5` 中说明选择 3 条的原因）
3. 格式化为文本块，追加到 user prompt 末尾

> **决策 C — 经验条数**
> 选择方案：**3 条**
> 理由：few-shot 示例过少（1 条）效果有限；过多（5 条+）占用大量 token 且可能引入噪音；3 条是经验平衡点，足以展示风格多样性，token 成本可控。

**注入格式**：
```
【账号历史优秀案例参考】
以下是「{账号名称}」账号的历史仿写优秀案例（按数据表现排序），供参考其风格：

案例 1（播放 {playsCount}，点赞 {likesCount}）：
{finalContent}

案例 2（播放 {playsCount}，点赞 {likesCount}）：
{finalContent}

案例 3（播放 {playsCount}，点赞 {likesCount}）：
{finalContent}
```

若没有历史经验，则不注入该区块。

### 3.3 经验状态展示（前端）

**位置**：仿写任务列表页的仿写卡片 / 仿写详情区域（已有的仿写列表页）

**展示内容**：
- 若该仿写已生成经验记录：显示 `已积累经验` 标签 + 数据摘要（播放数/点赞数）
- 若该仿写未生成经验：不显示（不显示"无经验"提示，减少噪音）

**位置约定**：在仿写列表页的每条仿写卡片上，若对应 `VideoRewriteLink` 存在且 `StyleExperience` 已生成，则在卡片底部展示一行数据摘要标签。

---

## 4. 数据模型

### StyleExperience

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| accountId | String | 抖音账号 ID（风格维度绑定到账号） |
| rewriteId | String | 仿写任务 ID |
| videoId | String | 视频 ID（来源于 VideoRewriteLink） |
| aiContent | Text | AI 生成原稿 |
| finalContent | Text | 人工最终稿（editedContent ?? generatedContent） |
| playsCount | Int | 视频播放数（来自最新 VideoSnapshot） |
| likesCount | Int | 点赞数 |
| commentsCount | Int | 评论数 |
| sharesCount | Int | 转发数 |
| qualityScore | Float | 质量评分（归一化分值） |
| organizationId | String | 组织 ID（数据隔离） |
| createdAt | DateTime | — |
| updatedAt | DateTime | — |

**唯一约束**：`(rewriteId, videoId)` — 一个仿写+视频组合只有一条经验记录（防止重复）

---

## 5. 质量评分策略

采用简单线性归一化方式，以播放量为主要权重：

```
qualityScore = playsCount + (likesCount * 10) + (commentsCount * 5) + (sharesCount * 3)
```

> 说明：这是原始加权分，用于相对排序。不做归一化到 [0,1] 区间（避免需要全量数据上下文），排序时直接用此分值降序即可。

---

## 6. 验收标准

| # | 验收项 | 说明 |
|---|--------|------|
| 1 | 自动生成经验 | 视频有关联仿写 + 最终稿 + VideoSnapshot，快照采集触发后自动创建 StyleExperience |
| 2 | 经验注入 Prompt | 后续同账号仿写 Worker 生成 Prompt 时，自动注入历史 3 条优秀经验（按质量评分降序） |
| 3 | 无经验不注入 | 若账号无历史经验，Prompt 无注入块，不影响现有仿写流程 |
| 4 | UI 展示 | 仿写列表页卡片中，已有经验的仿写显示"已积累经验"标签及数据摘要 |
| 5 | 数据隔离 | StyleExperience 查询强制过滤 organizationId |
| 6 | 重复安全 | 快照定时器多次触发时，upsert 语义保证不重复创建记录 |

---

## 7. 范围界定（不在本版本）

- 不实现经验的手动编辑/删除 UI
- 不实现经验列表管理页面
- 不实现自动经验评分的后台调整功能
- 不对现有仿写历史做批量经验初始化（只对新产生的快照触发）
