import { UserRole } from "@prisma/client";
import { z } from "zod";

import { buildTranscriptStreamChannel, createSSEMessage } from "@/lib/ai-stream";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { createPubSubRedisClient } from "@/lib/redis";
import { aiWorkspaceService } from "@/server/services/ai-workspace.service";

const workspaceIdSchema = z.object({
  id: z.string().cuid(),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_: Request, context: RouteContext): Promise<Response> {
  const session = await auth();
  requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

  const { id } = workspaceIdSchema.parse(await context.params);
  const workspace = await aiWorkspaceService.getWorkspaceById(id, session.user);

  if (workspace.status !== "TRANSCRIBING") {
    const text =
      workspace.transcript?.currentText ??
      workspace.transcript?.originalText ??
      "";

    return new Response(
      createSSEMessage("done", {
        kind: "transcript",
        text,
        modelConfigId: workspace.transcript?.aiProviderKey ?? null,
        modelName: workspace.transcript?.aiModel ?? null,
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Connection: "keep-alive",
        },
      },
    );
  }

  const redis = createPubSubRedisClient();
  const encoder = new TextEncoder();
  const channel = buildTranscriptStreamChannel(id);
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const cleanup = async () => {
        if (keepAliveTimer) {
          clearInterval(keepAliveTimer);
          keepAliveTimer = null;
        }
        redis.removeAllListeners("message");
        try {
          await redis.unsubscribe(channel);
        } catch {
          // noop
        }
        await redis.quit();
      };

      controller.enqueue(
        encoder.encode(
          createSSEMessage("start", {
            kind: "transcript",
          }),
        ),
      );

      await redis.subscribe(channel);
      redis.on("message", async (incomingChannel: string, payload: string) => {
        if (incomingChannel !== channel) {
          return;
        }

        const parsed = JSON.parse(payload) as {
          event: string;
          data: unknown;
        };

        controller.enqueue(encoder.encode(createSSEMessage(parsed.event, parsed.data)));

        if (parsed.event === "done" || parsed.event === "error") {
          await cleanup();
          controller.close();
        }
      });

      keepAliveTimer = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 15_000);
    },
    async cancel() {
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
      redis.removeAllListeners("message");
      try {
        await redis.unsubscribe(channel);
      } catch {
        // noop
      }
      await redis.quit();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Connection: "keep-alive",
    },
  });
}
