-- 清除短视频相关数据，保留组织、用户、账号配置等基础数据
-- 执行顺序：子表优先，避免外键约束报错

-- AI 工作区子表
DELETE FROM `ai_decomposition_annotations`;
DELETE FROM `ai_rewrite_drafts`;
DELETE FROM `ai_workspace_transcripts`;
DELETE FROM `ai_transcript_segments`;
DELETE FROM `ai_workspaces`;

-- 转录记录
DELETE FROM `transcriptions`;

-- 基准视频快照 & 视频
DELETE FROM `benchmark_video_snapshots`;
DELETE FROM `benchmark_videos`;

-- 我方账号视频快照 & 视频
DELETE FROM `video_snapshots`;
DELETE FROM `douyin_videos`;

-- 员工收藏视频
DELETE FROM `employee_collection_videos`;
