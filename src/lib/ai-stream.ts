import { AppError } from "@/lib/errors";

export const AI_WORKSPACE_TRANSCRIPT_CHANNEL_PREFIX = "ai-workspace:transcript:";

export function buildTranscriptStreamChannel(workspaceId: string): string {
  return `${AI_WORKSPACE_TRANSCRIPT_CHANNEL_PREFIX}${workspaceId}`;
}

export function createSSEMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function toStreamError(error: unknown, fallbackMessage: string) {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: fallbackMessage,
    statusCode: 500,
  };
}

export function chunkText(text: string, size: number = 24): string[] {
  if (!text) {
    return [];
  }

  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }

  return chunks;
}
