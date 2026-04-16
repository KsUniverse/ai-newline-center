import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { benchmarkAccountService } from "@/server/services/benchmark-account.service";

const querySchema = z.object({
  dateRange: z
    .enum(["today", "yesterday", "this_week", "this_month"])
    .default("this_week"),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE);

    const params = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const result = await benchmarkAccountService.listBannedAccounts(session.user, {
      dateRange: params.dateRange,
    });

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
