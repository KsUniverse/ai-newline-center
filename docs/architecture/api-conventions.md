# API 设计规范

> 摘要：RESTful 风格，统一响应格式 `{ success, data?, error? }`。路径 kebab-case，使用标准 HTTP 方法和状态码。AI/爬虫长任务通过异步任务 API + SSE 流式返回。

## URL 结构

```
/api/{resource}                 # 集合操作 (GET list, POST create)
/api/{resource}/{id}            # 单资源操作 (GET, PUT, DELETE)
/api/{resource}/{id}/{sub}      # 子资源
```

- 资源名使用 **kebab-case 复数**: `/api/project-tasks`
- 路径参数使用 **cuid** ID: `/api/users/clx1234...`

## HTTP 方法

| 方法 | 路径 | 用途 | 状态码 |
|------|------|------|--------|
| GET | /api/users | 列表查询 | 200 |
| GET | /api/users/:id | 单条查询 | 200 / 404 |
| POST | /api/users | 创建 | 201 |
| PUT | /api/users/:id | 全量更新 | 200 / 404 |
| PATCH | /api/users/:id | 部分更新 | 200 / 404 |
| DELETE | /api/users/:id | 删除 | 200 / 404 |

## 统一响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... }
}
```

### 列表响应（带分页）

```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "邮箱格式不正确"
  }
}
```

## 错误码规范

| HTTP 状态码 | 错误码 | 场景 |
|-------------|--------|------|
| 400 | VALIDATION_ERROR | 请求参数验证失败 |
| 401 | UNAUTHORIZED | 未登录 |
| 403 | FORBIDDEN | 无权限 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 资源冲突（如邮箱已存在） |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

## 查询参数规范

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| page | number | 页码（从 1 开始） | 1 |
| limit | number | 每页数量 (max: 100) | 20 |
| sort | string | 排序字段 | createdAt |
| order | "asc" \| "desc" | 排序方向 | desc |
| search | string | 搜索关键词 | — |

## 类型定义

```typescript
// src/types/api.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}
```

## 规则

1. 所有响应必须使用 `ApiResponse<T>` 格式
2. 列表接口必须支持分页
3. 输入验证使用 Zod，schema 定义在 Route Handler 文件顶部
4. 不在 URL 中暴露敏感信息
5. API 版本暂不使用前缀（v1），未来需要时在路径中添加
6. 所有需要认证的接口必须先调用 `auth()` 获取 session
7. 长任务（AI/爬虫）使用异步任务 API 模式

---

## 异步任务 API 模式

用于 AI 拆解、AI 仿写、爬虫同步等耗时操作。

### 提交任务

```
POST /api/tasks
Body: { type: "AI_REWRITE", payload: { ... } }
Response: { success: true, data: { id: "task_xxx", status: "PENDING" } }
```

### 查询任务状态

```
GET /api/tasks/{id}
Response: { success: true, data: { id, status, result?, error? } }
```

### SSE 流式订阅

```
GET /api/tasks/{id}/stream
Content-Type: text/event-stream

event: chunk
data: {"text": "生成的部分文本..."}

event: chunk
data: {"text": "更多文本..."}

event: done
data: {"taskId": "task_xxx", "status": "COMPLETED"}

event: error
data: {"code": "AI_ERROR", "message": "模型调用失败"}
```

### SSE 规范

| 事件类型 | 数据格式 | 说明 |
|---------|---------|------|
| `chunk` | `{ text: string }` | AI 生成的文本片段 |
| `progress` | `{ percent: number, message: string }` | 进度更新 |
| `done` | `{ taskId: string, status: string }` | 任务完成 |
| `error` | `{ code: string, message: string }` | 任务失败 |

**客户端处理**：使用 `EventSource` API 订阅，连接断开时可重连。

---

## 认证相关 API

```
POST /api/auth/signin          # NextAuth 内置登录
POST /api/auth/signout         # NextAuth 内置登出
GET  /api/auth/session         # NextAuth 获取当前 session
```

不需要自定义认证 API，直接使用 NextAuth 内置路由。
