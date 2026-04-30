# v0.5.0 技术设计 — 视频-文案关联 + 数据趋势展示

> 版本: v0.5.0
> 创建日期: 2026-04-30
> 范围: F-006-1 视频-文案关联 + F-006-2 数据趋势展示

---

## 1. 现有代码评估

### 1.1 VideoSnapshot（F-006-2）

**结论：无需新增 DB 字段或迁移**

| 项目 | 状态 |
|------|------|
| Prisma 模型 `VideoSnapshot` | ✅ 已存在，字段齐全 |
| `videoSnapshotRepository.findByVideoId()` | ✅ 已实现，支持时间范围和 limit |
| 定时任务 `runVideoSnapshotCollection()` | ✅ 已实现，每 10 分钟采集一次 |
| 前端展示 API | ❌ 缺少：`GET /api/videos/[id]/snapshots` |
| 前端图表组件 | ❌ 缺少：折线图组件（需安装 recharts） |

### 1.2 VideoRewriteLink（F-006-1）

**结论：需要新增 DB 模型和迁移**

| 项目 | 状态 |
|------|------|
| Prisma 模型 `VideoRewriteLink` | ❌ 不存在，需新增 |
| Repository | ❌ 需新增 |
| 仿写列表 API（有最终稿） | ❌ 缺少：`GET /api/rewrites/mine` |
| 视频关联 API | ❌ 缺少：`GET/PUT/DELETE /api/videos/[id]/rewrite-link` |
| 前端弹层关联区域 | ❌ 需扩展 `VideoDetailDialog` |

---

## 2. 数据模型

### 2.1 新增：`VideoRewriteLink`

```prisma
model VideoRewriteLink {
  id        String   @id @default(cuid())
  videoId   String   @unique          // 一视频最多一关联
  video     DouyinVideo @relation(fields: [videoId], references: [id])
  rewriteId String                    // 一稿可多视频关联
  rewrite   Rewrite  @relation(fields: [rewriteId], references: [id])
  linkedAt  DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([rewriteId])
  @@map("video_rewrite_links")
}
```

同时在以下模型添加反向关联：
- `DouyinVideo.rewriteLink VideoRewriteLink?`
- `Rewrite.videoLinks VideoRewriteLink[]`

---

## 3. API 设计

### 3.1 GET `/api/videos/[id]/snapshots` — 获取快照列表

**认证**: 需要（任意角色，但视频须可见）

**Query 参数**:
- `days`: number (1~90, default: 7) — 取最近 N 天

**响应 data**: `VideoSnapshotDTO[]`
```typescript
interface VideoSnapshotDTO {
  id: string;
  timestamp: string; // ISO
  playsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
}
```

### 3.2 GET `/api/videos/[id]/rewrite-link` — 获取当前关联

**认证**: 需要

**响应 data**: `VideoRewriteLinkDTO | null`
```typescript
interface VideoRewriteLinkDTO {
  id: string;
  rewriteId: string;
  rewriteMode: "WORKSPACE" | "DIRECT";
  rewriteTopic: string | null;
  targetAccountNickname: string | null;
  finalContent: string | null;      // 最终稿内容（editedContent ?? generatedContent）
  linkedAt: string;
}
```

### 3.3 PUT `/api/videos/[id]/rewrite-link` — 关联仿写

**认证**: 需要（EMPLOYEE）

**请求 body**: `{ rewriteId: string }`

**业务校验**:
1. 视频须属于当前用户的账号
2. 目标 Rewrite 须属于当前用户
3. 目标 Rewrite 须有 `isFinalVersion=true` 的版本

**响应 data**: `VideoRewriteLinkDTO`

### 3.4 DELETE `/api/videos/[id]/rewrite-link` — 取消关联

**认证**: 需要（EMPLOYEE）

**业务校验**: 视频须属于当前用户的账号

**响应 data**: `{ success: true }`

### 3.5 GET `/api/rewrites/mine` — 获取当前用户有最终稿的仿写列表

**认证**: 需要（EMPLOYEE）

**响应 data**: `RewritePickerItemDTO[]`
```typescript
interface RewritePickerItemDTO {
  id: string;
  mode: "WORKSPACE" | "DIRECT";
  topic: string | null;               // 直接创作模式
  benchmarkVideoTitle: string | null; // 工作台模式下的对标视频标题
  targetAccountNickname: string | null;
  targetAccountId: string | null;
  finalContent: string | null;        // editedContent ?? generatedContent of final version
  createdAt: string;
}
```

---

## 4. 服务层设计

### 4.1 `videoService` 扩展

```typescript
// 获取快照（F-006-2）
getSnapshots(videoId: string, caller: SessionUser, days: number): Promise<VideoSnapshotDTO[]>

// 获取关联（F-006-1）
getRewriteLink(videoId: string, caller: SessionUser): Promise<VideoRewriteLinkDTO | null>

// 关联仿写（F-006-1）
linkRewrite(videoId: string, rewriteId: string, caller: SessionUser): Promise<VideoRewriteLinkDTO>

// 取消关联（F-006-1）
unlinkRewrite(videoId: string, caller: SessionUser): Promise<void>
```

### 4.2 `rewriteService` 扩展

```typescript
// 获取当前用户有最终稿的仿写列表（用于选择器）
listMineWithFinalVersion(caller: SessionUser): Promise<RewritePickerItemDTO[]>
```

---

## 5. Repository 层设计

### 5.1 新增 `videoRewriteLinkRepository`

```typescript
create(videoId: string, rewriteId: string): Promise<VideoRewriteLink>
findByVideoId(videoId: string): Promise<VideoRewriteLinkWithRewrite | null>
deleteByVideoId(videoId: string): Promise<void>
```

### 5.2 `rewriteRepository` 扩展

```typescript
findMineWithFinalVersion(userId: string, organizationId: string): Promise<RewritePickerItem[]>
```

---

## 6. 前端设计

### 6.1 安装 recharts

```bash
pnpm add recharts
```

### 6.2 新增组件

| 组件 | 路径 | 说明 |
|------|------|------|
| `VideoSnapshotChart` | `src/components/features/accounts/video-snapshot-chart.tsx` | 折线图组件（recharts） |
| `VideoRewriteLinkSection` | `src/components/features/accounts/video-rewrite-link-section.tsx` | 关联文案区域 |
| `RewritePickerDialog` | `src/components/features/accounts/rewrite-picker-dialog.tsx` | 选择仿写任务对话框 |

### 6.3 扩展 `VideoDetailDialog`

在现有弹层内追加两个 section：
1. **数据趋势**（F-006-2）：`VideoSnapshotChart`
2. **关联文案**（F-006-1）：`VideoRewriteLinkSection`

### 6.4 新增类型

**文件**: `src/types/video-link.ts`

```typescript
export interface VideoSnapshotDTO { ... }
export interface VideoRewriteLinkDTO { ... }
export interface RewritePickerItemDTO { ... }
```

---

## 7. 迁移计划

1. 新增 `VideoRewriteLink` 模型到 `prisma/schema.prisma`
2. 运行 `pnpm db:migrate` 创建迁移文件
3. 运行 `pnpm db:generate` 更新 Prisma client

---

## 8. 不影响现有功能

- `runVideoSnapshotCollection()` 逻辑无需改动
- 现有 `/api/videos` 列表 API 无需改动
- 仿写生成链路无需改动
