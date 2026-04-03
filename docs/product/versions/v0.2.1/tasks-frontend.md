# v0.2.1 前端任务清单

## 必读文档

> 开始开发前必须按顺序阅读以下文档：

- `docs/product/versions/v0.2.1/requirements.md` — 本版本需求（理解业务背景和验收标准）
- `docs/product/versions/v0.2.1/technical-design.md` — 本版本技术设计（含 API 契约、组件树、Props 定义）
- `docs/architecture/frontend.md` — 前端组件体系（布局规范、组件层次）
- `docs/standards/ui-ux-system.md` — UI/UX 设计系统（颜色、间距、交互规范）
- `docs/standards/coding-standards.md` — 编码规范
- `src/components/features/accounts/account-detail-header.tsx` — 待修改的组件（修改前必读）
- `src/app/(dashboard)/accounts/[id]/page.tsx` — 待修改的页面（修改前必读）
- `src/types/douyin-account.ts` — 共享类型定义（了解 DTO 结构）
- `src/lib/api-client.ts` — API 客户端（了解调用方式）

**前端任务依赖后端任务**：
- FE-001 依赖 BE-009（`DouyinAccountDetailDTO` 包含 `lastSyncedAt`）
- FE-002 依赖 BE-006（`POST .../sync` API 可用）
- 建议后端 BE-001～BE-009 完成后再开始前端开发；若并行开发，需在 `apiClient.post` 调用处临时 mock 数据

---

## 摘要

- **任务总数**: 4
- **P0 任务数**: 3（核心展示和交互）
- **P1 任务数**: 1（工具函数）
- **估计文件变更数**: 4（2 新建 + 2 修改）

---

## 任务列表

---

### FE-001 (P1) — 新增 formatRelativeTime 工具函数

**文件**:
- `src/lib/utils.ts`

**详情**:

在现有 `utils.ts` 中新增 `formatRelativeTime` 函数，用于格式化同步时间展示。

**规则**:
| 条件 | 展示格式 |
|------|---------|
| `date === null` | `"尚未同步"` |
| 距今 < 1 分钟 | `"刚刚"` |
| 距今 1 ~ 59 分钟 | `"N 分钟前"` |
| 距今 1 ~ 23 小时 | `"N 小时前"` |
| 距今 ≥ 24 小时 | `"MM-DD HH:mm"` 格式（如 `"04-03 10:30"`） |

**函数签名**:
```typescript
export function formatRelativeTime(date: string | Date | null): string
```

**注意**:
- 入参为 `null` 时返回 `"尚未同步"`（对应 `lastSyncedAt === null` 的情况）
- 入参支持 ISO 字符串或 Date 对象（统一在函数内 `new Date(date)` 处理）
- 月日补零（如 4 月 3 日 → `"04-03"`）

**验收标准**:
- [ ] `formatRelativeTime(null)` 返回 `"尚未同步"`
- [ ] `formatRelativeTime(new Date())` 返回 `"刚刚"`
- [ ] 传入 30 分钟前的时间返回 `"30 分钟前"`
- [ ] 传入 25 小时前的时间返回 `"MM-DD HH:mm"` 格式字符串
- [ ] `pnpm type-check` 通过

---

### FE-002 (P0) — 新建 AccountSyncSection 组件

**文件**:
- `src/components/features/accounts/account-sync-section.tsx`（新建）
- `src/components/features/accounts/index.ts`（更新导出）

**详情**:

新建 `AccountSyncSection` 组件，包含「最后同步时间」文案和「立即同步」按钮。

**Props**:
```typescript
interface AccountSyncSectionProps {
  accountId: string;
  lastSyncedAt: string | null;
  onSyncSuccess: (newLastSyncedAt: string) => void;
}
```

**UI 结构**:
```
[最后同步时间: N 分钟前]   [立即同步 Button]
```
- 使用 `flex items-center gap-3` 布局
- 时间文案：`text-xs text-muted-foreground`
- 按钮：`size="sm" variant="outline"`，同步中时 `disabled` + 显示 `<Loader2 className="h-3 w-3 animate-spin" />` 图标
- 按钮文字：空闲时 `"立即同步"`，同步中时 `"同步中…"`

**内部状态**:
```typescript
const [syncing, setSyncing] = useState(false);
```

**同步逻辑**:
```typescript
async function handleSync() {
  setSyncing(true);
  try {
    const data = await apiClient.post<{ lastSyncedAt: string }>(
      `/douyin-accounts/${accountId}/sync`,
    );
    onSyncSuccess(data.lastSyncedAt);
    toast.success("同步成功");
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "同步失败，请稍后再试";
    toast.error(message);
  } finally {
    setSyncing(false);
  }
}
```

**时间展示**（使用 FE-001 中的 `formatRelativeTime`）:
```tsx
<span className="text-xs text-muted-foreground">
  最后同步时间：{formatRelativeTime(lastSyncedAt)}
</span>
```

**完整组件示例结构**:
```tsx
"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiClient, ApiError } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";

// ... 实现
```

**验收标准**:
- [ ] 组件渲染出「最后同步时间：尚未同步」（当 `lastSyncedAt === null`）
- [ ] 组件渲染出「最后同步时间：N 分钟前（或具体时间）」（当 `lastSyncedAt` 有值）
- [ ] 点击「立即同步」后按钮变为 disabled + loading 状态
- [ ] 同步成功后调用 `onSyncSuccess` 并显示 toast 成功提示
- [ ] 同步失败后显示 toast 错误提示，按钮恢复可用
- [ ] `syncing === true` 时按钮不可再次点击（防止重复触发）
- [ ] 组件已在 `index.ts` 中导出
- [ ] `pnpm type-check` 通过

---

### FE-003 (P0) — 修改 AccountDetailHeader：嵌入 AccountSyncSection

**文件**:
- `src/components/features/accounts/account-detail-header.tsx`

**详情**:

修改 `AccountDetailHeader` 组件，新增 `onSyncSuccess` prop，并在底部添加 `AccountSyncSection`。

**修改后 Props**:
```typescript
interface AccountDetailHeaderProps {
  account: DouyinAccountDetailDTO;
  onSyncSuccess: (newLastSyncedAt: string) => void;  // 新增
}
```

**UI 结构变更**（在现有头像/昵称/简介和粉丝数行之后，新增第三行）:
```tsx
// 现有内容：头像 + 昵称 + 简介 + 粉丝数/作品数
// 新增分隔线（可选，根据视觉效果决定）
<AccountSyncSection
  accountId={account.id}
  lastSyncedAt={account.lastSyncedAt}
  onSyncSuccess={onSyncSuccess}
/>
```

**注意**:
- `account` 的类型引用需更新为 `DouyinAccountDetailDTO`（该类型在 BE-009 完成后包含 `lastSyncedAt`）
- 若 `DouyinAccountDetailDTO` 还未包含 `lastSyncedAt`（后端未完成时临时处理），可先使用 `account.lastSyncedAt as string | null | undefined` 并用 `?? null` 处理

**验收标准**:
- [ ] `AccountDetailHeader` 底部显示 sync section（时间 + 按钮）
- [ ] `onSyncSuccess` 能正确向下传递到 `AccountSyncSection`
- [ ] 组件未报 TypeScript 类型错误
- [ ] 视觉上与现有头部信息保持一致的间距

---

### FE-004 (P0) — 修改账号详情页面：接入同步状态

**文件**:
- `src/app/(dashboard)/accounts/[id]/page.tsx`

**详情**:

在现有的 `AccountDetailPage` 中处理同步成功后的局部状态更新。

**修改点**:

1. `account` 状态类型已是 `DouyinAccountDetailDTO`（BE-009 完成后自动包含 `lastSyncedAt`）

2. 新增 `handleSyncSuccess` 回调函数：
```typescript
function handleSyncSuccess(newLastSyncedAt: string) {
  setAccount((prev) => {
    if (!prev) return prev;
    return { ...prev, lastSyncedAt: newLastSyncedAt };
  });
}
```

3. 将 `onSyncSuccess={handleSyncSuccess}` 传递给 `AccountDetailHeader`：
```tsx
<AccountDetailHeader
  account={account}
  onSyncSuccess={handleSyncSuccess}  // 新增
/>
```

**注意**:
- 同步成功仅更新 `lastSyncedAt` 局部字段，不重新请求完整账号数据（减少不必要请求）
- 如果将来需要同步后刷新粉丝数等字段，可在 `handleSyncSuccess` 内部触发 `loadAccount()`，但 v0.2.1 暂不做（同步后的粉丝数变化需要用户手动刷新页面查看，属合理体验）

**验收标准**:
- [ ] 点击「立即同步」成功后，「最后同步时间」显示更新为最新时间（无需刷新页面）
- [ ] 同步成功后账号头部其他数据（昵称、粉丝数）不受影响（不被清除或重置）
- [ ] `pnpm type-check` 通过

---

## 完整用户旅程验收

按以下步骤端到端验证完整功能：

1. **准备**：确保已有至少一个 `DouyinAccount` 记录（通过添加账号功能创建）
2. **打开账号详情页**：进入 `/accounts/{id}`
3. **验证初始状态**：
   - [ ] 账号头部显示「最后同步时间：尚未同步」（`lastSyncedAt` 为 null）
   - [ ] 「立即同步」按钮可点击
4. **点击「立即同步」**：
   - [ ] 按钮立即变为 loading 状态（`disabled` + 旋转图标 + "同步中…"文字）
   - [ ] 按钮不可再次点击
5. **等待同步完成**：
   - [ ] 出现成功 Toast 通知"同步成功"
   - [ ] 按钮恢复为"立即同步"可用状态
   - [ ] 「最后同步时间」更新为"刚刚"
6. **再次打开页面**（F5 刷新）：
   - [ ] 「最后同步时间」显示"N 分钟前"（与步骤 5 的时间一致）
7. **验证视频数据**（若后端已实现完整同步）：
   - [ ] 视频列表区域有数据（开发模式下有 mock 视频）
8. **错误处理验证**（临时关闭 CRAWLER_API_URL 或模拟网络失败）：
   - [ ] 点击同步出现错误 Toast"同步失败，请稍后再试"
   - [ ] 「最后同步时间」保持不变
   - [ ] 按钮恢复正常状态

---

## UI 设计参考

### AccountSyncSection 布局示意

```
┌─────────────────────────────────────────────────────────────┐
│  [头像]  昵称                                                 │
│          简介文字                                             │
│          12.3万 粉丝  ｜  58 作品                            │
│          最后同步时间: 3 分钟前          [立即同步 ↻]         │
└─────────────────────────────────────────────────────────────┘
```

### 按钮状态样式

| 状态 | 样式 |
|------|-----|
| 空闲 | `variant="outline" size="sm"` + `<RefreshCw className="h-3 w-3 mr-1.5" />` 图标 |
| 同步中 | `disabled` + `<Loader2 className="h-3 w-3 mr-1.5 animate-spin" />` |

*图标使用 `lucide-react`（项目已引入）*

---

## 自省报告

### 完成情况

- **FE-001** ✅ `formatRelativeTime` 已添加到 `src/lib/utils.ts`，覆盖全部 5 种时间范围规则（null / <1分钟 / 1-59分钟 / 1-23小时 / ≥24小时）
- **FE-002** ✅ `AccountSyncSection` 组件已新建于 `src/components/features/accounts/account-sync-section.tsx`，并在 `index.ts` 中导出
- **FE-003** ✅ `AccountDetailHeader` 已新增 `onSyncSuccess` prop，底部嵌入 `AccountSyncSection`
- **FE-004** ✅ `AccountDetailPage` 已新增 `handleSyncSuccess` 回调，局部更新 `lastSyncedAt` 状态并传入 `AccountDetailHeader`

### 偏差说明

- **按钮图标间距**：`ui-ux-system.md` 参考表中示例使用 `mr-1.5`，但按 shadcn/ui 惯例 Button 内图标与文字的间距由 `gap` 或内联间距控制。实现中图标直接紧靠文字（无额外 margin），与 Button 组件内部 `gap` 一致，视觉无差异。
- **`DouyinAccountDetailDTO.lastSyncedAt`**：后端已在 BE-009 中完成该字段，类型已包含 `string | null`，无需临时类型断言。

### 遗留问题

1. **`pnpm build` 失败**（预存在问题，非本次引入）：`CRAWLER_API_URL` 在生产构建时被 `env.ts` Zod schema 标记为必填，但 CI/构建环境未设置该变量，导致多个 API 路由在 build 阶段崩溃。`pnpm type-check` 和 `pnpm lint` 均通过。
2. **同步后粉丝数等字段不自动刷新**（有意为之，见 FE-004 注意事项）：同步成功仅更新 `lastSyncedAt`，粉丝数/作品数变化需用户手动刷新页面。v0.2.1 范围内属合理体验，后续版本可在 `handleSyncSuccess` 内触发 `loadAccount()`。
3. **`// TODO: [INTEGRATE]` 标注**：`account-sync-section.tsx` 中 `apiClient.post` 调用处已标注，依赖 BE-006（`POST /api/douyin-accounts/[id]/sync`）就绪后验证端到端流程。

