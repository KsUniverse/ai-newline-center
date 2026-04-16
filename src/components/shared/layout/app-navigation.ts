import {
  Building2,
  Cookie,
  LayoutDashboard,
  Lightbulb,
  MonitorPlay,
  Settings,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface AppNavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  roles: readonly string[];
}

export interface AppNavGroup {
  type: "group";
  icon: LucideIcon;
  label: string;
  basePath: string;
  roles: readonly string[];
  children: AppNavItem[];
}

export type AppNavEntry = AppNavItem | AppNavGroup;

export function isNavGroup(entry: AppNavEntry): entry is AppNavGroup {
  return "type" in entry && entry.type === "group";
}

export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  {
    icon: LayoutDashboard,
    label: "仪表盘",
    href: "/dashboard",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
  },
  {
    icon: MonitorPlay,
    label: "内容账号",
    href: "/accounts",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
  },
  {
    icon: Target,
    label: "对标账号",
    href: "/benchmarks",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
  },
  {
    icon: Lightbulb,
    label: "观点库",
    href: "/viewpoints",
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
  {
    icon: Sparkles,
    label: "AI 配置",
    href: "/system-settings/ai",
    roles: ["SUPER_ADMIN"],
  },
] as const;

export const APP_NAV_ENTRIES: readonly AppNavEntry[] = [
  ...APP_NAV_ITEMS,
  {
    type: "group",
    icon: Settings,
    label: "系统设置",
    basePath: "/settings",
    roles: ["SUPER_ADMIN"],
    children: [
      {
        icon: Cookie,
        label: "爬虫 Cookie 管理",
        href: "/settings/crawler-cookies",
        roles: ["SUPER_ADMIN"],
      },
    ],
  },
] as const;

export function getVisibleNavItems(role?: string): readonly AppNavItem[] {
  return APP_NAV_ITEMS.filter((item) => !role || item.roles.includes(role));
}

export function getVisibleNavEntries(role?: string): readonly AppNavEntry[] {
  return APP_NAV_ENTRIES.filter((entry) => {
    if (!role) return false;
    if (isNavGroup(entry)) return entry.roles.includes(role);
    return entry.roles.includes(role);
  });
}
