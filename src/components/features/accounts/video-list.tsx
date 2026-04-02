"use client";

import { Film, ChevronLeft, ChevronRight } from "lucide-react";

import type { DouyinVideoDTO } from "@/types/douyin-account";
import { proxyImageUrl, formatNumber, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VideoListProps {
  videos: DouyinVideoDTO[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onVideoClick: (video: DouyinVideoDTO) => void;
  loading: boolean;
}

export function VideoList({
  videos,
  total,
  page,
  limit,
  onPageChange,
  onVideoClick,
  loading,
}: VideoListProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (!loading && videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-4">
          <Film className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground/90">
          暂无视频
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground/80 max-w-sm">
          账号信息正在同步中，视频数据稍后会自动更新
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-lg border border-border/60 bg-card animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20">封面</TableHead>
              <TableHead>标题</TableHead>
              <TableHead className="w-28">发布时间</TableHead>
              <TableHead className="w-20 text-right">播放量</TableHead>
              <TableHead className="w-20 text-right">点赞</TableHead>
              <TableHead className="w-20 text-right">评论</TableHead>
              <TableHead className="w-20 text-right">转发</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.map((video) => (
              <TableRow
                key={video.id}
                className="group cursor-pointer"
                onClick={() => onVideoClick(video)}
              >
                <TableCell>
                  {video.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={proxyImageUrl(video.coverUrl)}
                      alt={video.title}
                      className="h-10 w-16 rounded object-cover bg-muted"
                    />
                  ) : (
                    <div className="h-10 w-16 rounded bg-muted flex items-center justify-center">
                      <Film className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <span className="line-clamp-1 text-sm">{video.title}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums tracking-tight">
                  {formatDateTime(video.publishedAt)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums tracking-tight">
                  {formatNumber(video.playCount)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums tracking-tight">
                  {formatNumber(video.likeCount)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums tracking-tight">
                  {formatNumber(video.commentCount)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums tracking-tight">
                  {formatNumber(video.shareCount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            共 {total} 条，第 {page}/{totalPages} 页
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
