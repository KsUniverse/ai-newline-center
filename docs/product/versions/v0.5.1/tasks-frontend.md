# v0.5.1 前端任务 — 经验反馈闭环

## 必读文档

- `docs/product/versions/v0.5.1/requirements.md`
- `docs/product/versions/v0.5.1/technical-design.md`
- `docs/architecture/frontend.md`
- `docs/standards/ui-ux-system.md`
- `src/types/video-link.ts`
- `src/components/features/rewrites/direct-create-panel.tsx`

---

## 任务清单

### T8: 更新类型定义

**文件**: `src/types/video-link.ts`

在 `RewritePickerItemDTO` 下方新增：
```typescript
export interface ExperienceSummaryDTO {
  playsCount: number;
  likesCount: number;
}
```

并在 `RewritePickerItemDTO` 中追加字段：
```typescript
experienceSummary: ExperienceSummaryDTO | null;
```

### T9: 更新仿写卡片组件（经验徽章）

**文件**: `src/components/features/rewrites/direct-create-panel.tsx`

在仿写卡片（或列表项）中，若 `item.experienceSummary` 不为 null，则在卡片底部显示：
- 一个绿色小徽章：`已积累经验`
- 旁边展示数据摘要：`播放 {playsCount.toLocaleString()} · 赞 {likesCount.toLocaleString()}`

参考现有 Badge 组件使用方式，保持 Linear 风格暗色主题。

---

## 自省报告（完成后填写）
