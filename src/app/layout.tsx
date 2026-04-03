import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/shared/providers";

export const metadata: Metadata = {
  title: "AI Newline Center",
  description: "AI Newline Center",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
