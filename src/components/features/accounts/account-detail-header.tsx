import type { DouyinAccountDetailDTO } from "@/types/douyin-account";
import { proxyImageUrl, formatNumber } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface AccountDetailHeaderProps {
  account: DouyinAccountDetailDTO;
}

export function AccountDetailHeader({ account }: AccountDetailHeaderProps) {
  return (
    <div className="flex items-start gap-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxyImageUrl(account.avatar)}
        alt={account.nickname}
        className="h-16 w-16 shrink-0 rounded-full bg-muted object-cover"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground/90">
            {account.nickname}
          </h2>
          {account.bio && (
            <p className="mt-1 text-sm text-muted-foreground/80 line-clamp-2">
              {account.bio}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="tabular-nums tracking-tight">
            <span className="text-foreground/80 font-medium">{formatNumber(account.followersCount)}</span>{" "}
            粉丝
          </span>
          <Separator orientation="vertical" className="h-3" />
          <span className="tabular-nums tracking-tight">
            <span className="text-foreground/80 font-medium">{formatNumber(account.videosCount)}</span>{" "}
            作品
          </span>
        </div>
      </div>
    </div>
  );
}
