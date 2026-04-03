# 编码规范

> 摘要：TypeScript strict 模式，ESLint + Prettier 强制格式。文件 kebab-case，组件 PascalCase，函数 camelCase。禁止 any，显式类型标注。

## TypeScript

### strict 模式要求

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### 类型规则

- **禁止 `any`**：使用 `unknown` + 类型守卫
- **禁止类型断言 `as`**：除非与第三方库交互且有注释说明
- **优先 `interface`**：描述对象结构时优先 interface，类型运算用 type
- **显式返回类型**：Service 和 Repository 公共方法必须标注返回类型
- **Zod → Type**：API 输入类型通过 `z.infer<typeof schema>` 生成

## 命名规范

| 元素 | 规范 | 示例 |
|------|------|------|
| 文件 | kebab-case | `user-profile.tsx` |
| 目录 | kebab-case | `user-profile/` |
| 组件 | PascalCase | `export function UserProfile()` |
| 函数 | camelCase | `function getUserById()` |
| 变量 | camelCase | `const userName = ...` |
| 常量 | UPPER_SNAKE_CASE | `const MAX_RETRIES = 3` |
| 类型/接口 | PascalCase | `interface UserProfile {}` |
| 枚举 | PascalCase + UPPER_SNAKE | `enum Status { ACTIVE }` |
| Hook | camelCase, use 前缀 | `function useAuth()` |
| Store | camelCase, use 前缀 | `const useAuthStore = create(...)` |
| Service | camelCase | `const userService = new UserService()` |

## 导入顺序

```typescript
// 1. node_modules
import { NextResponse } from "next/server";
import { z } from "zod";

// 2. @/ 别名 (按层级)
import { prisma } from "@/lib/prisma";
import { userService } from "@/server/services/user.service";
import { Button } from "@/components/ui/button";

// 3. 相对路径 (仅同模块内)
import { formatDate } from "./utils";

// 4. 类型导入
import type { User } from "@/types/user";
```

## 函数规范

- **单一功能**: 一个函数做一件事
- **参数数量**: 超过 3 个参数使用 options 对象
- **早返回**: 优先使用 guard clause 减少嵌套
- **抽象优先**: 出现第二处同构逻辑时，优先提炼共享 helper / mapper / query builder，禁止复制后轻微改名继续扩展

```typescript
// ✅ Good
async function getUser(id: string): Promise<User> {
  const user = await userRepository.findById(id);
  if (!user) throw new AppError("NOT_FOUND", "用户不存在", 404);
  return user;
}

// ❌ Bad
async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (user) {
    return user;
  } else {
    throw new Error("not found");
  }
}
```

## 错误处理

- **系统边界验证**: API 入口用 Zod 验证，内部不重复验证
- **业务错误用 AppError**: 包含 code + message + statusCode
- **不吞错误**: catch 必须处理或重新抛出
- **不用 try-catch 包裹所有代码**: 只在需要特殊处理的地方 catch

## 复用与抽象规范

- **统一风格优先**: 版本文档与既有实现风格冲突时，优先向全局统一模式收敛，再同步回写文档
- **Repository 复用**: 同一 Prisma Model 服务多个业务类型时，优先抽取共享 `where/include/select/orderBy` 构建函数
- **Service 复用**: 共用的外部数据映射、DTO 映射、权限判定，优先抽成私有方法或共享函数
- **禁止复制式扩展**: 不允许为同一领域的近似分支各写一整套几乎相同的查询和处理逻辑
- **语义方法保留**: 抽取共享逻辑后，仍要保留清晰的业务语义方法名，例如 `findManyBenchmarks()`

## 注释规范

- **不加无意义注释**: 代码自解释
- **关键决策加注释**: 解释 "为什么" 而非 "做什么"
- **TODO 格式**: `// TODO: [TAG] 描述` (TAG: INTEGRATE / OPTIMIZE / FIXME)

## 文档同步规范

- 当实现中沉淀出稳定通用模式时，必须评估是否需要同步到 `docs/architecture/*` 或 `docs/standards/*`
- 当目录、命名、分层模式发生稳定变化后，需同步更新对应文档，避免 Agent 或 Copilot 继续依据旧文档生成代码

## Git 规范

### 提交信息

```
<type>(<scope>): <description>

type: feat|fix|refactor|style|docs|test|chore
scope: 模块名
description: 简短描述 (中文可)
```

### 分支

```
main                    # 稳定分支
feature/v0.1.0          # 版本迭代分支
```

## 环境变量

所有环境变量通过 `src/lib/env.ts` 统一管理，使用 Zod 验证：

```typescript
// src/lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  CRAWLER_API_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
```

**规则**: 代码中禁止直接 `process.env.XXX`，统一使用 `env.XXX`。
