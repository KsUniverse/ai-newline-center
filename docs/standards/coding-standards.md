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

## 注释规范

- **不加无意义注释**: 代码自解释
- **关键决策加注释**: 解释 "为什么" 而非 "做什么"
- **TODO 格式**: `// TODO: [TAG] 描述` (TAG: INTEGRATE / OPTIMIZE / FIXME)

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
feature/v0.1            # 版本开发分支
```
