# Changelog — v0.2.0

> 发布日期: 2026-04-03
> 里程碑: v0.2.x（账号管理）
> 功能点: F-001-1（添加抖音账号）+ F-001-3（账号与视频列表展示）

---

## 新增功能

### F-001-1: 添加抖音账号
- 员工可通过抖音主页链接添加自己管理的账号
- 系统通过 CrawlerService 抓取账号基本信息（昵称、头像、粉丝数、作品数、简介）
- 重复添加同一链接时给出提示（profileUrl 全局唯一约束）
- 爬虫失败时有错误提示，不创建记录
- 开发模式支持 mock 数据（CRAWLER_API_URL 为空时自动启用）

### F-001-3: 账号与视频列表展示
- 账号列表页：卡片式布局，展示头像、昵称、粉丝数、作品数
- 角色权限控制：员工看自己的、分公司负责人看本公司的、超管看全部
- 无账号时展示引导性空状态
- 账号详情页：并行加载账号信息和视频列表，视频分页展示
- 视频详情弹窗：展示视频封面、统计数据、描述

## 技术变更

### 数据库
- 新增 `DouyinAccount` 模型（profileUrl @unique, type DouyinAccountType enum）
- 新增 `DouyinVideo` 模型（videoId @unique）
- 迁移: `20260402163020_add_douyin_models`

### 后端
- 新增 `CrawlerService`（统一封装外部爬虫 API + 自动重试 + mock 模式）
- 新增 `DouyinAccountService` + `DouyinAccountRepository`（三层架构）
- 新增 API 路由: `/api/douyin-accounts` (CRUD), `/api/douyin-accounts/preview`, `/api/proxy/image`
- 新增共享类型: `src/types/douyin-account.ts`

### 前端
- 新增 `/accounts` 页面（账号列表，角色自适应标题和权限）
- 新增 `/accounts/[id]` 页面（账号详情 + 视频列表 + 分页）
- 新增 7 个组件: AccountCard, AccountCardGrid, AccountAddDrawer, AccountDetailHeader, AccountEmptyState, VideoList, VideoDetailDialog
- 图片代理工具函数 `proxyImageUrl()`

### 安全
- 图片代理 SSRF 防护：HTTPS-only、严格域名白名单、需认证 session
- Service 层 `previewAccount` 增加 caller 参数做权限校验

## 流程改进

### PM 工作流（PROCESS.md + pm.agent.md）
- 强制要求每次迭代完整阅读 PRD.md 全文
- 新增「深度业务对接」环节：必须与用户确认外部服务对接、定时任务、数据流转细节

### 架构师工作流（PROCESS.md + architect.agent.md）
- 新增「深度技术对齐」环节：出方案前必须与用户确认领域模型、外部服务集成、业务逻辑细节、交互流程
- 禁止在外部服务对接细节不明确时假设实现方案

## 测试结果

- 自动化测试: 35/35 通过
- 功能验收: 12/12 通过
- type-check / lint: 通过
- 安全审查: 通过（SSRF 防护、认证检查）
