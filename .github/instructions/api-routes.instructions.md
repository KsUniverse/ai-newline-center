---
description: "Use when creating or modifying Next.js API route handlers. Enforces unified response format, Zod validation, and service layer delegation."
applyTo: "src/app/api/**"
---

# API Route 指令

> 完整规范参见 `docs/architecture/api-conventions.md` + `docs/architecture/backend.md`

## 关键规则速查

1. **Zod 验证**: schema 定义在文件顶部，所有输入必须验证
2. **只调用 Service**: 禁止直接调用 Prisma/Repository
3. **统一响应**: `successResponse()` + `handleApiError()`
4. **格式**: `{ success: boolean, data?: T, error?: { code, message } }`
5. **分页**: GET 列表必须支持 page/limit 参数
6. **认证**: `const session = await auth()`
7. **同领域接口一致性**: 分页、筛选参数和 DTO 语义优先复用统一命名，不随意引入近似参数名
8. **只做入口层**: 不在 Route Handler 里拼业务条件或 Prisma 查询，复杂筛选语义交给 Service / Repository
