"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/lib/stores/sidebar.store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  getVisibleNavSections,
  type AppNavItem,
  type AppNavSection,
} from "@/components/shared/layout/app-navigation";
import {
  getBrandNavHint,
  getBrandNavIconClassName,
  getBrandNavItemClassName,
} from "@/components/shared/common/brand";

function isNavItemActive(pathname: string, item: AppNavItem): boolean {
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function ExpandedNavSection({
  section,
  pathname,
}: {
  section: AppNavSection;
  pathname: string;
}) {
  const SectionIcon = section.key === "system" ? ShieldCheck : BriefcaseBusiness;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-2 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
        <SectionIcon className="h-3.5 w-3.5" />
        {section.title}
      </div>
      <div className="space-y-2">
        {section.items.map((item) => {
          const isActive = isNavItemActive(pathname, item);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={getBrandNavItemClassName(isActive)}
            >
              <span className={getBrandNavIconClassName(isActive)}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium tracking-tight">{item.label}</p>
                <p className="text-2xs text-muted-foreground/75">{getBrandNavHint(isActive, section.key)}</p>
              </div>
              <ArrowUpRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-opacity",
                  isActive ? "text-primary opacity-100" : "opacity-0 group-hover:opacity-70",
                )}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── AppSidebar ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "超级管理员",
  BRANCH_MANAGER: "分公司负责人",
  EMPLOYEE: "员工",
};

export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarStore();
  const { data: session, status } = useSession();

  const userRole = status === "authenticated" ? session?.user?.role : undefined;
  const userName = session?.user?.name ?? "用户";
  const userInitial = userName.charAt(0).toUpperCase();
  const roleLabel = userRole ? (ROLE_LABELS[userRole] ?? "成员") : "访客";

  const visibleNavSections = getVisibleNavSections(userRole);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border/60 bg-sidebar md:flex",
          "transition-[width] duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_28%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--sidebar))_55%,hsl(var(--background))_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.14]" />

        <div className="relative flex h-full flex-col">
          <div className="border-b border-border/40 p-3">
            <div
              className={cn(
                "overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-sm",
                collapsed ? "px-0 py-3" : "px-3 py-3",
              )}
            >
              <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "") }>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20">
                  A
                </div>
                {!collapsed ? (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-tight text-foreground/95">AI Newline</p>
                    <p className="text-2xs uppercase tracking-[0.18em] text-muted-foreground/70">Admin Surface</p>
                  </div>
                ) : null}
              </div>

              {!collapsed ? (
                <div className="mt-4 rounded-2xl border border-border/60 bg-background/80 p-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/85">Workspace</p>
                  </div>
                  <p className="mt-2 text-sm font-medium tracking-tight text-foreground/95">管理面板与内容研究共用同一套品牌界面语言</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <nav className={cn("space-y-5", collapsed && "space-y-4")}>
              {collapsed
                ? visibleNavSections.map((section) => (
                    <div key={section.key} className="space-y-2">
                      {section.key === "system" ? (
                        <div className="mx-auto h-px w-8 rounded-full bg-border/70" />
                      ) : null}
                      {section.items.map((item) => {
                        const isActive = isNavItemActive(pathname, item);
                        const Icon = item.icon;

                        return (
                          <Tooltip key={item.href}>
                            <TooltipTrigger asChild>
                              <Link
                                href={item.href}
                                className={cn(
                                  "relative mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border transition-all",
                                  isActive
                                    ? "border-primary/25 bg-primary/12 text-primary shadow-lg shadow-primary/10"
                                    : "border-transparent bg-background/60 text-muted-foreground hover:border-border/60 hover:bg-card/80 hover:text-foreground",
                                )}
                              >
                                <Icon className="h-4 w-4" />
                                {isActive ? (
                                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                                ) : null}
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">{item.label}</TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ))
                : visibleNavSections.map((section) => (
                    <ExpandedNavSection
                      key={section.key}
                      section={section}
                      pathname={pathname}
                    />
                  ))}
            </nav>
          </div>

          <div className="border-t border-border/40 p-3">
            <div className={cn("rounded-3xl border border-border/60 bg-card/80 p-2 shadow-sm", collapsed ? "px-1.5" : "px-2.5") }>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-sm transition-colors hover:bg-background/70",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <Avatar className="h-9 w-9 shrink-0 border border-border/60">
                      <AvatarFallback className="bg-background text-xs">{userInitial}</AvatarFallback>
                    </Avatar>
                    {!collapsed ? (
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate font-medium text-foreground/95">{userName}</p>
                        <p className="text-2xs text-muted-foreground/75">{roleLabel}</p>
                      </div>
                    ) : null}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align={collapsed ? "center" : "start"}
                  sideOffset={10}
                  className={cn(
                    "border-border/60 bg-popover/95",
                    collapsed ? "w-56" : "w-[var(--radix-dropdown-menu-trigger-width)] min-w-0",
                  )}
                >
                  <DropdownMenuLabel className="px-3 py-2.5">
                    <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">Signed In</p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground/95">{userName}</p>
                    <p className="text-2xs text-muted-foreground/75">{roleLabel}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                className={cn(
                  "mt-2 h-10 w-full rounded-2xl border border-transparent bg-background/50 text-muted-foreground hover:border-border/60 hover:bg-background/80 hover:text-foreground",
                  collapsed ? "mx-auto w-10 justify-center px-0" : "justify-start gap-3 px-3",
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <>
                    <PanelLeftClose className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium">收起导航</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
