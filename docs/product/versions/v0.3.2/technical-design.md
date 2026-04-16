# v0.3.2 技术设计方案

> 版本: v0.3.2
> 创建日期: 2026-04-10
> 功能范围: 碎片观点库（F-004-1 观点录入 + F-004-2 观点浏览与选择）

---

## 摘要

| 项目 | 内容 |
|------|------|
| 涉及模块 | 新增：观点库（viewpoints）；扩展：AI 工作台仿写阶段 |
| 新增模型 | `Fragment` |
| 修改模型 | `Organization`（添加 fragments 关联）、`User`（添加 createdFragments 关联） |
| 新增 API | `GET /api/viewpoints`、`POST /api/viewpoints`、`DELETE /api/viewpoints/:id` |
| 新增页面 | `/viewpoints` 观点库管理页 |
| 新增组件 | `ViewpointsPageView`、`ViewpointsAddDialog`、`ViewpointsList` |
| 扩展组件 | `AiWorkspaceRewriteStage`（新增观点选择区）、`useAiWorkspaceController`（新增 `selectedFragmentIds` state） |
| 新增类型 | `src/types/fragment.ts`、`CursorPaginatedData<T>`（追加到 `src/types/api.ts`） |
| 导航变更 | `app-navigation.ts` 新增「观点库」入口 |
| 架构变更 | 无 |

---

## 技术对齐结论

| 维度 | 结论 | 落点 |
|------|------|------|
| 模型命名 | 底层模型命名为 `Fragment`（对应 `fragments` 表），API 路由命名为 `/api/viewpoints`（对应产品功能名） | Route Handler 路径与 Service/Repository 命名解耦 |
| 分页方式 | Cursor 分页（createdAt + id 复合游标，base64url 编码），支持无限滚动 | Repository 实现复合 cursor WHERE 条件；新增 `CursorPaginatedData<T>` 类型 |
| 搜索方式 | 后端 `content LIKE %q%`，MySQL 8.0 原生支持，不引入全文索引 | Repository 条件查询 |
| 选中状态 | 仿写阶段观点选中 ID 只存 React state (`selectedFragmentIds`)，本版不持久化 | Controller 新增 state，resetToInitialWorkspace 时清空 |
| 权限粒度 | EMPLOYEE 可查全部 + 创建 + 删自己的；BRANCH_MANAGER 可删任意 | Service 层权限判定 |
| 组件扩展 | 只在 `AiWorkspaceRewriteStage` 底部区域追加观点选择区，不改变现有仿写主区域结构 | Props 向下扩展，不破坏现有回调 |

---

## 数据模型变更

### 新增模型

```prisma
model Fragment {
  id              String       @id @default(cuid())
  content         String       @db.Text          // 观点文本，500 字业务层校验
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  createdByUserId String
  createdByUser   User         @relation("FragmentCreator", fields: [createdByUserId], references: [id])
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  deletedAt       DateTime?                      // 软删除

  @@index([organizationId])
  @@index([createdByUserId])
  @@map("fragments")
}
```

### 修改模型

```prisma
// Organization 新增关联
fragments Fragment[]

// User 新增关联（需指定 relation name 避免歧义）
createdFragments Fragment[] @relation("FragmentCreator")
```

### 复合游标说明

Cursor 为 base64url 编码的 JSON：

```
cursor = base64url(JSON.stringify({ c: createdAt.toISOString(), i: id }))
```

查询条件（`createdAt DESC, id DESC` 排序稳定下翻页）：

```sql
WHERE organizationId = :orgId
  AND deletedAt IS NULL
  AND (content LIKE '%:q%')           -- 仅当 q 存在时
  AND (
    createdAt < :cursorCreatedAt      -- 仅当 cursor 存在时
    OR (createdAt = :cursorCreatedAt AND id < :cursorId)
  )
ORDER BY createdAt DESC, id DESC
LIMIT :limit + 1
```

---

## API 契约

### `GET /api/viewpoints` — 查询观点列表

**鉴权**: 任意已登录角色（`requireRole` 最低 EMPLOYEE）

**请求参数**（query string）:

```typescript
z.object({
  q:      z.string().max(200).optional(),
  cursor: z.string().optional(),         // base64url 游标
  limit:  z.coerce.number().int().min(1).max(100).default(20),
})
```

**响应** `200`:

```typescript
// CursorPaginatedData<FragmentDTO>
{
  success: true,
  data: {
    items: FragmentDTO[];
    nextCursor: string | null;
    hasMore: boolean;
  }
}
```

**FragmentDTO**:

```typescript
interface FragmentDTO {
  id:              string;
  content:         string;
  organizationId:  string;
  createdByUserId: string;
  createdByUser: {
    id:   string;
    name: string;
  };
  createdAt: string;   // ISO 8601
}
```

---

### `POST /api/viewpoints` — 批量创建观点

**鉴权**: 任意已登录角色（EMPLOYEE+）

**请求体**:

```typescript
z.object({
  contents: z.array(z.string().min(1).max(500, "每条观点不超过 500 字")).min(1).max(50),
})
```

> 注：Route Handler 传入 Service 前不做额外处理；Service 会对每条进行 trim，跳过空行。

**响应** `201`:

```typescript
{
  success: true,
  data: {
    created: number;           // 实际入库条数
    items: FragmentDTO[];      // 已创建的条目
  }
}
```

**业务规则**:
- 每条 trim 后为空的跳过，不入库
- 每条字数上限 500（Zod schema 已校验，超 500 字直接整体 400；批量时调用方应自行切分）
- 同一员工允许录入重复内容

---

### `DELETE /api/viewpoints/:id` — 软删除观点

**鉴权**: 已登录

**路径参数**: `id` (cuid)

**权限规则**:
- 创建者本人可删
- `BRANCH_MANAGER` 或 `SUPER_ADMIN` 可删任意组织内的观点

**响应** `200`:

```typescript
{ success: true, data: { id: string } }
```

**错误**:
- `404 NOT_FOUND` — 观点不存在或已删除
- `403 FORBIDDEN` — 无权删除

---

## 类型定义

### `src/types/fragment.ts`（新增）

```typescript
export interface FragmentDTO {
  id:              string;
  content:         string;
  organizationId:  string;
  createdByUserId: string;
  createdByUser: {
    id:   string;
    name: string;
  };
  createdAt: string;
}

export interface CreateFragmentsInput {
  contents: string[];
}

export interface ListFragmentsParams {
  q?:      string;
  cursor?: string;
  limit?:  number;
}

export interface CreateFragmentsResult {
  created: number;
  items:   FragmentDTO[];
}
```

### `src/types/api.ts`（追加）

```typescript
// 追加到现有类型定义之后
export interface CursorPaginatedData<T> {
  items:      T[];
  nextCursor: string | null;
  hasMore:    boolean;
}
```

---

## 前端组件设计

### 新增页面路由

```
src/app/(dashboard)/viewpoints/page.tsx
```

渲染 `ViewpointsPageView`（"use client" 组件）。

### 新增组件树

```
src/components/features/viewpoints/
├── index.ts                        # 统一导出
├── viewpoints-page-view.tsx        # 页面视图（含 DashboardPageShell）
├── viewpoints-add-dialog.tsx       # 批量录入弹窗（Dialog）
└── viewpoints-list.tsx             # 列表带搜索框+无限滚动
```

#### `ViewpointsPageView`

- 使用 `DashboardPageShell`（title="观点库"，description="全公司共享的碎片观点，支持录入与搜索引用"）
- 右上角「添加观点」Button（primary），点击打开 `ViewpointsAddDialog`
- 包含 `ViewpointsList`（搜索框 + 列表）
- 删除触发内联确认（`ConfirmDialog`）

#### `ViewpointsAddDialog`

- `Dialog` 原语封装
- Title：「添加观点」
- 多行 `Textarea`（`rows={8}`），placeholder：`输入观点内容，一行一条，支持批量录入`
- 提交时调用 `apiClient.post<CreateFragmentsResult>('/viewpoints', { contents })`
- 成功后：toast 提示「已添加 N 条观点」，关闭弹窗，触发列表刷新

#### `ViewpointsList`

- 顶部搜索 Input（防抖 300ms）
- 观点卡片：content 文本（`line-clamp-3`）+ 创建者姓名 + 相对时间 + 删除按钮（条件显示）
- 无限滚动：`IntersectionObserver` 监听列表底部，触发加载下一页（cursor 分页）
- 加载状态：骨架屏或 spinner

### 扩展 `AiWorkspaceRewriteStage`

在现有组件结构下方（grid 第二行区域）新增`FragmentSelectorArea`子块：

```
AiWorkspaceRewriteStage (现有结构保持不变，只追加 props 和下方区域)
└── FragmentSelectorArea (新增，位于现有 grid 第二行)
    ├── 区块标题 + 已选 N 条 Badge + 清空按钮
    ├── 搜索 Input（debounced 300ms，单独调用 /api/viewpoints）
    └── 可滚动结果列表（每条 Checkbox + 文本截断）
```

**新增 Props（扩展接口，不破坏现有参数）**:

```typescript
interface AiWorkspaceRewriteStageProps {
  // 现有 props 保持不变
  transcriptText:      string;
  annotations:         DecompositionAnnotation[];
  activeAnnotationId:  string | null;
  draft:               string;
  savingDraft:         boolean;
  onDraftChange:       (next: string) => void;
  onAnnotationSelect:  (annotationId: string) => void;
  // 新增
  selectedFragmentIds: string[];
  onFragmentToggle:    (id: string) => void;
  onFragmentsClear:    () => void;
}
```

### 扩展 `useAiWorkspaceController`

```typescript
// 新增 state
const [selectedFragmentIds, setSelectedFragmentIds] = useState<string[]>([]);

// 新增 reset（在 resetToInitialWorkspace 中追加）
setSelectedFragmentIds([]);

// 新增 handlers
const handleFragmentToggle = useCallback((id: string) => {
  setSelectedFragmentIds((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  );
}, []);

const handleFragmentsClear = useCallback(() => {
  setSelectedFragmentIds([]);
}, []);
```

返回值中暴露：`selectedFragmentIds`、`handleFragmentToggle`、`handleFragmentsClear`

### 导航入口

`src/components/shared/layout/app-navigation.ts` 新增条目：

```typescript
{
  icon: Lightbulb,   // from lucide-react
  label: "观点库",
  href: "/viewpoints",
  roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
}
```

> 插入位置：在「对标账号」（/benchmarks）之后，「组织管理」之前。

---

## 关键流程

### 批量录入流程

```
用户点击「添加观点」
  → ViewpointsAddDialog 打开
  → 用户填写 textarea（多行文本）
  → 提交：apiClient.post('/viewpoints', { contents: text.split('\n') })
  → Route Handler 验证（Zod schema，每条 max 500）
  → Service: trim 每条 → 过滤空行 → 批量 prisma.fragment.createMany
  → 返回 { created: N, items: FragmentDTO[] }
  → 前端 toast + 关闭弹窗 + 刷新列表（重置 cursor，重新加载第 1 页）
```

### 观点删除流程

```
用户点击删除按钮
  → ConfirmDialog 弹出「确认删除这条观点？」
  → 确认：apiClient.delete('/viewpoints/:id')
  → Route Handler → Service 权限检查 → 软删除（deletedAt = now()）
  → 前端列表移除该条记录（乐观更新或重新加载）
```

### 仿写阶段观点选择流程

```
用户进入仿写阶段（AiWorkspaceRewriteStage）
  → FragmentSelectorArea 出现
  → 用户在搜索框输入关键词（debounce 300ms）
  → apiClient.get('/viewpoints?q=xxx&limit=50') → 显示结果列表
  → 用户勾选 checkbox → handleFragmentToggle(id) → selectedFragmentIds 更新
  → 顶部 Badge 显示「已选 N 条」
  → 点击「清空」→ handleFragmentsClear()
  → （切换视频时 resetToInitialWorkspace 自动清空）
```

---

## 跨模块依赖

| 依赖项 | 方向 | 说明 |
|--------|------|------|
| `Fragment` 模型 | BE → FE | Schema 先行，Prisma generate 后 FE 类型可用 |
| `FragmentDTO` in `src/types/fragment.ts` | 共享 | 前后端共用，后端 Service 映射，前端 apiClient 接收 |
| `CursorPaginatedData<T>` in `src/types/api.ts` | 共享 | Repository 返回，前端渲染 |
| `AiWorkspaceShell` 向 `AiWorkspaceRewriteStage` 传参 | FE 内部 | Shell 需从 controller 取 `selectedFragmentIds` / handlers 传入 Stage |

**执行顺序约束**:

1. BE-001（Schema + migrate）→ BE-002（Repository）→ BE-003（Service）→ BE-004（Route）
2. FE 可在 BE-001 完成后并行开发（使用 mock 数据）
3. `AiWorkspaceRewriteStage` 扩展依赖 `useAiWorkspaceController` 先添加对应 state

---

## 自省：无架构变更

本版设计与现有架构完全一致，无需修改 `docs/architecture/*`。

新增的 `CursorPaginatedData<T>` 是对现有 `PaginatedData<T>` 的补充，不替换，适用于无限滚动场景。当前 api-conventions.md 未定义 cursor 分页，建议在本版完成后补写。
