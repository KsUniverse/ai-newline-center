---
description: "Use when modifying Prisma schema, creating migrations, or working with database models. Enforces naming conventions and required fields."
applyTo: "prisma/**"
---

# Prisma / 数据库指令

## Schema 约定

- Model 名: PascalCase 单数 (`User`, `ProjectTask`)
- Field 名: camelCase (`createdAt`, `userId`)
- Table 映射: snake_case 复数 (`@@map("users")`)
- Enum: PascalCase 名, UPPER_SNAKE_CASE 值

## 必备字段

每个模型必须包含：

```prisma
id        String   @id @default(cuid())
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```

软删除模型添加: `deletedAt DateTime?`

## 关系

- 显式定义外键 `@relation(fields: [xxxId], references: [id])`
- 级联删除需显式配置，默认不级联

## 迁移流程

1. 修改 schema.prisma
2. `pnpm db:migrate --name <描述>`
3. `pnpm db:generate`
4. **禁止手动修改已提交的迁移文件**

## 详细规范

参见 `docs/architecture/database.md`
