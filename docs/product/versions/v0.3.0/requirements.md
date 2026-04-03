# v0.3.0 需求文档 — 视频转录（AI 转文字）

> 版本: v0.3.0
> 里程碑: v0.3.x（AI 拆解）
> 需求来源: [PRD.md M-003](../../PRD.md) F-003-1
> 创建日期: 2026-04-04

---

## 版本信息

| 属性 | 值 |
|------|----|
| 版本号 | v0.3.0 |
| 里程碑 | v0.3.x — AI 拆解 |
| 功能点 | F-003-1 |
| 依赖版本 | v0.2.2（对标账号基础） |

---

## 摘要

- **版本目标**: 为对标账号视频引入 AI 语音转录能力，将视频语音内容转为可编辑的文字文案，为后续 AI 划句批注拆解（F-003-2）提供文本基础
- **功能数量**: 1 个（F-003-1 视频转录）
- **优先级分布**: P0(1)
- **前置依赖**: v0.2.2（对标账号管理）已完成；DouyinVideo 已有 `videoStoragePath` 字段存储本地视频文件；BullMQ + SSE 基础架构已就绪
- **后续迭代**: v0.3.1 的 AI 划句批注拆解将以本版本生成的 `Transcription` 文本为输入

---

## 用户故事

> 作为一名**员工**，当我浏览对标账号的爆款视频时，我希望能一键触发 AI 将视频内容转录为文字，然后对转录文案进行校对和修正，为后续的 AI 拆解操作做准备。

---

## 面向角色与访问权限表

| 角色 | 发起转录 | 查看转录文案 | 编辑转录文案 |
|------|---------|------------|------------|
| **员工** | 本组织对标视频 | 本组织对标视频 | 本组织对标视频 |
| **分公司负责人** | 本分公司对标视频 | 本分公司对标视频 | 本分公司对标视频 |
| **超级管理员** | 全平台对标视频 | 全平台对标视频 | 全平台对标视频 |

> **隔离规则**：Transcription 绑定 DouyinVideo → DouyinAccount（organizationId），数据可见性与对标账号保持一致。组织内任意员工均可发起和编辑转录，不限制为转录发起者本人。

---

## 功能清单

---

### F-003-1: 视频转录 (P0)

**描述**: 员工在对标视频详情页点击「AI 转录」，系统将视频转录任务通过 BullMQ 异步入队，由 AI Gateway 调用语音识别模型将视频语音内容转录为文字文案，再通过 SSE 推送结果到前端展示。转录完成后，员工可对文案进行人工校对和编辑，校对结果与 AI 原文分开存储。

---

#### 触发方式

- **触发入口**: 对标视频详情页的「AI 转录」按钮
- **触发条件**:
  - 视频尚无 Transcription 记录，或已有记录但状态为 `FAILED`：显示「AI 转录」主操作按钮
  - 已有 `PENDING` 或 `PROCESSING` 状态记录：按钮禁用，展示「转录中…」loading 状态
  - 已有 `COMPLETED` 状态记录：隐藏主按钮，展示转录文案内容 + 「重新转录」文字链
- **任务处理**: 通过 BullMQ 异步队列，前端通过 SSE 订阅任务状态更新

---

#### 数据流

```
用户点击「AI 转录」
  → POST /api/transcriptions  { videoId }
  → 鉴权：auth() 获取 session，验证视频所属 organizationId
  → 检查 videoStoragePath: 若为 null → 返回 400，前端提示「视频文件尚未下载，请等待同步完成」
  → 检查是否已有 PENDING/PROCESSING 记录 → 若存在返回 409
  → 创建/更新 Transcription 记录（status=PENDING，清空旧 originalText/editedText/errorMessage）
  → BullMQ 入队（payload: transcriptionId, videoId, videoStoragePath, aiModel）
  → 返回 { transcriptionId, status: 'PENDING' }
  → 前端 SSE 订阅 transcriptionId 的状态更新

Worker 处理：
  → 更新 status=PROCESSING
  → 调用 AiGateway.transcribe(videoStoragePath, model)
    ├── 成功 → 写入 originalText，status=COMPLETED，SSE 推送完成事件
    └── 失败 → 写入 errorMessage，status=FAILED，SSE 推送失败事件（BullMQ 自动重试，最多 3 次，全部失败后置 FAILED）

人工编辑：
  → 用户点击「编辑」
  → 内联 textarea 展示当前文案（editedText 非空则展示 editedText，否则展示 originalText）
  → 用户修改后点击「保存」→ PATCH /api/transcriptions/[id]  { editedText }
  → 鉴权：同发起转录（organizationId 一致）
  → 写入 editedText，返回成功
  → 前端展示「已手工校对」标签，「恢复 AI 原文」入口清空 editedText
```

---

#### 数据模型（新增）

**Transcription**:

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| videoId | String | 关联 DouyinVideo.id，唯一约束（一视频一条记录） |
| status | Enum | `PENDING` / `PROCESSING` / `COMPLETED` / `FAILED` |
| aiModel | String | 使用的 AI 模型标识（e.g. `openai/whisper-1`）[假设] |
| originalText | String? | AI 生成的原始转录文本（COMPLETED 后写入） |
| editedText | String? | 人工校对后的文本（保存时写入，为 null 时展示 originalText） |
| errorMessage | String? | 失败原因（FAILED 状态时写入） |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 最后更新时间 |

> **设计说明**：`originalText` 与 `editedText` 双字段分离，保证人工校对不覆盖 AI 原始结果。前端展示时，优先展示 `editedText`（非 null），否则展示 `originalText`。`videoId` 设唯一约束（单视频只有一条 Transcription）；重新转录时更新同一条记录，不新增行。

---

#### AI 模型对接

- **调用方式**: 统一通过 AiGateway Service（`src/server/services/ai-gateway.service.ts`），禁止在 Worker 中直接调用 AI SDK
- **模型类型**: 语音识别（Speech-to-Text）
- **输入**: `DouyinVideo.videoStoragePath`（由爬虫在 v0.2.1.1 下载并存储的本地视频文件路径）
- **输出**: 转录文本字符串

> **[假设] AI 模型配置**: 使用 OpenAI Whisper API 或兼容的语音识别接口。v0.3.0 阶段通过环境变量 `TRANSCRIPTION_AI_MODEL` 指定模型标识（默认 `openai/whisper-1`），由 `src/lib/env.ts` 统一管理。后续版本可迁移至管理员后台配置。

---

#### 视频文件可用性处理

| 场景 | 处理方式 |
|------|----------|
| `videoStoragePath` 为 null | API 层前置检查，拒绝入队，返回 400；前端提示「视频文件尚未下载，请等待同步完成后再试」 |
| 视频文件路径存在但 AI 返回空文本 | 状态置为 `COMPLETED`，`originalText` 设为空字符串；前端展示空文案区域并提示「未识别到有效语音内容，可手动输入文案」 |
| AI 调用超时 / 服务异常 | Worker 侧 BullMQ 自动重试（最多 3 次），全部失败后 `status=FAILED`；SSE 通知前端；前端展示「AI 转录失败」+ 「重试」按钮 |
| Worker 宕机 / 任务卡住 | BullMQ 自身超时机制兜底，任务重新入队（最多 3 次）|

---

#### 状态机

```
（无记录）
    ↓ [点击「AI 转录」]
  PENDING
    ↓ [Worker 处理开始]
  PROCESSING
    ↓ [成功]          ↓ [失败 / 重试耗尽]
  COMPLETED          FAILED
    ↓ [点击「重新转录」]
  PENDING → PROCESSING → COMPLETED / FAILED
```

---

#### 前端交互细节

**按钮状态映射**:

| 场景 | UI 展示 |
|------|---------|
| 无 Transcription 记录，`videoStoragePath` 存在 | 「AI 转录」主操作按钮（primary） |
| 无 Transcription 记录，`videoStoragePath` 为 null | 「AI 转录」按钮（disabled）+ tooltip「视频文件尚未下载」 |
| `PENDING` / `PROCESSING` | 「转录中…」按钮（disabled）+ spinner + SSE 状态提示 |
| `COMPLETED` | 文案展示区 + 「编辑」按钮 + 「重新转录」文字链 |
| `FAILED` | 错误提示文字 + 「重试」按钮（primary） |

**文案展示与编辑**:
- 转录结果展示在视频详情页侧边栏或视频下方专属区域，区域标题「转录文案」
- 「编辑」点击后文案区变为 `<textarea>`（内联编辑模式），底部显示「保存」和「取消」
- 已有 `editedText` 时，展示「已手工校对」标签（低调 badge）和「恢复 AI 原文」文字链

**SSE 反馈**:
- 前端 SSE 只需订阅 `transcriptionId` 维度的状态变更事件（与现有 SSE 推送机制一致）
- SSE 断开重连后，前端主动 `GET /api/transcriptions/by-video/[videoId]` 拉取最新状态，避免状态丢失

> **[假设]** 布局占位：v0.3.0 中转录文案区域即为后续 v0.3.1 拆解交互面板的左侧位置。视频详情页右侧预留批注区占位，v0.3.0 阶段为空。

---

#### API 端点（出参/入参概要）

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/api/transcriptions` | 发起转录，入队 BullMQ |
| `GET` | `/api/transcriptions/by-video/[videoId]` | 查询指定视频的转录状态与文案 |
| `PATCH` | `/api/transcriptions/[id]` | 保存人工编辑结果（editedText） |

所有端点遵循 `{ success, data?, error? }` 统一响应格式，鉴权通过 `auth()` + organizationId 校验。

---

#### 权限

- 需要 `auth()` 获取 session（所有接口）
- 发起转录 + 编辑：验证视频所属 `DouyinAccount.organizationId` 与当前用户 `organizationId` 一致，不一致返回 403
- 超级管理员跨组织豁免（与现有权限模式一致）

---

## 交互流程

```
员工 → 进入「对标账号」→ 点击某博主 → 进入视频列表
  → 点击某视频 → 进入视频详情页
  → 视频播放区 + 右侧/下方「转录文案」区域
  → 若无转录：显示「AI 转录」按钮
  → 点击后：按钮变为 loading，SSE 实时监听
  → 转录完成：文案自动填充，展示「编辑」按钮
  → 可选：点击「编辑」→ 修改文案 → 保存 → 出现「已手工校对」标签
  → 可选：点击「重新转录」→ 重走转录流程（覆盖旧结果）
```

---

## 验收标准

1. 对标视频详情页展示「AI 转录」入口，视频文件存在时可点击，`videoStoragePath` 为 null 时按钮 disabled 并有提示
2. 点击「AI 转录」后按钮立即变为 loading 状态，SSE 实时反馈任务状态变化
3. 转录完成后文案自动展示在页面上，无需手动刷新（SSE 推送）
4. 已有 `PENDING` / `PROCESSING` 状态时，前端禁用按钮且后端返回 409，阻止重复提交
5. 员工可点击「编辑」进入内联编辑模式，修改文案并保存；保存成功后出现「已手工校对」标签
6. 「恢复 AI 原文」可将 `editedText` 清空，重新展示 `originalText`
7. 转录失败时展示 `errorMessage` 提示，提供「重试」按钮，点击后重新入队
8. 跨组织访问视频时返回 403，数据隔离正确
9. BullMQ Worker 失败后最多重试 3 次，全部失败后置为 `FAILED` 状态并 SSE 通知前端
10. `GET /api/transcriptions/by-video/[videoId]` 可查询当前状态，用于 SSE 重连后状态恢复

---

## 超出范围（Out of Scope）

以下功能不在 v0.3.0 中实现，归入后续版本：

| 功能 | 归属版本 | 说明 |
|------|---------|------|
| AI 划句批注拆解（F-003-2） | v0.3.1 | 依赖本版本生成的 Transcription 文本 |
| 无语音视频的字幕/OCR 文字提取 | v0.3.1+ | 超出本次范围，AI 返回空文本时引导手动输入即可 |
| 拆解结果管理（F-003-3） | v0.3.2 | 依赖 F-003-2 Analysis 数据模型 |
| 碎片观点录入与选择（F-004-1、F-004-2） | v0.3.2 | 同里程碑后续迭代 |
| 「我的账号」视频转录入口 | TBD | PRD 入口定义在对标视频，MY_ACCOUNT 转录延后排期 |
| AI 模型管理后台配置界面 | v0.3.x+ | v0.3.0 通过环境变量 `TRANSCRIPTION_AI_MODEL` 配置 |
| 流式转录进度条（逐句出现） | v0.3.x+ | Whisper API 不支持分段流式输出 [假设]，v0.3.0 仅展示整体 loading |
| 批量转录（多视频一键） | TBD | v0.3.0 仅支持单视频手动触发 |
