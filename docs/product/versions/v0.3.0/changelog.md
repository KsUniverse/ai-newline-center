# Changelog — v0.3.0

> 发布日期: 2026-04-04
> 状态: Released

## 摘要

完成 F-003-1「视频转录 — AI 转文字」全栈实现。

## 后端功能

### 数据模型

- 新增 `Transcription` 模型（`TranscriptionStatus` 枚举：PENDING / PROCESSING / COMPLETED / FAILED）
- 字段：`originalText`、`editedText`（独立存储）、`aiModel`、`errorMessage`、软删除字段

### API

- `POST /api/transcriptions` — 发起转录（入队 BullMQ）
- `GET /api/transcriptions?videoId=` — 查询转录记录
- `PATCH /api/transcriptions/[id]` — 保存人工编辑 / 恢复 AI 原文
- `GET /api/transcriptions/[id]/sse` — SSE 实时推送转录状态

### 队列 & Worker

- BullMQ `transcription` 队列，Worker 调用 AiGateway 处理音视频
- Worker 错误捕获，Job 失败自动更新 DB 状态为 FAILED
- SSE 通过 Redis Pub/Sub 桥接，支持多进程扩展

### AI Gateway

- 新增 `transcribe()` 方法，含 120s `AbortSignal.timeout` 超时保护
- 通过 `TRANSCRIPTION_AI_MODEL` 环境变量配置模型

## 前端功能

- `VideoTranscriptionEditor` — 内联编辑组件，字数统计，保存/取消
- `VideoTranscriptionPanel` — 完整状态机面板（null/PENDING/PROCESSING/COMPLETED/FAILED），SSE 实时订阅 + onerror 处理
- `BenchmarkVideoDetailPanel` — 视频详情 Slide Panel（元信息 + AI 转录区）
- `BenchmarkVideoList` — 新增 `onVideoClick` prop
- `SlidePanel` — 新建通用从右侧滑出面板组件

## 架构升级（[ARCH-CHANGE]）

- `docs/architecture/backend.md` 新增 BullMQ Worker 初始化模式（`initialized` flag 防热重载重复注册）
- `docs/architecture/api-conventions.md` 新增 SSE 端点规范（路径约定、事件格式、心跳 30s、终态快速路径）

## 验证

- `pnpm type-check` ✅
- `pnpm lint` ✅
