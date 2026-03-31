# 迭代流程与角色职责

> 摘要：7 个角色通过 7 阶段瀑布式小步骤迭代协作。每阶段有明确的输入/输出/检查点。

## 角色定义

### 1. 编排者 (Orchestrator)

- **工具**: 全部
- **职责**: 读 INDEX.md → 判断当前阶段 → 按序推进各角色 → 检查点确认
- **产出**: 阶段流转指令
- **禁止**: 不写业务代码，不做技术决策

### 2. 产品经理 (PM)

- **工具**: read, search, edit, web
- **职责**: 与用户沟通需求 → 读 ROADMAP → 分解为需求文档
- **产出**: `requirements.md`
- **禁止**: 不写代码，不做技术决策，不拆分开发任务

### 3. 技术架构师 (Architect)

- **工具**: read, edit, search, web
- **职责**: 读需求 → 设计技术方案 → 定义接口契约 → 拆分开发任务 → 维护架构/规范文档
- **产出**: `technical-design.md` + `tasks-backend.md` + `tasks-frontend.md` + 更新 architecture/*, standards/*
- **禁止**: 不写业务实现代码，不修改 PM 的需求文档
- **特殊权限**: 可修改 docs/architecture/* 和 docs/standards/* 文档
- **标注规范**: 若需打破现有架构约定，必须在 technical-design.md 中标注 `[ARCH-CHANGE]` 并同步更新架构文档

### 4. 后端开发 (Backend)

- **工具**: read, edit, search, execute
- **职责**: 严格按 technical-design.md + tasks-backend.md 实现后端代码
- **产出**: src/server/**, src/app/api/**, prisma/schema.prisma
- **禁止**: 不碰前端组件 (src/components/**, src/app/**/page.tsx)，不修改架构文档

### 5. 前端开发 (Frontend)

- **工具**: read, edit, search, execute
- **职责**: 严格按 technical-design.md + tasks-frontend.md 实现前端 UI/交互/样式
- **产出**: src/app/**/page.tsx, src/components/**
- **禁止**: 不写 API 路由，不改 Prisma schema，不修改架构文档
- **标注规范**: 复杂业务逻辑标注 `// TODO: [INTEGRATE] 需要后端集成阶段补充`

### 6. 代码评审 (Reviewer)

- **工具**: read, search
- **职责**: 审查编译错误 → 逻辑错误 → 架构合规性 (对照 technical-design.md) → 编码规范
- **产出**: 评审报告 (问题列表 + 严重度 + 修复建议)
- **禁止**: 不直接修改代码

### 7. 测试 (Tester)

- **工具**: read, search, execute, web
- **职责**: 功能验收 (对照 requirements.md) + UI 一致性检查 (对照 ui-ux-system.md)
- **产出**: 测试报告 (通过/失败项 + 截图描述 + 问题列表)
- **禁止**: 不修复代码，不修改文档

---

## 迭代流程 (7 阶段)

```
[用户] "进入下一个版本迭代"
    ↓
Phase 1: 需求沟通 ──→ Phase 2: 技术设计 ──→ Phase 3: 后端开发
    ↓ ✅ 确认需求     ↓ ✅ 确认方案        ↓ ✅ 确认后端
Phase 4: 前端开发 ──→ Phase 5: 集成联调 ──→ Phase 6: 代码评审
    ↓ ✅ 确认前端     ↓ ✅ 确认集成        ↓ ✅ 评审通过
Phase 7: 测试验收
    ↓ ✅ 测试通过
[Release] 合入 main → 更新 ROADMAP + INDEX.md
```

### Phase 1: 需求沟通

- **角色**: 产品经理 (PM)
- **输入**: 用户口述需求 + ROADMAP.md + 已实现功能
- **动作**:
  1. 阅读 ROADMAP.md 了解产品全貌
  2. 阅读已完成版本的 requirements.md 了解已实现功能
  3. 与用户多轮沟通，确认本版本范围
  4. 确认每个功能的细节（交互、边界、优先级）
  5. 产出 `docs/product/versions/vX.X/requirements.md`
- **检查点**: 用户确认需求文档无误

### Phase 2: 技术设计

- **角色**: 技术架构师 (Architect)
- **输入**: requirements.md + architecture/* + standards/*
- **动作**:
  1. 阅读需求文档
  2. 对照现有架构评估影响范围
  3. 设计数据模型变更、API 契约、组件树
  4. 拆分前后端开发任务 (tasks-backend.md, tasks-frontend.md)
  5. 若需架构变更，标注 `[ARCH-CHANGE]` 并更新相关架构文档
  6. 产出 `technical-design.md`
- **检查点**: 用户确认技术方案

### Phase 3: 后端开发

- **角色**: 后端开发 (Backend) — 推荐使用 Codex
- **输入**: technical-design.md + tasks-backend.md
- **动作**:
  1. 按任务清单逐项实现
  2. 每完成一项在 tasks-backend.md 中标记 ✅
  3. 确保编译通过 + 类型安全
- **检查点**: 用户确认后端开发完成

### Phase 4: 前端开发

- **角色**: 前端开发 (Frontend)
- **输入**: technical-design.md + tasks-frontend.md + ui-ux-system.md
- **动作**:
  1. 按任务清单逐项实现页面/组件
  2. 严格遵循 UI/UX 设计系统
  3. 复杂业务逻辑标注 `// TODO: [INTEGRATE]`
  4. 每完成一项在 tasks-frontend.md 中标记 ✅
- **检查点**: 用户确认前端开发完成

### Phase 5: 集成联调

- **角色**: 编排者协调 (后端角色补充前端逻辑)
- **输入**: 前后端代码 + technical-design.md
- **动作**:
  1. 搜索所有 `// TODO: [INTEGRATE]` 标注
  2. 补充前端的业务逻辑和数据绑定
  3. 联调 API 调用
  4. 确保前后端类型一致
- **检查点**: 用户确认集成完成

### Phase 6: 代码评审

- **角色**: 代码评审 (Reviewer) — 推荐使用 Codex
- **输入**: 本版本所有变更代码 + technical-design.md + review-checklist.md
- **动作**:
  1. 检查编译错误和类型错误
  2. 检查逻辑错误和边界条件
  3. 对照 technical-design.md 检查架构合规性
  4. 对照 coding-standards.md 检查编码规范
  5. 产出评审报告
  6. 开发角色根据报告修复问题
- **检查点**: 评审通过（无 Critical/High 问题）

### Phase 7: 测试验收

- **角色**: 测试 (Tester)
- **输入**: requirements.md + ui-ux-system.md + 运行中的应用
- **动作**:
  1. 对照 requirements.md 逐项验收功能
  2. 对照 ui-ux-system.md 检查 UI 一致性
  3. 检查响应式布局
  4. 产出测试报告
- **检查点**: 测试通过

---

## 文档产出规范

### 版本目录结构

```
docs/product/versions/vX.X/
├── requirements.md        # PM 产出
├── technical-design.md    # 架构师产出
├── tasks-backend.md       # 架构师产出 → 后端执行
├── tasks-frontend.md      # 架构师产出 → 前端执行
└── changelog.md           # Release 后编排者更新
```

### 文档格式要求

- **摘要优先**: 每个文档开头 10-20 行摘要，概括关键要点
- **上下文预算**: INDEX.md < 150行 | OVERVIEW.md < 100行 | 任务清单 < 150行 | Agent 提示词 < 80行
- **任务清单格式**: `- [ ] TASK-001: 描述 (优先级: P0/P1/P2)`
- **完成标记**: `- [x] TASK-001: 描述 ✅`

### 交接规范

角色间交接通过文档进行，不依赖口头或上下文传递：
- PM → 架构师: requirements.md
- 架构师 → 后端: technical-design.md + tasks-backend.md
- 架构师 → 前端: technical-design.md + tasks-frontend.md
- 前端 → 集成: `// TODO: [INTEGRATE]` 标注
- 评审 → 开发: 评审报告 (问题列表)
- 测试 → 开发: 测试报告 (失败项)
