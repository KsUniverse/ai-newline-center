import type { ReactNode } from "react";

import { AppSidebar } from "@/components/shared/layout/app-sidebar";
import { AppHeader } from "@/components/shared/layout/app-header";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <AppHeader title={title} />
        <div className="flex-1 overflow-auto bg-dot-grid">
          {children}
        </div>
      </main>
    </div>
  );
}
