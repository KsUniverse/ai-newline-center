"use client";

import { useCallback, useEffect, useState } from "react";
import { Cookie, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { SurfaceSection } from "@/components/shared/common/surface-section";
import { Button } from "@/components/ui/button";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { ConfirmDialog } from "@/components/shared/common/confirm-dialog";
import { TaskEmptyState } from "@/components/shared/common/task-empty-state";
import { CrawlerCookieTable } from "@/components/features/settings/crawler-cookie-table";
import { AddCrawlerCookieDialog } from "@/components/features/settings/crawler-cookie-add-dialog";
import { managementClient } from "@/lib/management-client";
import type { CrawlerCookieDTO } from "@/types/crawler-cookie";
import { managementCompactActionClassName, managementInsetSurfaceClassName } from "@/components/shared/common/management-primitives";

type ConfirmState =
  | { type: "single"; id: string }
  | { type: "batch"; ids: string[] }
  | null;

export function CrawlerCookiePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [items, setItems] = useState<CrawlerCookieDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [deleting, setDeleting] = useState(false);

  // Role guard
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await managementClient.listCrawlerCookies();
      setItems(data);
    } catch {
      toast.error("加载 Cookie 列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "SUPER_ADMIN") {
      void loadItems();
    }
  }, [status, session, loadItems]);

  const handleSelectChange = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(items.map((i) => i.id)));
    else setSelectedIds(new Set());
  };

  const handleDeleteSingle = (id: string) => {
    setConfirmState({ type: "single", id });
  };

  const handleDeleteBatch = () => {
    if (selectedIds.size === 0) return;
    setConfirmState({ type: "batch", ids: Array.from(selectedIds) });
  };

  const handleConfirmDelete = async () => {
    if (!confirmState) return;
    setDeleting(true);
    try {
      if (confirmState.type === "single") {
        await managementClient.deleteCrawlerCookie(confirmState.id);
        toast.success("Cookie 已删除");
        setItems((prev) => prev.filter((i) => i.id !== confirmState.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(confirmState.id);
          return next;
        });
      } else {
        const { deletedCount } = await managementClient.deleteCrawlerCookies({ ids: confirmState.ids });
        toast.success(`已删除 ${deletedCount} 个 Cookie`);
        const deletedSet = new Set(confirmState.ids);
        setItems((prev) => prev.filter((i) => !deletedSet.has(i.id)));
        setSelectedIds(new Set());
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败，请重试";
      toast.error(`删除失败：${message}`);
    } finally {
      setDeleting(false);
      setConfirmState(null);
    }
  };

  const handleCreated = (item: CrawlerCookieDTO) => {
    setItems((prev) => [...prev, item]);
  };

  const confirmTitle =
    confirmState?.type === "batch"
      ? `确定删除选中的 ${confirmState.ids.length} 个 Cookie 吗？`
      : "确定删除该 Cookie 吗？";
  const confirmDescription = "此操作不可恢复，删除后 Redis 状态将自动归零。";

  return (
    <>
      <DashboardPageShell
        eyebrow="System Settings"
        title="爬虫 Cookie 管理"
        description="管理用于爬虫接口调用的 Cookie 池，系统将自动轮询切换（每 5 次请求切换一次）。"
        actions={
          <Button onClick={() => setAddDialogOpen(true)} size="sm" className={managementCompactActionClassName}>
            <Plus className="h-4 w-4" />
            添加 Cookie
          </Button>
        }
      >
        <SurfaceSection
          eyebrow="Cookie Pool"
          title="轮询凭证与删除操作"
          description="列表、批量删除和新增入口保持在同一工作面中，减少切换并统一系统设置页的品牌语言。"
          bodyClassName="space-y-5"
          actions={
            <MetaPillList
              items={[
                { label: `共 ${items.length} 个 Cookie`, tone: "primary" },
                { label: selectedIds.size > 0 ? `已选择 ${selectedIds.size} 个` : "等待选择" },
              ]}
            />
          }
        >
          {selectedIds.size > 0 ? (
            <div className={`flex items-center gap-3 px-4 py-2.5 ${managementInsetSurfaceClassName}`}>
              <span className="text-sm text-muted-foreground">
                已选择 <span className="font-medium text-foreground">{selectedIds.size}</span> 个
              </span>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={handleDeleteBatch}
              >
                <Trash2 className="h-3.5 w-3.5" />
                批量删除（{selectedIds.size}）
              </Button>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <span className="text-sm">加载中…</span>
            </div>
          ) : items.length === 0 ? (
            <TaskEmptyState
              icon={Cookie}
              eyebrow="Cookie Pool"
              title="暂无爬虫 Cookie"
              description="添加 Cookie 后，系统将自动以轮询方式切换使用，提升爬虫链路稳定性。"
              hint="建议至少添加 2 个 Cookie 以启用轮询。"
              action={
                <Button onClick={() => setAddDialogOpen(true)} size="sm" className={managementCompactActionClassName}>
                  <Plus className="h-4 w-4" />
                  添加 Cookie
                </Button>
              }
            />
          ) : (
            <CrawlerCookieTable
              items={items}
              selectedIds={selectedIds}
              onSelectChange={handleSelectChange}
              onSelectAll={handleSelectAll}
              onDelete={handleDeleteSingle}
            />
          )}
        </SurfaceSection>
      </DashboardPageShell>

      <AddCrawlerCookieDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onCreated={handleCreated}
      />

      <ConfirmDialog
        open={confirmState !== null}
        onOpenChange={(open) => { if (!open) setConfirmState(null); }}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel="删除"
        destructive
        loading={deleting}
        onConfirm={() => { void handleConfirmDelete(); }}
      />
    </>
  );
}
