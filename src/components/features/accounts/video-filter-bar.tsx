"use client";

import { ArrowUpWideNarrow, Filter, Hash, MonitorPlay } from "lucide-react";

import type { DouyinAccountDTO } from "@/types/douyin-account";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VideoFilterBarProps {
  accounts: DouyinAccountDTO[];
  availableTags: string[];
  accountId: string | undefined;
  tag: string | undefined;
  sort: "publishedAt" | "likeCount";
  onAccountChange: (accountId: string | undefined) => void;
  onTagChange: (tag: string | undefined) => void;
  onSortChange: (sort: "publishedAt" | "likeCount") => void;
}

export function VideoFilterBar({
  accounts,
  availableTags,
  accountId,
  tag,
  sort,
  onAccountChange,
  onTagChange,
  onSortChange,
}: VideoFilterBarProps) {
  return (
    <div className="rounded-lg border border-border/55 bg-background/70 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-md border border-border/45 bg-card/80 px-3 py-1 text-sm text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>筛选与排序</span>
        </div>

        <Select
          value={accountId ?? "all"}
          onValueChange={(val) => onAccountChange(val === "all" ? undefined : val)}
        >
          <SelectTrigger className="h-8 w-[11rem] border-border/55 bg-card text-sm">
            <MonitorPlay className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="全部账号" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部账号</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.nickname}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {availableTags.length > 0 ? (
          <Select
            value={tag ?? "all"}
            onValueChange={(val) => onTagChange(val === "all" ? undefined : val)}
          >
            <SelectTrigger className="h-8 w-[9rem] border-border/55 bg-card text-sm">
              <Hash className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="全部标签" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部标签</SelectItem>
              {availableTags.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <Select
          value={sort}
          onValueChange={(val) => onSortChange(val as "publishedAt" | "likeCount")}
        >
          <SelectTrigger className="h-8 w-[9rem] border-border/55 bg-card text-sm sm:ml-auto">
            <ArrowUpWideNarrow className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="publishedAt">最新发布</SelectItem>
            <SelectItem value="likeCount">最多点赞</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
