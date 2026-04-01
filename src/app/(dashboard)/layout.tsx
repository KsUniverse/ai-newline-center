import type { ReactNode } from "react";

import { AppLayout } from "@/components/shared/layout/app-layout";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return <AppLayout>{children}</AppLayout>;
}
