# v0.3.1.1 Changelog

> 版本: v0.3.1.1
> 最后更新: 2026-04-10

## 摘要

v0.3.1.1 的核心功能——**单视频详情层内的人工划句批注拆解**——已在 v0.3.1 的工作台重构中一并交付，无需单独版本发布。本 changelog 记录 v0.3.1.1 规划内容的最终落地状态，以及与原需求的差异。

---

## 已交付内容

### 1. 手动划句批注系统（划句拆解核心）

**交付形式**：融合在 v0.3.1 的 `AiWorkspaceShell` 工作台中，不单独开列版本节点。

**前端**：
- `AiWorkspaceDecompositionPanel`：拆解面板，支持用户在转录文案上选中文本后输入拆解说明并保存为批注
- 文本高亮联动：选区清晰可见，批注内容用于后续仿写引用
- 批注列表：在面板下方展示已创建的所有批注，点击可聚焦高亮对应选区
- 从拆解阶段进入仿写阶段：点击"进入仿写"按钮，工作台切换到仿写视图并保留批注列表作参考

**后端**：
- `AiDecompositionAnnotation` 数据模型：包含 `quotedText`、`startOffset`、`endOffset`、`function`、`purpose`、`technique`、`note` 等结构化字段
- `POST /api/ai-workspaces/{id}/annotations`：保存新批注
- `PATCH /api/ai-workspaces/{id}/annotations/{annotationId}`：更新批注
- `DELETE /api/ai-workspaces/{id}/annotations/{annotationId}`：删除批注
- 批注保存后工作台状态自动更新为 `DECOMPOSED`

### 2. 仿写阶段草稿占位（rewrite scaffold）

- `AiWorkspaceRewriteStage`：仿写区展示转录原文对照 + 拆解批注列表 + 手动草稿编辑框（`textarea`）
- `PATCH /api/ai-workspaces/{id}/rewrite-draft`：保存/更新手动草稿，debounce 500ms 自动保存
- `AiRewriteDraft` 数据模型：包含 `currentDraft`、`sourceTranscriptText`、`sourceDecompositionSnapshot`

---

## 与原需求的差异（已知简化）

| 原计划（requirements.md） | 实际交付 | 说明 |
|--------------------------|----------|------|
| AI 自动触发拆解（用户点击"AI 拆解"，AI 自动标注文案） | **未实现**，改为全人工划句 | AI 自动拆解能力顺延，不属于本版交付 |
| 大尺寸详情弹框/重型详情层承载 | 在全局 AI 工作台（`AiWorkspaceShell`）中实现 | 实现形式更完整 |
| AI 拆解输入优先级（editedText / originalText） | 在工作台当前文本基础上批注，逻辑等价 | 以 `currentText` 为基准 |

**注**：AI 自动拆解（F-003-2 中的 AI 触发部分）后续可作为单独能力补充，当前以人工划句批注替代，已满足核心拆解业务流程需求。

---

## 基础设施变更（同期，非功能版本）

以下变更发生在 v0.3.1 正式交付后，属于基础设施升级，不纳入功能版本号：

- **数据库迁移**：从 PostgreSQL 迁移至 MySQL 8.0，适配宝塔/VPS 部署环境
- **OSS 服务**：新增阿里云 OSS 文件服务层（`OssService`），用于视频/封面文件存储与 CDN 访问
- **部署包优化**：清理冗余部署脚本，改用 `ecosystem.config.cjs` + `pnpm` 打包流程

---

## 验证状态

- `pnpm lint` 通过
- `pnpm type-check` 通过
- 手动验证：工作台划句批注保存、批注联动高亮、进入仿写阶段、仿写草稿自动保存
