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

## 迭代粒度与版本策略

采用 **里程碑 + 小迭代** 模式，版本号格式为 `vX.Y.Z`：
- `X.Y` = 里程碑编号（对应产品模块主题，如 v0.1 = 组织与权限）
- `Z` = 迭代序号（每次迭代覆盖 1-3 个功能点）
- **每次迭代走完整 7 阶段流程**
- PM 在 Phase 1 从 PRD.md 中选取功能点，组成本次迭代的范围
- 迭代边界可根据实际情况调整，功能点过大时进一步拆分

详见 [ROADMAP.md](../product/ROADMAP.md) 中的里程碑和迭代规划。

## 版本路径解析

编排者从 INDEX.md 的「当前迭代」字段获取版本号（如 v0.1.0），对应版本文档路径：
`docs/product/versions/{version}/`

所有角色引用版本文档时使用此路径。**禁止硬编码版本号**，必须动态解析。

### 文档读取模式：入口 + 发现

> **不维护固定文件列表。** 每个角色有 1-2 个入口文档，通过文档内的引用链和目录浏览按需发现相关文档。
> AGENTS.md 和 .instructions.md 由工具链**自动加载**，不在此列。

| 角色 | 入口文档 | 发现策略 |
|------|----------|----------|
| 编排者 | `docs/INDEX.md` | INDEX → PROCESS.md → ROADMAP.md |
| PM | `docs/product/PRD.md` | PRD → ROADMAP → 已完成迭代目录 |
| 架构师 | 当前版本 `requirements.md` | → `docs/architecture/` 整目录 + `docs/standards/` 整目录 + 扫描 `src/` |
| 后端 | 当前版本 `tasks-backend.md` | → 任务文件顶部 `## 必读文档` 节列出的文档（由架构师生成） |
| 前端 | 当前版本 `tasks-frontend.md` | → 任务文件顶部 `## 必读文档` 节列出的文档（由架构师生成） |
| 评审 | 当前版本 `technical-design.md` | → `docs/standards/` 整目录 + 变更文件关联的规范 |
| 测试 | 当前版本 `requirements.md` | → `docs/standards/ui-ux-system.md` + 运行应用实际检查 |

**原则**：宁可多读不可漏读。遇到文档交叉引用时跟进阅读。架构和规范目录下的文件不多，有疑问时浏览整个目录。

### 任务文件自包含规则

无论哪个角色执行开发或评审，都可能在不同工具环境中运行，无法保证自动加载 `.agent.md`。
解决方式：**架构师在 tasks-backend.md 顶部必须包含 `## 必读文档` 节**，列出该阶段需读取的全局规范和版本文档的完整相对路径，使任务文件自包含。
评审和测试任务同理，架构师在 technical-design.md 中包含评审和测试所需的参考文档列表。

---

## 自省机制

> **每个角色在完成主要工作后、交付产出前，必须执行自省流程。** 自省确保文档体系随开发同步演进，不留缺口。

### 自省三步

```
完成主要工作
    ↓
Step 1: 回顾 — 我的产出涉及了哪些技术决策、新增模式、或发现了哪些规范缺口？
    ↓
Step 2: 检查 — 以下文档是否需要新增或更新？
    - 全局文档: docs/architecture/*, docs/standards/*
    - 版本文档: 当前迭代目录下的文件
    - 入口文档: docs/INDEX.md, docs/product/ROADMAP.md
    ↓
Step 3: 提议 — 列出需要修改的文档、修改内容摘要、修改原因
    → 提交给用户确认 → 用户同意后执行修改
```

### 各角色自省重点

| 角色 | 自省重点 |
|------|----------|
| PM | PRD.md 是否有模糊需求需要补充？ROADMAP 状态是否需更新？ |
| 架构师 | 架构/规范文档是否与本版本设计矛盾？是否引入了新模式需要记录？ |
| 后端 | 实现中是否发现架构文档缺失的模式？coding-standards 是否覆盖新场景？ |
| 前端 | ui-ux-system 是否覆盖新组件样式？前端规范是否需要补充？ |
| 评审 | review-checklist 是否覆盖本次发现的问题类型？架构文档是否有歧义？ |
| 测试 | ui-ux-system 是否有需要细化的检查项？requirements 验收标准是否充分？ |
| 编排者 | INDEX.md 状态是否最新？PROCESS.md 流程是否需要调整？ |

### 自省产出格式

```markdown
## 自省报告

### 需要更新的文档

1. `docs/standards/coding-standards.md`
   - **修改**: 新增 Redis 连接池使用规范
   - **原因**: 本版本引入了 Redis，现有规范未覆盖

2. `docs/architecture/backend.md`
   - **修改**: 补充批量操作的事务处理模式
   - **原因**: tasks-backend 中 F-002 涉及批量创建，实现中发现了通用模式

### 无需更新
确认以下文档与产出一致，无需修改: (列出已检查的文档)
```

**关键规则**: 自省发现的修改**必须经用户确认**后才能执行。角色不可自行修改超出职责范围的文档。

## Git 分支策略

- **创建分支**: 用户说"进入下一个版本迭代"时，编排者立即创建 `feature/vX.Y.Z` 分支
- **开发阶段**: 所有 Phase 3-5 的代码提交在 feature 分支上
- **合并时机**: Phase 7 测试通过 + 用户验收确认后
- **合并方式**: Squash Merge 到 main（保持主分支历史干净，一个迭代一个提交）
- **合并后**: 删除 feature 分支，打 tag `vX.Y.Z`

## 开发中断修正协议

> 开发过程中（Phase 3-5），角色可能发现文档描述与实际情况不符。

**处理流程**：
1. 在任务文件对应任务项旁标注 `[DOC-ISSUE] 简要描述问题`
2. 如果问题**不阻塞**当前开发 → 继续开发可完成的部分 → 阶段结束时自省汇总
3. 如果问题**阻塞**当前开发 → 暂停 → 在任务文件中记录阻塞原因 → 提交给用户确认修正
4. 文档修正由**对应职责角色**执行（架构问题 → 架构师修，需求问题 → PM 修）
5. 修正完成后继续开发

**可修正的文档范围**：
- 版本文档（technical-design.md, tasks-*.md）→ 由架构师修正
- 全局文档（architecture/*, standards/*）→ 由架构师修正
- 需求文档（requirements.md）→ 由 PM 修正

## 迭代流程 (7 阶段)

```
[用户] "进入下一个版本迭代"
    ↓ 创建 feature/vX.Y.Z 分支
Phase 1: 需求确认 ──→ Phase 2: 技术设计 ──→ Phase 3: 后端开发
    ↓ ✅ 确认需求     ↓ ✅ 确认方案        ↓ ✅ 确认后端
Phase 4: 前端开发 ──→ Phase 5: 集成联调 ──→ Phase 6: 代码评审 ←─┐
    ↓ ✅ 确认前端     ↓ ✅ 确认集成        ↓ ✅ 评审通过      │
                                              ↓ ❌ 有问题 ──修复──┘
Phase 7: 测试验收 ←─────────────────────────────┐
    ↓ ✅ 测试通过                                │
    ↓ ❌ 有BUG ──回退修复──重测─────────────────┘
[Release] squash merge → main → tag vX.Y.Z → 更新 ROADMAP + INDEX.md + changelog.md
```

### Phase 1: 需求确认

- **角色**: 产品经理 (PM)
- **输入**: 用户意图 + PRD.md + ROADMAP.md + 已完成迭代的 requirements.md
- **动作**:
  1. 阅读 ROADMAP.md 确定当前里程碑和下一个待规划迭代
  2. 阅读 PRD.md 中对应模块的功能点定义
  3. 阅读已完成迭代的 requirements.md 了解已实现功能
  4. 与用户确认本次迭代的功能点范围（1-3 个功能点）
  5. 确认每个功能点的细节补充（如有 PRD 未覆盖的内容）
  6. 产出 `docs/product/versions/vX.Y.Z/requirements.md`
  7. 更新 ROADMAP.md 中对应迭代的状态
- **检查点**: 用户确认需求文档无误
- **自省**: 回顾 PRD.md 是否有需要补充的模糊需求；ROADMAP 状态是否已更新。提议修改 → 用户确认

### Phase 2: 技术设计

- **角色**: 技术架构师 (Architect)
- **输入**: requirements.md + architecture/* + standards/* + 现有代码
- **动作**:
  1. 阅读需求文档
  2. 对照现有架构评估影响范围
  3. 设计数据模型变更、API 契约、组件树
  4. 拆分前后端开发任务 (tasks-backend.md, tasks-frontend.md)
  5. 若需架构变更，标注 `[ARCH-CHANGE]` 并更新相关架构文档
  6. 产出 `technical-design.md`
- **检查点**: 用户确认技术方案
- **自省**: 检查 architecture/* 和 standards/* 是否与本版本设计矛盾；是否引入新模式需记录。提议修改 → 用户确认

### Phase 3: 后端开发

- **角色**: 后端开发 (Backend)
- **输入**: technical-design.md + tasks-backend.md（含必读文档节）
- **动作**:
  1. 阅读 tasks-backend.md 顶部「必读文档」节列出的所有文档
  2. 按任务清单逐项实现
  3. 每完成一项在 tasks-backend.md 中标记 ✅
  4. 确保编译通过 + 类型安全
  5. 开发中遇到文档问题，按「开发中断修正协议」处理
- **检查点**: 用户确认后端开发完成
- **自省**: 实现中是否发现架构文档缺失的模式或 coding-standards 未覆盖的场景。提议修改 → 用户确认

### Phase 4: 前端开发

- **角色**: 前端开发 (Frontend)
- **输入**: technical-design.md + tasks-frontend.md（含必读文档节）
- **重点**: 页面布局、交互设计、样式实现。**使用 mock 数据**，不依赖后端 API 就绪。
- **动作**:
  1. 阅读 tasks-frontend.md 顶部「必读文档」节列出的所有文档
  2. 按任务清单逐项实现页面/组件
  3. 严格遵循 UI/UX 设计系统
  4. 数据层使用 mock 数据（硬编码或 mock 函数），标注 `// TODO: [INTEGRATE] 替换为真实 API 调用`
  5. 复杂业务逻辑标注 `// TODO: [INTEGRATE] 需要后端集成阶段补充`
  6. 每完成一项在 tasks-frontend.md 中标记 ✅
  7. 开发中遇到文档问题，按「开发中断修正协议」处理
- **检查点**: 用户确认前端开发完成
- **自省**: ui-ux-system 是否覆盖新组件样式；前端架构规范是否需要补充。提议修改 → 用户确认

### Phase 5: 集成联调

- **角色**: 后端开发 (Backend) — 在前端代码中补充实际逻辑
- **输入**: 前后端代码 + technical-design.md
- **动作**:
  1. 搜索所有 `// TODO: [INTEGRATE]` 标注
  2. 将 mock 数据替换为真实 API 调用（通过 api-client.ts）
  3. 补充前端中复杂的业务逻辑
  4. 联调前后端接口，确保类型一致
  5. 删除所有 `[INTEGRATE]` 标注
  6. 确保全链路功能可运行
- **检查点**: 用户确认集成完成
- **自省**: 集成过程中是否发现前后端契约不一致；api-client 规范是否需要补充。提议修改 → 用户确认

### Phase 6: 代码评审

- **角色**: 代码评审 (Reviewer)
- **输入**: 本版本所有变更代码 + technical-design.md + review-checklist.md + coding-standards.md
- **动作**:
  1. 检查编译错误和类型错误
  2. 检查逻辑错误和边界条件
  3. 对照 technical-design.md 检查架构合规性
  4. 对照 coding-standards.md 检查编码规范
  5. 产出评审报告（问题列表 + 严重度 Critical/High/Medium/Low + 修复建议）
- **修复回路**: 评审发现问题后 → 用户确认评审报告 → 对应角色修复（后端问题交后端角色，前端问题交前端角色）→ 修复完成后重新评审 → 循环直到通过
- **检查点**: 评审通过（无 Critical/High 问题）
- **自省**: review-checklist 是否覆盖本次发现的问题类型；架构文档是否有歧义需澄清。提议修改 → 用户确认

### Phase 7: 测试验收

- **角色**: 测试 (Tester)
- **输入**: requirements.md + ui-ux-system.md + 运行中的应用
- **动作**:
  1. 对照 requirements.md 逐项验收功能
  2. 对照 ui-ux-system.md 检查 UI 一致性
  3. 检查响应式布局
  4. 产出测试报告
- **检查点**: 测试通过
- **修复回路**: 测试发现 BUG → 用户确认测试报告 → 回退到 Phase 5(集成) 或 Phase 3/4(开发) 修复 → 修复完成后直接重测（跳过评审）
- **自省**: ui-ux-system 检查项是否充分；requirements 验收标准是否需要细化。提议修改 → 用户确认

### Release

- **角色**: 编排者 (Orchestrator)
- **触发**: Phase 7 测试通过 + 用户验收确认
- **动作**:
  1. 汇总处理所有阶段的自省提议（未处理的 `[GLOBAL-UPDATE]` 和 `[DOC-ISSUE]`）
  2. 产出 `docs/product/versions/vX.Y.Z/changelog.md`（变更记录）
  3. 更新 `docs/product/ROADMAP.md` 中对应迭代状态为 ✅
  4. 更新 `docs/INDEX.md` 的当前迭代指向下一个待规划版本
  5. Squash merge `feature/vX.Y.Z` → `main`
  6. 打 tag `vX.Y.Z`
  7. 删除 feature 分支

---

## 文档产出规范

### 版本目录结构

每次迭代在 `docs/product/versions/` 下创建独立目录：

```
docs/product/versions/vX.Y.Z/
├── requirements.md        # PM 产出 (引用 PRD 功能点 + 本次补充)
├── technical-design.md    # 架构师产出
├── tasks-backend.md       # 架构师产出 → 后端执行 (含必读文档节)
├── tasks-frontend.md      # 架构师产出 → 前端执行
└── changelog.md           # Release 后编排者更新
```

### 任务文件必读文档节

架构师产出的 `tasks-backend.md` 和 `tasks-frontend.md` **必须**在顶部包含必读文档节：

```markdown
## 必读文档

> 开始开发前必须阅读以下文档：

- `docs/product/versions/vX.Y.Z/technical-design.md` — 本版本技术设计
- `docs/architecture/backend.md` — 后端分层规范
- `docs/architecture/database.md` — 数据库设计规范
- `docs/architecture/api-conventions.md` — API 设计规范
- `docs/standards/coding-standards.md` — 编码规范
```

前端任务文件替换为对应的前端规范路径（frontend.md, ui-ux-system.md 等）。

### 角色自省规则

所有角色（无论在什么工具中运行）都必须在完成工作后执行自省。
架构师在 `tasks-backend.md` 和 `tasks-frontend.md` 底部必须包含以下自省提示：

```markdown
## 自省（所有任务完成后执行）

完成全部任务后，回顾开发过程：
1. 实现中是否发现架构文档缺失的模式或 coding-standards 未覆盖的场景？
2. 是否有值得记录到全局文档的通用经验？
3. 若有，在任务文件末尾以 `## 自省报告` 写下发现和修改建议，等待用户确认后由架构师执行修改。
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
