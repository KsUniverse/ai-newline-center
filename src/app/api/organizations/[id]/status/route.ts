import { UserRole, OrganizationStatus } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { organizationService } from "@/server/services/organization.service";

const updateOrganizationStatusSchema = z.object({
  status: z.nativeEnum(OrganizationStatus),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const { id } = await context.params;
    const body = await request.json();
    const data = updateOrganizationStatusSchema.parse(body);
    const result = await organizationService.setStatus(id, data.status);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
