import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { existsSync } from "node:fs";
import path from "node:path";

let prisma: (typeof import("@/lib/prisma"))["prisma"] | null = null;
let aiGateway: (typeof import("@/server/services/ai-gateway.service"))["aiGateway"] | null = null;

async function resolveTargetWorkspace() {
  if (!prisma) {
    throw new Error("Prisma is not initialized for the live transcription test");
  }

  const workspaceId = process.env.LIVE_TRANSCRIPTION_WORKSPACE_ID;

  if (workspaceId) {
    const workspace = await prisma.aiWorkspace.findUnique({
      where: { id: workspaceId },
      include: {
        video: {
          select: {
            id: true,
            title: true,
            shareUrl: true,
            videoStoragePath: true,
          },
        },
        transcript: {
          select: {
            originalText: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    return workspace;
  }

  const workspace = await prisma.aiWorkspace.findFirst({
    where: {
      video: {
        videoStoragePath: {
          not: null,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      video: {
        select: {
          id: true,
          title: true,
          shareUrl: true,
          videoStoragePath: true,
        },
      },
      transcript: {
        select: {
          originalText: true,
        },
      },
    },
  });

  if (!workspace) {
    throw new Error("No workspace with local video file was found");
  }

  return workspace;
}

describe("transcription worker live integration", () => {
  beforeAll(async () => {
    if (process.env.RUN_LIVE_TRANSCRIPTION_TEST !== "true") {
      return;
    }

    const prismaModule = await import("@/lib/prisma");
    const aiGatewayModule = await import("@/server/services/ai-gateway.service");
    prisma = prismaModule.prisma;
    aiGateway = aiGatewayModule.aiGateway;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it.runIf(process.env.RUN_LIVE_TRANSCRIPTION_TEST === "true")(
    "transcribes the target workspace video file with the current TRANSCRIBE implementation",
    async () => {
      const workspace = await resolveTargetWorkspace();
      const videoStoragePath = workspace.video.videoStoragePath;
      const absoluteVideoPath = path.join(
        process.cwd(),
        "public",
        videoStoragePath?.startsWith("/") ? videoStoragePath.slice(1) : videoStoragePath ?? "",
      );

      expect(videoStoragePath).toBeTruthy();
      expect(existsSync(absoluteVideoPath)).toBe(true);

      console.log("[LiveTranscriptionTest] target workspace", {
        workspaceId: workspace.id,
        videoId: workspace.video.id,
        title: workspace.video.title,
        shareUrl: workspace.video.shareUrl,
        videoStoragePath,
        absoluteVideoPath,
        hasExistingTranscript: Boolean(workspace.transcript?.originalText?.trim()),
      });

      if (!aiGateway) {
        throw new Error("AI gateway is not initialized for the live transcription test");
      }

      const result = await aiGateway.generateTranscriptionFromVideo(absoluteVideoPath);

      console.log("[LiveTranscriptionTest] transcript preview", {
        workspaceId: workspace.id,
        modelConfigId: result.modelConfigId,
        modelName: result.modelName,
        transcriptLength: result.text.length,
        preview: result.text.slice(0, 120),
      });

      expect(result.text.length).toBeGreaterThan(0);
    },
    120_000,
  );
});
