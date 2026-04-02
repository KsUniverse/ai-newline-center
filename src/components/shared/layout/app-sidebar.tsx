"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/lib/stores/sidebar.store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  {
    icon: LayoutDashboard,
    label: "仪表盘",
    href: "/dashboard",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
  },
  {
    icon: Building2,
    label: "组织管理",
    href: "/organizations",
    roles: ["SUPER_ADMIN"],
  },
  {
    icon: Users,
    label: "用户管理",
    href: "/users",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER"],
  },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarStore();
  const { data: session, status } = useSession();

  const userRole = status === "authenticated" ? session?.user?.role : undefined;
  const userName = session?.user?.name ?? "用户";
  const userInitial = userName.charAt(0).toUpperCase();

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !userRole || (item.roles as readonly string[]).includes(userRole),
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-screen flex-col border-r border-border bg-sidebar transition-[width] duration-200 overflow-hidden",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center px-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-foreground text-background text-[10px] font-bold shadow-sm">
              A
            </div>
            {!collapsed && (
              <span className="truncate text-sm font-medium tracking-tight">AI Newline</span>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2 px-3">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-8 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                  isActive
                    ? "bg-accent/50 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-70" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: User + Toggle */}
        <div className="border-t border-border p-3 space-y-1.5">
          {/* User avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent",
                  collapsed && "justify-center px-0",
                )}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-xs">{userInitial}</AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <span className="truncate text-sm text-muted-foreground">
                    {userName}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Collapse toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className={cn("h-9 w-full", collapsed ? "w-9 mx-auto" : "justify-start px-3 gap-3")}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                <span className="text-sm">收起</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
