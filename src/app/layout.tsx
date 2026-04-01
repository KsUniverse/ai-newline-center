import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Outfit, JetBrains_Mono } from "next/font/google";

import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/shared/providers";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

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
      <body className={`${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
