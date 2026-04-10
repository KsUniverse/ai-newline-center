# v0.3.2 后端任务清单

## 必读文档

> 开始开发前必须阅读以下文档：

- `docs/product/versions/v0.3.2/requirements.md` — 本版本需求（理解业务背景）
- `docs/product/versions/v0.3.2/technical-design.md` — 本版本技术设计（**主要参考**）
- `docs/architecture/backend.md` — 后端分层规范
- `docs/architecture/database.md` — 数据库设计规范
- `docs/architecture/api-conventions.md` — API 设计规范
- `docs/standards/coding-standards.md` — 编码规范

**参考现有实现**：

- `prisma/schema.prisma` — 当前 Schema，了解 Organization/User 关联写法
- `src/server/repositories/ai-workspace.repository.ts` — Repository 模式参考
- `src/server/services/ai-workspace.service.ts` — Service 权限检查模式参考
- `src/app/api/users/route.ts` — Route Handler 模式参考
- `src/lib/errors.ts` — AppError 使用方式
- `src/types/api.ts` — 共享类型定义（需追加 `CursorPaginatedData<T>`）

---

## 摘要

- 任务总数: 5
- 涉及文件:
  - `prisma/schema.prisma`
  - `src/types/api.ts`（追加类型）
  - `src/types/fragment.ts`（新增）
  - `src/server/repositories/fragment.repository.ts`（新增）
  - `src/server/services/fragment.service.ts`（新增）
  - `src/app/api/viewpoints/route.ts`（新增）
  - `src/app/api/viewpoints/[id]/route.ts`（新增）

---

## 任务列表

- [ ] **BE-001**: (P0) 更新 Prisma Schema 并生成迁移

  - 文件: `prisma/schema.prisma`
  - 详情:
    1. 新增 `Fragment` 模型（字段：`id / content / organizationId / createdByUserId / createdAt / updatedAt / deletedAt`）
    2. `content` 字段使用 `@db.Text`（无 DB 层字符限制，500 字上限在业务层校验）
    3. 添加索引：`@@index([organizationId])`、`@@index([createdByUserId])`
    4. 表名：`@@map("fragments")`
    5. 在 `Organization` 模型中追加 `fragments Fragment[]` 关联
    6. 在 `User` 模型中追加 `createdFragments Fragment[] @relation("FragmentCreator")` 关联
    7. `Fragment` 中使用命名关联：`createdByUser User @relation("FragmentCreator", fields: [createdByUserId], references: [id])`
    8. 执行 `pnpm db:migrate`，提交迁移文件
  - 验证: `pnpm db:generate` 无错误，`pnpm type-check` 通过

---

- [ ] **BE-002**: (P0) 新增共享类型与 Fragment DTO 类型

  - 文件: `src/types/api.ts`、`src/types/fragment.ts`（新增）
  - 详情:

    **`src/types/api.ts`（追加以下内容到文件末尾）**:
    ```typescript
    export interface CursorPaginatedData<T> {
      items:      T[];
      nextCursor: string | null;
      hasMore:    boolean;
    }
    ```

    **`src/types/fragment.ts`（新增文件）**:
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

  - 验证: `pnpm type-check` 通过

---

- [ ] **BE-003**: (P0) 实现 Fragment Repository

  - 文件: `src/server/repositories/fragment.repository.ts`（新增）
  - 详情:

    1. **`findMany`** — cursor 分页查询，支持 `q` 搜索（`content: { contains: q }`）。
       - 参数: `{ organizationId, q?, cursor?, limit }`
       - Cursor 解码: `Buffer.from(cursor, 'base64url').toString('utf8')` → JSON `{ c: string, i: string }`
       - WHERE 条件（cursor 存在时追加）:
         ```
         OR: [
           { createdAt: { lt: new Date(c) } },
           { AND: [{ createdAt: new Date(c) }, { id: { lt: i } }] }
         ]
         ```
       - `take: limit + 1`，用 `hasMore = items.length > limit`，截断到 `limit` 条
       - `nextCursor` 计算: `base64url(JSON.stringify({ c: lastItem.createdAt.toISOString(), i: lastItem.id }))`
       - Include: `createdByUser: { select: { id: true, name: true } }`
       - OrderBy: `[{ createdAt: 'desc' }, { id: 'desc' }]`
       - 返回类型: `{ items, nextCursor, hasMore }`

    2. **`create`** — 单条创建（`prisma.fragment.create`）
       - 参数: `{ content, organizationId, createdByUserId }`
       - Include: `createdByUser: { select: { id: true, name: true } }`

    3. **`createMany`** — 批量创建（`prisma.fragment.createMany`）
       - 参数: `{ items: Array<{ content, organizationId, createdByUserId }> }`
       - 返回: `{ count: number }`
       - 注意: `createMany` 不支持 include，需要后续 `findMany` 回填 DTO

    4. **`findById`** — 按 `id` 查单条（含 `deletedAt` 为 null 过滤）
       - Include: `createdByUser: { select: { id: true, name: true } }`

    5. **`softDelete`** — 设置 `deletedAt = new Date()`
       - 参数: `{ id, organizationId }`（确保组织隔离）

  - 验证: `pnpm type-check` 通过

---

- [ ] **BE-004**: (P0) 实现 Fragment Service

  - 文件: `src/server/services/fragment.service.ts`（新增）
  - 详情:

    **`listFragments(caller: SessionUser, params: ListFragmentsParams): Promise<CursorPaginatedData<FragmentDTO>>`**
    - 直接委托 `fragmentRepository.findMany`，传入 `caller.organizationId`（SUPER_ADMIN 需额外处理，本版不涉及跨组织，统一使用 caller.organizationId）
    - 映射返回 `FragmentDTO[]`

    **`createFragments(caller: SessionUser, input: CreateFragmentsInput): Promise<CreateFragmentsResult>`**
    - 对 `input.contents` 做 trim 过滤（`filter(s => s.trim().length > 0)`）
    - 每条 contents 不超过 500 字（业务层再次校验，超出则 throw `AppError("VALIDATION_ERROR", ..., 400)`）
    - 批量调用 `fragmentRepository.createMany`
    - 再用创建时间范围查回刚入库的记录以拼装 DTO（或直接遍历 create 单条，视并发量决定）
    - 返回 `{ created: count, items: FragmentDTO[] }`

    **`deleteFragment(caller: SessionUser, fragmentId: string): Promise<{ id: string }>`**
    - 先 `findById` 确认存在（404 if not found）
    - 权限检查：
      - `SUPER_ADMIN` 或 `BRANCH_MANAGER`: 可删任意本组织观点
      - 其他角色: 只能删自己创建的（`fragment.createdByUserId !== caller.id` → 403）
      - 额外检查：`fragment.organizationId !== caller.organizationId`（非 SUPER_ADMIN 时）→ 403
    - 调用 `fragmentRepository.softDelete({ id: fragmentId, organizationId: caller.organizationId })`
    - 返回 `{ id: fragmentId }`

  - 验证: `pnpm type-check` 通过

---

- [ ] **BE-005**: (P0) 实现 API Route Handlers

  - 文件: `src/app/api/viewpoints/route.ts`（新增）、`src/app/api/viewpoints/[id]/route.ts`（新增）
  - 详情:

    **`src/app/api/viewpoints/route.ts`**

    ```typescript
    // GET /api/viewpoints
    const listQuerySchema = z.object({
      q:      z.string().max(200).optional(),
      cursor: z.string().optional(),
      limit:  z.coerce.number().int().min(1).max(100).default(20),
    });

    export async function GET(request: Request) {
      // 1. auth() → requireRole 为任意登录角色（使用 requireRole(session, UserRole.EMPLOYEE)
      //    但 EMPLOYEE 是最低角色，直接判断 session 存在即可；参考现有模式）
      // 2. listQuerySchema.parse(searchParams)
      // 3. fragmentService.listFragments(session.user, query)
      // 4. successResponse(result)
    }

    // POST /api/viewpoints
    const createSchema = z.object({
      contents: z.array(z.string().min(1).max(500)).min(1).max(50),
    });

    export async function POST(request: Request) {
      // 1. auth() → session 检查（requireRole 任意登录用户）
      // 2. createSchema.parse(body)
      // 3. fragmentService.createFragments(session.user, data)
      // 4. successResponse(result, 201)
    }
    ```

    **`src/app/api/viewpoints/[id]/route.ts`**

    ```typescript
    // DELETE /api/viewpoints/:id
    export async function DELETE(
      request: Request,
      { params }: { params: Promise<{ id: string }> }
    ) {
      // 1. auth() → session 检查
      // 2. await params → { id }
      // 3. fragmentService.deleteFragment(session.user, id)
      // 4. successResponse(result)
    }
    ```

  - 约束:
    - 鉴权：所有接口 `auth()` 获取 session，session 不存在则 `requireRole` 会抛出 401
    - 错误处理：统一 `handleApiError(error)` 包裹
    - 参数校验：Route Handler 层 Zod，Service 层业务校验
  - 验证: `pnpm type-check` 通过，`pnpm lint` 通过

---

## 完成标准

- [ ] `pnpm db:migrate` 执行成功，`fragments` 表已创建
- [ ] `pnpm db:generate` 成功，`prisma.fragment` 可用
- [ ] `pnpm type-check` 全部通过
- [ ] `pnpm lint` 无报错
- [ ] 手动测试 `GET /api/viewpoints`、`POST /api/viewpoints`、`DELETE /api/viewpoints/:id` 均正常返回
