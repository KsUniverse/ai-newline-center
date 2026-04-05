"use client";

import { Clock3, MessageCircle, Play, Share2 } from "lucide-react";

import type { DouyinVideoDTO } from "@/types/douyin-account";
import { Badge } from "@/components/ui/badge";
import { SlidePanel } from "@/components/shared/common/slide-panel";
import { proxyImageUrl, formatDateTime, formatNumber } from "@/lib/utils";

import {
  getBenchmarkVideoDetailTitle,
  getBenchmarkVideoStatusHint,
  getBenchmarkVideoStatusLabel,
} from "./benchmark-copy";
import { VideoTranscriptionPanel } from "./video-transcription-panel";

interface BenchmarkVideoDetailPanelProps {
  video: DouyinVideoDTO | null;
  onClose: () => void;
}

export function BenchmarkVideoDetailPanel({
  video,
  onClose,
}: BenchmarkVideoDetailPanelProps) {
  const title = getBenchmarkVideoDetailTitle(video?.title);

  return (
    <SlidePanel
      open={video !== null}
      onClose={onClose}
      title={title}
      width="lg"
    >
      {video && (
        <div className="space-y-5">
          <section className="space-y-4 rounded-3xl border border-border/60 bg-background/70 p-4 shadow-sm">
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-muted flex items-center justify-center">
              {video.coverUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={proxyImageUrl(video.coverUrl)}
                  alt={video.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-sm text-muted-foreground">暂无封面</div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-2xs">
                {getBenchmarkVideoStatusLabel(video.videoStoragePath)}
              </Badge>
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                {formatDateTime(video.publishedAt)}
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold leading-snug tracking-tight text-foreground/95">
                {video.title}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground/80">
                {getBenchmarkVideoStatusHint(video.videoStoragePath)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-border/60 bg-card/80 p-3">
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Play className="h-3.5 w-3.5" />
                  播放
                </span>
                <p className="mt-2 text-base font-semibold tracking-tight text-foreground/95">
                  {formatNumber(video.playCount)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/80 p-3">
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  点赞
                </span>
                <p className="mt-2 text-base font-semibold tracking-tight text-foreground/95">
                  {formatNumber(video.likeCount)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/80 p-3">
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MessageCircle className="h-3.5 w-3.5" />
                  评论
                </span>
                <p className="mt-2 text-base font-semibold tracking-tight text-foreground/95">
                  {formatNumber(video.commentCount)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/80 p-3">
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Share2 className="h-3.5 w-3.5" />
                  分享
                </span>
                <p className="mt-2 text-base font-semibold tracking-tight text-foreground/95">
                  {formatNumber(video.shareCount)}
                </p>
              </div>
            </div>

            {video.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {video.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-3xl border border-border/60 bg-background/70 p-4 shadow-sm">
            <div className="space-y-1.5">
              <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/85">
                Research Transcript
              </p>
              <h3 className="text-lg font-semibold tracking-tight text-foreground/95">研究转录</h3>
              <p className="text-sm leading-6 text-muted-foreground/80">
                仅针对研究对象档案内的 benchmark video 发起与编辑 AI 转录，用于后续拆解和回溯。
              </p>
            </div>
            <VideoTranscriptionPanel
              videoId={video.id}
              videoStoragePath={video.videoStoragePath}
            />
          </section>
        </div>
      )}
    </SlidePanel>
  );
}
