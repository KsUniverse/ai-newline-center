---
description: "Use when writing backend API routes, services, or repositories. Enforces three-layer architecture with Zod validation and AppError handling."
applyTo: ["src/app/api/**", "src/server/**"]
---

# 后端开发指令

> 完整规范参见 `docs/architecture/backend.md` + `docs/architecture/api-conventions.md`

## 关键规则速查

1. **三层分离**: Route Handler → Service → Repository，禁止跨层调用
2. **Zod 验证**: 所有 API 输入通过 Zod schema 验证
3. **统一响应**: `successResponse()` / `handleApiError()`，格式 `{ success, data?, error? }`
4. **数据隔离**: Repository 列表查询必须接受 `organizationId` 过滤
5. **认证**: 需认证接口先 `const session = await auth()`
6. **AI 调用**: 统一走 `aiGateway`，禁止直接调用 AI SDK
7. **爬虫调用**: 统一走 `crawlerService`，禁止直接 fetch
8. **环境变量**: `env.XXX` (from `@/lib/env`)，禁止 `process.env`
9. **抽象优先**: 出现第二处近似查询 / 映射逻辑时，优先提炼共享 `where/include/helper/mapper`
10. **避免复制式实现**: 若只是 `type`、权限、归档、文案差异，禁止复制一整套近似 Service / Repository
11. **语义方法优先**: 上层调用业务语义方法，不直接拼底层 Prisma 条件替代 Repository

## 禁止操作

- 不修改 src/components/**、src/app/**/page.tsx — **Phase 5 集成联调除外**
- 不修改 docs/**
