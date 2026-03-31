---
description: "Use when creating or modifying Next.js API route handlers. Enforces unified response format, Zod validation, and service layer delegation."
applyTo: "src/app/api/**"
---

# API Route 指令

## Route Handler 结构

```typescript
import { NextRequest } from "next/server";
import { z } from "zod";
import { xxxService } from "@/server/services/xxx.service";
import { handleApiError, successResponse } from "@/lib/api-response";

const createSchema = z.object({ /* ... */ });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const result = await xxxService.create(data);
    return successResponse(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
```

## 规则

- Zod schema 定义在文件顶部
- 只调用 Service，**不直接调用 Prisma / Repository**
- 统一用 `successResponse()` 和 `handleApiError()` 返回
- 响应格式: `{ success: boolean, data?: T, error?: { code, message } }`
- GET 列表必须支持 page/limit 分页参数
- 详细 API 规范参见 `docs/architecture/api-conventions.md`
