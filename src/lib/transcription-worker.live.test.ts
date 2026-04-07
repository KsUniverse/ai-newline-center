import { afterAll, describe, expect, it } from "vitest";

import path from "node:path";
import { existsSync } from "node:fs";

import { prisma } from "@/lib/prisma";
import { aiGateway } from "@/server/services/ai-gateway.service";

async function resolveTargetWorkspace() {
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
  afterAll(async () => {
    await prisma.$disconnect();
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
