"use client";

import { ExternalLink, Heart, MessageCircle, Play, Share2 } from "lucide-react";

import type { DouyinVideoDTO, DouyinVideoWithAccountDTO } from "@/types/douyin-account";
import { formatDateTime, formatNumber, proxyImageUrl } from "@/lib/utils";
import { SlidePanel } from "@/components/shared/common/slide-panel";

import { getAccountDetailPanelTitle } from "./accounts-copy";

interface VideoDetailDialogProps {
  video: (DouyinVideoDTO & Partial<Pick<DouyinVideoWithAccountDTO, "accountNickname">>) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoDetailDialog({ video, open, onOpenChange }: VideoDetailDialogProps) {
  if (!video) return null;

  return (
    <SlidePanel
      open={open}
      onClose={() => onOpenChange(false)}
      title={getAccountDetailPanelTitle(video)}
      width="lg"
    >
      <div className="space-y-5">
        <section className="space-y-4 rounded-xl border border-border/55 bg-background/70 p-4">
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-border/55 bg-muted">
            {video.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proxyImageUrl(video.coverUrl)}
                alt={video.title}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/75">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/14 bg-primary/8 px-2.5 py-1 text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              内容样本
            </span>
            {video.accountNickname ? (
              <span className="inline-flex items-center rounded-md border border-border/45 bg-background/80 px-2.5 py-1 normal-case tracking-normal text-muted-foreground">
                {video.accountNickname}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-md border border-border/45 bg-background/80 px-2.5 py-1 normal-case tracking-normal text-muted-foreground">
              {formatDateTime(video.publishedAt)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatItem icon={Play} label="播放" value={video.playCount} />
            <StatItem icon={Heart} label="点赞" value={video.likeCount} />
            <StatItem icon={MessageCircle} label="评论" value={video.commentCount} />
            <StatItem icon={Share2} label="转发" value={video.shareCount} />
          </div>
        </section>

        <section className="rounded-xl border border-border/55 bg-background/70 p-4">
          <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/85">Distribution</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground/80">
            该面板用于快速核查内容样本的互动表现、发布时间与原视频跳转链接。
          </p>
          {video.videoUrl ? (
            <a
              href={video.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              查看原视频
            </a>
          ) : null}
        </section>
      </div>
    </SlidePanel>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border/55 bg-card/80 p-3 text-center">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-lg font-semibold tabular-nums tracking-tight text-foreground/90">
        {formatNumber(value)}
      </span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
