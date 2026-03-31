---
description: "Use when writing backend API routes, services, or repositories. Enforces three-layer architecture with Zod validation and AppError handling."
applyTo: ["src/app/api/**", "src/server/**"]
---

# 后端开发指令

## 架构约束

- **三层分离**: Route Handler → Service → Repository
- Route Handler 只做: 解析参数 → Zod 验证 → 调用 Service → 返回统一响应
- Service 包含业务逻辑，可调用多个 Repository
- Repository 只做 Prisma 操作，不含业务逻辑
- **禁止在 Route Handler 中直接调用 Prisma**

## 文件约定

- Route Handler: `src/app/api/[resource]/route.ts`
- Service: `src/server/services/[resource].service.ts`
- Repository: `src/server/repositories/[resource].repository.ts`
- 详细模板参见 `docs/architecture/backend.md`

## 必须遵循

- 所有输入通过 Zod schema 验证，schema 定义在 Route Handler 文件顶部
- 所有响应使用 `successResponse()` / `handleApiError()`
- 业务错误使用 `AppError(code, message, statusCode)`
- API 响应格式: `{ success: boolean, data?: T, error?: { code, message } }`
- 列表接口必须支持分页

## 禁止操作

- 不修改 src/components/** (前端组件)
- 不修改 src/app/**/page.tsx (页面文件)
- 不修改 docs/** (文档)
