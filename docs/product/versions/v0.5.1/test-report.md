# v0.5.1 测试报告 — 经验反馈闭环（AI 风格训练）

> 测试日期: 2026-04-30
> 版本: v0.5.1
> 测试方式: 静态代码分析
> 测试依据: requirements.md §6 验收标准 + technical-design.md

---

## 摘要

- 测试功能数: 6（F-006-3 子功能块）
- 验收项总数: 27
- 通过: 25 ✅ / 警告: 1 ⚠️ / 失败: 1 ❌
- 构建检查：`type-check` ✅ `lint` ✅
- **结论: 需修复 ❌**（存在 1 项部署阻断性问题）

---

## 构建验证

| 项目 | 结果 | 备注 |
|------|------|------|
| `pnpm type-check` | ✅ 通过 | tsc --noEmit 无错误 |
| `pnpm lint` | ✅ 通过 | ESLint 无错误 |
| `pnpm build` | 未执行 | 静态分析阶段 |
| `pnpm db:push` | ⚠️ 开发环境 | 无 migration 文件（见 T-001）|

---

## 功能验收

### 验收标准 1 — 自动生成经验记录

**测试方式**: 代码逻辑 + 数据库 schema 静态验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `StyleExperience` 表已创建 | ✅ | db:push 成功，Prisma Client 已生成 |
| `upsertForVideo` 逻辑：无 VideoRewriteLink → 跳过 | ✅ | 早返回逻辑正确 |
| `upsertForVideo` 逻辑：无最终稿 → 跳过 | ✅ | isFinalVersion 判断正确 |
| `upsertForVideo` 逻辑：无 VideoSnapshot → 跳过 | ✅ | 快照不存在时 return |
| `upsertForVideo` 逻辑：条件全满足 → upsert | ✅ | Prisma upsert by `(rewriteId, videoId)` |
| 在 `runVideoSnapshotCollection` 末尾调用 | ✅ | sync.service.ts 已集成，try/catch 隔离 |
| 重复执行幂等（upsert 不重复创建） | ✅ | `@@unique([rewriteId, videoId])` 约束保证 |

### 验收标准 2 — 后续仿写引用历史经验

**测试方式**: 代码逻辑静态验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| rewrite-worker 在构建 prompt 后注入 few-shot | ✅ | Step 4.5 位置正确 |
| 查询同账号同组织的 top-3 经验 | ✅ | `findTopByAccountId` 按 qualityScore DESC |
| 格式化文本块包含账号名 + 播放/点赞 + 内容 | ✅ | `getFewShotExamples` 格式正确 |
| 注入到 user prompt 末尾（非 system prompt） | ✅ | `userPrompt = userPrompt + "\n\n" + fewShotBlock` |
| 注入失败（异常）不影响仿写流程 | ✅ | try/catch + console.warn，不阻断 |

### 验收标准 3 — 无历史经验时不注入

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 空经验列表时 `getFewShotExamples` 返回 null | ✅ | `if (experiences.length === 0) return null` |
| null 时不追加文本块 | ✅ | `if (fewShotBlock)` 保护 |

### 验收标准 4 — UI 展示经验状态

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `ExperienceSummaryDTO` 类型定义 | ✅ | `src/types/video-link.ts` 已添加 |
| `RewritePickerItemDTO` 包含 `experienceSummary` | ✅ | 类型已更新 |
| `/api/rewrites/mine` 返回 `experienceSummary` 字段 | ✅ | Service 层已追加字段 |
| 仿写选择器中显示"已积累经验"徽章 | ✅ | `rewrite-picker-dialog.tsx` 已更新 |
| 徽章含播放/点赞数据摘要 | ✅ | `${playsCount.toLocaleString()} · 赞 ${likesCount.toLocaleString()}` |
| 无经验时不显示徽章 | ✅ | `{item.experienceSummary ? (...) : null}` |

### 验收标准 5 — 数据隔离

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `StyleExperience` 含 `organizationId` 字段 | ✅ | Schema 设计正确 |
| `findTopByAccountId` 强制过滤 `organizationId` | ✅ | where 条件包含 organizationId |
| `findMineWithFinalVersion` 过滤 userId + organizationId | ✅ | 已有约束，未改动 |

### 验收标准 6 — 重复安全

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `@@unique([rewriteId, videoId])` 数据库约束 | ✅ | Prisma 唯一约束 |
| Prisma upsert 语义（update on conflict） | ✅ | `upsert` with `where: rewriteId_videoId` |

---

## 验收矩阵（补充核查）

### Schema 字段与关联完整性

| 检查项 | 状态 | 备注 |
|--------|------|------|
| `StyleExperience` 模型存在 | ✅ | schema.prisma 第 737 行 |
| `@@unique([rewriteId, videoId])` upsert 键 | ✅ | 幂等约束正确 |
| `videoId @unique`（一视频一经验） | ✅ | Prisma 一对一关系必需 |
| `@@index([accountId, qualityScore])` | ✅ | 查询性能索引 |
| `@@index([organizationId])` | ✅ | 数据隔离索引 |
| Organization 反向关联 | ✅ | schema 第 38 行 |
| DouyinAccount 反向关联 | ✅ | schema 第 187 行 |
| DouyinVideo 反向关联（一对一） | ✅ | schema 第 345 行 |
| Rewrite 反向关联 | ✅ | schema 第 674 行 |
| **数据库迁移文件** | ❌ | 无 migration SQL，见 T-001 |

### qualityScore 公式验证

设计规范：`playsCount + likesCount × 10 + commentsCount × 5 + sharesCount × 3`

实现（`style-experience.service.ts`）：
```typescript
return playsCount + likesCount * 10 + commentsCount * 5 + sharesCount * 3;
```
✅ 完全一致

### few-shot 注入格式验证

设计规范标题：`【账号历史优秀案例参考】`
实现：
```typescript
`【账号历史优秀案例参考】`
`以下是「${accountName}」账号的历史仿写优秀案例（按数据表现排序），供参考其风格：`
`案例 ${idx + 1}（播放 ${exp.playsCount.toLocaleString()}，点赞 ${exp.likesCount.toLocaleString()}）：`
```
✅ 与 requirements.md §3.2 完全一致

---

## 问题列表

### [T-001] 缺少 Prisma 迁移文件 ❌

- **严重度**: High（**生产部署阻断**）
- **位置**: `prisma/migrations/`
- **描述**: `style_experiences` 表仅通过 `pnpm db:push` 推送到开发数据库，无对应 migration SQL。当前最新迁移为 `20260430000000_add_video_rewrite_link`，不含 StyleExperience 表结构。
- **预期**: 存在 migration 文件（如 `20260430010000_add_style_experience/migration.sql`），可通过 `pnpm db:migrate` 在生产部署
- **实际**: 无 migration 文件，生产环境部署后数据库无 `style_experiences` 表，所有经验相关功能运行时报错
- **修复方式**: 执行 `pnpm db:migrate --name add_style_experience` 生成迁移文件并提交

---

### [T-002] 经验徽章实现位置与技术设计不符 ⚠️

- **严重度**: Low（非阻断，UX 可接受）
- **位置**: `src/components/features/rewrites/direct-create-panel.tsx`（缺失）
- **描述**: 技术设计 §4.3 指定在 `direct-create-panel.tsx` 展示经验徽章，但该组件是单一仿写创建面板，无仿写卡片列表。实现放在了 `src/components/features/accounts/rewrite-picker-dialog.tsx`（视频关联选择器弹框）。
- **预期**: 技术设计指定组件（`direct-create-panel.tsx`）
- **实际**: `rewrite-picker-dialog.tsx`，场景合理（用户选择仿写时看到经验标签），但与文档不符
- **建议**: 产品/技术负责人确认实现位置是否符合产品意图。若认可，需更新技术设计文档

---

## 已知限制（不在本版本范围）

- 经验列表管理页面（手动删除/编辑）未实现
- 历史仿写数据未做批量经验初始化
- few-shot 内容长度无截断（大文案可能占用较多 token）

---

## 测试结论

**本版本不可直接合并到生产** ❌

| # | 问题 | 严重度 | 是否阻断 |
|---|------|--------|---------|
| T-001 | 缺少 Prisma 迁移文件 | High | ✅ 是 |
| T-002 | 经验徽章组件位置与技术设计不符 | Low | ❌ 否 |

**T-001 修复后可重新评估合并**。T-002 建议提交产品确认，不阻断版本发布。
