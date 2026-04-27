import type { Metadata } from "next";

import { DirectCreatePage } from "@/components/features/rewrites/direct-create-page";

export const metadata: Metadata = {
  title: "直接创作 - AI Newline Center",
};

export default function Page() {
  return <DirectCreatePage />;
}
