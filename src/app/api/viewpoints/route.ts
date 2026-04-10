import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { fragmentService } from "@/server/services/fragment.service";

const listFragmentsSchema = z.object({
  q: z.string().max(200).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createFragmentsSchema = z.object({
  contents: z.array(z.string()).min(1).max(50),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const query = listFragmentsSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const result = await fragmentService.listFragments(session.user, query);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const body = await request.json();
    const data = createFragmentsSchema.parse(body);
    const result = await fragmentService.createFragments(session.user, data);

    return successResponse(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
