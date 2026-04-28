import {
  Building2,
  Cookie,
  FileText,
  Layers,
  LayoutDashboard,
  Lightbulb,
  MonitorPlay,
  PenLine,
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
  section: "workspace" | "system";
}

export interface AppNavSection {
  title: string;
  key: "workspace" | "system";
  items: readonly AppNavItem[];
}

export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  {
    icon: LayoutDashboard,
    label: "仪表盘",
    href: "/dashboard",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
    section: "workspace",
  },
  {
    icon: MonitorPlay,
    label: "内容账号",
    href: "/accounts",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
    section: "workspace",
  },
  {
    icon: Target,
    label: "对标账号",
    href: "/benchmarks",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
    section: "workspace",
  },
  {
    icon: Layers,
    label: "拆解列表",
    href: "/decompositions",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
    section: "workspace",
  },
  {
    icon: Lightbulb,
    label: "观点库",
    href: "/viewpoints",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
    section: "workspace",
  },
  {
    icon: PenLine,
    label: "直接创作",
    href: "/rewrites/new",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"],
    section: "workspace",
  },
  {
    icon: Building2,
    label: "组织管理",
    href: "/organizations",
    roles: ["SUPER_ADMIN"],
    section: "system",
  },
  {
    icon: Users,
    label: "用户管理",
    href: "/users",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER"],
    section: "system",
  },
  {
    icon: Sparkles,
    label: "AI 配置",
    href: "/system-settings/ai",
    roles: ["SUPER_ADMIN"],
    section: "system",
  },
  {
    icon: FileText,
    label: "Prompt 模板",
    href: "/system-settings/prompt-templates",
    roles: ["SUPER_ADMIN"],
    section: "system",
  },
  {
    icon: Cookie,
    label: "爬虫 Cookie 管理",
    href: "/settings/crawler-cookies",
    roles: ["SUPER_ADMIN"],
    section: "system",
  },
] as const;

const NAV_SECTION_META: Record<AppNavSection["key"], { title: string }> = {
  workspace: { title: "工作区" },
  system: { title: "系统管理" },
};

export function getVisibleNavItems(role?: string): readonly AppNavItem[] {
  return APP_NAV_ITEMS.filter((item) => !role || item.roles.includes(role));
}

export function getVisibleNavSections(role?: string): readonly AppNavSection[] {
  if (!role) {
    return [];
  }

  const visibleItems = getVisibleNavItems(role);
  const sectionOrder: AppNavSection["key"][] = ["workspace", "system"];

  return sectionOrder
    .map((key) => ({
      key,
      title: NAV_SECTION_META[key].title,
      items: visibleItems.filter((item) => item.section === key),
    }))
    .filter((section) => section.items.length > 0);
}
