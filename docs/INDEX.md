# 📌 AI Newline Center — 项目主入口

> 本文件是所有 AI Agent 的唯一入口。每次启动任务前必须先阅读本文件。

## 项目状态

| 属性 | 值 |
|------|----|
| **当前里程碑** | v0.3.x (AI 拆解 + 碎片观点) |
| **当前迭代** | v0.3.3 |
| **当前阶段** | Phase 1: 待规划 |
| **分支** | main |
| **最后更新** | 2026-04-16 |

## 文档导航

### 🏗 架构文档 (docs/architecture/)

| 文件 | 说明 | 何时阅读 |
|------|------|----------|
| [OVERVIEW.md](architecture/OVERVIEW.md) | 技术架构摘要 | **必读** — 所有角色 |
| [project-structure.md](architecture/project-structure.md) | 目录结构约定 | 创建新文件时 |
| [backend.md](architecture/backend.md) | 后端分层规范 | 后端开发 / 架构师 |
| [frontend.md](architecture/frontend.md) | 前端组件体系 + 页面壳 + 共享弹层原语 | 前端开发 / 架构师 |
| [database.md](architecture/database.md) | 数据库设计规范 | 后端开发 / 架构师 |
| [api-conventions.md](architecture/api-conventions.md) | API 设计规范 | 前后端开发 / 架构师 |

### 🎨 规范文档 (docs/standards/)

| 文件 | 说明 | 何时阅读 |
|------|------|----------|
| [ui-ux-system.md](standards/ui-ux-system.md) | 全局视觉语言、主题 token、页面/表单/弹层样式规范 | 前端开发 / 测试 |
| [coding-standards.md](standards/coding-standards.md) | 编码规范 | 所有开发角色 |
| [review-checklist.md](standards/review-checklist.md) | 评审检查清单 | 代码评审 |

### 📋 产品文档 (docs/product/)

| 文件 | 说明 | 何时阅读 |
|------|------|----------|
| [PRD.md](product/PRD.md) | 完整产品需求规格书 | **必读** — 产品经理 / 架构师 |
| [ROADMAP.md](product/ROADMAP.md) | 版本路线图 | 产品经理 / 架构师 |
| versions/vX.Y.Z/ | 各版本需求和任务 | 当前迭代角色 |

### ⚙ 流程文档 (docs/workflow/)

| 文件 | 说明 | 何时阅读 |
|------|------|----------|
| [PROCESS.md](workflow/PROCESS.md) | 迭代流程 + 角色职责 | **必读** — 编排者 |

## 版本历史

| 版本 | 状态 | 说明 |
|------|------|------|
| v0.1.0 | ✅ 已完成 | 基础框架 + 用户登录 |
| v0.1.1 | ✅ 已完成 | 组织管理 + 用户管理 |
| v0.2.0 | ✅ 已完成 | 添加抖音账号 + 账号与视频列表 |
| v0.2.1 | ✅ 已完成 | 账号信息定时同步 |
| v0.2.1.1 | ✅ 已完成 | 爬虫真实对接 |
| v0.2.2 | ✅ 已完成 | 收藏同步 + 对标账号管理 |
| v0.3.0 | ✅ 已完成 | AI 拆解基础能力 |
| v0.3.0.1 | ✅ 已完成 | 收藏同步修复 + 页面自动刷新 |
| v0.3.0.2 | ✅ 已完成 | 员工抖音账号扫码登录与 Cookie 持久化 |
| v0.3.1 | ✅ 已完成 | AI 配置 + 统一 AI 工作台（转录/手动拆解/仿写占位） |
| v0.3.1.1 | ✅ 已完成 | 手动划句批注拆解（已并入 v0.3.1）+ MySQL 迁移 + OSS 基础设施 |
| v0.3.2 | ✅ 已完成 | 碎片观点库（F-004-1 + F-004-2） |
| v0.3.2.1 | ✅ 已完成 | 仪表盘改造：短视频列表 + 封禁账号列表 |
| v0.3.2.2 | 🏗 开发中 | 系统设置：爬虫 Cookie 管理 |

## 快速指令

- **开始新版本迭代**: 对编排者说 "进入下一个版本迭代"
- **查看当前进度**: 阅读当前版本目录下的 changelog.md
- **查看技术方案**: 阅读当前版本目录下的 technical-design.md
