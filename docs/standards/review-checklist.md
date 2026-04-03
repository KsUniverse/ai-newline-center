# 代码评审检查清单

> 摘要：评审 4 个维度——编译安全、逻辑正确、架构合规、规范遵循。严重度分 Critical / High / Medium / Low。

## 评审流程

1. 阅读当前版本 `technical-design.md` 了解设计意图
2. 阅读 `tasks-backend.md` + `tasks-frontend.md` 确认任务完成度
3. 逐文件按以下清单检查
4. 输出评审报告

## 评审维度

### 1. 编译与类型安全 (Critical)

- [ ] TypeScript 无编译错误 (`pnpm type-check` 通过)
- [ ] ESLint 无错误 (`pnpm lint` 通过)
- [ ] 无 `any` 类型使用
- [ ] 无 `@ts-ignore` / `@ts-expect-error`
- [ ] Zod schema 与 TypeScript 类型一致

### 2. 逻辑正确性 (Critical / High)

- [ ] API 入口有 Zod 输入验证
- [ ] 错误使用 AppError 抛出，有明确 code 和 message
- [ ] 异步操作有错误处理
- [ ] 空值检查（null / undefined）完备
- [ ] 分页参数有上限和默认值
- [ ] 无 SQL 注入 / XSS / CSRF 风险 (Prisma parameterized + Next.js 内建防护)

### 3. 架构合规性 (High)

- [ ] Route Handler 只做解析→验证→调用 Service→返回
- [ ] Service 不直接调用 Prisma（经过 Repository）
- [ ] 前端不直接 fetch（经过 apiClient）
- [ ] 组件层级正确（ui → shared → features）
- [ ] 文件位置符合 project-structure.md 约定
- [ ] 前后端共享类型定义在 src/types/
- [ ] API 响应使用统一 `ApiResponse<T>` 格式
- [ ] 数据隔离：业务模型有 `organizationId` + Repository 查询使用 `organizationId` 过滤
- [ ] 数据模型有 id/createdAt/updatedAt 必备字段
- [ ] 同领域近似逻辑未复制扩散：Repository / Service 是否优先复用了共享查询构建、映射或校验逻辑
- [ ] 业务语义方法与共享抽象边界清晰：上层未直接拼 Prisma 条件替代 Repository 语义方法

### 4. 编码规范 (Medium / Low)

- [ ] 命名符合规范 (文件 kebab-case, 组件 PascalCase)
- [ ] 导入顺序正确 (node_modules → @/ → relative → type)
- [ ] 无冗余导入
- [ ] 无 console.log (开发调试遗留)
- [ ] 注释有意义（"为什么" 而非 "是什么"）
- [ ] 组件使用 named export
- [ ] 只使用 Tailwind utility classes

### 5. UI/UX 一致性 (Medium)

- [ ] 使用 shadcn/ui 组件，无自制基础组件
- [ ] 颜色使用 CSS 变量（不硬编码色值）
- [ ] `--card` 背景与 `--background` 有可见区别（暗色模式下卡片不能隐形）
- [ ] ThemeToggle 类 Sun/Moon 绝对定位图标的父容器有 `relative` class
- [ ] 间距符合 4px 倍数体系
- [ ] 字号层级正确 (参照 ui-ux-system.md)
- [ ] 响应式布局正常
- [ ] 路由注册验证：`router.push()` 的目标路径在路由表中存在（可通过 `pnpm build` 后检查 routes-manifest.json）
- [ ] 用户操作权限 UI：对当前登录用户本身的危险操作按钮（禁用/删除等）需置灰，不能仅依赖后端拦截

## 评审报告格式

```markdown
# 代码评审报告 — vX.Y.Z

## 摘要
- 审查文件数: N
- 问题总数: N (Critical: N / High: N / Medium: N / Low: N)
- 结论: 通过 ✅ / 需修复 ❌

## 问题列表

### [C-001] Critical: 标题
- **文件**: src/app/api/users/route.ts:25
- **描述**: 缺少输入验证
- **修复建议**: 添加 Zod schema 验证

### [H-001] High: 标题
- **文件**: src/server/services/user.service.ts:15
- **描述**: ...
- **修复建议**: ...
```

## 通过标准

- **Critical**: 0 个 → 必须全部修复
- **High**: 0 个 → 必须全部修复
- **Medium**: 可接受，记录到技术债务
- **Low**: 可接受，建议修复

## 常见高风险反模式

- 为同一模型的不同 `type` 分支复制两套近似 Repository 查询
- 在 Service 层直接拼 Prisma where 条件，绕过 Repository 语义方法
- 版本文档与全局架构规范冲突后，只改代码不回写文档
- 目录结构已变化，但 `project-structure.md` 仍保留旧路径，导致后续 Agent / Copilot 继续生成过期代码
