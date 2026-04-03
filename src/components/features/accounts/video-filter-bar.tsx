"use client";

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
    <div className="flex items-center gap-3">
      {/* Account filter */}
      <Select
        value={accountId ?? "all"}
        onValueChange={(val) => onAccountChange(val === "all" ? undefined : val)}
      >
        <SelectTrigger className="w-40 h-8 text-sm">
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

      {/* Tag filter — only show when tags exist */}
      {availableTags.length > 0 && (
        <Select
          value={tag ?? "all"}
          onValueChange={(val) => onTagChange(val === "all" ? undefined : val)}
        >
          <SelectTrigger className="w-32 h-8 text-sm">
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
      )}

      {/* Sort — pushed to right */}
      <Select
        value={sort}
        onValueChange={(val) => onSortChange(val as "publishedAt" | "likeCount")}
      >
        <SelectTrigger className="w-32 h-8 text-sm ml-auto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="publishedAt">最新发布</SelectItem>
          <SelectItem value="likeCount">最多点赞</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
