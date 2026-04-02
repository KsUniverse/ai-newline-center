"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import type { DouyinAccountDTO } from "@/types/douyin-account";
import type { PaginatedData } from "@/types/api";
import { AccountCardGrid } from "@/components/features/accounts/account-card-grid";
import { AccountEmptyState } from "@/components/features/accounts/account-empty-state";
import { AccountAddDrawer } from "@/components/features/accounts/account-add-drawer";
import { Button } from "@/components/ui/button";
import { apiClient, ApiError } from "@/lib/api-client";

function getPageMeta(role: string): { title: string; description: string } {
  switch (role) {
    case "BRANCH_MANAGER":
      return { title: "本公司账号", description: "查看本公司所有员工的抖音账号" };
    case "SUPER_ADMIN":
      return { title: "所有账号", description: "查看全平台所有抖音账号" };
    default:
      return { title: "我的账号", description: "管理你的抖音账号" };
  }
}

export default function AccountsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [accounts, setAccounts] = useState<DouyinAccountDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const userRole = session?.user?.role ?? "EMPLOYEE";
  const isEmployee = userRole === "EMPLOYEE";
  const { title, description } = getPageMeta(userRole);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const result = await apiClient.get<PaginatedData<DouyinAccountDTO>>(
          "/douyin-accounts?page=1&limit=100",
        );
        if (!cancelled) {
          setAccounts(result.items);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof ApiError ? error.message : "加载账号数据失败，请稍后重试";
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [status, refreshKey]);

  if (status === "loading") {
    return null;
  }

  function handleCardClick(account: DouyinAccountDTO) {
    router.push(`/accounts/${account.id}`);
  }

  function handleAddSuccess() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="animate-in-up flex items-center justify-between">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight leading-none text-foreground/90">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground/80">{description}</p>
        </div>
        {isEmployee && (
          <Button
            onClick={() => setDrawerOpen(true)}
            size="sm"
            className="h-8 rounded-md text-sm px-3 shadow-sm"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            添加账号
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="animate-in-up-d1">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-lg border border-border/60 bg-card animate-pulse"
              />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <AccountEmptyState onAdd={isEmployee ? () => setDrawerOpen(true) : undefined} />
        ) : (
          <AccountCardGrid accounts={accounts} onCardClick={handleCardClick} />
        )}
      </div>

      {/* Drawer */}
      <AccountAddDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSuccess={handleAddSuccess}
      />
    </div>
  );
}
