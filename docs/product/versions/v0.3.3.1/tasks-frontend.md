# v0.3.3.1 前端任务

> 版本: v0.3.3.1
> 角色: 前端开发
> 参考: technical-design.md

## 必读文档

1. `docs/product/versions/v0.3.3.1/requirements.md`
2. `docs/product/versions/v0.3.3.1/technical-design.md`
3. `docs/architecture/frontend.md`（重点阅读"品牌表面常量"和"布局体系"章节）
4. `docs/standards/ui-ux-system.md`

---

## 任务清单

### T-FE-001: localStorage Hook

- [ ] 新建 `src/lib/hooks/use-direct-create-local-state.ts`：
  - key: `ai_direct_create_state`
  - 存储：`{ currentRewriteId: string | null, fragmentIds: string[], userInputContent: string, topic: string, modelConfigId: string | null, targetAccountId: string | null }`
  - 提供 `loadFromStorage()` 和 `saveToStorage(state)` 方法
  - 提供 `clearCurrentTask()` 或等价能力，用于点击「新建任务」时清空 currentRewriteId 与版本结果状态

### T-FE-002: DirectCreatePanel 组件

- [ ] 新建 `src/components/features/rewrites/direct-create-panel.tsx`
  - 两栏布局（`lg:grid-cols-2`）
  - 左栏：今日观点多选（复用 `ViewpointPicker`）+ 已选观点 Chip + 临时素材输入框 + **创作主题/指令**输入框（必填） + 目标账号下拉 + AI 模型下拉 + 「创作」按钮
  - 右栏：当前任务状态 + 「新建任务」按钮 + 版本 Badge / 下拉 + 生成结果编辑区（Textarea）
  - 复用 `AiRewritePanel` 的版本切换逻辑（版本 Badge、AlertDialog 确认重新生成、防抖自动保存）
  - 表面样式使用 `BRAND_SURFACE_CLASS_NAME` / `BRAND_INSET_SURFACE_CLASS_NAME`（来自 `brand.ts`）
  - 生成期间「创作」按钮禁用，展示 `Loader2` 旋转
  - 生成期间禁用输入区，避免当前任务上下文与后台版本生成错配
  - `topic` 为空时「创作」按钮禁用
  - 当前任务已有版本且用户再次点击「创作」时，调用 generate API 并传入 `currentRewriteId`，追加新版本
  - 用户点击「新建任务」时，清空 `currentRewriteId`、versions、activeVersionId、编辑区内容，下一次「创作」创建新任务

### T-FE-003: DirectCreatePage 组件

- [ ] 新建 `src/components/features/rewrites/direct-create-page.tsx`：
  - 使用 `DashboardPageShell`（eyebrow="AI 仿写", title="直接创作", description="不依赖对标视频，直接输入主题和观点生成短视频文案"）
  - 负责数据获取（douyin-accounts、ai-config/settings）和 API 调用（POST generate、GET rewrite、PATCH edit）
  - 首次生成不传 `rewriteId`；生成成功后保存返回的 `rewriteId` 为 `currentRewriteId`
  - 同一任务继续生成时传入 `currentRewriteId`，生成成功后拉取同一任务的版本列表
  - 页面刷新后若 localStorage 存在 `currentRewriteId`，先 GET 当前任务并恢复版本状态
  - 2s 轮询（与 v0.3.3 工作台保持一致）
  - 集成 `useDirectCreateLocalState`

### T-FE-004: 路由页面

- [ ] 新建 `src/app/(dashboard)/rewrites/new/page.tsx`：
  - 导出 `DirectCreatePage`
  - 设置 metadata（title: "直接创作 - AI Newline Center"）

### T-FE-005: 侧边栏导航入口

- [ ] `src/components/shared/layout/app-navigation.ts`：
  - 在"工作区"分区添加"直接创作"导航项
  - 图标：`PenLine`（来自 `lucide-react`）
  - 路由：`/rewrites/new`
  - 仅对 EMPLOYEE 及以上角色可见

---

## 视觉约束

- 所有主区块面板使用 `BRAND_SURFACE_CLASS_NAME`（`rounded-xl border border-border/55 bg-card`）
- 字段块使用 `BRAND_FIELD_SHELL_CLASS_NAME`
- 按钮使用标准 `Button` 组件，不手写圆角或阴影
- 表单分区使用 `BRAND_FORM_SECTION_CLASS_NAME`
- 禁止使用 `rounded-2xl`、`rounded-3xl`、`shadow-sm`、`shadow-md` 等
- 字号使用语义 token（`text-sm`、`text-base`、`text-lg` 等），禁止 `text-[13px]` 任意值

## 完成标准

- `pnpm type-check` 无错误
- `pnpm lint` 无警告
- 页面在 `/rewrites/new` 路由可访问
- 侧边栏导航项可点击跳转
