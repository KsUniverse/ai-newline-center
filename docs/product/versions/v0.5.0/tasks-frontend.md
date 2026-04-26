# v0.5.0 前端开发文档 - 成长型 AI 仿写

## 必读文档

- `docs/product/versions/v0.5.0/background.md`
- `docs/product/versions/v0.5.0/requirements.md`
- `docs/product/versions/v0.5.0/technical-design.md`
- `docs/product/versions/v0.3.3/tasks-frontend.md`
- `docs/architecture/frontend.md`
- `docs/standards/ui-ux-system.md`

---

## 摘要

前端目标是在现有 AI 仿写面板中增加“关联已发布视频”的轻量闭环入口，并展示当前版本的发布绑定状态。第一版不展示完整账号画像，不新增学习看板。

任务总数: 7

---

## FE-001: 类型与 API Client 对齐

**文件**

- 修改: `src/types/ai-workspace.ts`
- 新增: `src/types/rewrite-learning.ts`
- 修改: 现有 API 调用处的泛型引用

**内容**

新增 `RewritePublicationDTO`，并在 `RewriteVersionDTO` 中增加：

```typescript
publication: RewritePublicationDTO | null;
usedLearningCaseIds: string[];
```

新增请求类型：

```typescript
export interface LinkPublishedVideoInput {
  douyinVideoId: string;
}
```

**验证**

- `AiRewritePanel` 能读取 `activeVersion.publication`。
- `pnpm type-check` 无类型错误。

---

## FE-002: 发布视频选择弹框

**文件**

- 新增: `src/components/features/benchmarks/rewrite-published-video-picker.tsx`

**组件接口**

```typescript
interface RewritePublishedVideoPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetAccountId: string;
  selectedVideoId: string | null;
  onConfirm: (douyinVideoId: string) => void;
}
```

**内容**

1. 打开时调用 `/douyin-accounts/${targetAccountId}/videos?page=1&limit=20`。
2. 展示视频封面、标题、发布时间、播放、点赞、评论、分享。
3. 支持分页加载。
4. 单选视频。
5. 无视频时展示“该账号暂无可关联视频，请先同步账号视频”。
6. 点击确认后回传 `douyinVideoId`。

**交互约束**

- 弹框内不做发布动作。
- 不展示其他账号视频。
- loading、error、empty 三种状态必须齐全。

---

## FE-003: 版本发布状态展示

**文件**

- 修改: `src/components/features/benchmarks/ai-rewrite-panel.tsx`

**内容**

在版本选择区和结果编辑区之间增加“发布反馈”小区块：

未绑定：

- 显示“尚未关联发布视频”。
- 显示按钮“关联已发布视频”。

已绑定：

- 显示视频标题、发布时间、播放、点赞、评论、分享、收藏。
- 显示按钮“解除关联”。

按钮禁用条件：

- 无 activeVersion。
- activeVersion.status !== `COMPLETED`。
- 无 `rewrite.targetAccountId`。

**视觉要求**

- 使用现有 Linear 风格暗色卡片。
- 不新增大面积营销式说明。
- 信息密度保持紧凑。

---

## FE-004: 绑定和解绑操作

**文件**

- 修改: `src/components/features/benchmarks/ai-rewrite-panel.tsx`
- 修改: `src/components/features/benchmarks/ai-workspace-controller.ts`

**Controller 新增方法**

```typescript
linkPublishedVideo(versionId: string, douyinVideoId: string): Promise<void>
unlinkPublishedVideo(versionId: string): Promise<void>
```

绑定接口：

```typescript
POST /api/ai-workspace/${videoId}/rewrite/versions/${versionId}/published-video
```

解绑接口：

```typescript
DELETE /api/ai-workspace/${videoId}/rewrite/versions/${versionId}/published-video
```

成功后：

1. toast 展示操作结果。
2. 调用 `loadRewrite(videoId)` 刷新版本数据。
3. 关闭 picker 或确认框。

失败后：

1. 展示后端 error.message。
2. 保持当前弹框状态，方便用户重试或取消。

---

## FE-005: 解绑确认弹框

**文件**

- 修改: `src/components/features/benchmarks/ai-rewrite-panel.tsx`

**内容**

点击“解除关联”时展示 `AlertDialog`：

标题：`解除发布视频关联`

描述：`解除后，这条发布反馈将不再参与该账号后续仿写学习。历史绑定记录会保留。`

按钮：

- 取消
- 解除关联

确认后调用 `unlinkPublishedVideo`。

---

## FE-006: AI 配置页支持 EMBED 步骤

**文件**

- 修改: `src/components/features/system-settings/ai-config-page.tsx`
- 修改: `src/types/ai-config.ts`

**内容**

在步骤绑定列表中增加：

```typescript
{ step: "EMBED", label: "向量", description: "用于成长型仿写案例检索的 embedding 模型。" }
```

展示位置在 `REWRITE` 后面。

**验证**

- 超管可以为 EMBED 选择模型。
- 未绑定 EMBED 时，后端降级不阻塞普通仿写。

---

## FE-007: 前端测试与验收

**文件**

- 新增测试: `src/components/features/benchmarks/rewrite-published-video-picker.test.tsx`
- 扩展测试: `src/components/features/benchmarks/ai-rewrite-panel-layout.test.ts`

**测试场景**

1. picker loading 状态。
2. picker empty 状态。
3. picker 选择视频后确认。
4. 已绑定版本展示 publication 信息。
5. 未完成版本禁用绑定按钮。
6. 解绑确认弹框触发正确回调。

**手工验收**

1. 生成一个仿写版本。
2. 编辑最终文案。
3. 同步目标账号视频。
4. 绑定一个真实发布视频。
5. 刷新页面后绑定状态仍存在。
6. 解绑后状态恢复未绑定。
7. 再次生成同账号仿写时后端写入 `usedLearningCaseIds`。

---

## 前端边界

1. 不展示 `DouyinAccountStyleProfile` 完整内容。
2. 不展示向量相似度。
3. 不展示学习案例列表。
4. 不支持自动匹配发布视频。
5. 不支持跨账号选择视频。
6. 不支持自动发布。

---

## 全量验证

前端完成后运行：

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm build
```

若全量测试存在历史失败，需要单独运行新增或修改的测试，并在测试报告中注明历史失败不属于 v0.5.0 新增能力。

