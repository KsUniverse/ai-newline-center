# v0.3.1 前端任务清单

## 必读文档

- `docs/product/versions/v0.3.1/requirements.md`
- `docs/product/versions/v0.3.1/technical-design.md`
- `docs/architecture/frontend.md`
- `docs/standards/ui-ux-system.md`
- `docs/standards/coding-standards.md`

**参考现有实现**：

- `src/components/features/benchmarks/*`
- `src/components/shared/common/slide-panel.tsx`
- `src/components/shared/layout/dashboard-page-shell.tsx`
- `src/lib/management-client.ts`

---

## 摘要

- 任务总数: 10
- 核心目标:
  - 交付统一 AI 工作台弹框
  - 支持分析优先的正文 + 拆解工作流
  - 支持任意范围拆解编辑
  - 支持共享元素式展开与仿写态切换
- 视觉约束:
  - 必须保持项目现有前端设计语言、token、共享原语和工作台表面层级
  - 只提升动效质量与工作台切换体验，不重造一套视觉皮肤
  - 性能是全局约束，不只优化单一按钮或单一栏位

---

## 任务列表

- [ ] **FE-001**: (P0) 新增 AI 配置导航与页面
  - 文件: `src/components/shared/layout/*`, `src/app/(dashboard)/system-settings/ai/page.tsx`
  - 详情:
    1. `SUPER_ADMIN` 可见
    2. 页面用于步骤绑定

- [ ] **FE-002**: (P0) 扩展 `managementClient` 和 AI 配置类型
  - 文件: `src/lib/management-client.ts`, `src/types/ai-config.ts`
  - 详情:
    1. 查询/保存 AI 配置
    2. 不新增平行 client

- [ ] **FE-003**: (P0) 创建 AI 配置页
  - 文件: `src/components/features/system-settings/*`
  - 详情:
    1. 实现方式列表
    2. 三个步骤绑定
    3. 保存反馈

- [x] **FE-004**: (P0) 用统一 AI 工作台替换旧 benchmark 详情弹框主入口
  - 文件: `src/components/features/benchmarks/benchmark-ai-workspace-panel.tsx` 及相关入口
  - 详情:
    1. 点击视频后进入 AI 工作台
    2. 旧详情层退化为视频播放辅助层

- [x] **FE-005**: (P0) 重构分析优先工作台壳与三栏布局
  - 文件: `src/components/features/benchmarks/ai-workspace-shell.tsx` 及子组件
  - 详情:
    1. 默认分析态：视频 / 转录 / 拆解
    2. 仿写态：拆解 / 转录 / 仿写
    3. 列切换由统一 shell 控制，不再由各列自己改模式

- [x] **FE-006**: (P0) 实现转录主文档编辑区与正文画布
  - 文件: `src/components/features/benchmarks/ai-workspace-transcript-canvas.tsx`
  - 详情:
    1. 展示 AI 原稿和当前稿
    2. 支持修词
    3. 手动分段仅服务阅读，不再作为拆解业务入口
    4. 支持锁定编辑 / 解锁编辑
    5. 解锁时通过确认框提示会丢失拆解/仿写
    6. 正文是最稳定视觉锚点，不因明细切换跳动

- [x] **FE-007**: (P0) 实现拆解区
  - 文件: `src/components/features/benchmarks/ai-workspace-decomposition-panel.tsx`
  - 详情:
    1. 支持任意文本范围划词
    2. 输入态与明细态分离
    3. 点击拆解明细时，只聚焦对应正文范围
    4. 再点同一条拆解，返回全局浏览态

- [x] **FE-008**: (P0) 实现仿写态动画切换与共享转场
  - 文件: `src/components/features/benchmarks/ai-workspace-shell.tsx`
  - 详情:
    1. 初始态：视频 / 转录 / 拆解
    2. 仿写态：拆解 / 转录 / 仿写
    3. 视频详情整栏收缩为转录栏顶部小缩略卡
    4. 小缩略卡点击后打开视频播放层
    5. 列表视频卡片 -> 工作台左栏视频区共享展开
    6. 关闭时反向回收
    6. 仅提升转场质量，不引入脱离现有设计系统的新皮肤或新原语

- [x] **FE-009**: (P0) 实现仿写主工作区
  - 文件: `src/components/features/benchmarks/ai-workspace-rewrite-stage.tsx`
  - 详情:
    1. 右侧作为主仿写区
    2. 支持人工编辑与草稿保存
    3. 与中间原文形成清晰对照

- [~] **FE-010**: (P0) 补齐交互测试与基础校验
  - 文件: 相关测试文件
  - 详情:
    1. 工作台布局切换
    2. 解锁编辑提示
    3. 缺少 `shareUrl` 时阻断转录
    4. 进入仿写后的缩略卡与三栏位置变化
    5. 当前已通过 `pnpm type-check` 和 `pnpm lint`
    6. `vitest` 仍受当前 Windows 环境 `spawn EPERM` 影响，待环境恢复后补齐自动化测试

---

## 当前真实前端结构

```text
AiWorkspaceShell
├── useAiWorkspaceController
├── AiWorkspaceVideoPane
├── AiWorkspaceTranscriptCanvas
├── AiWorkspaceDecompositionPanel
└── AiWorkspaceRewriteStage
```

说明：

- 旧的 `ai-workspace-panel / ai-workspace-*-column / ai-workspace-layout / ai-workspace-model`
  已从主路径删除
- 当前工作台统一由 shell + controller 驱动
- 列表卡片 -> 工作台的启动链路已收口为单一 launcher state + 共享展开 origin
- 旧的 `benchmark-ai-workspace-panel` 中转 wrapper 已删除，详情页直接挂载 `AiWorkspaceShell`
- 后续所有迭代均以这套结构为基线，不再回到旧的 patch-on-patch 模式

