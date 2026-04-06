import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createWorkspaceMock,
  findByVideoIdAndUserIdMock,
  findVideoByIdMock,
  replaceTranscriptMock,
  queueTranscribeMock,
  clearWorkspaceDependenciesMock,
  updateWorkspaceMock,
  upsertDraftMock,
} = vi.hoisted(() => ({
  createWorkspaceMock: vi.fn(),
  findByVideoIdAndUserIdMock: vi.fn(),
  findVideoByIdMock: vi.fn(),
  replaceTranscriptMock: vi.fn(),
  queueTranscribeMock: vi.fn(),
  clearWorkspaceDependenciesMock: vi.fn(),
  updateWorkspaceMock: vi.fn(),
  upsertDraftMock: vi.fn(),
}));

vi.mock("@/server/repositories/ai-workspace.repository", () => ({
  aiWorkspaceRepository: {
    create: createWorkspaceMock,
    findByVideoIdAndUserId: findByVideoIdAndUserIdMock,
    update: updateWorkspaceMock,
    replaceTranscript: replaceTranscriptMock,
    clearDependencies: clearWorkspaceDependenciesMock,
    upsertRewriteDraft: upsertDraftMock,
  },
}));

vi.mock("@/server/repositories/benchmark-video.repository", () => ({
  benchmarkVideoRepository: {
    findByIdWithAccountOrganization: findVideoByIdMock,
  },
}));

vi.mock("@/lib/bullmq", () => ({
  getTranscriptionQueue: () => ({
    add: queueTranscribeMock,
  }),
  TRANSCRIPTION_QUEUE_NAME: "transcription",
}));

describe("aiWorkspaceService", () => {
  beforeEach(() => {
    createWorkspaceMock.mockReset();
    findByVideoIdAndUserIdMock.mockReset();
    findVideoByIdMock.mockReset();
    replaceTranscriptMock.mockReset();
    queueTranscribeMock.mockReset();
    clearWorkspaceDependenciesMock.mockReset();
    updateWorkspaceMock.mockReset();
    upsertDraftMock.mockReset();
  });

  it("requires shareUrl before scheduling transcription", async () => {
    findVideoByIdMock.mockResolvedValue({
      id: "video_1",
      title: "video",
      shareUrl: null,
      videoStoragePath: null,
      account: { organizationId: "org_1" },
    });

    const { aiWorkspaceService } = await import("@/server/services/ai-workspace.service");

    await expect(
      aiWorkspaceService.startTranscription(
        {
          id: "user_1",
          account: "employee",
          role: UserRole.EMPLOYEE,
          organizationId: "org_1",
        },
        "video_1",
      ),
    ).rejects.toMatchObject({ code: "AI_SHARE_URL_REQUIRED" });
  });

  it("queues transcription for the workspace using the shareUrl", async () => {
    findVideoByIdMock.mockResolvedValue({
      id: "video_1",
      title: "video",
      shareUrl: "https://www.douyin.com/video/abc",
      videoStoragePath: "/storage/video.mp4",
      account: { organizationId: "org_1" },
    });
    findByVideoIdAndUserIdMock.mockResolvedValue(null);
    createWorkspaceMock.mockResolvedValue({
      id: "workspace_1",
      videoId: "video_1",
      userId: "user_1",
      organizationId: "org_1",
      status: "IDLE",
    });

    const { aiWorkspaceService } = await import("@/server/services/ai-workspace.service");
    await aiWorkspaceService.startTranscription(
      {
        id: "user_1",
        account: "employee",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
      "video_1",
    );

    expect(queueTranscribeMock).toHaveBeenCalledWith(
      "transcription",
      expect.objectContaining({
        workspaceId: "workspace_1",
        videoId: "video_1",
        shareUrl: "https://www.douyin.com/video/abc",
      }),
    );
  });

  it("clears dependent decomposition and rewrite data when unlocking transcript", async () => {
    clearWorkspaceDependenciesMock.mockResolvedValue(undefined);
    replaceTranscriptMock.mockResolvedValue(undefined);
    updateWorkspaceMock.mockResolvedValue({
      id: "workspace_1",
      status: "TRANSCRIPT_DRAFT",
    });

    const { aiWorkspaceService } = await import("@/server/services/ai-workspace.service");
    await aiWorkspaceService.unlockTranscript("workspace_1", {
      id: "user_1",
      account: "employee",
      role: UserRole.EMPLOYEE,
      organizationId: "org_1",
    });

    expect(clearWorkspaceDependenciesMock).toHaveBeenCalledWith("workspace_1");
    expect(replaceTranscriptMock).toHaveBeenCalledWith("workspace_1", {
      isConfirmed: false,
    });
    expect(updateWorkspaceMock).toHaveBeenCalledWith("workspace_1", {
      status: "TRANSCRIPT_DRAFT",
    });
  });
});
