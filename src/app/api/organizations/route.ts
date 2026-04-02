import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { organizationService } from "@/server/services/organization.service";

const createOrganizationSchema = z.object({
  name: z.string().min(1, "组织名称不能为空").max(100, "组织名称不能超过 100 个字符"),
});

export async function GET() {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const result = await organizationService.listBranches();
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const body = await request.json();
    const data = createOrganizationSchema.parse(body);
    const organization = await organizationService.createBranch(data.name);

    return successResponse(organization, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
