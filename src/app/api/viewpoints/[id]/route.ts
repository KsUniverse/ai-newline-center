import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { fragmentService } from "@/server/services/fragment.service";

const fragmentIdSchema = z.object({
  id: z.string().cuid(),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const { id } = fragmentIdSchema.parse(await context.params);
    const result = await fragmentService.deleteFragment(session.user, id);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
