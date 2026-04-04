# v0.3.0.2 前端任务清单

## 必读文档

- docs/product/versions/v0.3.0.2/requirements.md
- docs/product/versions/v0.3.0.2/technical-design.md
- docs/architecture/frontend.md
- docs/standards/ui-ux-system.md
- docs/standards/coding-standards.md

## 摘要

| 属性 | 值 |
|------|----|
| 任务总数 | 7 |
| 涉及模块 | 新增账号弹窗、账号列表、账号详情、API 调用封装、登录状态展示 |
| 优先级 | FE-001 ~ FE-005 为 P0，FE-006 / FE-007 为 P1 |
| 执行顺序约束 | 先完成新增账号弹窗扫码流程，再补账号状态展示与重登录入口 |

---

## 任务列表

### FE-001: 重构“新增账号”弹窗，改为二维码登录主流程 ✅

文件：
- src/components/features/accounts/account-add-drawer.tsx
- src/components/features/accounts/account-login-qrcode-panel.tsx
- src/components/features/accounts/account-login-status-copy.ts

详情：
1. 点击“新增账号”后，优先发起登录会话。
2. 弹窗展示二维码。
3. 前端轮询登录状态。
4. 根据状态展示产品型文案。
5. 自动建号成功后关闭弹窗并刷新列表。

状态要求：
- IDLE
- CREATING_SESSION
- QRCODE_READY
- SCANNED
- SUCCESS
- EXPIRED
- FAILED

---

### FE-002: 为二维码登录补前端轮询与刷新 / 取消操作 ✅

文件：
- src/components/features/accounts/account-add-drawer.tsx
- src/lib/douyin-login-session-client.ts
- src/components/features/accounts/use-douyin-login-session.ts

详情：
1. 创建登录会话后保存 loginSessionId。
2. 周期性轮询状态接口。
3. 支持点击“刷新二维码”。
4. 支持点击“取消”。
5. 关闭弹窗时，主动取消未结束会话。

实现要求：
- 不使用 SSE / WebSocket。
- 不因轮询导致弹窗状态被重置。
- 二维码刷新后展示最新二维码。

---

### FE-003: 在账号列表与账号详情展示登录状态 ✅

文件：
- src/types/douyin-account.ts
- src/components/features/accounts/account-card.tsx
- src/components/features/accounts/account-row-card.tsx
- src/components/features/accounts/account-detail-header.tsx
- src/components/features/accounts/account-login-status-badge.tsx

详情：
- 为账号列表卡片、行卡片、详情头部补充登录状态展示。
- 统一使用 Badge 和状态文案，避免分散硬编码。

---

### FE-004: 为已录入账号增加“重新登录”入口 ✅

文件：
- src/components/features/accounts/account-detail-header.tsx
- src/components/features/accounts/account-relogin-dialog.tsx

详情：
- 对已录入账号提供重新登录能力。
- 未登录 / 已失效 / 登录失败：展示“重新登录”或“立即登录”。
- 已登录：展示“更新登录”。
- 入口放在账号详情页头部。

---

### FE-005: 删除旧的主页链接预览入口与残留抽象 ✅

文件：
- src/components/features/accounts/account-add-drawer.tsx

详情：
- 新增账号流程只保留扫码自动建号主链路。
- 不再展示或维护旧的主页链接预览步骤。
- 相关类型与空壳组件不继续保留。

---

### FE-006: 为前端 API 调用补统一封装与类型 ✅

文件：
- src/lib/douyin-login-session-client.ts
- src/types/douyin-account.ts

详情：
- 补充 DouyinLoginSessionDTO、DouyinAccountLoginStatus 等前端专用类型。
- 封装创建登录会话、轮询状态、刷新二维码、取消登录、重登录调用。

---

### FE-007: 补充前端验收与异常交互 ✅

文件：
- src/components/features/accounts/account-add-drawer.tsx
- src/components/features/accounts/account-login-qrcode-panel.tsx

详情：
- 覆盖二维码加载失败、登录失败、二维码过期、用户取消、无法识别 secUserId 等异常场景。
- 错误提示清晰，不暴露底层技术细节。
- 保留用户下一步操作入口：重试 / 刷新 / 取消。

---

## 自省报告

1. 二维码登录已经沉淀为可复用的会话 hook + 面板组合，新增账号与账号重登录共用同一套轮询、刷新、取消与终态处理。
2. 登录状态 Badge 已稳定落在列表卡片、横向账号卡片与详情头部，复用成本低。
3. 前端新增账号流程已经收敛为单一主链路，状态机与文案都更容易维护。
4. 本次文档已同步删除旧路径描述，避免后续误按不存在的交互继续扩展。
