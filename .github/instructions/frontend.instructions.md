---
description: "Use when writing frontend pages, components, layouts, styles, or React hooks. Enforces shadcn/ui design system and component hierarchy."
applyTo: ["src/app/**/page.tsx", "src/app/**/layout.tsx", "src/components/**", "src/hooks/**", "src/stores/**"]
---

# 前端开发指令

> 完整规范参见 `docs/architecture/frontend.md` + `docs/standards/ui-ux-system.md`

## 关键规则速查

1. **Linear 风格布局**: 左侧 Sidebar(w-16/w-60) + 右侧主内容区
2. **弹框优先**: 新建/编辑用 Sheet，详情用 SlidePanel，确认用 AlertDialog，禁止页面跳转
3. **UI/UX**: 色彩只用 CSS 变量，间距 4px 倍数，严格遵循 `ui-ux-system.md`；字体使用 `Outfit`（禁用 Inter/Roboto/Space Grotesk）
4. **只用 Tailwind**: 禁止内联 style、CSS modules
5. **shadcn/ui**: 有现成组件优先使用，不自造
6. **API 调用**: 统一通过 `@/lib/api-client.ts`，禁止直接 fetch
7. **[INTEGRATE] 标注**: 复杂业务逻辑标注 `// TODO: [INTEGRATE]`
8. **统一风格优先**: 同领域页面优先复用既有列表页、详情页、空状态、分页和添加流程的视觉与交互模式
9. **避免复制式实现**: 若差异只在文案、接口、Badge、权限展示，优先抽共享组件或 props 配置，不直接复制整页/整组件

## 美学约束 (DISTILLED_AESTHETICS)

- 字体：只用 `Outfit`（UI）+ `JetBrains Mono`（代码），拒绝 Inter / Space Grotesk / system-ui
- 品牌色：`--primary` 为电光青 `hsl(173 80% 37%)`，按钮/Logo 标记用此色
- 背景：避免纯色；登录页用大气渐变，主内容区可叠加点阵纹理 (`.bg-dot-grid`)
- 动效：页面入场用 `.animate-in-up` + 间隔延迟类 (`.animate-in-up-d1` 等)，时长 ≤ 350ms
- Logo 标记：`bg-primary text-primary-foreground shadow-primary/20`

## 禁止操作

- 不写 src/app/api/**、src/server/**、prisma/**
- 不修改 docs/**
