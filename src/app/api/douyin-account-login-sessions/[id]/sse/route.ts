import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-response";
import { requireRole } from "@/lib/auth-guard";
import { douyinAuthService } from "@/server/services/douyin-auth.service";

function createSSEMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE);

    const { id } = await params;
    const loginSession = await douyinAuthService.getSession(session.user, id);
    const encoder = new TextEncoder();

    if (
      loginSession.status === "SUCCESS" ||
      loginSession.status === "CANCELLED" ||
      loginSession.status === "FAILED" ||
      loginSession.status === "EXPIRED"
    ) {
      const eventName =
        loginSession.status === "SUCCESS"
          ? "done"
          : loginSession.status === "FAILED"
            ? "session-error"
            : "status";

      return new Response(
        encoder.encode(createSSEMessage(eventName, { session: loginSession })),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        },
      );
    }

    let cleanup: (() => void) | null = null;

    const stream = new ReadableStream({
      start(controller) {
        let lastPayload = JSON.stringify(loginSession);
        let closed = false;

        const close = () => {
          if (closed) {
            return;
          }

          closed = true;
          clearInterval(heartbeat);
          clearInterval(poller);
          try {
            controller.close();
          } catch {
            return;
          }
        };

        cleanup = close;

        const heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        }, 30_000);

        const emitSession = (
          eventName: "status" | "done" | "session-error",
          nextSession: typeof loginSession,
        ) => {
          controller.enqueue(
            encoder.encode(createSSEMessage(eventName, { session: nextSession })),
          );
          lastPayload = JSON.stringify(nextSession);

          if (eventName === "done" || eventName === "session-error") {
            close();
          }
        };

        controller.enqueue(encoder.encode(createSSEMessage("status", { session: loginSession })));

        const poller = setInterval(() => {
          void douyinAuthService
            .getSession(session.user, id)
            .then((nextSession) => {
              const nextPayload = JSON.stringify(nextSession);
              if (nextPayload === lastPayload) {
                return;
              }

              if (nextSession.status === "SUCCESS") {
                emitSession("done", nextSession);
                return;
              }

              if (nextSession.status === "FAILED") {
                emitSession("session-error", nextSession);
                return;
              }

              emitSession("status", nextSession);

              if (nextSession.status === "EXPIRED" || nextSession.status === "CANCELLED") {
                close();
              }
            })
            .catch(() => {
              close();
            });
        }, 1_000);

      },
      cancel() {
        cleanup?.();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
