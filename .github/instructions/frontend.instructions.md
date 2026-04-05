---
description: "Use when writing frontend pages, components, layouts, styles, or React hooks. Enforces shadcn/ui design system and component hierarchy."
applyTo: ["src/app/**/page.tsx", "src/app/**/layout.tsx", "src/components/**", "src/hooks/**", "src/stores/**"]
---

# 前端开发指令

> 完整规范参见 `docs/architecture/frontend.md` + `docs/standards/ui-ux-system.md`

## 关键规则速查

1. **品牌工作台布局**: 左侧 Sidebar(`w-16` / `w-60`) + 右侧主内容区，移动端导航必须与桌面侧栏同一视觉语言
2. **弹层优先**: 短表单用 `Dialog`，长表单和流程用 `Sheet`，确认用 `AlertDialog`，轻量动作用 `DropdownMenu`
3. **UI/UX**: 色彩只用 CSS 变量，字号只用 `text-2xs` ~ `text-3xl` 语义 token，严格遵循 `ui-ux-system.md`
4. **全局原语优先**: 菜单、Dialog、AlertDialog、Sheet 的统一风格改在 `src/components/ui/*`，不要在功能组件各写一套
5. **只用 Tailwind**: 禁止内联 style、CSS modules
6. **API 调用**: 统一通过 `@/lib/api-client.ts`，禁止直接 fetch
7. **页面入口收敛**: `src/app/**/page.tsx` 只做入口，页面级状态和交互下沉到 `src/components/features/**/[feature]-page.tsx`
8. **页面壳复用**: Dashboard 页面优先复用 `src/components/shared/layout/dashboard-page-shell.tsx`
9. **列表双视图**: 高密度列表优先采用“统计摘要 + 移动卡片 + 桌面表格”
10. **字段块优先**: 关键输入区优先用字段块，而不是裸 input 直接贴在页面上
11. **文档同步**: 稳定的新视觉模式必须同步更新 `docs/standards/ui-ux-system.md` 和 `docs/architecture/frontend.md`
12. **[INTEGRATE] 标注**: 复杂业务逻辑标注 `// TODO: [INTEGRATE]`

## 美学约束 (DISTILLED_AESTHETICS)

- 字体：只用 `Outfit`（UI）+ `JetBrains Mono`（代码）
- 主题：亮色默认，暗色完整兼容；禁止假设“暗色是唯一正式主题”
- 品牌色：`--primary` 为电光青，按钮、Logo、焦点与眉标使用该语义色
- 背景：避免单纯白板或纯黑底，允许点阵纹理与极淡 radial gradient 氛围层
- 表面：主区块使用 `rounded-3xl border border-border/60 bg-card/80 shadow-sm` 一类卡片化表面
- 动效：页面入场用 `.animate-in-up` + 延迟类，时长控制在 350ms 左右

## 禁止操作

- 不写 src/app/api/**、src/server/**、prisma/**
- 不在功能组件内复制一套新的 Dropdown / Dialog / Sheet 视觉皮肤
- 不跳过文档同步，导致代码与规范长期分叉
