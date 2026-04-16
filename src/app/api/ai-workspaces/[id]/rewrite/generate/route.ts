import { UserRole } from "@prisma/client";
import { z } from "zod";

import { createSSEMessage, toStreamError } from "@/lib/ai-stream";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { aiGateway } from "@/server/services/ai-gateway.service";
import { aiWorkspaceService } from "@/server/services/ai-workspace.service";

const workspaceIdSchema = z.object({
  id: z.string().cuid(),
});

const bodySchema = z.object({
  currentDraft: z.string().optional(),
  selectedViewpoints: z.array(z.string()).optional(),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const encoder = new TextEncoder();

  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const { id } = workspaceIdSchema.parse(await context.params);
    const body = bodySchema.parse(await request.json());
    const prompt = await aiWorkspaceService.buildGeneratedRewritePrompt(id, session.user, body);
    const streamResult = await aiGateway.streamText("REWRITE", prompt);

    const stream = new ReadableStream({
      start(controller) {
        void (async () => {
          let fullText = "";

          try {
            controller.enqueue(
              encoder.encode(
                createSSEMessage("start", {
                  kind: "rewrite",
                  modelConfigId: streamResult.modelConfigId,
                  modelName: streamResult.modelName,
                }),
              ),
            );

            for await (const delta of streamResult.textStream) {
              fullText += delta;
              controller.enqueue(
                encoder.encode(
                  createSSEMessage("delta", {
                    kind: "rewrite",
                    delta,
                  }),
                ),
              );
            }

            controller.enqueue(
              encoder.encode(
                createSSEMessage("done", {
                  kind: "rewrite",
                  text: fullText,
                  modelConfigId: streamResult.modelConfigId,
                  modelName: streamResult.modelName,
                }),
              ),
            );
          } catch (error) {
            const streamError = toStreamError(error, "AI 仿写生成失败");
            controller.enqueue(
              encoder.encode(
                createSSEMessage("error", {
                  kind: "rewrite",
                  code: streamError.code,
                  message: streamError.message,
                }),
              ),
            );
          } finally {
            controller.close();
          }
        })();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const streamError = toStreamError(error, "AI 仿写生成失败");

    return new Response(
      createSSEMessage("error", {
        kind: "rewrite",
        code: streamError.code,
        message: streamError.message,
      }),
      {
        status: streamError.statusCode,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Connection: "keep-alive",
        },
      },
    );
  }
}
