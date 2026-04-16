import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { crawlerCookieService } from "@/server/services/crawler-cookie.service";

const createCrawlerCookieSchema = z.object({
  value: z.string().min(1, "Cookie 值不能为空"),
});

const deleteCrawlerCookiesSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, "至少选择一个 Cookie"),
});

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const items = await crawlerCookieService.list(session.user.organizationId);
    return successResponse(items);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const body = await request.json();
    const data = createCrawlerCookieSchema.parse(body);
    const item = await crawlerCookieService.create(session.user.organizationId, data.value);
    return successResponse(item, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const body = await request.json();
    const data = deleteCrawlerCookiesSchema.parse(body);
    const result = await crawlerCookieService.deleteMany(data.ids, session.user.organizationId);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
