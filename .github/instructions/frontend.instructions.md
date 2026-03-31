---
description: "Use when writing frontend pages, components, layouts, styles, or React hooks. Enforces shadcn/ui design system and component hierarchy."
applyTo: ["src/app/**/page.tsx", "src/app/**/layout.tsx", "src/components/**", "src/hooks/**", "src/stores/**"]
---

# 前端开发指令

> 完整规范参见 `docs/architecture/frontend.md` + `docs/standards/ui-ux-system.md`

## 关键规则速查

1. **Linear 风格布局**: 左侧 Sidebar(w-16/w-60) + 右侧主内容区
2. **弹框优先**: 新建/编辑用 Sheet，详情用 SlidePanel，确认用 AlertDialog，禁止页面跳转
3. **UI/UX**: 色彩只用 CSS 变量，间距 4px 倍数，严格遵循 `ui-ux-system.md`
4. **只用 Tailwind**: 禁止内联 style、CSS modules
5. **shadcn/ui**: 有现成组件优先使用，不自造
6. **API 调用**: 统一通过 `@/lib/api-client.ts`，禁止直接 fetch
7. **[INTEGRATE] 标注**: 复杂业务逻辑标注 `// TODO: [INTEGRATE]`

## 禁止操作

- 不写 src/app/api/**、src/server/**、prisma/**
- 不修改 docs/**
