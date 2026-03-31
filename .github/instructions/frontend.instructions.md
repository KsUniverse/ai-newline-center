---
description: "Use when writing frontend pages, components, layouts, styles, or React hooks. Enforces shadcn/ui design system and component hierarchy."
applyTo: ["src/app/**/page.tsx", "src/app/**/layout.tsx", "src/components/**", "src/hooks/**", "src/stores/**"]
---

# 前端开发指令

## 组件层次

- `src/components/ui/` — shadcn/ui 原子组件 (**不手动修改**)
- `src/components/shared/` — 跨功能通用组件
- `src/components/features/[name]/` — 业务功能组件

## UI/UX 规则

- 色彩只用 CSS 变量 (--background, --foreground, --primary 等)
- 间距用 Tailwind 4px 倍数: p-2, gap-4, space-y-6 等
- 字号按层级: text-3xl(H1) > text-2xl(H2) > text-xl(H3) > text-sm(正文) > text-xs(辅助)
- 只用 Tailwind utility classes，禁止内联 style
- shadcn/ui 组件优先，有现成的就不自造
- 详细设计系统参见 `docs/standards/ui-ux-system.md`

## 编码规则

- `"use client"` 仅在需要 hooks/事件/浏览器 API 时添加
- 每个组件必须定义 Props interface + named export
- API 调用统一通过 `@/lib/api-client.ts`，禁止直接 fetch
- 复杂业务逻辑标注 `// TODO: [INTEGRATE] 需要后端集成阶段补充`

## 禁止操作

- 不写 src/app/api/** (API 路由)
- 不改 prisma/** (数据库)
- 不改 src/server/** (后端代码)
