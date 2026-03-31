# 后端架构规范

> 摘要：三层架构 Route Handler → Service → Repository。Zod 验证输入，AppError 统一错误处理，Prisma 操作数据库。

## 分层职责

```
Route Handler (src/app/api/)
  ├── 解析请求参数
  ├── Zod schema 验证
  ├── 调用 Service
  └── 返回统一响应格式

Service (src/server/services/)
  ├── 业务逻辑
  ├── 权限检查
  ├── 跨实体协调
  └── 抛出 AppError

Repository (src/server/repositories/)
  ├── Prisma CRUD 操作
  ├── 查询构建
  └── 数据转换
```

## Route Handler 模板

```typescript
// src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { userService } from "@/server/services/user.service";
import { handleApiError, successResponse } from "@/lib/api-response";

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createUserSchema.parse(body);
    const user = await userService.create(data);
    return successResponse(user, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "20");
    const result = await userService.list({ page, limit });
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

## Service 模板

```typescript
// src/server/services/user.service.ts
import { userRepository } from "@/server/repositories/user.repository";
import { AppError } from "@/lib/errors";

class UserService {
  async create(data: { name: string; email: string }) {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw new AppError("EMAIL_EXISTS", "邮箱已被注册", 409);
    }
    return userRepository.create(data);
  }

  async list(params: { page: number; limit: number }) {
    return userRepository.findMany(params);
  }
}

export const userService = new UserService();
```

## Repository 模板

```typescript
// src/server/repositories/user.repository.ts
import { prisma } from "@/lib/prisma";

class UserRepository {
  async create(data: { name: string; email: string }) {
    return prisma.user.create({ data });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findMany(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count(),
    ]);
    return { items, total, page, limit };
  }
}

export const userRepository = new UserRepository();
```

## 统一响应格式

```typescript
// src/lib/api-response.ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>(
    { success: true, data },
    { status }
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: "VALIDATION_ERROR", message: error.errors[0].message } },
      { status: 400 }
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  console.error("Unhandled error:", error);
  return NextResponse.json<ApiResponse<never>>(
    { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
    { status: 500 }
  );
}
```

## 错误处理

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}
```

## 规则

1. Route Handler 只做：解析参数 → 验证 → 调用 Service → 返回响应
2. Service 包含所有业务逻辑，可调用多个 Repository
3. Repository 只做数据库操作，不含业务逻辑
4. 所有输入通过 Zod schema 验证，Schema 定义在 Route Handler 文件顶部
5. 错误通过 AppError 抛出，Route Handler 统一捕获
6. 禁止在 Route Handler 中直接使用 Prisma client
