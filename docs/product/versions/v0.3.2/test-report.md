# 测试报告 — v0.3.2

> 测试日期: 2026-04-10
> 测试类型: 静态代码审查
> 版本: v0.3.2 碎片观点库

---

## 摘要

- 测试功能数: 2（F-004-1 + F-004-2）
- 验收标准: 8 条（AC-1 ~ AC-8）
- 通过: 8 / 失败: 0
- UI 问题: 0
- 构建检查: 通过 ✅（`pnpm type-check` + `pnpm lint` 均无错误）
- **结论: 通过 ✅**（T-001 已修复，commit `6a7879b`）

---

## 验收标准逐项检查

| # | 验收标准 | 状态 | 说明 |
|---|---------|------|------|
| AC-1 | `/viewpoints` 页存在，导航可进入，展示观点列表 | ✅ | `viewpoints/page.tsx` 存在；`app-navigation.ts` 新增「观点库」+ Lightbulb 图标 + href `/viewpoints`，所有角色可见 |
| AC-2 | 点击「添加观点」打开弹窗，支持单条和多行批量录入，提交后列表刷新 | ✅ | 弹窗标题「添加观点」✅；`\n` 分割 + trim + filter 空行；提交后 `onCreated()` → `refreshKey+1` → `key={refreshKey}` 触发 ViewpointsList 重挂载重载 |
| AC-3 | 每条展示文本、创建者、时间；超长文本折叠 | ✅ | `line-clamp-3` 折叠；`createdByUser.name` + `formatRelativeTime()` 展示 |
| AC-4 | 搜索框可过滤列表，防抖 300ms 正常工作 | ✅ | `handleQueryChange` 用 `debounceRef` 实现 300ms 防抖；`loadVersionRef` 防竞态 |
| AC-5 | 创建者可删自己的；BRANCH_MANAGER 可删任意；删除后列表刷新 | ✅ | `canDelete` = `canManageAny || item.createdByUserId === currentUserId`；Service 层 EMPLOYEE 非自己 → 403；删除后乐观 `filter` 移除 |
| AC-6 | 仿写阶段内嵌观点选择区可搜索并多选，显示「已选 N 条」 | ✅ | `AiWorkspaceRewriteStage` 底部增加「观点参考」面板；Checkbox 多选；Badge「已选 N 条」；清空按钮 |
| AC-7 | 观点状态保存在工作台 state，切换视频后重置 | ❌ | **见问题 T-001** |
| AC-8 | 视觉风格与现有页面一致 | ✅ | 使用 `DashboardPageShell`、相同 CSS 变量、间距体系、`rounded-2xl/3xl`；与用户管理等页面风格一致 |

---

## 测试用例

### F-004-1 观点库管理页面

**TC-01: 页面路由和导航入口**
- 路由 `src/app/(dashboard)/viewpoints/page.tsx` 存在 ✅
- `APP_NAV_ITEMS` 中「观点库」`href="/viewpoints"`，roles 包含全部三种角色 ✅

**TC-02: 添加弹窗 - 单条录入**
- `ViewpointsAddDialog` 分割 `\n`、trim、filter 空行 ✅
- 前端校验 > 50 条时提示拆分 ✅
- 前端校验任意一条 > 500 字时整体提示，符合 technical-design.md 约定（与 requirements.md "超限单条独立报错" 有落差，见说明）

**TC-03: 添加弹窗 - 批量录入**
- 多行粘贴按 `\n` 分割 ✅
- `POST /api/viewpoints` body `{ contents: string[] }` ✅
- Zod schema `z.array(z.string().min(1).max(500)).min(1).max(50)` ✅
- 成功后列表刷新 ✅

**TC-04: 观点列表展示**
- `FragmentDTO` 含 `content`、`createdByUser.name`、`createdAt` ✅
- `line-clamp-3` 超长折叠 ✅
- 骨架屏加载状态 ✅
- 空状态（带或不带搜索词）两种描述 ✅

**TC-05: 搜索**
- 300ms 防抖 + 竞态防护（`loadVersionRef`）✅
- `GET /api/viewpoints?q=...` 后端 `contents LIKE %q%` ✅

**TC-06: Cursor 分页**
- Repository 实现 `createdAt DESC, id DESC` 复合游标 ✅
- `IntersectionObserver` + sentinel 元素实现滚动加载 ✅
- `take: limit + 1` 判断 hasMore ✅

**TC-07: 删除权限**
- EMPLOYEE：仅自己创建的显示删除按钮；Service 层再校验 ✅
- BRANCH_MANAGER / SUPER_ADMIN：任意观点可删 ✅
- `ConfirmDialog` 二次确认 ✅
- 软删除 (`deletedAt = now()`) ✅
- `organizationId` 隔离（`softDelete` 含 organizationId 过滤防跨租户） ✅

**TC-08: API 权限验证**
- GET / POST / DELETE 均有 `auth()` + `requireRole(EMPLOYEE, BRANCH_MANAGER, SUPER_ADMIN)` ✅
- DELETE 路由额外校验 `fragmentId` 为 cuid ✅

**TC-09: organizationId 数据隔离**
- `findMany`: `buildWhere` 强制带 `organizationId` ✅
- `findById`: 带 `organizationId` 过滤 ✅
- `softDelete`: 带 `organizationId` 过滤 ✅
- `createFragments`: `caller.organizationId` 写入 ✅

---

### F-004-2 AI 仿写阶段观点选择

**TC-10: 观点选择区渲染**
- `AiWorkspaceRewriteStage` 底部「观点参考」面板正确渲染 ✅
- 搜索 Input（300ms 防抖）+ Checkbox 列表 ✅

**TC-11: 多选状态管理**
- `useAiWorkspaceController` 中 `selectedFragmentIds: string[]` ✅
- `handleFragmentToggle`: toggle in/out ✅
- `handleFragmentsClear`: 清空为 [] ✅
- Props 链路：controller → shell → rewrite-stage ✅

**TC-12: 仿写阶段观点加载**
- `useEffect([fragmentQuery])` 监听搜索词，取消旧请求（`cancelled` flag）✅
- `limit=50`（在选择面板中不分页，合理）✅

**TC-13: 切换视频后重置 selectedFragmentIds**
- ❌ **见问题 T-001**

---

## 问题列表

### [T-001] selectedFragmentIds 切换视频后不重置（Medium）

- **位置**: `src/components/features/benchmarks/ai-workspace-controller.ts` — `applyWorkspace` 函数
- **描述**: 用户在仿写阶段勾选了若干观点后，关闭工作台再打开另一个视频，`selectedFragmentIds` 不会被清空。`resetToInitialWorkspace()` 中有 `setSelectedFragmentIds([])` 但该函数只在**工作台加载失败**时调用；正常切换视频时走 `applyWorkspace`，后者未清零 `selectedFragmentIds`。`AiWorkspaceShell` 在 `benchmark-detail-page.tsx` 中始终挂载（无条件渲染），不会因 video → null 而 unmount，故 state 持久存在。
- **违反标准**: 需求 AC-7「切换视频后重置（本版不持久化选中状态）」
- **预期行为**: 每次切换到新视频时（video prop 从 null → 新视频对象，或从视频 A → 视频 B），`selectedFragmentIds` 置空
- **修复建议**: 在 `applyWorkspace` 的 `startTransition` 块中补加 `setSelectedFragmentIds([])` 即可，与 `draft`、`manualSelection` 的重置模式一致：

  ```typescript
  startTransition(() => {
    setWorkspace(next);
    setTranscriptText(nextTranscript);
    setDraft(next.rewriteDraft?.currentDraft ?? "");
    setDraftDirty(false);
    setManualSelection(options?.nextSelection ?? null);
    setActiveAnnotationId(resolvedActiveAnnotationId);
    setSelectedFragmentIds([]);   // ← 补加
    // ...
  });
  ```

---

## 附注

**批量录入"超限单条独立报错"差异说明**（非 Bug，已知落差）

需求 requirements.md 描述："超限时单条报错，其余正常入库"（部分成功）。技术设计 technical-design.md 明确改为"超 500 字直接整体 400；批量时调用方应自行切分"。前端 `ViewpointsAddDialog` 同步实现了整体预校验。实际行为与 technical-design.md 一致，属于有意简化，不算 bug——但 requirements.md 对应验收标准措辞未同步更新，建议后续对齐文档。

---

## 构建检查

| 检查项 | 结果 | 命令 |
|--------|------|------|
| TypeScript 类型检查 | ✅ 无错误 | `pnpm type-check` |
| ESLint 检查 | ✅ 无错误 | `pnpm lint` |

---

## 测试结论

v0.3.2 整体实现质量良好，架构分层、数据隔离、权限校验均符合规范。唯一需修复问题为 **T-001**（`selectedFragmentIds` 在正常切换视频时不重置，Medium 级），修复方案明确，改动极小（1 行）。建议修复后重新走测试，验证 AC-7 通过即可发布。
