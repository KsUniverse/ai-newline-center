import type { DouyinAccountLoginStatus } from "@/types/douyin-account";
import { BRAND_PILL_BASE_CLASS_NAME } from "@/components/shared/common/brand";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { getAccountLoginStatusMeta } from "./account-login-status-copy";

interface AccountLoginStatusBadgeProps {
  status: DouyinAccountLoginStatus;
  className?: string;
}

export function AccountLoginStatusBadge({
  status,
  className,
}: AccountLoginStatusBadgeProps) {
  const meta = getAccountLoginStatusMeta(status);

  return (
    <Badge
      variant="outline"
      className={cn(
        BRAND_PILL_BASE_CLASS_NAME,
        "px-2 py-0.5 text-2xs font-medium shadow-none",
        meta.className,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClassName)} aria-hidden />
      {meta.label}
    </Badge>
  );
}
