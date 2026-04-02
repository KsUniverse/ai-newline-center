import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { douyinAccountService } from "@/server/services/douyin-account.service";

const previewAccountSchema = z.object({
  profileUrl: z
    .string()
    .url("请输入合法的 URL")
    .regex(/^https?:\/\/(www\.)?douyin\.com\/user\/.+$/, "请输入合法的抖音主页链接"),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE);

    const body = await request.json();
    const data = previewAccountSchema.parse(body);
    const preview = await douyinAccountService.previewAccount(session.user, data.profileUrl);

    return successResponse(preview);
  } catch (error) {
    return handleApiError(error);
  }
}
