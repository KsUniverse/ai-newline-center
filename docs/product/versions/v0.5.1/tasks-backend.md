# v0.5.1 后端任务 — 成长型 AI 仿写

## 必读文档

- `docs/product/versions/v0.5.1/requirements.md`
- `docs/product/versions/v0.5.1/technical-design.md`
- `docs/architecture/OVERVIEW.md`
- `docs/architecture/backend.md`
- `docs/standards/coding-standards.md`
- `prisma/schema.prisma`

---

## 任务清单

### T1: Prisma Schema 升级

**文件**: `prisma/schema.prisma`

1. 删除 `StyleExperience` 模型与反向关联
2. 新增 `RewritePublication`
3. 新增 `RewriteLearningCase`
4. 新增 `DouyinAccountStyleProfile`
5. 为 `RewriteVersion` 添加：
   - `usedLearningCaseIds`
   - `learningContextSnapshot`
   - `promptTemplateVersion`
   - 新反向关联
6. 为 `Rewrite` / `DouyinVideo` / `DouyinAccount` / `Organization` 添加反向关联
7. 生成正式 migration（禁止仅 `db:push`）

### T2: 发布绑定 Repository + Service

**文件**:

- `src/server/repositories/rewrite-publication.repository.ts`
- `src/server/services/rewrite-publication.service.ts`

实现：

1. 查询版本当前绑定
2. 查询候选发布视频
3. 创建或更新绑定
4. 解绑
5. 校验：
   - 版本已完成
   - 有目标账号
   - 视频属于目标账号
   - 视频未被其他有效绑定占用
   - 最终稿内容不为空

### T3: 学习案例 Repository + Service

**文件**:

- `src/server/repositories/rewrite-learning-case.repository.ts`
- `src/server/services/rewrite-learning-case.service.ts`

实现：

1. 根据 `RewritePublication` 创建或刷新 `RewriteLearningCase`
2. 提取 transcript / annotations / fragments / generated / edited / final 快照
3. 从 `DouyinVideo` + `VideoSnapshot` 构建 `metricsSnapshot`
4. 计算 `performanceScore`
5. 生成 `embeddingText`
6. 写入 `embeddingJson` 与 `embeddingStatus`
7. 解绑时归档案例

### T4: 账号画像 Repository + Service

**文件**:

- `src/server/repositories/douyin-account-style-profile.repository.ts`
- `src/server/services/douyin-account-style-profile.service.ts`

实现：

1. 查询同账号有效案例
2. 样本数 `< 2` 时生成空画像
3. 样本数足够时重建画像字段
4. 绑定、解绑、案例刷新时重建

### T5: 学习检索 Service

**文件**: `src/server/services/rewrite-learning-retrieval.service.ts`

实现：

1. 构建查询文本
2. MySQL 应用层 cosine similarity
3. 合并 `performanceScore` / `recencyScore`
4. 返回 top 6 案例
5. 预留向量后端抽象，当前默认 MySQL

### T6: Rewrite Worker 集成

**文件**: `src/lib/rewrite-worker.ts`

改动：

1. 移除 `StyleExperience` 注入逻辑
2. 注入画像摘要 + 历史案例 + 本次继承经验
3. 在 `RewriteVersion` 写入：
   - `usedLearningCaseIds`
   - `learningContextSnapshot`
   - `promptTemplateVersion`
4. 检索失败时降级为原有 Prompt

### T7: 快照采集链路集成

**文件**: `src/server/services/sync.service.ts`

改动：

1. 在视频快照采集后刷新关联学习案例
2. 案例刷新后重建画像
3. 单条失败不阻断整体任务

### T8: API 路由

**文件**: `src/app/api/rewrite-versions/...`

新增：

1. `GET /api/rewrite-versions/[id]/publication`
2. `POST /api/rewrite-versions/[id]/publication`
3. `DELETE /api/rewrite-versions/[id]/publication`
4. `GET /api/rewrite-versions/[id]/publication/candidates`

要求：

1. 统一响应格式
2. 先 `auth()` 获取 session
3. Route Handler 不直接操作 Prisma

### T9: 旧实现清理

**文件**:

- `src/server/services/style-experience.service.ts`
- `src/server/repositories/style-experience.repository.ts`
- 相关引用处

改动：

1. 删除旧 `StyleExperience` 路径
2. 替换相关调用与 DTO 字段
3. 清理过时文档和测试预期
