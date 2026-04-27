# v0.3.4 技术设计方案

> 版本: v0.3.4  
> 阶段: Phase 2 — 技术设计  
> 创建日期: 2026-04-27

---

## 摘要

| 维度 | 内容 |
|------|------|
| 涉及模块 | `ai-workspace`（查询扩展）、`decompositions`（新增页面+API）、`app-navigation`（导航扩展） |
| 数据库变更 | **无**（零 Prisma schema 变更，复用现有 `AiWorkspace` 模型） |
| 新增 API | `GET /api/decompositions`、`GET /api/decompositions/filter-accounts` |
| 复用服务 | `AiWorkspaceService`（扩展方法）、`AiWorkspaceRepository`（扩展方法） |
| 新增前端组件 | `DecompositionsPage`、`DecompositionList`（含筛选栏） |
| 架构变更 | 无 |

---

## 技术对齐结论

| 维度 | 结论 | 落点 |
|------|------|------|
| Prisma schema 变更 | 不需要。AiWorkspace 已有 videoId → BenchmarkVideo → BenchmarkAccount 完整关联链路；`_count.annotations` 在查询层 include 即可 | Repository 查询层 |
| 数据隔离 | 同时过滤 `userId = caller.id` + `organizationId = caller.organizationId`，二者缺一不可 | Repository `where` 子句 |
| 分页方式 | Cursor 分页，基于 `(updatedAt DESC, id ASC)` 复合排序，与 `CursorPaginatedData<T>` 类型合约一致 | Repository + API 层 |
| 筛选参数 | `benchmarkAccountIds`（string[] 多选）+ `hasAnnotations`（boolean 可选），均在 Repository where 子句实现 | Repository + API Zod schema |
| 对标账号筛选下拉数据 | 独立轻量接口 `GET /api/decompositions/filter-accounts`，返回当前用户有 workspace 记录的去重 BenchmarkAccount 列表 | 独立 API route |
| `/ai-workspace/[videoId]` 路由 | v0.3.4 不新建独立工作台路由（非目标）。DTO 中包含 `accountId`，前端直接构造链接：点击行 → `/benchmarks/[accountId]`；发起仿写 → `/benchmarks/[accountId]?videoId=[videoId]&stage=rewrite`（BenchmarkDetailPage 已支持 workspace stage 参数） | 前端路由拼接 |
| 权限控制 | `auth()` 获取 session；角色须为 EMPLOYEE / BRANCH_MANAGER / SUPER_ADMIN；所有三种角色在本版均限于自身数据（无角色提权差异） | API Route Handler |

---

## 数据模型变更

**无 Prisma schema 变更。**

现有关联链路验证（已满足所有 DTO 字段需求）：

```
AiWorkspace {
  id, userId, organizationId, status, updatedAt
  videoId → BenchmarkVideo {
    id, title, coverUrl,
    accountId → BenchmarkAccount { id, nickname, avatar }
  }
  _count { annotations }   ← Prisma include._count 聚合，无需额外表
}
```

唯一约束 `@@unique([videoId, userId])` 确保每位员工对每个视频至多一个工作台记录，列表行与 workspace 一一对应。

---

## API 契约

### `GET /api/decompositions`

**路径**: `src/app/api/decompositions/route.ts`

**权限**: 需 `auth()` session，角色须为 EMPLOYEE 及以上（实际等同于任意已登录用户，因当前角色体系最低为 EMPLOYEE）。

**Zod Query Schema**:

```typescript
const listDecompositionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // hasAnnotations 通过 searchParams.get('hasAnnotations') 单独解析
  // benchmarkAccountIds 通过 searchParams.getAll('benchmarkAccountIds') 单独解析
});
```

**请求参数**（Query String）:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `cursor` | string | 否 | Cursor 分页令牌（base64 JSON） |
| `limit` | number | 否 | 每页数量，默认 20，最大 100 |
| `benchmarkAccountIds` | string[] | 否 | 重复参数，如 `?benchmarkAccountIds=id1&benchmarkAccountIds=id2` |
| `hasAnnotations` | `"true"` \| `"false"` | 否 | 有/无批注筛选 |

**成功响应** (`200`):

```typescript
ApiResponse<CursorPaginatedData<DecompositionListItemDTO>>
```

示例：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "workspaceId": "cm...",
        "videoId": "cm...",
        "videoTitle": "示例视频标题",
        "videoCoverUrl": "https://...",
        "accountId": "cm...",
        "accountNickname": "某博主",
        "accountAvatar": "https://...",
        "annotationCount": 5,
        "updatedAt": "2026-04-27T10:00:00.000Z"
      }
    ],
    "nextCursor": "eyJ1cGRhdGVkQXQiOiIyMDI2LTA0LTI3VDA5OjAwOjAwLjAwMFoiLCJpZCI6ImNtLi4uIn0=",
    "hasMore": true
  }
}
```

---

### `GET /api/decompositions/filter-accounts`

**路径**: `src/app/api/decompositions/filter-accounts/route.ts`

**权限**: 同上，需 `auth()` session。

**请求参数**: 无。

**成功响应** (`200`):

```typescript
ApiResponse<Array<{ id: string; nickname: string; avatar: string }>>
```

返回当前用户在当前组织中拥有 AiWorkspace 记录的去重 BenchmarkAccount 列表，按 nickname 升序排列。

---

## DTO 设计

文件: `src/types/ai-workspace.ts`（追加）

```typescript
export interface DecompositionListItemDTO {
  workspaceId: string;
  videoId: string;
  videoTitle: string;
  videoCoverUrl: string | null;
  accountId: string;
  accountNickname: string;
  accountAvatar: string;
  annotationCount: number;
  updatedAt: string; // ISO 8601 字符串
}

export interface ListDecompositionsParams {
  cursor?: string;
  limit?: number;
  benchmarkAccountIds?: string[];
  hasAnnotations?: boolean;
}
```

---

## Service 层设计

**文件**: `src/server/services/ai-workspace.service.ts`（扩展已有 `AiWorkspaceService` 类）

新增两个公开方法：

### `listDecompositions(caller, params)`

```typescript
async listDecompositions(
  caller: SessionUser,
  params: ListDecompositionsParams,
): Promise<CursorPaginatedData<DecompositionListItemDTO>>
```

职责：
1. 调用 `aiWorkspaceRepository.listDecompositions({ userId: caller.id, organizationId: caller.organizationId, ...params })`
2. 返回数据已由 Repository 映射为 `DecompositionListItemDTO`

### `listDecompositionFilterAccounts(caller)`

```typescript
async listDecompositionFilterAccounts(
  caller: SessionUser,
): Promise<Array<{ id: string; nickname: string; avatar: string }>>
```

职责：
1. 调用 `aiWorkspaceRepository.findDistinctBenchmarkAccountsByUser({ userId: caller.id, organizationId: caller.organizationId })`
2. 返回结构化账号列表

---

## Repository 层设计

**文件**: `src/server/repositories/ai-workspace.repository.ts`（扩展已有 `AiWorkspaceRepository` 类）

### 内部工具函数（文件级，非类方法）

```typescript
interface WorkspaceCursor {
  updatedAt: string; // ISO 8601
  id: string;
}

function encodeCursor(cursor: WorkspaceCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(encoded: string): WorkspaceCursor {
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as WorkspaceCursor;
}
```

### 新增类型

```typescript
export interface ListDecompositionsRepoParams {
  userId: string;
  organizationId: string;
  cursor?: string;
  limit?: number;
  benchmarkAccountIds?: string[];
  hasAnnotations?: boolean;
}
```

### 新增方法 1：`listDecompositions`

Prisma include 结构：

```typescript
const decompositionListInclude = {
  video: {
    select: {
      id: true,
      title: true,
      coverUrl: true,
      account: {
        select: { id: true, nickname: true, avatar: true },
      },
    },
  },
  _count: {
    select: { annotations: true },
  },
} satisfies Prisma.AiWorkspaceInclude;
```

Where 构建逻辑：

```typescript
const where: Prisma.AiWorkspaceWhereInput = {
  userId,
  organizationId,
  ...(benchmarkAccountIds?.length ? { video: { accountId: { in: benchmarkAccountIds } } } : {}),
  ...(hasAnnotations === true  ? { annotations: { some: {} } } : {}),
  ...(hasAnnotations === false ? { annotations: { none: {} } } : {}),
  ...(cursorObj ? {
    OR: [
      { updatedAt: { lt: new Date(cursorObj.updatedAt) } },
      { AND: [{ updatedAt: { equals: new Date(cursorObj.updatedAt) } }, { id: { gt: cursorObj.id } }] },
    ],
  } : {}),
};
```

分页逻辑（`take: limit + 1`，截取前 `limit` 条，多余则 `hasMore = true`）。

Mapper：

```typescript
function mapToDecompositionListItemDTO(
  item: Prisma.AiWorkspaceGetPayload<{ include: typeof decompositionListInclude }>,
): DecompositionListItemDTO {
  return {
    workspaceId: item.id,
    videoId: item.video.id,
    videoTitle: item.video.title,
    videoCoverUrl: item.video.coverUrl ?? null,
    accountId: item.video.account.id,
    accountNickname: item.video.account.nickname,
    accountAvatar: item.video.account.avatar,
    annotationCount: item._count.annotations,
    updatedAt: item.updatedAt.toISOString(),
  };
}
```

### 新增方法 2：`findDistinctBenchmarkAccountsByUser`

```typescript
async findDistinctBenchmarkAccountsByUser(params: {
  userId: string;
  organizationId: string;
}): Promise<Array<{ id: string; nickname: string; avatar: string }>>
```

实现：`prisma.benchmarkAccount.findMany` 通过 `aiWorkspaces: { some: { userId, organizationId } }` 关联过滤，`select: { id, nickname, avatar }`, `orderBy: { nickname: 'asc' }`。

---

## 前端组件设计

### 路由

`/decompositions` → `src/app/(dashboard)/decompositions/page.tsx`（服务端组件入口，渲染客户端 `DecompositionsPage`）

### 目录结构

```
src/components/features/decompositions/
  decompositions-page.tsx      # 页面级客户端组件（状态管理 + 筛选 + 分页）
  decomposition-list.tsx       # 列表 + "加载更多" 按钮
  index.ts                     # barrel export
```

### 组件树

```
decompositions/page.tsx (Server Component)
└── DecompositionsPage (Client Component)
    ├── DashboardPageShell (title="拆解列表", description="你的全部 AI 拆解记录")
    ├── DecompositionFilters（筛选栏，内联于 DecompositionsPage）
    │   ├── 对标账号多选下拉（Command + Popover，数据来自 filter-accounts API）
    │   └── 拆解状态单选（全部 / 有批注 / 无批注）
    └── DecompositionList
        ├── BRAND_TABLE_WRAPPER 桌面表格（列：封面、视频标题、账号、批注数、状态、更新时间、操作）
        ├── 每行点击 → router.push(`/benchmarks/${accountId}`)
        ├── 操作列「发起仿写」按钮 → router.push(`/benchmarks/${accountId}?videoId=${videoId}&stage=rewrite`)
        ├── 空状态：EmptyState 组件
        └── 「加载更多」按钮（hasMore 时显示）
```

### 状态管理方案

客户端状态留在 `DecompositionsPage` 组件的 `useState`，无需 Zustand store（不跨组件共享）：

- `filterAccounts: string[]` — 已选对标账号 IDs
- `hasAnnotations: boolean | undefined` — 拆解状态筛选
- `cursor: string | null` — 当前分页游标
- `allItems: DecompositionListItemDTO[]` — 累积列表（"加载更多"模式）
- `isLoading: boolean`

### API Client 扩展

`src/lib/api-client.ts` 新增：

```typescript
getDecompositions(params: ListDecompositionsParams): 
  Promise<ApiResponse<CursorPaginatedData<DecompositionListItemDTO>>>

getDecompositionFilterAccounts(): 
  Promise<ApiResponse<Array<{ id: string; nickname: string; avatar: string }>>>
```

---

## 导航入口

**文件**: `src/components/shared/layout/app-navigation.ts`

在 `APP_NAV_ITEMS` 的 "对标账号"（Target 图标）后插入：

```typescript
{
  icon: Layers,        // from "lucide-react"
  label: "拆解列表",
  href: "/decompositions",
  roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
  section: "workspace",
},
```

同时在 import 中加入 `Layers`。

---

## 跨模块依赖

| 依赖关系 | 说明 |
|----------|------|
| `src/types/ai-workspace.ts` → 后端 + 前端 | 新增 `DecompositionListItemDTO`、`ListDecompositionsParams` 为前后端共享类型，必须最先完成 |
| `src/types/api.ts` | 已有 `CursorPaginatedData<T>` 无需修改 |
| BE-002 Repository → BE-003 Service | Service 调用 Repository 方法，Repository 先完成 |
| BE-003 Service → BE-004 API Route | Route Handler 调用 Service，Service 先完成 |
| BE-001 Types → T-FE-001 API Client | 前端 API Client 类型标注依赖 DTO 类型，类型定义先完成 |

**推荐执行顺序**: BE-001 → BE-002 → BE-003 → BE-004 → T-FE-001 → T-FE-002 → T-FE-003 → T-FE-004

---

## 架构决策记录

### ADR-001：`/ai-workspace/[videoId]` 路由处理

**背景**：v0.3.4 需求要求点击拆解列表行跳转到 AI 工作台，但明确标注"独立工作台路由实现"为非目标。

**决策**：v0.3.4 不新建 `/ai-workspace/[videoId]` 独立路由。`DecompositionListItemDTO` 中包含 `accountId` 字段，前端直接构造以下链接：
- 点击行 → `/benchmarks/[accountId]`（进入该账号的对标账号详情页，用户可从视频列表快速定位）
- 发起仿写 → `/benchmarks/[accountId]?videoId=[videoId]&stage=rewrite`

**代价**：用户跳转后仍需在对标账号视频列表中找到对应视频后手动打开工作台（除发起仿写路径外）。

**后续**：待 M-005 版本实现完整工作台路由后替换为 `/ai-workspace/[videoId]` 直接跳转。

### ADR-002：筛选账号数据独立接口

**背景**：对标账号筛选下拉需要加载当前用户有 workspace 记录的 BenchmarkAccount 列表。

**决策**：设计为独立的 `GET /api/decompositions/filter-accounts` 轻量接口，而非在主列表 API 中内嵌。

**原因**：主列表 cursor 分页下无法在第 N 页知晓全量账号列表；独立接口使前端可并行加载筛选项与第一页列表，响应更快。
