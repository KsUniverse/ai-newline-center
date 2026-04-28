import { PromptStepType, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { promptTemplateService } from "@/server/services/prompt-template.service";

const createSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100),
  stepType: z.nativeEnum(PromptStepType),
  systemContent: z.string().min(1).nullable().optional(),
  content: z.string().min(1, "模板内容不能为空"),
  modelConfigId: z.string().cuid().nullable().optional(),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

const listQuerySchema = z.object({
  stepType: z.nativeEnum(PromptStepType).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const { searchParams } = new URL(request.url);
    const query = listQuerySchema.parse({
      stepType: searchParams.get("stepType") ?? undefined,
      isActive: searchParams.get("isActive") ?? undefined,
    });

    const data = await promptTemplateService.list(query);
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const body: unknown = await request.json();
    const input = createSchema.parse(body);

    const data = await promptTemplateService.create(input);
    return successResponse(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
