# v0.5.0 前端任务

## 必读文档

- `docs/product/versions/v0.5.0/requirements.md`
- `docs/product/versions/v0.5.0/technical-design.md`
- `docs/architecture/frontend.md`
- `docs/standards/ui-ux-system.md`

---

## FE-001: 安装 recharts

```bash
pnpm add recharts
```

## FE-002: 新增共享类型

**文件**: `src/types/video-link.ts`

```typescript
export interface VideoSnapshotDTO { ... }
export interface VideoRewriteLinkDTO { ... }
export interface RewritePickerItemDTO { ... }
```

## FE-003: VideoSnapshotChart 组件

**文件**: `src/components/features/accounts/video-snapshot-chart.tsx`

- 使用 recharts LineChart
- 4条曲线：播放量(playsCount)、点赞(likesCount)、评论(commentsCount)、转发(sharesCount)
- 横轴时间格式：MM/DD HH:mm
- 快照数 < 2 时展示空状态

## FE-004: RewritePickerDialog 组件

**文件**: `src/components/features/accounts/rewrite-picker-dialog.tsx`

- 使用 Dialog 组件
- 从 `/api/rewrites/mine` 加载数据
- 列表展示：目标账号昵称、模式标签、内容预览（前100字）、创建时间
- 支持单选 + 确认

## FE-005: VideoRewriteLinkSection 组件

**文件**: `src/components/features/accounts/video-rewrite-link-section.tsx`

- 未关联：显示"关联文案"按钮 → 打开 RewritePickerDialog
- 已关联：显示仿写摘要 + "解除关联"按钮 → ConfirmDialog
- 调用 `/api/videos/[id]/rewrite-link` CRUD API

## FE-006: 扩展 VideoDetailDialog

**文件**: `src/components/features/accounts/video-detail-dialog.tsx`

在现有内容区域追加：
1. 数据趋势 section → `VideoSnapshotChart`（从 `/api/videos/[id]/snapshots` 拉取）
2. 关联文案 section → `VideoRewriteLinkSection`

---

## 自省报告

（实现完成后填写）
