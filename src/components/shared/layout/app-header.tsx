"use client";

import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, Menu, Moon, ShieldCheck, Sparkles, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useTheme } from "next-themes";

import {
  BRAND_DIVIDER_CLASS_NAME,
  getBrandNavHint,
  getBrandNavIconClassName,
  getBrandNavItemClassName,
} from "@/components/shared/common/brand";
import { getVisibleNavSections } from "@/components/shared/layout/app-navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navSections = getVisibleNavSections(session?.user?.role);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/35 bg-background px-6">
      <div className="flex items-center gap-3">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" aria-label="打开导航">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-full border-r border-border/55 bg-card p-0 sm:max-w-sm">
            <div className="relative flex h-full flex-col overflow-hidden">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.22)_100%)]" />
              <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.08]" />
              <SheetHeader className={cn("relative border-b px-5 py-5 text-left", BRAND_DIVIDER_CLASS_NAME)}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/14 bg-primary text-sm font-bold text-primary-foreground">
                    A
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">Navigation</p>
                    <SheetTitle className="text-lg font-semibold tracking-tight text-foreground/95">工作区导航</SheetTitle>
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-border/55 bg-background p-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/85">Control Surface</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground/80">移动端导航与桌面侧栏保持同一套品牌语言、层级和模块状态。</p>
                </div>
              </SheetHeader>
              <nav className="relative flex-1 space-y-5 px-4 py-4">
                {navSections.map((section) => {
                  const SectionIcon = section.key === "system" ? ShieldCheck : BriefcaseBusiness;

                  return (
                    <div key={section.key} className="space-y-2">
                      <div className="flex items-center gap-2 px-1 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                        <SectionIcon className="h-3.5 w-3.5" />
                        {section.title}
                      </div>
                      <div className="space-y-2">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={getBrandNavItemClassName(isActive)}
                              onClick={() => setMobileNavOpen(false)}
                            >
                              <span className={getBrandNavIconClassName(isActive)}>
                                <Icon className="h-4 w-4 shrink-0" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium tracking-tight">{item.label}</p>
                                <p className="text-2xs text-muted-foreground/75">{getBrandNavHint(isActive, section.key)}</p>
                              </div>
                              <ArrowUpRight className={cn("h-3.5 w-3.5 shrink-0 transition-opacity", isActive ? "text-primary opacity-100" : "opacity-0 group-hover:opacity-70")}/>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        {title ? <h2 className="text-sm font-medium tracking-tight">{title}</h2> : <div />}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="切换主题"
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </Button>
    </header>
  );
}
