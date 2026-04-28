import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { PromptTemplateListPage } from "@/components/features/prompt-templates/prompt-template-list";

export default async function PromptTemplatesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return <PromptTemplateListPage />;
}
