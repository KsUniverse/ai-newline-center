import {
  Building2,
  LayoutDashboard,
  Lightbulb,
  MonitorPlay,
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
    label: "组织研究库",
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

export function getVisibleNavItems(role?: string): readonly AppNavItem[] {
  return APP_NAV_ITEMS.filter((item) => !role || item.roles.includes(role));
}
