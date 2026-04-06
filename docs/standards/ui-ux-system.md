# UI/UX 设计系统

> 摘要：亮色优先、暗色兼容的品牌化运营界面。以卡片化内容表面、气氛层背景、统一页面壳、共享弹层原语为核心。基于 Tailwind CSS 4 + shadcn/ui，所有稳定样式模式必须回写到本文档和前端架构文档。

## 规范来源

当前 UI/UX 的唯一可信来源按优先级如下：

1. `src/app/globals.css`：主题 token、字体、字号 token、动效、滚动条、背景纹理
2. `src/components/ui/*.tsx`：Dialog / AlertDialog / Sheet / DropdownMenu 等共享原语
3. `src/components/shared/layout/*.tsx`：AppSidebar、AppHeader、DashboardPageShell 等布局壳
4. 本文档 `docs/standards/ui-ux-system.md`
5. `docs/architecture/frontend.md`

当代码实现与文档冲突时，应先确认实现是否已经成为稳定模式；若是，必须同步更新文档，而不是让文档继续过期。

## 设计原则

1. **品牌化但克制**：避免模板化 SaaS 外观，用气氛层、卡片和字距建立识别度，但不过度装饰。
2. **表面层级清晰**：页面背景、区块表面、浮层、危险反馈必须有明确层次，而不是只靠单一灰度区分。
3. **上下文优先**：创建、编辑、确认、查看优先在当前页面完成，减少页面跳转。
4. **共享原语先行**：菜单、弹框、抽屉、页面壳统一从全局原语收敛，不允许每个功能各做一套。
5. **移动端不缩表格**：数据密集页面默认采用“移动卡片 + 桌面表格”双视图，而不是强行压缩桌面表格。
6. **文档必须反映真实实现**：稳定的视觉模式、布局模式和交互模式必须沉淀到规范文档。

## 主题与色彩

### 总原则

- 默认主题为**亮色**，暗色作为完整兼容主题。
- 颜色必须通过 CSS 变量使用，禁止在组件中硬编码 HSL / HEX 作为业务常态样式。
- 品牌主色为电光青；信息辅助色为冷蓝；成功、警告、危险使用语义色，不混入品牌色职责。

### 主题 Token

| 语义 | 亮色 `:root` | 暗色 `.dark` | 用途 |
|------|--------------|--------------|------|
| `--background` | `0 0% 99%` | `240 7% 8%` | 页面底色 |
| `--foreground` | `240 10% 10%` | `0 0% 95%` | 主文字 |
| `--card` | `0 0% 100%` | `240 7% 10%` | 卡片与主表面 |
| `--popover` | `0 0% 100%` | `240 7% 10%` | 浮层背景 |
| `--primary` | `173 80% 26%` | `173 80% 37%` | 品牌高亮、Logo、焦点 |
| `--secondary` | `240 4.8% 95.9%` | `240 5% 15%` | 次级按钮/次级表面 |
| `--muted` | `240 5% 94%` | `240 5% 15%` | 辅助底色 |
| `--accent` | `240 5% 92%` | `240 6% 18%` | hover / active 辅助表面 |
| `--destructive` | `0 84.2% 60.2%` | `0 62.8% 40%` | 危险动作 |
| `--border` | `240 6% 90%` | `240 6% 16%` | 边框与分割线 |
| `--sidebar` | `0 0% 98%` | `240 7% 8%` | 导航背景 |

### 功能色

```css
--success: 142 76% 36%;
--warning: 38 92% 50%;
--info: 217 91% 60%;
```

## 字体与字号

### 字体

- UI 正文字体：`Outfit`
- 等宽字体：`JetBrains Mono`
- 中文 fallback：`PingFang SC`、`Microsoft YaHei`

禁止回退到 Inter、Roboto、Arial 作为主要 UI 字体方案。

### 字号 Token

所有字号必须使用 `globals.css` 中已经注册的语义 token，禁止常态使用 `text-[Npx]` 任意值。

| Token | 实际尺寸 | 用途 |
|------|----------|------|
| `text-2xs` | 11px | 眉标、极小辅助标签、状态说明 |
| `text-xs` | 12px | 编号、ID、等宽技术信息 |
| `text-sm` | 13px | 默认 UI 文案、表格单元、提示文案、下拉菜单 |
| `text-base` | 14px | 正文、详情描述 |
| `text-lg` | 16px | 区块标题 |
| `text-xl` | 18px | 页面标题 |
| `text-2xl` | 22px | 指标数字 |
| `text-3xl` | 26px | 大标题 / 强调数字 |

## 间距、圆角与阴影

### 间距

- 组件内边距：`p-2` ~ `p-4`
- 组件间距：`gap-3` ~ `gap-6`
- 页面区块间距：`space-y-6`
- 页面边距：`px-4 py-6` 起步，桌面升级到 `sm:px-6 lg:px-8`

### 圆角

- 基准圆角：`--radius: 0.4rem`
- 输入 / 按钮：`rounded-md`
- 图标壳 / 内嵌小卡：`rounded-xl` ~ `rounded-2xl`
- 区块表面 / 浮层：`rounded-2xl` ~ `rounded-3xl`

### 阴影

- 普通表面：`shadow-sm`
- 浮层：`shadow-xl shadow-black/10`
- 主 Dialog / Sheet：`shadow-2xl shadow-black/15`

本项目用法上**边框优先于重阴影**，阴影只用于提示悬浮层级，不用于制造厚重拟物感。

## 全局背景与氛围层

### 页面背景

- 页面底色来自 `--background`
- 可叠加 `bg-dot-grid` 点阵纹理
- 品牌氛围通过极淡 radial gradient 营造，而不是大片彩色块

### 玻璃感与透出

固定头部、悬浮区块、抽屉和菜单允许使用半透明背景 + blur：

```tsx
bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60
```

约束：

- 必须写 `supports-backdrop-filter:*` 渐进增强
- 不能只写 blur 而没有实底色回退

### 滚动条

滚动条属于全局品牌样式的一部分，统一由 `globals.css` 管理：

- Firefox 使用 `scrollbar-color` + `scrollbar-width: thin`
- WebKit 使用圆角胶囊形 thumb
- thumb 采用 `primary → info` 渐变

禁止在单个页面或组件内自定义另一套滚动条皮肤。

## 布局契约

### App Shell

后台主壳由 `AppSidebar + AppHeader + 主内容区` 组成：

- Sidebar 收起宽度：`w-16`
- Sidebar 展开宽度：`w-60`
- Header 高度：`h-14`
- Sidebar 与移动端导航抽屉必须使用同一套视觉语言

### DashboardPageShell

所有 Dashboard 页面优先复用 `DashboardPageShell`，统一容器宽度、标题区、动作区和返回导航：

```tsx
<DashboardPageShell
  eyebrow="Account Dossier"
  title="账号档案"
  description="查看账号登录态、同步状态与内容样本。"
  backHref="/accounts"
  backLabel="返回账号列表"
  actions={...}
>
  {children}
</DashboardPageShell>
```

约束：

- 容器限宽统一由组件负责，页面不要手写另一套顶层 `max-w-*` 容器
- 有父级列表页的详情页优先使用返回 chip，而不是裸文字链接
- 页面标题区统一保持轻页头，不再为二级页面追加独立的重页头卡片
- 标题区主操作按钮优先直接挂在 `DashboardPageShell.actions`，保持标题、动作和返回入口属于同一层级

### Dashboard 首页

Dashboard 首页默认采用**快捷入口模式**：

- 页面壳只保留问候语、角色/状态类 compact chips
- 主内容直接提供可点击的工作区卡片
- 不使用欢迎词、原理说明或大面积 overview hero 抢占首屏

### 侧边栏与移动导航

侧边栏是品牌表面的一部分，而不是纯功能菜单：

- 顶部使用品牌身份卡 + 氛围层
- 导航项使用图标壳 + 文字层级 + 激活状态说明
- 底部使用用户卡片 + 下拉菜单 + 折叠按钮
- 移动端导航抽屉必须复用相同的品牌语言和状态表达

### 区块表面

页面中的业务表面统一使用如下层级：

- 主区块：`rounded-3xl border border-border/60 bg-card/80 p-* shadow-sm`
- 内嵌表面：`rounded-2xl border border-border/60 bg-background/80`
- 危险或错误提示：语义色边框 + 极浅危险背景

## 共享交互原语

### 使用原则

菜单、弹框、抽屉必须统一走 `src/components/ui/*` 的共享封装。若风格发生稳定变化，应先修改原语，再让所有功能面继承。

### 原语规范

| 原语 | 用途 | 当前视觉契约 |
|------|------|--------------|
| `DropdownMenu` | 用户菜单、表格行操作、轻量上下文动作 | `rounded-2xl`、`border-border/60`、`bg-popover/95`、`backdrop-blur-xl` |
| `Dialog` | 聚焦型创建/编辑、短内容详情 | `rounded-3xl`、`bg-card/95`、关闭按钮使用小型图标壳 |
| `AlertDialog` | 删除、确认、危险动作 | Header/Footer 分区明确，按钮规格统一 `h-8 rounded-md px-3` |
| `Sheet` | 长表单、复杂流程、移动端导航 | 半透明浮层表面、右侧/左侧滑出、统一关闭按钮 |
| `Fullscreen Workspace Overlay` | 沉浸式三栏工作流、共享元素展开 | 全屏卡片化壳、来源卡片共享展开、关闭时反向回收 |

### 交互选择顺序

1. 确认操作：`AlertDialog`
2. 短表单或短内容：`Dialog`
3. 长表单、分步流程、移动导航：`Sheet`
4. 轻量上下文动作：`DropdownMenu`

### Fullscreen Workspace Overlay

这是当前新增的稳定模式，用于 AI 工作台这类“分析优先、创作后置”的连续任务流。

视觉与交互约束：

- 来源通常是一张列表卡片，打开时应保持“卡片被放大并进入工作台”的连续感。
- 工作台本体继续使用项目现有 `rounded-[28px] border border-border/60 bg-card/95 shadow-2xl` 表面体系，不另起一套皮肤。
- 背景遮罩、壳层 chrome、正文区和侧栏区允许分阶段淡入，但动效必须服从内容，不可喧宾夺主。
- 关闭时优先反向回收至来源卡片；若无来源锚点，才退化为普通淡出关闭。
- 同一模式下必须支持 `Escape`、点击 backdrop 关闭、body scroll lock，以及来源卡片在工作台打开期间隐藏、关闭时再显现。

## 内容模式

### 列表页模式

数据密集页面默认遵循以下结构：

1. 顶部页面壳 `DashboardPageShell`
2. 统计摘要卡片
3. 移动端卡片列表
4. 桌面端表格列表

不要在移动端直接压缩桌面表格宽度凑合显示。

附加约束：

- 列表首页默认使用**任务优先的轻页头**，只保留标题、简短描述和主操作
- 不要在首屏插入大段“原理说明型” hero / overview 区块占据主要空间
- 说明类信息优先下沉到 helper text、空状态、抽屉说明和详情页，而不是首页首屏
- 摘要卡片允许搭配一张右侧或下方的 contextual sidecar 卡片，用于放筛选说明、启停提示或管理注意事项，但文案必须保持简短，不能膨胀成第二个 hero
- 列表容器允许叠加轻量品牌气氛层（渐变 + dot-grid），但表格和卡片的可读性必须始终优先于装饰

### 表格模式

- 桌面表格作为高密度浏览模式
- 行 hover 才展示附加操作
- 技术信息使用 `font-mono` 或 `tabular-nums`
- 状态优先使用小圆点 + 文字，而不是大面积彩色 Badge

### 顶部 Chips

列表页和详情页标题区内的 summary chips 使用统一的 compact pill 模式：

- 结构：圆角胶囊 + 可选图标 + 单行状态文案
- 用途：数量、同步节奏、筛选摘要、系统状态
- 禁止：在 chips 中塞入长段解释文案，或为每个页面重写一套 pill 样式
- 详情页首屏的弱信息优先并入 chips；关键动作直接放入标题区或摘要区，避免再并排堆叠一整组说明卡

### 表单字段模式

对页面中的核心输入项，优先使用“字段块”而不是裸 input：

1. 眉标或字段分组标题
2. Label
3. 图标壳 + 输入容器
4. helper text / error text

示例：

```tsx
<div className="rounded-3xl border border-border/60 bg-background/80 p-4 shadow-sm">
  <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">
    Profile URL
  </p>
  <Label htmlFor="profile-url" className="text-sm font-medium text-foreground/90">
    抖音主页链接
  </Label>
  <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/90 px-3 py-3">
    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/90 text-primary">
      <Link2 className="h-4 w-4" />
    </span>
    <Input className="h-auto border-0 bg-transparent px-0 py-0 shadow-none" />
  </div>
</div>
```

### 详情页模式

- 返回 chip
- 眉标 + 标题 + 描述
- 动作区与内容区解耦
- 内容主体使用 `maxWidth="wide"`
- 详情页顶部状态条与二级区块摘要统一使用 compact chips，不再额外造一套 span 标签样式

### 加载、空态与反馈

- 成功 / 失败：使用 `sonner` toast
- 页面级加载：骨架屏或占位卡片
- 空态：使用统一 EmptyState 风格
- 错误：卡片内错误说明 + 明确恢复操作

空态默认采用**任务型空状态**：

- 图标 + 眉标 + 标题 + 简短描述
- 可选主操作按钮
- 可选 hint 区块告诉用户下一步怎么做
- 不再使用解释系统原理的大型 hero 空态

## 动效

页面内容区统一使用 `fade-up` 语义类：

- `.animate-in-up`
- `.animate-in-up-d1`
- `.animate-in-up-d2`
- `.animate-in-up-d3`
- `.animate-in-up-d4`

约束：

- 单页只做 2~4 个区块交错，不做密集逐行动画
- Dialog / Sheet 使用原语自带进出场
- 动效时长控制在 350ms 左右

## 响应式

| 断点 | 策略 |
|------|------|
| `< md` | 侧边栏隐藏，使用移动导航 Sheet；列表优先卡片化 |
| `md` | 侧边栏出现，可保持收起/展开状态 |
| `lg` | 标准桌面工作区，页面壳完整展开 |
| `xl` | 列表/详情分栏、宽内容区 |
| `2xl` | 容器限宽，避免内容过长 |

## 强约束

1. **只用 CSS 变量表达颜色**，不在业务组件里硬编码品牌色值。
2. **只用语义字号 token**，禁止常态化 `text-[13px]`、`text-[11px]` 等任意值。
3. **全局原语优先**：Dialog、AlertDialog、Sheet、DropdownMenu 的样式统一在 `src/components/ui/*` 维护。
4. **页面壳统一**：Dashboard 页面优先使用 `DashboardPageShell`。
5. **导航成套**：桌面侧栏与移动抽屉必须共享同一视觉语言。
6. **核心字段块化**：关键输入区优先使用字段块，而不是裸表单控件直接贴在页面上。
7. **移动端卡片化**：数据密集型列表必须为移动端提供卡片视图。
8. **危险操作显式化**：确认框必须说明影响范围，按钮规格统一。
9. **滚动条全局统一**：禁止单页私自覆盖另一套滚动条样式。
10. **文档同步**：稳定模式一旦落地，必须同步更新本文档、`frontend.md` 以及相关评审/指令文档。