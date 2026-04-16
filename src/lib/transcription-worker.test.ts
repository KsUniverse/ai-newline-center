import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  completeQueuedTranscriptionMock,
  generateTranscriptionFromVideoMock,
  markQueuedTranscriptionFailedMock,
  publishMock,
  workerHandlers,
  workerState,
} = vi.hoisted(() => ({
  completeQueuedTranscriptionMock: vi.fn(),
  generateTranscriptionFromVideoMock: vi.fn(),
  markQueuedTranscriptionFailedMock: vi.fn(),
  publishMock: vi.fn(),
  workerHandlers: new Map<string, (job: unknown, error: unknown) => unknown>(),
  workerState: {
    processFn: null as null | ((job: unknown) => Promise<unknown>),
  },
}));

const envMock = {
  REDIS_URL: "redis://127.0.0.1:6379",
};

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

vi.mock("@/lib/redis", () => ({
  createBullMQRedisConnection: vi.fn(() => ({ mocked: true })),
  createPubSubRedisClient: vi.fn(() => ({
    publish: publishMock,
    quit: vi.fn(),
  })),
}));

vi.mock("@/server/services/ai-gateway.service", () => ({
  aiGateway: {
    generateTranscriptionFromVideo: generateTranscriptionFromVideoMock,
  },
}));

vi.mock("@/server/repositories/ai-workspace.repository", () => ({
  aiWorkspaceRepository: {
    completeQueuedTranscription: completeQueuedTranscriptionMock,
    markQueuedTranscriptionFailed: markQueuedTranscriptionFailedMock,
  },
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(_name: string, processFn: (job: unknown) => Promise<unknown>) {
      workerState.processFn = processFn;
    }

    on(event: string, handler: (job: unknown, error: unknown) => unknown) {
      workerHandlers.set(event, handler);
      return this;
    }
  },
}));

describe("startTranscriptionWorker", () => {
  beforeEach(async () => {
    vi.resetModules();
    completeQueuedTranscriptionMock.mockReset();
    generateTranscriptionFromVideoMock.mockReset();
    markQueuedTranscriptionFailedMock.mockReset();
    publishMock.mockReset();
    workerHandlers.clear();
    workerState.processFn = null;
    vi.restoreAllMocks();

    globalThis.__transcriptionWorkerInitialized = false;
    envMock.REDIS_URL = "redis://127.0.0.1:6379";
  });

  it("uses the configured TRANSCRIBE implementation for successful jobs", async () => {
    generateTranscriptionFromVideoMock.mockResolvedValue({
      modelConfigId: "google-transcribe",
      modelName: "gemini-2.5-flash-lite",
      text: "Gemini 转录正文",
    });

    const { startTranscriptionWorker } = await import("@/lib/transcription-worker");

    startTranscriptionWorker();
    expect(workerState.processFn).toBeTypeOf("function");

    await workerState.processFn?.({
      id: "job_success_1",
      data: {
        workspaceId: "workspace_1",
        organizationId: "org_1",
        videoStoragePath: "/storage/videos/demo.mp4",
      },
    });

    expect(generateTranscriptionFromVideoMock).toHaveBeenCalledWith(
      expect.stringContaining("/public/storage/videos/demo.mp4"),
    );
    expect(completeQueuedTranscriptionMock).toHaveBeenCalledWith(
      "workspace_1",
      "org_1",
      expect.objectContaining({
        originalText: "Gemini 转录正文",
        currentText: "Gemini 转录正文",
        aiProviderKey: "google-transcribe",
        aiModel: "gemini-2.5-flash-lite",
      }),
    );
    expect(publishMock).toHaveBeenCalled();
  });

  it("logs permanent transcription failures and marks the workspace as failed", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { startTranscriptionWorker } = await import("@/lib/transcription-worker");

    startTranscriptionWorker();

    const failedHandler = workerHandlers.get("failed");
    expect(failedHandler).toBeTypeOf("function");

    const error = new Error("Gemini invalid credentials");

    await failedHandler?.(
      {
        id: "job_1",
        attemptsMade: 3,
        opts: { attempts: 3 },
        data: {
          workspaceId: "workspace_1",
          organizationId: "org_1",
          videoStoragePath: "/storage/videos/demo.mp4",
        },
      },
      error,
    );

    expect(markQueuedTranscriptionFailedMock).toHaveBeenCalledWith("workspace_1");
    expect(errorSpy).toHaveBeenCalledWith(
      "[TranscriptionWorker] Job failed permanently",
      expect.objectContaining({
        jobId: "job_1",
        workspaceId: "workspace_1",
        attemptsMade: 3,
        maxAttempts: 3,
        error: "Gemini invalid credentials",
      }),
    );
  });
});
