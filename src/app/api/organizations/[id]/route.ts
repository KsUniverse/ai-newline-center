import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { organizationService } from "@/server/services/organization.service";
import { UserRole } from "@prisma/client";
import { z } from "zod";

const updateOrganizationSchema = z.object({
  name: z.string().min(1, "组织名称不能为空").max(100, "组织名称不能超过 100 个字符"),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER);

    const { id } = await context.params;
    const organization = await organizationService.getBranchByIdForCaller(session.user, id);

    return successResponse(organization);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const { id } = await context.params;
    const body = await request.json();
    const data = updateOrganizationSchema.parse(body);
    const organization = await organizationService.updateBranch(id, data.name);

    return successResponse(organization);
  } catch (error) {
    return handleApiError(error);
  }
}
