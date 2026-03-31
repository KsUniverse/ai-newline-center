# UI/UX 设计系统

> 摘要：现代深色主题设计系统，基于 shadcn/ui + Tailwind CSS。参考 Linear/Vercel 风格：简洁、高对比、克制动效。

## 设计原则

1. **简洁优先**: 减少视觉噪音，突出核心内容
2. **一致性**: 相同功能使用相同组件和交互模式
3. **层次分明**: 通过颜色、大小、间距建立清晰的视觉层次
4. **响应式**: 移动端优先，断点向上适配

## 色彩体系

基于 shadcn/ui CSS 变量体系，在 `globals.css` 中定义：

### 语义色

| 用途 | CSS 变量 | 暗色值 | 场景 |
|------|----------|--------|------|
| 背景 | `--background` | `hsl(240 10% 3.9%)` | 页面背景 |
| 前景 | `--foreground` | `hsl(0 0% 98%)` | 主要文字 |
| 卡片 | `--card` | `hsl(240 10% 3.9%)` | 卡片背景 |
| 主色 | `--primary` | `hsl(0 0% 98%)` | 主要按钮/链接 |
| 次要 | `--secondary` | `hsl(240 3.7% 15.9%)` | 次要按钮 |
| 柔和 | `--muted` | `hsl(240 3.7% 15.9%)` | 辅助文字/禁用 |
| 强调 | `--accent` | `hsl(240 3.7% 15.9%)` | 悬停状态 |
| 危险 | `--destructive` | `hsl(0 62.8% 30.6%)` | 删除/错误 |
| 边框 | `--border` | `hsl(240 3.7% 15.9%)` | 分割线/边框 |

### 功能色 (自定义扩展)

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
| Mobile | 默认 | < 640px | 单列，展开菜单 |
| Tablet | `sm:` | ≥ 640px | 双列 |
| Desktop | `md:` | ≥ 768px | 侧边栏 + 主内容 |
| Wide | `lg:` | ≥ 1024px | 完整布局 |
| Ultra | `xl:` | ≥ 1280px | 限制最大宽度 |

## 常用组件模式

### 页面容器

```tsx
<div className="container mx-auto py-6 px-4 md:px-6 lg:px-8 max-w-7xl">
```

### 页面标题区域

```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl font-bold tracking-tight">页面标题</h1>
    <p className="text-sm text-muted-foreground">页面描述文字</p>
  </div>
  <Button>操作按钮</Button>
</div>
```

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

## 规则

1. **暗色主题为主**: 所有样式优先考虑暗色，亮色主题通过 `.dark` class 自动切换
2. **只用 Tailwind**: 禁止内联 style、禁止 CSS modules、禁止自定义 CSS 类
3. **shadcn/ui 优先**: 有现成组件直接用，避免从零实现
4. **间距一致**: 同层级元素间距保持一致，使用 gap 而非 margin
5. **无固定宽高**: 组件尺寸由内容和容器决定，使用 min/max 约束
