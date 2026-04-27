import type { Metadata } from "next";

import { DecompositionsPage } from "@/components/features/decompositions";

export const metadata: Metadata = {
  title: "拆解列表 - AI Newline Center",
};

export default function DecompositionsRoutePage() {
  return <DecompositionsPage />;
}
