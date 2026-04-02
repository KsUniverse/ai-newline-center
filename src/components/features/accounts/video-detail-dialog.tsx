"use client";

import { ExternalLink, Play, Heart, MessageCircle, Share2 } from "lucide-react";

import type { DouyinVideoDTO } from "@/types/douyin-account";
import { proxyImageUrl, formatNumber, formatDateTime } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VideoDetailDialogProps {
  video: DouyinVideoDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoDetailDialog({ video, open, onOpenChange }: VideoDetailDialogProps) {
  if (!video) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="line-clamp-2">{video.title}</DialogTitle>
          <DialogDescription className="tabular-nums tracking-tight">
            {formatDateTime(video.publishedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cover */}
          {video.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxyImageUrl(video.coverUrl)}
              alt={video.title}
              className="w-full rounded-lg object-cover bg-muted max-h-64"
            />
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-3">
            <StatItem icon={Play} label="播放" value={video.playCount} />
            <StatItem icon={Heart} label="点赞" value={video.likeCount} />
            <StatItem icon={MessageCircle} label="评论" value={video.commentCount} />
            <StatItem icon={Share2} label="转发" value={video.shareCount} />
          </div>

          {/* Video link */}
          {video.videoUrl && (
            <a
              href={video.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              查看原视频
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-card p-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-lg font-semibold tabular-nums tracking-tight text-foreground/90">
        {formatNumber(value)}
      </span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
