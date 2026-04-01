# UI/UX 设计系统

> 摘要：Linear 风格暗色主题设计系统，支持亮色切换。基于 shadcn/ui + Tailwind CSS。弹框/抽屉/Slide-over 优先交互，减少页面跳转。如有外部品牌设计文档，以该文档为准。

## 设计原则

1. **简洁优先**: 减少视觉噪音，突出核心内容
2. **一致性**: 相同功能使用相同组件和交互模式
3. **层次分明**: 通过颜色、大小、间距建立清晰的视觉层次
4. **弹框优先**: 创建/编辑/详情用 Drawer/SlidePanel/Dialog，减少页面跳转
5. **响应式**: 桌面优先（B 端后台），兼容平板

## 品牌设计

> **如有外部提供的品牌设计文档，以该文档为准，本文档同步更新。**
>
> 外部文档应包含：品牌色、字体选择、图标风格、Logo 规范。
> 本文档提供默认设计系统作为基础。

## 色彩体系

基于 shadcn/ui CSS 变量体系，在 `globals.css` 中定义。使用 `next-themes` 切换暗色/亮色。

### 暗色主题 (默认)

> ⚠️ 下表为 **实际生效值**（已从原始 shadcn 默认值调整为 Linear 微蓝深灰黑色调）。修改 `globals.css` 时必须以此为准。

| 用途 | CSS 变量 | 值 | 场景 |
|------|----------|------|------|
| 背景 | `--background` | `hsl(240 7% 8%)` | 页面背景（非纯黑，带微蓝色调） |
| 前景 | `--foreground` | `hsl(0 0% 95%)` | 主要文字（略低于纯白，减少刺眼感） |
| 卡片 | `--card` | `hsl(240 7% 10%)` | 卡片/浮层背景（比背景亮 +2-3%） |
| 弹出层 | `--popover` | `hsl(240 7% 10%)` | 下拉/弹出框背景（与 card 统一，非背景色） |
| 主色 | `--primary` | `hsl(173 80% 37%)` | 品牌色电光青（按钮/焦点/高亮）— 区别于 emerald 状态指示器 |
| 次要 | `--secondary` | `hsl(240 5% 15%)` | 次要按钮 |
| 柔和 | `--muted` | `hsl(240 5% 15%)` | 辅助背景/禁用区域 |
| 强调 | `--accent` | `hsl(240 6% 18%)` | 悬停状态（比 muted 略亮，形成层次） |
| 危险 | `--destructive` | `hsl(0 62.8% 40%)` | 删除/错误（比原版更亮，暗背景下可读） |
| 边框 | `--border` | `hsl(240 6% 16%)` | 分割线/边框 |
| 侧边栏 | `--sidebar` | `hsl(240 7% 8%)` | 与背景同色（Linear 风格：侧边栏不单独突出） |

### 亮色主题

| 用途 | CSS 变量 | 值 |
|------|----------|------|
| 背景 | `--background` | `hsl(0 0% 99%)` |
| 前景 | `--foreground` | `hsl(240 10% 10%)` |
| 卡片 | `--card` | `hsl(0 0% 100%)` |
| 主色 | `--primary` | `hsl(173 80% 26%)` | 深电光青，深色背景可读 |
| 次要 | `--secondary` | `hsl(240 4.8% 95.9%)` |
| 柔和 | `--muted` | `hsl(240 5% 94%)` |
| 强调 | `--accent` | `hsl(240 5% 92%)` |
| 危险 | `--destructive` | `hsl(0 84.2% 60.2%)` |
| 边框 | `--border` | `hsl(240 6% 90%)` |
| 侧边栏 | `--sidebar` | `hsl(0 0% 98%)` |

### 功能色 (两套主题共用语义)

```css
--success: hsl(142 76% 36%);    /* 成功状态 */
--warning: hsl(38 92% 50%);     /* 警告状态 */
--info: hsl(217 91% 60%);       /* 信息提示 */
```

## 字体

### 字体选型原则 (DISTILLED_AESTHETICS)

> 前端美学核心要求：避免通用 AI 生成外观，选择**独特、有设计感**的字体，拒绝 Inter、Roboto、Arial、Space Grotesk 等泛滥字体。

- **UI 正文字体**：`"Outfit"` — 几何人文主义无衬线，字形独特（A/G/Q 等字母有辨识度），现代感强，非主流 SaaS 选择
- **代码/等宽字体**：`"JetBrains Mono"` — 开发者工具标配，字符可读性极佳
- 中文字符自动 fallback 到系统字体（PingFang SC / Microsoft YaHei）

```css
--font-sans: "Outfit", ui-sans-serif, system-ui, "PingFang SC", "Microsoft YaHei", sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, monospace;
```

## 字号规范

所有字号必须使用下列**语义 token 类名**，严禁硬编码 `text-[Npx]` 任意值。
Token 在 `globals.css` 的 `@theme inline` 块中定义；若需调整尺寸，只改该文件即可全局生效。

| Token Class | 实际尺寸 | 场景 |
|-------------|---------|------|
| `text-2xs` | 11px | 状态圆点旁边的角色标签、Badge 内文字 |
| `text-xs` | 12px | 等宽标识符（账号、ID、代码），搭配 `font-mono` |
| `text-sm` | 13px | **默认 UI 文字**：表格单元格、筛选标签、下拉项、帮助文本 |
| `text-base` | 14px | 正文内容 |
| `text-lg` | 16px | 区域小节标题 |
| `text-xl` | 18px | 页面主标题（配合 `font-semibold tracking-tight`） |
| `text-2xl` | 22px | 大数字/指标展示 |
| `text-3xl` | 26px | 强调标题 |

> **禁止事项**：不使用 `text-[13px]`、`text-[12px]`、`text-[11px]` 等任意值。
> 如需新尺寸，先在 `globals.css` `@theme inline` 中注册 token，再使用对应类名。

## 间距系统

基于 4px 倍数 (Tailwind 默认):

| 用途 | 值 | Tailwind |
|------|-----|----------|
| 组件内间距 | 8-12px | `p-2` ~ `p-3` |
| 组件间距 | 16-24px | `gap-4` ~ `gap-6` |
| 区域间距 | 24-32px | `space-y-6` ~ `space-y-8` |
| 页面边距 | 24-48px | `px-6` ~ `px-12` |

## 圆角

> `--radius` 基准值为 `0.4rem`（已从 shadcn 默认 `0.5rem` 收紧，整体更精致）。

| 用途 | Tailwind | 值 |
|------|----------|----|
| 按钮/输入框 | `rounded-md` | 6px |
| 卡片 | `rounded-lg` | 8px |
| 弹窗 | `rounded-xl` | 12px |
| 头像/图标 | `rounded-full` | 50% |

## 阴影

暗色主题下阴影效果较弱，通过边框区分层级：

| 层级 | 样式 |
|------|------|
| 基础 | `border border-border` |
| 浮起 | `border border-border shadow-sm` |
| 弹出 | `border border-border shadow-lg` |

## 背景与氛围 (Background & Atmosphere) (DISTILLED_AESTHETICS)

> 避免纯色背景，通过 CSS 分层营造**深度感和氛围感**，而非依赖纯色填充。

### 点阵网格纹理

可在主内容背景上叠加极淡的点阵纹理，增加深度：

```css
/* .bg-dot-grid — 在 globals.css utilities 层注册 */
background-image: radial-gradient(circle, hsl(var(--foreground) / 0.05) 1px, transparent 1px);
background-size: 20px 20px;
```

### 登录页大气渐变背景

```tsx
{/* Auth Layout 背景层 */}
<div className="pointer-events-none absolute inset-0">
  {/* 品牌色发光光晕（顶部中心） */}
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,hsl(173_80%_37%_/_0.12),transparent)]" />
  {/* 蓝色辅助氛围（右下角） */}
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_80%_100%,hsl(217_91%_60%/_0.06),transparent)]" />
  {/* 点阵纹理 */}
  <div className="absolute inset-0 bg-dot-grid" />
</div>
```

### 品牌 Logo 标记

Logo 方块使用 `bg-primary text-primary-foreground`，搭配 `shadow-primary/20` 发光阴影：

```tsx
<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20">
  A
</div>
```

## 动效

### 动效总体原则 (DISTILLED_AESTHETICS)

> 避免散乱的 micro-interaction，聚焦**高冲击时刻**：一次精心设计的页面加载交错渐显远胜于遍布各处的小动效。

```css
/* 页面入场 — 统一使用以下 keyframe */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 使用语义 class 而非 Tailwind 任意值 */
.animate-in-up      { animation: fade-up 0.35s ease-out both; }
.animate-in-up-d1   { animation: fade-up 0.35s ease-out 0.06s both; }
.animate-in-up-d2   { animation: fade-up 0.35s ease-out 0.12s both; }
.animate-in-up-d3   { animation: fade-up 0.35s ease-out 0.18s both; }
.animate-in-up-d4   { animation: fade-up 0.35s ease-out 0.24s both; }
```

**使用规范**：
- 每个 Dashboard 页面内容区根块加 `animate-in-up`
- 页面内 2~4 个独立区域使用 `animate-in-up-d1` ~ `animate-in-up-d4` 交错
- 列表行不做逐行动画（性能问题）
- Dialog / Sheet 沿用 shadcn 内置动效，不额外添加



## 响应式断点

| 断点 | Tailwind | 宽度 | 布局策略 |
|------|----------|------|----------|
| Mobile | 默认 | < 768px | 侧边栏隐藏，汉堡菜单 |
| Tablet | `md:` | ≥ 768px | 侧边栏收起，主内容全宽 |
| Desktop | `lg:` | ≥ 1024px | 侧边栏展开 + 主内容 |
| Wide | `xl:` | ≥ 1280px | 支持列表/详情分栏 |
| Ultra | `2xl:` | ≥ 1536px | 限制最大宽度 |

## Linear 风格布局规范

### 侧边栏 (Sidebar)

- **收起宽度**: `w-16` (64px) — 只显示图标
- **展开宽度**: `w-60` (240px) — 图标 + 文字
- **背景**: 使用 `--sidebar` 变量，略深于主背景
- **结构**: Logo → 主导航(图标+文字) → 分隔线 → 管理入口 → 底部(用户头像+名字)
- **当前项高亮**: `bg-accent text-accent-foreground rounded-md`

### 列表/详情分栏

在 `xl:` 以上断点，列表页可分为左侧列表 + 右侧 Slide-over 详情面板：

```tsx
<div className="flex h-full">
  <div className="flex-1 border-r border-border overflow-auto">
    {/* 列表区域 */}
  </div>
  <SlidePanel open={selected !== null} onClose={() => setSelected(null)}>
    {/* 详情/编辑 */}
  </SlidePanel>
</div>
```

### 页面标题区

每个页面顶部统一标题区（非 AppHeader，而是页面内容区的本地标题）：

```tsx
<div className="flex items-center justify-between mb-6">
  <div className="space-y-1.5">
    <h1 className="text-xl font-semibold tracking-tight leading-none text-foreground/90">页面标题</h1>
    <p className="text-sm text-muted-foreground/80 mt-1">页面描述</p>
  </div>
  <div className="flex items-center gap-2">
    {/* 操作按钮 */}
  </div>
</div>
```

## Linear 美学强约束与特征 (v0.1.1+ 必须遵循)

在后续的 UI/UX 开发中，必须严格执行以下 **Linear 级极简美学** 的细化设定：

### 1. 色彩与对比度极大克制

- 背景色拒绝纯黑，暗色模式底色使用带微蓝色的深灰黑（`hsl(240 7% 8%)`）。
- 图标不使用强烈的反差色，通常带有不透明度（如 `text-muted-foreground` 或 `opacity-70`），仅在悬停、激活或提示性反馈时恢复全对比。
- 边框应比原生 shadcn 更轻浅，常用带透明度的边框隔离内容：
  - 主要分割线：`border-border/60`
  - 顶栏 / 次要分割：`border-border/40`

### 2. 紧凑排版与精致字体参数

- 数据密集型列表、侧边栏导航文字应缩小字号：
  - 通用辅助文字 / 筛选标签 / 表头 / 下拉项：`text-[13px]`
  - 技术类标识符（账号、ID）：`text-[12px] font-mono`
  - 极小角标 / 标签内文字：`text-[11px]`
- 时间 / 数字类单元格加强可读性：`tracking-tight tabular-nums`
- 页面主标题：`text-xl font-semibold tracking-tight leading-none text-foreground/90`
- 页面副标题：`text-[13px] text-muted-foreground/80 mt-1`

### 3. 操作隐藏与上下文渐进式展示 (Hover Actions)

- 列表行 / 表格上的附加操作按钮（如"更多"按钮 `...`）**默认完全隐藏**，绝对不能占用视觉权重。
- 父级行元素加 `group`，操作按钮应用：
  ```
  opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 data-[state=open]:opacity-100
  ```
- 操作按钮固定尺寸：`h-7 w-7`（比标准 `h-8 w-8` 更小）；下拉菜单宽度 `w-36`。
- 菜单项规格：`text-[13px] py-1.5 cursor-pointer`；图标：`h-3.5 w-3.5 text-muted-foreground`。

### 4. 发光小圆点取代色块 Badge (Minimalist Indicators)

- 抛弃大面积背景填充的实心 Badge（如 `bg-green-100 text-green-800`）。
- 用 **彩色小圆点 + `text-muted-foreground` 文本** 表示启用 / 禁用状态：
  - 正常/启用：`h-1.5 w-1.5 rounded-full bg-emerald-500`
  - 已禁用：`h-1.5 w-1.5 rounded-full bg-muted-foreground/40`
- 角色 / 类型标签（非状态）使用**中性无色**方案，不做彩色区分：
  ```
  inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground
  ```

### 5. 空间纵深感与磨砂玻璃 (Depth & Glassmorphism)

- 悬浮在滚动内容上方的固定元素（顶栏 Header）必须具备空间透出感。
- 使用渐进增强写法（兼容不支持 backdrop-filter 的环境）：
  ```
  bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60
  ```
- 禁止使用 `backdrop-blur-md` 单独写法，必须配合 `supports-[backdrop-filter]` 条件包裹。

### 6. 统一页面容器与内容限宽

- 每个 Dashboard 页面内容区必须限宽并居中：
  ```
  flex flex-1 flex-col gap-6 px-8 py-6 max-w-6xl mx-auto w-full
  ```
- 新建 / 主操作按钮统一规格（不使用默认 `size="sm"` 的高度）：
  ```
  h-8 rounded-md text-[13px] px-3 shadow-sm
  ```
  图标缩小为 `h-3.5 w-3.5`，间距 `mr-1.5`。
## 交互模式

### 弹框优先原则

**首选 Dialog**，仅当内容明显过多（需要大量滚动）时才升级到 Drawer（Sheet）。

| 操作 | 交互方式 | shadcn 组件 | 升级条件 |
|------|---------|------------|---------|
| 新建/编辑（≤ 6 个字段） | **居中弹框** | `Dialog` | — |
| 新建/编辑（> 6 个字段或含富文本） | 抽屉（右侧滑出） | `Sheet` | 内容确实过多 |
| 查看详情 | 居中弹框 | `Dialog` | > 1000 字时用 `Sheet` |
| 确认/删除 | 弹框 | `AlertDialog` | — |
| 筛选 | 弹出面板 | `Popover` | — |
| 行操作 | 下拉菜单 | `DropdownMenu` | — |
| 设置/配置 | 抽屉 | `Sheet` | — |

**Dialog 动效标准**（Linear 风格）：
- Overlay：`bg-black/50`（非纯黑）
- Content：`duration-150`，`zoom-in-95` 进入，`zoom-out-95` 退出，从 `top-[52%]` 进出
- 背景：`bg-card border border-border/60 shadow-xl`（与背景有可见区分）

### 状态反馈

| 场景 | 方式 |
|------|------|
| 操作成功 | Toast 通知 (sonner) |
| 操作失败 | Toast 错误提示 |
| 加载中 | 骨架屏 (Skeleton) |
| 空数据 | EmptyState 组件 |
| AI 生成中 | 流式文字 + 进度指示 |

## 常用组件模式

### 卡片

```tsx
<Card className="border border-border">
  <CardHeader className="pb-3">
    <CardTitle className="text-base font-medium">标题</CardTitle>
    <CardDescription>描述</CardDescription>
  </CardHeader>
  <CardContent>内容</CardContent>
</Card>
```

### 空状态

```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <Icon className="h-12 w-12 text-muted-foreground/50 mb-4" />
  <h3 className="text-lg font-medium mb-1">暂无数据</h3>
  <p className="text-sm text-muted-foreground mb-4">描述文字</p>
  <Button variant="outline">操作</Button>
</div>
```

### 数据表格

使用以下标准外壳结构，**不要用 `Card` 包裹**，直接自定义容器：

```tsx
{/* 外层容器 */}
<div className="rounded-lg border border-border/60 bg-background shadow-xs overflow-hidden">
  <Table className="text-[13px] border-b-0">
    <TableHeader className="bg-muted/30">
      {/* hover:bg-transparent 防止表头出现悬停高亮；*:h-10 统一行高 */}
      <TableRow className="hover:bg-transparent border-border/60 *:h-10 *:align-middle">
        <TableHead className="font-semibold text-foreground/70 pl-5">名称</TableHead>
        <TableHead className="font-semibold text-foreground/70">状态</TableHead>
        <TableHead className="w-16 text-right font-semibold text-foreground/70 pr-5">操作</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map((item) => (
        <TableRow key={item.id} className="border-border/60 hover:bg-muted/30 transition-colors group">
          {/* 第一列固定左内边距 */}
          <TableCell className="font-medium pl-5">{item.name}</TableCell>
          {/* 技术类 ID / 账号 — 等宽字体 */}
          <TableCell className="text-muted-foreground/80 font-mono text-[12px]">{item.account}</TableCell>
          {/* 状态指示：小圆点 + 文字 */}
          <TableCell>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">正常</span>
            </div>
          </TableCell>
          {/* 时间列：等宽数字 */}
          <TableCell className="text-muted-foreground tracking-tight tabular-nums">
            {formatDate(item.createdAt)}
          </TableCell>
          {/* 操作列：默认隐藏，hover 显示，最后一列右内边距 */}
          <TableCell className="text-right pr-5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 data-[state=open]:opacity-100 -mr-1"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem className="text-[13px] py-1.5 cursor-pointer">
                  <Pencil className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  编辑
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

**关键规则**：
- 最后一个空 `TableRow`（空状态行）设 `border-b-0` 防止底部多余边线
- 筛选区域（位于表格顶部）：`bg-muted/10 border-b border-border/60 px-5 py-3`

## 规则

1. **暗色默认**: 暗色为默认主题，亮色通过 `next-themes` 切换
2. **只用 Tailwind**: 禁止内联 style、禁止 CSS modules、禁止自定义 CSS 类
3. **shadcn/ui 优先**: 有现成组件直接用，避免从零实现
4. **间距一致**: 同层级元素间距保持一致，使用 gap 而非 margin
5. **无固定宽高**: 组件尺寸由内容和容器决定，使用 min/max 约束
6. **弹框优先**: ≤ 6 个字段的新建/编辑优先用 `Dialog`，内容过多再考虑 `Sheet`
7. **品牌遵循**: 如有外部品牌设计文档，颜色/字体/图标以该文档为准
8. **颜色变量**: 颜色必须使用 CSS 变量（不硬编码 hsl 值），确保主题切换生效
9. **卡片可见性**: `--card` 在暗色模式下必须与 `--background` 有可见区别（推荐 `--card` 比 `--background` 亮度至少 +2%）
10. **字号 Token**: 必须使用 `text-2xs / text-xs / text-sm / text-base` 等已注册的 token 类名，**严禁** `text-[Npx]` 任意值

## 标准组件实现

### ThemeToggle（主题切换按钮）

```tsx
// 必须有 relative 容器，Sun/Moon 通过 dark: 类切换
<Button variant="ghost" size="icon" className="relative" onClick={...}>
  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
</Button>
```

**关键**: `Moon` 使用 `absolute` 定位，父 `Button` 必须有 `relative` 类，否则图标会脱离按钮范围。

### AppHeader（顶部导航栏）

```tsx
<header className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  {title ? (
    <h2 className="text-sm font-medium tracking-tight">{title}</h2>
  ) : (
    <div /> {/* 占位，保持 space-between 对齐 */}
  )}
  <div className="flex items-center gap-2">
    {/* 主题切换等右侧操作，图标按钮规格 */}
    <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground hover:text-foreground">
      {/* ... */}
    </Button>
  </div>
</header>
```

**关键**：`shrink-0` 防止 flex 布局下顶栏被压缩；`supports-[backdrop-filter]` 作为磨砂玻璃的渐进增强条件。
