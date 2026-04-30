# v0.5.0 后端任务

## 必读文档

- `docs/product/versions/v0.5.0/requirements.md`
- `docs/product/versions/v0.5.0/technical-design.md`
- `docs/architecture/backend.md`
- `docs/architecture/api-conventions.md`

---

## BE-001: Prisma Schema — 新增 VideoRewriteLink

**文件**: `prisma/schema.prisma`

新增模型：
```prisma
model VideoRewriteLink {
  id        String      @id @default(cuid())
  videoId   String      @unique
  video     DouyinVideo @relation(fields: [videoId], references: [id])
  rewriteId String
  rewrite   Rewrite     @relation(fields: [rewriteId], references: [id])
  linkedAt  DateTime    @default(now())
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  @@index([rewriteId])
  @@map("video_rewrite_links")
}
```

在 `DouyinVideo` 添加反向关联 `rewriteLink VideoRewriteLink?`
在 `Rewrite` 添加反向关联 `videoLinks VideoRewriteLink[]`

执行: `pnpm db:migrate` → `pnpm db:generate`

## BE-002: 新增 videoRewriteLinkRepository

**文件**: `src/server/repositories/video-rewrite-link.repository.ts`

方法：
- `create(videoId, rewriteId)` → `VideoRewriteLink`
- `findByVideoId(videoId)` → link with rewrite info or null
- `deleteByVideoId(videoId)` → void

## BE-003: 扩展 rewriteRepository — listMineWithFinalVersion

**文件**: `src/server/repositories/rewrite.repository.ts`

新增方法 `findMineWithFinalVersion(userId, organizationId)`:
- 查询该用户的 Rewrite，filter: versions 中有 `isFinalVersion=true`
- include: targetAccount.nickname, versions (filter isFinalVersion=true take:1), workspace.video.title (for WORKSPACE mode)
- 返回轻量 DTO（见 technical-design.md §3.5）

## BE-004: 扩展 videoService — 快照 + 关联操作

**文件**: `src/server/services/video.service.ts`

新增方法：
- `getSnapshots(videoId, caller, days)`: 调用 videoSnapshotRepository.findByVideoId，验证视频可见性
- `getRewriteLink(videoId, caller)`: 验证视频可见性，查询关联
- `linkRewrite(videoId, rewriteId, caller)`: 验证视频归属当前用户账号 + Rewrite 归属当前用户 + Rewrite 有最终稿 → upsert VideoRewriteLink
- `unlinkRewrite(videoId, caller)`: 验证视频归属当前用户账号 → 删除关联

## BE-005: 扩展 rewriteService — listMineWithFinalVersion

**文件**: `src/server/services/rewrite.service.ts`

新增方法 `listMineWithFinalVersion(caller)`:
- 调用 rewriteRepository.findMineWithFinalVersion
- 返回 RewritePickerItemDTO[]

## BE-006: API 路由 — 快照

**文件**: `src/app/api/videos/[id]/snapshots/route.ts`

`GET`: `days` query param (1~90, default: 7) → `videoService.getSnapshots()`

## BE-007: API 路由 — 视频关联

**文件**: `src/app/api/videos/[id]/rewrite-link/route.ts`

- `GET`: → `videoService.getRewriteLink()`
- `PUT`: body `{ rewriteId }` → `videoService.linkRewrite()`
- `DELETE`: → `videoService.unlinkRewrite()`

## BE-008: API 路由 — 仿写选择器

**文件**: `src/app/api/rewrites/mine/route.ts`

`GET`: → `rewriteService.listMineWithFinalVersion()` (EMPLOYEE only)

---

## 自省报告

（实现完成后填写）
