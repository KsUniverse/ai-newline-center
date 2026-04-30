# v0.5.1 测试报告 — 经验反馈闭环（AI 风格训练）

> 测试日期: 2026-04-30
> 版本: v0.5.1
> 测试依据: requirements.md §6 验收标准

---

## 构建验证

| 项目 | 结果 |
|------|------|
| `pnpm type-check` | ✅ 通过，无类型错误 |
| `pnpm lint` | ✅ 通过，无 lint 错误 |
| `pnpm build` | ✅ 通过，所有路由正常编译 |
| `pnpm db:push` | ✅ `style_experiences` 表已创建，约束生效 |

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

## 已知限制（不在本版本范围）

- 经验列表管理页面（手动删除/编辑）未实现
- 历史仿写数据未做批量经验初始化
- few-shot 内容长度无截断（大文案可能占用较多 token）

---

## 测试结论

**验收通过** ✅

所有 6 条验收标准均通过代码静态验证和构建验证。v0.5.1 可进入 Release 流程。
