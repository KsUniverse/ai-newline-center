# Bug 记录 — v0.1.0

---

## BUG-002: Tailwind CSS 样式完全失效

- **严重度**: Critical
- **状态**: In Fix
- **分支**: bug/BUG-002-missing-tailwind-styles
- **发现时机**: 用户验收
- **描述**: 页面呈现完全无样式的白板 HTML，登录组件和全局样式完全未能按照预期的 Tailwind 效果加载。
- **复现步骤**:
  1. 运行 `npm run dev`
  2. 访问 `/login`
- **影响范围**: 整个前端 UI 样式瘫痪
- **根本原因**: 项目使用 Tailwind CSS v4，但是 `package.json` 和 `postcss.config.mjs` 中未配置必需的 `@tailwindcss/postcss` 转换插件，导致 Tailwind 类名未被编译为实际的 CSS。
- **修复说明**:
  1. 运行 `pnpm add -D @tailwindcss/postcss -w` 安装缺失的文件
  2. 在 `postcss.config.mjs` 中正确注册 `@tailwindcss/postcss`
- **验证结果**: 待用户本地运行查看样式是否恢复
