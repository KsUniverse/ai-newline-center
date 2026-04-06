# v0.3.1 Changelog

> 版本: v0.3.1
> 最后更新: 2026-04-06

## 摘要

本版完成系统级 AI 配置与 benchmark AI 工作台主链路收口，统一转录、拆解、仿写交互入口，并移除旧的独立 `/transcriptions` 前后端链路。

## 主要变更

### 1. AI 配置上线

- 新增系统设置中的 AI 配置页，支持为 `TRANSCRIBE / DECOMPOSE / REWRITE` 三个步骤绑定默认实现。
- AI 配置页面加入页面级 `SUPER_ADMIN` 权限保护。
- 不可用实现改为前端禁选，并展示缺失环境变量提示。
- 加载远端配置失败时不再回退到本地 mock 配置，改为明确错误态与重试入口。

### 2. 统一 AI 工作台交付

- benchmark 视频点击后直接进入统一 AI 工作台，不再使用旧详情弹框附带的转录面板。
- 工作台结构收口为 `AiWorkspaceShell + controller + pane/canvas/panel/stage`。
- 交互口径统一为单一“转录主文档 + 批注拆解层”，不再做 AI 稿 / 人工稿双视图。
- 转录区支持编辑、锁定、解锁、批注联动与仿写态切换。
- 发起 AI 转录后，前端会自动轮询工作台状态并在完成后回填正文。

### 3. 后端主链路收口

- AI 工作台按 `(videoId, userId)` 唯一建模，并补齐服务端 `organizationId + userId` 双重访问约束。
- 转录任务正式收口到 `shareUrl -> AiWorkspaceTranscript` 单轨链路。
- 删除旧 `/api/transcriptions` route、service、repository、SSE 与相关前端遗留组件。
- 解锁编辑改为原子清空 segments / annotations / rewriteDraft。
- 重新转录、继续编辑、进入仿写等流程增加服务端状态机约束，避免绕过 unlock。

### 4. 视觉与页面结构统一

- 组织管理、用户管理、AI 配置及二级详情页统一为轻页头模式。
- 移除 `DashboardPageShell.surfaceHeader` 重页头能力与相关文档说明。
- AI 工作台、组织管理、用户管理页面风格与当前品牌视觉对齐。

## 验证

- `pnpm lint` 通过
- `pnpm type-check` 通过
- 核心 AI route/service 测试 21 项通过

## 已知残余风险

- `ai-workspaces` 其余写接口的 route 测试仍可继续补强。
- 工作台三栏切换、共享展开转场和解锁弹框仍缺少浏览器级自动化覆盖。
- 生产构建未作为本轮最终验收依据，当前已完成的是静态检查与核心链路定向测试。