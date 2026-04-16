# v0.3.2.2 需求文档

## 基本信息

| 属性 | 值 |
|------|----|
| **版本号** | v0.3.2.2 |
| **里程碑** | v0.3.x — AI 拆解 + 碎片观点 |
| **依赖版本** | v0.3.2.1（仪表盘改造） |
| **功能点数** | 3 |
| **优先级分布** | P0(3) |
| **主题** | 系统设置 — 爬虫 Cookie 管理 |

## 版本定位

当前爬虫 Cookie 通过单一环境变量硬注入，无法在运行时切换，长期使用会因 Cookie 失效导致爬虫请求整体中断。本版作为运维基础设施补丁，引入数据库驱动的多 Cookie 池，配合 Redis 计数器实现按组织隔离的自动轮询策略，并在左侧导航新增"系统设置"入口，为后续更多系统级配置项提供扩展容器。

---

## 摘要

- **版本目标**：支持运行时管理多个爬虫 Cookie，自动循环轮询，提升爬虫链路稳定性
- **功能数量**：3 个
- **交付内容**：
  - 左侧导航新增"系统设置"菜单，含"爬虫 Cookie 管理"子项
  - 爬虫 Cookie CRUD 管理页面（新增 / 删除 / 批量删除）
  - Redis 计数器驱动的 Cookie 轮询机制（每 5 次请求切换，自动调用爬虫 `update_cookie` 接口）

---

## 边界结论

### 范围内

- 左侧导航新增"系统设置"顶级菜单（扩展现有导航结构）
- "爬虫 Cookie 管理"作为系统设置的第一个子页面
- Cookie 增删管理（支持批量删除）
- Cookie 在数据库中加密存储，展示时脱敏（前 20 字符 + `...` + 后 10 字符）
- Cookie 按组织隔离（`organizationId` 维度）
- Redis 维护每组织的请求计数器 + 当前 Cookie 指针
- 每 5 次请求切换下一个 Cookie，调用爬虫 `/api/hybrid/update_cookie` 同步
- Cookie 池为空时，降级使用 `env.CRAWLER_COOKIE`（保持向后兼容）

### 非目标（不在本版实现）

- Cookie 有效性自动检测（不主动探测 Cookie 是否过期）
- Cookie 失效自动跳过（失效检测留给后续版本）
- Cookie 排序 / 优先级手动调整
- Cookie 名称（备注）字段（暂只存 value，无需 label）
- 导入 / 导出 Cookie 文件
- 爬虫 Cookie 与员工抖音账号 Cookie 的合并管理（两者独立）

---

## 数据模型变更

### 新增表 `CrawlerCookie`

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | `String` (cuid) | — | 主键 |
| `organizationId` | `String` | — | 所属组织，外键 → `Organization` |
| `value` | `String` (TEXT) | — | Cookie 原文，加密后存储 |
| `createdAt` | `DateTime` | `now()` | 创建时间 |
| `updatedAt` | `DateTime` | auto | 更新时间 |

**索引**：`(organizationId, createdAt)` 复合索引，用于按组织拉取全量记录（按创建时间升序作为默认轮询顺序）。

### Redis Key 规范

| Key | 类型 | 说明 |
|-----|------|------|
| `crawler:cookie:counter:{organizationId}` | String (整数) | 当前组织累计爬虫请求计数，原子自增 |
| `crawler:cookie:pointer:{organizationId}` | String (整数) | 当前使用的 Cookie 在池中的索引（0-based） |

两个 Key 均不设过期时间（持久存储），服务重启后自动恢复轮询状态。

---

## 功能详细需求

### F-SysSettings-1：系统设置导航菜单（P0）

**用户故事**

作为管理员，我希望在左侧导航看到"系统设置"入口，点击后可展开子菜单，访问"爬虫 Cookie 管理"等运维配置页面。

**导航结构变更**

在现有左侧导航的"系统配置"（AI 配置）菜单**下方**，新增独立的"系统设置"顶级导航项，初始包含一个子项：

```
系统设置
  └─ 爬虫 Cookie 管理   →  /settings/crawler-cookies
```

**权限**：仅 `ADMIN` 角色可见（与现有"系统配置"菜单保持一致）。

**验收标准**

1. 管理员登录后，左侧导航出现"系统设置"菜单项
2. 点击展开，显示"爬虫 Cookie 管理"子项；点击跳转至 `/settings/crawler-cookies`
3. 非管理员角色不显示该菜单，直接访问 URL 时返回 403
4. 当前页面对应的菜单项高亮

---

### F-Cookie-1：爬虫 Cookie 管理页面（P0）

**用户故事**

作为管理员，我希望在"爬虫 Cookie 管理"页面查看当前组织的 Cookie 列表，并能新增或删除（含批量删除），以便在 Cookie 失效时快速替换，维持爬虫链路正常运转。

**页面位置**：`/settings/crawler-cookies`

**页面布局**

- 页头：标题"爬虫 Cookie 管理" + 右侧"添加 Cookie"按钮
- 操作栏：勾选状态下显示"批量删除（N）"按钮
- 列表：表格形式，支持全选

**列表字段**

| 列 | 说明 |
|----|------|
| 复选框 | 用于批量选择 |
| Cookie（脱敏） | 展示前 20 字符 + `...` + 后 10 字符；原文不在前端传输 |
| 创建时间 | `createdAt`，格式 `YYYY-MM-DD HH:mm` |
| 操作 | 单条"删除"按钮 |

列表按 `createdAt` **升序**排列（与轮询顺序一致，方便运营人员对照）。无分页，全量展示（Cookie 数量通常极少，预期个位数）。

**新增 Cookie**

- 点击"添加 Cookie"：弹出 Dialog
- Dialog 内含一个多行文本输入框（Textarea），Label 为"Cookie 值"，placeholder 提示"请粘贴完整的 Cookie 字符串"
- 点击确认：校验非空，调用 `POST /api/settings/crawler-cookies`
- 提交成功后关闭 Dialog，列表刷新
- 错误时 Toast 提示"添加失败：{message}"

**删除 Cookie**

- **单条删除**：点击行内"删除"按钮 → 确认提示"确定删除该 Cookie 吗？此操作不可恢复" → 确认后调用 `DELETE /api/settings/crawler-cookies/{id}`
- **批量删除**：勾选多条后，点击"批量删除（N）"→ 确认提示"确定删除选中的 N 个 Cookie 吗？" → 调用 `DELETE /api/settings/crawler-cookies`（body: `{ ids: string[] }`）
- 删除成功后：列表刷新，同时**重置**该组织的 Redis 计数器和指针（归零），避免指针越界

**空状态**

列表为空时展示：图标 + "暂无 Cookie，请点击右上角"添加 Cookie"按钮添加" + 快捷入口按钮。

**API 端点**

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/settings/crawler-cookies` | 查询当前组织 Cookie 列表（脱敏后返回） |
| `POST` | `/api/settings/crawler-cookies` | 新增一个 Cookie（body: `{ value: string }`） |
| `DELETE` | `/api/settings/crawler-cookies/{id}` | 删除单条 |
| `DELETE` | `/api/settings/crawler-cookies` | 批量删除（body: `{ ids: string[] }`） |

> API 返回的 Cookie `value` 字段**必须脱敏**（前20后10），原始值仅在服务端处理，不可通过任何接口暴露明文。

**验收标准**

1. 管理员打开页面，能看到当前组织所有 Cookie 的脱敏列表（按创建时间升序）
2. 点击"添加 Cookie"，弹出 Dialog，粘贴 Cookie 后提交，列表出现新条目（脱敏展示）
3. 提交空值时，输入框下方显示校验错误"Cookie 值不能为空"
4. 单条删除：点击删除 → 确认弹框 → 确认后该条消失，Redis 计数器和指针归零
5. 批量删除：勾选多条 → 点击批量删除 → 确认弹框显示正确数量 → 确认后全部消失，Redis 复位
6. 全选复选框勾选/取消全选行为正确
7. 列表为空时展示空状态
8. 跨组织数据隔离：组织 A 无法看到或操作组织 B 的 Cookie

---

### F-Cookie-2：Cookie 轮询调度逻辑（P0）

**用户故事**

作为系统，当爬虫请求量累积到 5 次时，应自动切换到下一个 Cookie 并通知爬虫服务更新，使多个 Cookie 均衡被使用，降低单一 Cookie 因频率限制失效的风险。

**轮询策略**

1. 每次发起爬虫 API 请求前，对 Redis Key `crawler:cookie:counter:{organizationId}` 执行原子自增（INCR）
2. 若 `counter % 5 == 0`（即第 5、10、15… 次请求），触发 Cookie 切换流程：
   - 将指针 `pointer` 移动到下一个索引：`pointer = (pointer + 1) % cookiePoolSize`
   - 将新指针写入 Redis Key `crawler:cookie:pointer:{organizationId}`
   - 调用爬虫接口 `POST /api/hybrid/update_cookie`，参数：
     ```json
     { "service": "douyin_web", "cookie": "<新 Cookie 的解密明文>" }
     ```
3. 切换完成后，本次及后续请求使用新 Cookie（即第 1–4 次用原 Cookie，第 5 次起用新 Cookie）
4. 若 Cookie 池为空（数据库无记录），**降级**使用 `env.CRAWLER_COOKIE`，不触发计数和切换逻辑

**初始化**

- Redis Key 不存在时，视为 `counter = 0`、`pointer = 0`，第一次自增后 counter=1，不触发切换，直接使用 pointer=0 对应的 Cookie
- 应用启动时**不**主动调用 `update_cookie`，以实际请求触发为准

**并发安全**

- `counter` 自增使用 Redis INCR 原子操作，保证多 Worker 并发场景下计数准确
- `pointer` 更新与 `update_cookie` 调用之间存在非原子窗口，属于可接受的最终一致（影响仅为同一 Cookie 多用 1-2 次，不影响正确性）

**Cookie 解密**

- Cookie 在数据库中加密存储（AES-256-GCM 或等效算法，密钥通过环境变量注入）
- `CrawlerService` 在读取 Cookie 时进行解密，**解密后的明文仅在内存中使用**，不落日志、不返回前端

**降级策略小结**

| 场景 | 行为 |
|------|------|
| Cookie 池有 N ≥ 1 条记录 | 使用轮询策略 |
| Cookie 池为空 | 降级使用 `env.CRAWLER_COOKIE`，不计数不切换 |
| `update_cookie` 调用失败 | 写日志 WARN，继续使用当前 Cookie（不抛出异常中断主流程） |

**爬虫 API 对接信息**

| 项 | 值 |
|----|-----|
| 接口路径 | `POST /api/hybrid/update_cookie` |
| Request Body | `{ "service": "douyin_web", "cookie": "<Cookie 明文>" }` |
| `service` 值 | `"douyin_web"`（固定，不可变） |
| 认证方式 | 与现有爬虫 API 调用保持一致（`env.CRAWLER_API_URL` + 已有认证头） |
| 调用时机 | 每满 5 次请求，切换指针后立即调用，**在当次请求发出前完成** |

**验收标准**

1. Cookie 池有 2 条记录（A、B）时：第 1–4 次请求均使用 A；第 5 次请求触发切换，调用 `update_cookie(B)`，本次及后续使用 B；第 10 次请求切换回 A，以此类推
2. Redis `counter` 和 `pointer` 值在切换后符合预期（可通过日志或单测验证）
3. Cookie 池只有 1 条记录时：每满 5 次仍触发计数，但 pointer 始终为 0（切换到自己），`update_cookie` 仍会被调用（保持 Cookie 活跃）
4. Cookie 池为空时，正常使用 `env.CRAWLER_COOKIE`，不报错
5. `update_cookie` 调用失败时，爬虫主请求不受影响，日志中出现 WARN 级别记录
6. 删除 Cookie 后，Redis counter 和 pointer 归零，下次请求从 index=0 重新开始

---

## 非功能要求

### 安全

- Cookie 原文**禁止**出现在：API 响应体、前端 console、应用日志（任何级别）
- 加密密钥通过独立环境变量注入（如 `CRAWLER_COOKIE_ENCRYPTION_KEY`），不得使用 `JWT_SECRET` 等已有密钥复用
- 所有 Cookie 管理 API 必须校验 session，且角色为 `ADMIN`，否则返回 401/403
- 批量删除接口需校验所有 `ids` 均属于当前 `organizationId`，防止越权删除

### 性能

- Redis INCR 为 O(1) 操作，对请求链路引入的延迟可忽略（< 1ms）
- `update_cookie` 调用为**异步**（不阻塞爬虫主请求），超时设置 3s，失败后不重试（打日志即可）

### 兼容性

- 本版引入 Cookie 池后，`env.CRAWLER_COOKIE` 仍须保留在环境变量定义中，作为兜底降级（不做破坏性变更）
- 现有爬虫调用逻辑（`CrawlerService`）需在最小侵入前提下集成轮询策略
