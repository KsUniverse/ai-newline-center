# 前端架构规范

> 摘要：品牌化运营工作台架构。亮色优先、暗色兼容；统一页面壳、导航壳与共享弹层原语；业务页面采用“页面壳 → 区块表面 → 共享原语 → 功能组件”的分层实现。

## 设计规范引用

- 视觉规范：`docs/standards/ui-ux-system.md`
- 全局 token：`src/app/globals.css`
- 共享布局壳：`src/components/shared/layout/*`
- 共享交互原语：`src/components/ui/*`

前端代码必须以这些文件为统一约束来源；若出现稳定新模式，必须同步回写文档。

## 前端分层

### L0: 全局样式层

`src/app/globals.css` 负责：

- 主题 token
- 字体 token
- 语义字号 token
- 全局动效类
- 点阵纹理
- 滚动条样式

### L1: 共享原语层

`src/components/ui/*` 基于 shadcn/ui 做统一封装，允许**集中主题化修改**。这层不是业务组件，但也不是“永远不可改”的第三方代码镜像。

当前必须统一维护的高频原语：

- `button.tsx`
- `input.tsx`
- `dropdown-menu.tsx`
- `dialog.tsx`
- `alert-dialog.tsx`
- `sheet.tsx`

原则：视觉风格稳定变化时，优先改这一层，不在 `features/*` 内重复覆盖。

### L2: 共享布局与组合层

`src/components/shared/*` 负责跨功能复用的布局和表面模式：

- `layout/app-layout.tsx`
- `layout/app-sidebar.tsx`
- `layout/app-header.tsx`
- `layout/dashboard-page-shell.tsx`
- `common/confirm-dialog.tsx`
- `common/surface-section.tsx`
- `common/empty-state.tsx`

### L3: 功能组件层

`src/components/features/*` 承载具体业务模块，允许使用共享壳和共享原语组合，但不得再造一套基础交互皮肤。

## 布局体系

### AppLayout

```tsx
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
```

约束：

- Sidebar 固定为品牌导航表面
- Header 作为全局工具栏，使用半透明背景与模糊
- 页面内容通过 `DashboardPageShell` 管理容器宽度与标题区

### DashboardPageShell

所有 Dashboard 页面优先使用页面壳，而不是手写顶层容器：

```tsx
interface DashboardPageShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  maxWidth?: "default" | "wide" | "full";
  children: React.ReactNode;
}
```

页面壳职责：

- 居中与限宽
- 页面标题区
- 返回 chip
- 头部动作区

### 导航壳

`AppSidebar` 与移动端 `AppHeader` 内的导航 Sheet 必须保持：

- 同一套图标壳与卡片结构
- 同一套 active / hover 状态
- 同一套品牌气氛层
- 同一套用户身份与退出逻辑呈现

## 页面模式

### 列表页

默认结构：

1. `DashboardPageShell`
2. 摘要卡片
3. 移动端卡片列表
4. 桌面端表格列表
5. 菜单 / 确认框 / 抽屉作为页内交互

适用模块：账号、对标账号、用户、组织等高密度列表。

约束：

- 列表首页优先使用轻页头，不额外叠加大面积解释型 overview hero
- 若需要教学或背景说明，应下沉到空状态、字段说明、抽屉或详情页
- 顶部数量 / 状态 / 筛选摘要统一使用 compact chips，而不是每页自写 span pill
- 摘要卡片区允许并列一个 contextual sidecar / filter card，承载筛选说明、管理提醒或作用范围提示
- 空态优先复用统一的任务型空状态组件

### Dashboard 首页

Dashboard 首页作为任务分发入口，而不是说明页：

1. 页面壳展示问候语与紧凑状态 chips
2. 主体提供按角色可见的快捷入口卡片
3. 不额外堆叠解释业务原理的 overview hero

### 详情页

默认结构：

1. 返回 chip
2. 眉标 + 标题 + 描述
3. 详情摘要区块
4. 次级内容区块（样本、日志、状态等）
5. 对应 Dialog / Sheet 的局部交互

约束：

- 详情页顶部状态信息和二级内容区摘要优先复用 compact chips
- 详情页不要并行维护另一套零散状态标签样式
- 详情页首屏优先保留关键动作，来源、同步、录入时间等弱信息应折叠为 chips 或短辅助文案，不再占用独立说明卡区域

### 表单页内交互

表单优先在 `Dialog` 或 `Sheet` 中完成，而不是新建独立路由页。对关键信息输入优先使用带 label / helper / icon shell 的字段块。

## 交互模式

| 场景 | 首选交互 | 组件 |
|------|----------|------|
| 短表单创建 / 编辑 | 居中弹框 | `Dialog` |
| 长表单 / 多步骤流程 | 侧边抽屉 | `Sheet` |
| 危险确认 | 确认框 | `AlertDialog` |
| 上下文动作 | 下拉菜单 | `DropdownMenu` |
| 沉浸式多栏工作流 | 全屏工作台壳 | 自定义 Overlay Shell |
| 轻量提示 | Tooltip / helper text | `Tooltip` / 文案 |

规则：

- 不允许在功能组件内直接复制原语结构做另一套样式
- 危险操作统一通过 `ConfirmDialog` 或 `AlertDialog`
- 移动导航统一通过 `Sheet`

### 全屏工作台壳

当业务目标不是“补一个表单”或“查看一段详情”，而是在当前上下文中连续完成
`选素材 -> 整理主文档 -> 拆解 -> 进入创作` 这类沉浸式工作流时，允许使用自定义全屏工作台壳。

当前基线场景：`AiWorkspaceShell`

规则：

- 只有在 `Dialog` / `Sheet` 无法稳定承载共享元素转场和三栏连续工作流时，才允许使用自定义 portal overlay。
- 启动链路必须显式维护来源卡片矩形（origin rect），并支持打开时展开、关闭时反向回收。
- 必须保留 backdrop click、`Escape` 关闭、body scroll lock 和 source reveal 等基础交互约束。
- 页面层只维护单一 launcher state，不把 `selectedVideo`、`hiddenVideoId`、`originRect` 分散到多个无关组件中。
- 壳层负责转场与列布局，业务请求和状态机必须下沉到 controller / view-model，不回到单体弹框模式。

## 组件目录约定

```text
src/components/
├── ui/                    # 共享原语层，可集中主题化修改
├── shared/                # 布局壳与跨功能组合组件
│   ├── layout/
│   └── common/
└── features/              # 业务功能组件
```

约束：

- `ui/` 不写业务逻辑
- `shared/` 不绑定具体业务接口
- `features/` 不重复定义全局视觉皮肤

## 页面入口约定

`src/app/**/page.tsx` 只做页面入口与路由承接，业务状态和 UI 交互下沉到 `src/components/features/**/[feature]-page.tsx`。

## 状态与数据

- API 请求统一经 `@/lib/api-client.ts`
- 页面交互状态用 React state 或 Zustand
- 会话、导航折叠、主题切换等横切状态可放共享 store / provider

## 前端实现规则

1. **颜色只用 token**：通过 `bg-card`、`text-muted-foreground`、`border-border/60` 等语义类表达。
2. **字号只用 token**：优先 `text-2xs` ~ `text-3xl`，禁止滥用 `text-[Npx]`。
3. **全局原语先改**：当多个页面出现同类样式漂移时，先改 `src/components/ui/*`。
4. **页面壳必复用**：Dashboard 页面优先使用 `DashboardPageShell`。
5. **列表双视图**：高密度列表必须兼顾移动卡片与桌面表格。
6. **导航一体化**：桌面侧栏和移动导航必须保持同一视觉语言。
7. **文档同步**：新增稳定模式后，同步更新 `ui-ux-system.md`、本文件和相关检查文档。