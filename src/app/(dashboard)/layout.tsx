import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppLayout } from "@/components/shared/layout/app-layout";
import { auth } from "@/lib/auth";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <AppLayout>{children}</AppLayout>;
}
