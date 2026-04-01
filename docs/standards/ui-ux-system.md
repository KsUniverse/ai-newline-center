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

| 用途 | CSS 变量 | 值 | 场景 |
|------|----------|------|------|
| 背景 | `--background` | `hsl(240 10% 3.9%)` | 页面背景 |
| 前景 | `--foreground` | `hsl(0 0% 98%)` | 主要文字 |
| 卡片 | `--card` | `hsl(240 10% 7%)` | 卡片背景（略亮于背景，确保可见） |
| 主色 | `--primary` | `hsl(0 0% 98%)` | 主要按钮/链接 |
| 次要 | `--secondary` | `hsl(240 3.7% 15.9%)` | 次要按钮 |
| 柔和 | `--muted` | `hsl(240 3.7% 15.9%)` | 辅助文字/禁用 |
| 强调 | `--accent` | `hsl(240 3.7% 15.9%)` | 悬停状态 |
| 危险 | `--destructive` | `hsl(0 62.8% 30.6%)` | 删除/错误 |
| 边框 | `--border` | `hsl(240 3.7% 15.9%)` | 分割线/边框 |
| 侧边栏 | `--sidebar` | `hsl(240 10% 5.9%)` | 侧边栏背景 |

### 亮色主题

| 用途 | CSS 变量 | 值 |
|------|----------|------|
| 背景 | `--background` | `hsl(0 0% 100%)` |
| 前景 | `--foreground` | `hsl(240 10% 3.9%)` |
| 卡片 | `--card` | `hsl(0 0% 100%)` |
| 主色 | `--primary` | `hsl(240 5.9% 10%)` |
| 次要 | `--secondary` | `hsl(240 4.8% 95.9%)` |
| 柔和 | `--muted` | `hsl(240 4.8% 95.9%)` |
| 强调 | `--accent` | `hsl(240 4.8% 95.9%)` |
| 危险 | `--destructive` | `hsl(0 84.2% 60.2%)` |
| 边框 | `--border` | `hsl(240 5.9% 90%)` |
| 侧边栏 | `--sidebar` | `hsl(240 4.8% 95.9%)` |

### 功能色 (两套主题共用语义)

```css
--success: hsl(142 76% 36%);    /* 成功状态 */
--warning: hsl(38 92% 50%);     /* 警告状态 */
--info: hsl(217 91% 60%);       /* 信息提示 */
```

## 字体

```css
--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, monospace;
```

## 字号规范

| 层级 | Tailwind Class | 场景 |
|------|---------------|------|
| H1 | `text-3xl font-bold` | 页面标题 |
| H2 | `text-2xl font-semibold` | 区域标题 |
| H3 | `text-xl font-semibold` | 卡片标题 |
| H4 | `text-lg font-medium` | 小节标题 |
| Body | `text-sm` | 正文 (默认 14px) |
| Caption | `text-xs text-muted-foreground` | 辅助说明 |

## 间距系统

基于 4px 倍数 (Tailwind 默认):

| 用途 | 值 | Tailwind |
|------|-----|----------|
| 组件内间距 | 8-12px | `p-2` ~ `p-3` |
| 组件间距 | 16-24px | `gap-4` ~ `gap-6` |
| 区域间距 | 24-32px | `space-y-6` ~ `space-y-8` |
| 页面边距 | 24-48px | `px-6` ~ `px-12` |

## 圆角

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

## 动效

```css
/* 统一过渡 */
transition-all duration-200 ease-in-out

/* 悬停效果 */
hover:bg-accent

/* 加载动画 */
animate-pulse (骨架屏)
animate-spin (加载图标)
```

**原则**: 动效时长不超过 300ms，优先使用 CSS transition，避免大面积动画。

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

每个页面顶部统一标题区：

```tsx
<div className="flex items-center justify-between border-b border-border px-6 py-4">
  <div>
    <h1 className="text-lg font-semibold tracking-tight">页面标题</h1>
    <p className="text-sm text-muted-foreground">页面描述</p>
  </div>
  <div className="flex items-center gap-2">
    {/* 操作按钮 */}
  </div>
</div>
```

## 交互模式

### 弹框优先原则

| 操作 | 交互方式 | shadcn 组件 |
|------|---------|------------|
| 新建/编辑 | 抽屉 (从右侧滑出) | `Sheet` |
| 查看详情 | Slide-over 面板 | 自定义 `SlidePanel` |
| 确认/删除 | 弹框 | `AlertDialog` |
| 筛选 | 弹出面板 | `Popover` |
| 行操作 | 下拉菜单 | `DropdownMenu` |
| 设置/配置 | 抽屉 | `Sheet` |

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

使用 shadcn/ui `DataTable` 模式，配合列定义和分页。

## 规则

1. **暗色默认**: 暗色为默认主题，亮色通过 `next-themes` 切换
2. **只用 Tailwind**: 禁止内联 style、禁止 CSS modules、禁止自定义 CSS 类
3. **shadcn/ui 优先**: 有现成组件直接用，避免从零实现
4. **间距一致**: 同层级元素间距保持一致，使用 gap 而非 margin
5. **无固定宽高**: 组件尺寸由内容和容器决定，使用 min/max 约束
6. **弹框优先**: 创建/编辑/详情操作不跳转页面
7. **品牌遵循**: 如有外部品牌设计文档，颜色/字体/图标以该文档为准
8. **颜色变量**: 颜色必须使用 CSS 变量（不硬编码 hsl 值），确保主题切换生效
9. **卡片可见性**: `--card` 在暗色模式下必须与 `--background` 有可见区别（推荐 `--card` 比 `--background` 亮度至少 +3%）

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
