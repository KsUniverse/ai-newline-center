# v0.3.4 后端任务清单

> 版本: v0.3.4  
> 阶段: Phase 3 — 后端开发  
> 创建日期: 2026-04-27

---

## 必读文档

> 开始开发前必须按顺序阅读以下文档：

- `docs/product/versions/v0.3.4/requirements.md` — 本版本需求（理解业务背景和验收标准）
- `docs/product/versions/v0.3.4/technical-design.md` — 本版本技术设计（API 契约、DTO、设计决策）
- `docs/architecture/backend.md` — 后端三层架构规范（Route Handler → Service → Repository）
- `docs/architecture/database.md` — 数据库设计规范（命名、索引、数据隔离）
- `docs/architecture/api-conventions.md` — API 设计规范（响应格式、错误码、查询参数）
- `docs/standards/coding-standards.md` — 编码规范（TypeScript strict、命名约定）

---

## 摘要

| 属性 | 内容 |
|------|------|
| 任务总数 | 4 |
| 数据库迁移 | 无（零 Prisma schema 变更） |
| 涉及文件 | `src/types/ai-workspace.ts`、`src/server/repositories/ai-workspace.repository.ts`、`src/server/services/ai-workspace.service.ts`、`src/app/api/decompositions/route.ts`、`src/app/api/decompositions/filter-accounts/route.ts` |

---

## 任务列表

---

### T-BE-001 (P0) ✅ 类型扩展 — DecompositionListItemDTO

- **文件**: `src/types/ai-workspace.ts`
- **操作**: 追加（不修改现有类型）

**改动描述**:

在文件末尾追加以下两个类型定义：

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
  updatedAt: string; // ISO 8601
}

export interface ListDecompositionsParams {
  cursor?: string;
  limit?: number;
  benchmarkAccountIds?: string[];
  hasAnnotations?: boolean;
}
```

**验收**:
- `pnpm type-check` 无新增错误
- 两个类型被 T-BE-002 的 Repository 正确引用

---

### T-BE-002 (P0) ✅ Repository 层扩展 — listDecompositions

- **文件**: `src/server/repositories/ai-workspace.repository.ts`
- **操作**: 在已有 `AiWorkspaceRepository` 类中追加两个方法；在类外追加工具函数和内部类型

**改动描述**:

**1. 在文件顶部 import 区域补充类型导入**（`DecompositionListItemDTO` 来自 `@/types/ai-workspace`）

**2. 在文件中 `AiWorkspaceRepository` 类定义之前，添加内部工具（文件级定义，非导出）**：

```typescript
// ─── Cursor 工具（仅此文件内部使用）────────────────────────────────────────────

interface WorkspaceCursor {
  updatedAt: string; // ISO 8601
  id: string;
}

function encodeCursor(cursor: WorkspaceCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(encoded: string): WorkspaceCursor {
  const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)["updatedAt"] !== "string" ||
    typeof (parsed as Record<string, unknown>)["id"] !== "string"
  ) {
    throw new Error("Invalid cursor format");
  }
  return parsed as WorkspaceCursor;
}

// ─── Include 片段（可复用，satisfies 约束）──────────────────────────────────────

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

type DecompositionListRawItem = Prisma.AiWorkspaceGetPayload<{
  include: typeof decompositionListInclude;
}>;

function mapToDecompositionListItemDTO(item: DecompositionListRawItem): DecompositionListItemDTO {
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

**3. 追加 Repository 参数类型（导出，供 Service 引用）**：

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

**4. 在 `AiWorkspaceRepository` 类末尾追加两个公开方法**：

**方法一 `listDecompositions`**（cursor 分页列表）:

```typescript
async listDecompositions(
  params: ListDecompositionsRepoParams,
): Promise<CursorPaginatedData<DecompositionListItemDTO>> {
  const {
    userId,
    organizationId,
    cursor,
    limit = 20,
    benchmarkAccountIds,
    hasAnnotations,
  } = params;

  const cursorObj = cursor ? decodeCursor(cursor) : null;

  const where: Prisma.AiWorkspaceWhereInput = {
    userId,
    organizationId,
    ...(benchmarkAccountIds != null && benchmarkAccountIds.length > 0
      ? { video: { accountId: { in: benchmarkAccountIds } } }
      : {}),
    ...(hasAnnotations === true ? { annotations: { some: {} } } : {}),
    ...(hasAnnotations === false ? { annotations: { none: {} } } : {}),
    ...(cursorObj != null
      ? {
          OR: [
            { updatedAt: { lt: new Date(cursorObj.updatedAt) } },
            {
              AND: [
                { updatedAt: { equals: new Date(cursorObj.updatedAt) } },
                { id: { gt: cursorObj.id } },
              ],
            },
          ],
        }
      : {}),
  };

  const rows = await prisma.aiWorkspace.findMany({
    where,
    include: decompositionListInclude,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const lastItem = items[items.length - 1];
  const nextCursor =
    hasMore && lastItem != null
      ? encodeCursor({ updatedAt: lastItem.updatedAt.toISOString(), id: lastItem.id })
      : null;

  return {
    items: items.map(mapToDecompositionListItemDTO),
    nextCursor,
    hasMore,
  };
}
```

**方法二 `findDistinctBenchmarkAccountsByUser`**（筛选下拉数据）:

```typescript
async findDistinctBenchmarkAccountsByUser(params: {
  userId: string;
  organizationId: string;
}): Promise<Array<{ id: string; nickname: string; avatar: string }>> {
  return prisma.benchmarkAccount.findMany({
    where: {
      deletedAt: null,
      aiWorkspaces: {
        some: {
          userId: params.userId,
          organizationId: params.organizationId,
        },
      },
    },
    select: { id: true, nickname: true, avatar: true },
    orderBy: { nickname: "asc" },
  });
}
```

**注意**：`CursorPaginatedData<T>` 来自 `@/types/api`，需在文件顶部 import 区域补充。

**验收**:
- `pnpm type-check` 无新增错误
- Repository 方法签名与 T-BE-003 Service 调用处一致
- `listDecompositions` 的 cursor 编解码正确（base64url，含格式验证）
- `findDistinctBenchmarkAccountsByUser` 仅返回有 workspace 记录的去重账号

---

### T-BE-003 (P0) ✅ Service 层扩展 — listDecompositions

- **文件**: `src/server/services/ai-workspace.service.ts`
- **操作**: 在已有 `AiWorkspaceService` 类中追加两个公开方法

**改动描述**:

**1. 在顶部 import 区域补充类型导入**：
- `ListDecompositionsRepoParams`（来自 `@/server/repositories/ai-workspace.repository`）
- `CursorPaginatedData`（来自 `@/types/api`）
- `DecompositionListItemDTO`、`ListDecompositionsParams`（来自 `@/types/ai-workspace`）

**2. 在 `AiWorkspaceService` 类末尾追加两个公开方法**：

**方法一 `listDecompositions`**：

```typescript
async listDecompositions(
  caller: SessionUser,
  params: ListDecompositionsParams,
): Promise<CursorPaginatedData<DecompositionListItemDTO>> {
  return aiWorkspaceRepository.listDecompositions({
    userId: caller.id,
    organizationId: caller.organizationId,
    cursor: params.cursor,
    limit: params.limit,
    benchmarkAccountIds: params.benchmarkAccountIds,
    hasAnnotations: params.hasAnnotations,
  });
}
```

**方法二 `listDecompositionFilterAccounts`**：

```typescript
async listDecompositionFilterAccounts(
  caller: SessionUser,
): Promise<Array<{ id: string; nickname: string; avatar: string }>> {
  return aiWorkspaceRepository.findDistinctBenchmarkAccountsByUser({
    userId: caller.id,
    organizationId: caller.organizationId,
  });
}
```

**验收**:
- `pnpm type-check` 无新增错误
- Service 方法签名与 T-BE-004 Route Handler 调用处一致

---

### T-BE-004 (P0) ✅ API 路由

- **文件 A**: `src/app/api/decompositions/route.ts`（新建）
- **文件 B**: `src/app/api/decompositions/filter-accounts/route.ts`（新建）

---

#### 文件 A：`src/app/api/decompositions/route.ts`

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { handleApiError, successResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { aiWorkspaceService } from "@/server/services/ai-workspace.service";

const listDecompositionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new AppError("UNAUTHORIZED", "未登录", 401);
    }

    const { searchParams } = new URL(request.url);
    const { cursor, limit } = listDecompositionsQuerySchema.parse({
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const benchmarkAccountIds = searchParams.getAll("benchmarkAccountIds");
    const hasAnnotationsRaw = searchParams.get("hasAnnotations");
    const hasAnnotations =
      hasAnnotationsRaw === "true" ? true : hasAnnotationsRaw === "false" ? false : undefined;

    const result = await aiWorkspaceService.listDecompositions(session.user, {
      cursor,
      limit,
      benchmarkAccountIds: benchmarkAccountIds.length > 0 ? benchmarkAccountIds : undefined,
      hasAnnotations,
    });

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

#### 文件 B：`src/app/api/decompositions/filter-accounts/route.ts`

```typescript
import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError, successResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { aiWorkspaceService } from "@/server/services/ai-workspace.service";

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new AppError("UNAUTHORIZED", "未登录", 401);
    }

    const accounts = await aiWorkspaceService.listDecompositionFilterAccounts(session.user);
    return successResponse(accounts);
  } catch (error) {
    return handleApiError(error);
  }
}
```

**验收**:
- `GET /api/decompositions` 无 session 时返回 `401 UNAUTHORIZED`
- `GET /api/decompositions` 无筛选参数时返回第一页 20 条（或更少）结果，按 updatedAt 倒序
- `GET /api/decompositions?hasAnnotations=true` 只返回 `annotationCount > 0` 的记录
- `GET /api/decompositions?benchmarkAccountIds=id1&benchmarkAccountIds=id2` 正确过滤
- cursor 分页：第一页 `hasMore=true` 时 `nextCursor` 非 null；将 `nextCursor` 作为下一页 `cursor` 参数可获取后续数据
- `GET /api/decompositions/filter-accounts` 返回当前用户有 workspace 记录的去重账号列表
- `pnpm type-check` 无新增错误
- `pnpm lint` 无新增 lint 错误

---

## 自省报告（Phase 3 完成）

> 完成时间：2026-04-27

### 回顾

1. **可复用抽象**：`decompositionListInclude` + `mapToDecompositionListItemDTO` 作为文件级私有常量/函数，避免在方法内内联，符合抽象优先原则。
2. **技术偏差修正**：`tasks-backend.md` 内 `findDistinctBenchmarkAccountsByUser` 代码示例使用了不存在的 `BenchmarkAccount.aiWorkspaces` 直接关联，实际 schema 路径为 `BenchmarkAccount → videos → aiWorkspaces`，已按正确路径实现。
3. **Cursor 安全性**：`decodeCursor` 包裹在 `try-catch` 中，伪造或格式错误的 cursor 会被静默忽略（退化为首页查询），不抛出 500 错误。
4. **认证方式**：使用 `if (!session?.user)` + `AppError("UNAUTHORIZED")` 模式而非 `requireRole`，与 tasks-backend.md 约定一致；所有角色（EMPLOYEE/BRANCH_MANAGER/SUPER_ADMIN）均仅查看自身数据，无角色提权差异。

### 文档检查

- 现有后端架构文档（`docs/architecture/backend.md`、`api-conventions.md`）无需补充，本版改动完全在既有模式内。
- `technical-design.md` 中 `findDistinctBenchmarkAccountsByUser` 的 `aiWorkspaces` 直接引用描述与实际 schema 不符，属于文档笔误，已在实现中修正。如需同步修正文档请告知。

---

## 自省报告（Phase 5 集成联调完成）

> 完成时间：2026-04-27

### 集成检查结论

| 检查点 | 结论 |
|--------|------|
| API 路径 | ✅ 前端 `/decompositions` + `/decompositions/filter-accounts` 经 `apiClient`（自动加 `/api` 前缀）后路径与后端 Route Handler 完全匹配 |
| 响应解包 | ✅ `apiClient.request<T>` 已将 `ApiResponse<T>.data` 解包返回，前端直接拿到 `CursorPaginatedData<DecompositionListItemDTO>`，类型对齐 |
| 筛选参数格式 | ✅ `searchParams.append("benchmarkAccountIds", id)` 生成重复参数，与后端 `getAll("benchmarkAccountIds")` 对应；`hasAnnotations` 以字符串 `"true"/"false"` 传递，后端做等值对比解析，格式一致 |
| TypeScript 类型 | ✅ `pnpm type-check` 无错误 |
| Lint | ✅ `pnpm lint` 无 warning |
| TODO: [INTEGRATE] | ✅ 已移除全部 5 处标注（均在 `decompositions-page.tsx`）；代码实际已调用真实 API，注释为前端开发阶段残留，删除后不影响功能 |

### 回顾

- 前端开发阶段已自行用 `apiClient.get<T>()` 内联调用实现了真实集成，无 mock 数据需要替换。
- 集成联调的核心工作为：确认路径/响应格式/参数格式三处对齐，并清除过期标注。
- 无新增抽象，符合"不越界"原则。
