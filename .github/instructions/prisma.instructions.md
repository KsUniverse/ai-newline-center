---
description: "Use when modifying Prisma schema, creating migrations, or working with database models. Enforces naming conventions and required fields."
applyTo: "prisma/**"
---

# Prisma / 数据库指令

> 完整规范参见 `docs/architecture/database.md`

## 关键规则速查

1. **Model**: PascalCase 单数, **Table**: snake_case 复数 `@@map("xxx")`
2. **必备字段**: `id String @id @default(cuid())` + `createdAt` + `updatedAt`
3. **数据隔离**: 业务模型必须有 `organizationId` + `@@index([organizationId])`
4. **软删除**: `deletedAt DateTime?`
5. **关系**: 显式定义 `@relation(fields: [...], references: [...])`
6. **迁移**: `pnpm db:migrate --name <描述>` → `pnpm db:generate`，禁止修改已提交迁移文件
