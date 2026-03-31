---
description: "Use when writing frontend pages, components, layouts, styles, or React hooks. Enforces shadcn/ui design system and component hierarchy."
applyTo: ["src/app/**/page.tsx", "src/app/**/layout.tsx", "src/components/**", "src/hooks/**", "src/stores/**"]
---

# 前端开发指令

## 布局体系 (Linear 风格)

- **整体布局**: 左侧 Sidebar(收起w-16/展开w-60) + 右侧主内容区
- **Sidebar**: Logo → 主导航 → 分隔线 → 管理入口 → 底部用户区
- **页面标题区**: 每个页面顶部统一标题+描述+操作按钮区域
- **详情**: 使用 SlidePanel 右侧滑出面板，不跳转页面

## 交互模式 — 弹框优先

- **新建/编辑**: 使用 Sheet (抽屉) 从右侧滑出
- **查看详情**: 使用 SlidePanel 或 Sheet
- **确认/删除**: 使用 AlertDialog 弹框
- **筛选**: 使用 Popover
- **行操作**: 使用 DropdownMenu
- **禁止**: 表单/详情页面跳转（除顶级模块切换外）

## 组件层次

- `src/components/ui/` — shadcn/ui 原子组件 (**不手动修改**)
- `src/components/shared/layout/` — 布局组件 (AppLayout, Sidebar, Header)
- `src/components/shared/common/` — 通用组件 (SlidePanel, EmptyState, Loading)
- `src/components/features/[name]/` — 业务功能组件

## UI/UX 规则

- 色彩只用 CSS 变量 (--background, --foreground, --primary 等)
- 间距用 Tailwind 4px 倍数: p-2, gap-4, space-y-6 等
- 字号按层级: text-3xl(H1) > text-2xl(H2) > text-xl(H3) > text-sm(正文) > text-xs(辅助)
- 只用 Tailwind utility classes，禁止内联 style
- shadcn/ui 组件优先，有现成的就不自造
- 暗色主题为默认，通过 next-themes 支持亮色切换
- **如有外部品牌设计文档，以该文档为准**
- 详细设计系统参见 `docs/standards/ui-ux-system.md`

## 编码规则

- `"use client"` 仅在需要 hooks/事件/浏览器 API 时添加
- 每个组件必须定义 Props interface + named export
- API 调用统一通过 `@/lib/api-client.ts`，禁止直接 fetch
- AI 流式结果通过 `@/lib/sse-client.ts` 订阅
- 复杂业务逻辑标注 `// TODO: [INTEGRATE] 需要后端集成阶段补充`

## 禁止操作

- 不写 src/app/api/** (API 路由)
- 不改 prisma/** (数据库)
- 不改 src/server/** (后端代码)
