"use client";

import { Film, Play, Heart, MessageCircle, Share2 } from "lucide-react";

import type { DouyinVideoDTO } from "@/types/douyin-account";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SlidePanel } from "@/components/shared/common/slide-panel";
import { proxyImageUrl, formatNumber, formatDateTime } from "@/lib/utils";
import { VideoTranscriptionPanel } from "./video-transcription-panel";

interface BenchmarkVideoDetailPanelProps {
  video: DouyinVideoDTO | null;
  onClose: () => void;
}

export function BenchmarkVideoDetailPanel({
  video,
  onClose,
}: BenchmarkVideoDetailPanelProps) {
  return (
    <SlidePanel
      open={video !== null}
      onClose={onClose}
      title={video?.title ?? "视频详情"}
      width="lg"
    >
      {video && (
        <div className="space-y-5">
          {/* ① 视频元信息区 */}
          <div className="space-y-3">
            {/* 封面图 */}
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center">
              {video.coverUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={proxyImageUrl(video.coverUrl)}
                  alt={video.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Film className="h-12 w-12 text-muted-foreground/50" />
              )}
            </div>

            {/* 标题 */}
            <h2 className="text-base font-semibold leading-snug">{video.title}</h2>

            {/* 发布时间 */}
            <p className="text-sm text-muted-foreground">
              {formatDateTime(video.publishedAt)}
            </p>

            {/* 数据指标行 */}
            <div className="flex flex-wrap gap-4">
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Play className="h-3.5 w-3.5" />
                {formatNumber(video.playCount)}
              </span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Heart className="h-3.5 w-3.5" />
                {formatNumber(video.likeCount)}
              </span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <MessageCircle className="h-3.5 w-3.5" />
                {formatNumber(video.commentCount)}
              </span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Share2 className="h-3.5 w-3.5" />
                {formatNumber(video.shareCount)}
              </span>
            </div>

            {/* 标签 */}
            {video.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {video.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* ② 分隔线 */}
          <Separator />

          {/* ③ 转录区 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium mb-3">AI 转录</h3>
            <VideoTranscriptionPanel
              videoId={video.id}
              videoStoragePath={video.videoStoragePath}
            />
          </div>
        </div>
      )}
    </SlidePanel>
  );
}
