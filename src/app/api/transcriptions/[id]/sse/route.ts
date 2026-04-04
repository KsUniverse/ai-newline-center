import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";

import { requireRole } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-response";
import { createPubSubRedisClient, TRANSCRIPTION_CHANNEL_PREFIX } from "@/lib/redis";
import { transcriptionService } from "@/server/services/transcription.service";

function createSSEMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
  const session = await auth();
  requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

  const { id } = await params;
  const transcription = await transcriptionService.getById(id, session.user);
  const encoder = new TextEncoder();

  if (transcription.status === "COMPLETED") {
    return new Response(
      encoder.encode(
        createSSEMessage("done", {
          transcriptionId: transcription.id,
          status: transcription.status,
          originalText: transcription.originalText ?? "",
        }),
      ),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      },
    );
  }

  if (transcription.status === "FAILED") {
    return new Response(
      encoder.encode(
        createSSEMessage("error", {
          transcriptionId: transcription.id,
          status: transcription.status,
          errorMessage: transcription.errorMessage,
        }),
      ),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      },
    );
  }

  const stream = new ReadableStream({
    start(controller) {
      const subscriber = createPubSubRedisClient();
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 30_000);

      void subscriber.subscribe(`${TRANSCRIPTION_CHANNEL_PREFIX}${id}`);

      subscriber.on("message", (_channel, message) => {
        const parsed = JSON.parse(message) as {
          event: string;
          data: unknown;
        };

        controller.enqueue(encoder.encode(createSSEMessage(parsed.event, parsed.data)));

        if (parsed.event === "done" || parsed.event === "error") {
          clearInterval(heartbeat);
          void subscriber.quit();
          controller.close();
        }
      });

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        void subscriber.quit();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
  } catch (error) {
    return handleApiError(error);
  }
}
