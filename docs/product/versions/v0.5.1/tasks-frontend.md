# v0.5.1 前端任务 — 成长型 AI 仿写

## 必读文档

- `docs/product/versions/v0.5.1/requirements.md`
- `docs/product/versions/v0.5.1/technical-design.md`
- `docs/architecture/frontend.md`
- `docs/standards/ui-ux-system.md`

---

## 任务清单

### T10: 版本区域绑定入口

**文件**:

- `src/components/features/benchmarks/ai-rewrite-panel.tsx`
- `src/components/features/rewrites/direct-create-panel.tsx`

实现：

1. 当前版本 `COMPLETED` 时展示“关联已发布视频”
2. 已绑定时展示发布视频摘要、核心指标、解绑操作
3. 无绑定时展示空状态

### T11: 候选视频选择弹框

**文件**: `src/components/features/rewrites/publication-video-picker-dialog.tsx`（新建）

实现：

1. 拉取目标账号下候选视频
2. 按 `publishedAt desc` 展示
3. 展示封面、标题、发布时间、播放、点赞、评论、分享
4. 已被占用的视频置灰并提示原因

### T12: 版本绑定数据类型

**文件**: `src/types/...`

新增：

1. `RewritePublicationDTO`
2. `RewritePublicationCandidateDTO`
3. `RewriteLearningSummaryDTO`

并为版本视图模型补充：

1. 当前绑定摘要
2. 学习状态摘要

### T13: 视频详情展示区改造

**文件**: `src/components/features/accounts/video-rewrite-link-section.tsx`

改动：

1. 从“主绑定入口”改为“绑定结果展示区”
2. 显示关联的仿写版本、状态和摘要
3. 保留解绑入口

### T14: 交互反馈

实现统一反馈：

1. 无可关联视频空状态
2. 视频已被占用提示
3. 当前版本无可学习内容提示
4. 绑定成功 / 解绑成功 toast

### T15: 旧经验徽章清理

删除基于 `StyleExperience` 的旧展示逻辑，避免与新绑定/学习状态并存混淆。
