import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createWorkspaceMock,
  findByVideoIdAndUserIdMock,
  findByIdMock,
  findVideoByIdMock,
  queueTranscribeMock,
  resetTranscriptToDraftMock,
  upsertAnnotationMock,
  upsertDraftMock,
  updateWorkspaceMock,
} = vi.hoisted(() => ({
  createWorkspaceMock: vi.fn(),
  findByVideoIdAndUserIdMock: vi.fn(),
  findByIdMock: vi.fn(),
  findVideoByIdMock: vi.fn(),
  queueTranscribeMock: vi.fn(),
  resetTranscriptToDraftMock: vi.fn(),
  upsertAnnotationMock: vi.fn(),
  upsertDraftMock: vi.fn(),
  updateWorkspaceMock: vi.fn(),
}));

vi.mock("@/server/repositories/ai-workspace.repository", () => ({
  aiWorkspaceRepository: {
    create: createWorkspaceMock,
    findByVideoIdAndUserId: findByVideoIdAndUserIdMock,
    findById: findByIdMock,
    resetTranscriptToDraft: resetTranscriptToDraftMock,
    upsertAnnotation: upsertAnnotationMock,
    upsertRewriteDraft: upsertDraftMock,
    update: updateWorkspaceMock,
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
  function createWorkspaceDetail(overrides: Record<string, unknown> = {}) {
    return {
      id: "workspace_1",
      videoId: "video_1",
      userId: "user_1",
      organizationId: "org_1",
      status: "TRANSCRIPT_CONFIRMED",
      enteredRewriteAt: null,
      createdAt: new Date("2026-04-06T00:00:00.000Z"),
      updatedAt: new Date("2026-04-06T00:00:00.000Z"),
      video: {
        id: "video_1",
        title: "video",
        coverUrl: null,
        shareUrl: "https://www.douyin.com/video/abc",
        publishedAt: null,
        playCount: 0,
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
      },
      transcript: {
        originalText: "原稿",
        currentText: "当前稿",
        isConfirmed: true,
        confirmedAt: new Date("2026-04-06T00:00:00.000Z"),
        lastEditedAt: new Date("2026-04-06T00:00:00.000Z"),
        aiProviderKey: "ark-default",
        aiModel: "ark/transcribe",
      },
      segments: [],
      annotations: [],
      rewriteDraft: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    createWorkspaceMock.mockReset();
    findByVideoIdAndUserIdMock.mockReset();
    findByIdMock.mockReset();
    findVideoByIdMock.mockReset();
    queueTranscribeMock.mockReset();
    resetTranscriptToDraftMock.mockReset();
    upsertAnnotationMock.mockReset();
    upsertDraftMock.mockReset();
    updateWorkspaceMock.mockReset();
  });

  it("requires videoStoragePath before scheduling transcription", async () => {
    findVideoByIdMock.mockResolvedValue({
      id: "video_1",
      videoId: "video_1",
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
    ).rejects.toMatchObject({ code: "VIDEO_FILE_REQUIRED" });
  });

  it("queues transcription for the workspace using the videoStoragePath", async () => {
    findVideoByIdMock.mockResolvedValue({
      id: "video_1",
      videoId: "video_1",
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
    updateWorkspaceMock.mockResolvedValue({
      id: "workspace_1",
      status: "TRANSCRIBING",
    });
    findByIdMock
      .mockResolvedValueOnce(
        createWorkspaceDetail({
          status: "IDLE",
          transcript: null,
        }),
      )
      .mockResolvedValueOnce(createWorkspaceDetail({ status: "TRANSCRIBING" }));

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
        videoStoragePath: "/storage/video.mp4",
      }),
    );
  });

  it("resets current transcript data before re-transcribing in non-rewrite stages", async () => {
    findVideoByIdMock.mockResolvedValue({
      id: "video_1",
      videoId: "video_1",
      title: "video",
      shareUrl: "https://www.douyin.com/video/abc",
      videoStoragePath: "/storage/video.mp4",
      account: { organizationId: "org_1" },
    });
    findByVideoIdAndUserIdMock.mockResolvedValue({
      id: "workspace_1",
      videoId: "video_1",
      userId: "user_1",
      organizationId: "org_1",
      status: "DECOMPOSED",
    });
    findByIdMock
      .mockResolvedValueOnce(
        createWorkspaceDetail({
          status: "DECOMPOSED",
          annotations: [
            {
              id: "annotation_1",
              segmentId: null,
              startOffset: 0,
              endOffset: 4,
              quotedText: "当前稿",
              function: null,
              argumentRole: null,
              technique: null,
              purpose: null,
              effectiveness: null,
              note: null,
              createdAt: new Date("2026-04-06T00:00:00.000Z"),
              updatedAt: new Date("2026-04-06T00:00:00.000Z"),
            },
          ],
        }),
      )
      .mockResolvedValueOnce(createWorkspaceDetail({ status: "TRANSCRIBING", annotations: [] }));
    resetTranscriptToDraftMock.mockResolvedValue(undefined);
    updateWorkspaceMock.mockResolvedValue({ id: "workspace_1", status: "TRANSCRIBING" });

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

    expect(resetTranscriptToDraftMock).toHaveBeenCalledWith("workspace_1", "org_1", {
      lastEditedAt: expect.any(Date),
    });
    expect(queueTranscribeMock).toHaveBeenCalled();
  });

  it("blocks retranscription after entering rewrite stage", async () => {
    findVideoByIdMock.mockResolvedValue({
      id: "video_1",
      videoId: "video_1",
      title: "video",
      shareUrl: "https://www.douyin.com/video/abc",
      videoStoragePath: "/storage/video.mp4",
      account: { organizationId: "org_1" },
    });
    findByVideoIdAndUserIdMock.mockResolvedValue({
      id: "workspace_1",
      videoId: "video_1",
      userId: "user_1",
      organizationId: "org_1",
      status: "REWRITING",
    });
    findByIdMock.mockResolvedValue(
      createWorkspaceDetail({
        status: "REWRITING",
        enteredRewriteAt: new Date("2026-04-06T00:00:00.000Z"),
        rewriteDraft: {
          currentDraft: "draft",
          sourceTranscriptText: "当前稿",
          sourceDecompositionSnapshot: [],
        },
      }),
    );

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
    ).rejects.toMatchObject({ code: "REWRITE_STAGE_LOCKED" });
  });

  it("rolls workspace status back when queue scheduling fails", async () => {
    findVideoByIdMock.mockResolvedValue({
      id: "video_1",
      videoId: "video_1",
      title: "video",
      shareUrl: "https://www.douyin.com/video/abc",
      videoStoragePath: "/storage/video.mp4",
      account: { organizationId: "org_1" },
    });
    findByVideoIdAndUserIdMock.mockResolvedValue({
      id: "workspace_1",
      videoId: "video_1",
      userId: "user_1",
      organizationId: "org_1",
      status: "IDLE",
    });
    findByIdMock.mockResolvedValue(
      createWorkspaceDetail({
        status: "IDLE",
        transcript: null,
      }),
    );
    queueTranscribeMock.mockRejectedValue(new Error("redis unavailable"));
    updateWorkspaceMock.mockResolvedValue({ id: "workspace_1" });

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
    ).rejects.toThrow("redis unavailable");

    expect(updateWorkspaceMock).toHaveBeenNthCalledWith(1, "workspace_1", {
      status: "TRANSCRIBING",
    });
    expect(updateWorkspaceMock).toHaveBeenNthCalledWith(2, "workspace_1", {
      status: "IDLE",
    });
  });

  it("rejects saving annotations until the transcript is confirmed", async () => {
    findByIdMock.mockResolvedValue(
      createWorkspaceDetail({
        transcript: {
          originalText: "原稿",
          currentText: "当前稿",
          isConfirmed: false,
          confirmedAt: null,
          lastEditedAt: new Date("2026-04-06T00:00:00.000Z"),
          aiProviderKey: "ark-default",
          aiModel: "ark/transcribe",
        },
      }),
    );

    const { aiWorkspaceService } = await import("@/server/services/ai-workspace.service");

    await expect(
      aiWorkspaceService.saveAnnotation(
        "workspace_1",
        {
          id: "user_1",
          account: "employee",
          role: UserRole.EMPLOYEE,
          organizationId: "org_1",
        },
        {
          startOffset: 0,
          endOffset: 4,
          quotedText: "当前稿",
        },
      ),
    ).rejects.toMatchObject({ code: "TRANSCRIPT_CONFIRM_REQUIRED" });
  });

  it("forbids accessing another employee's workspace in the same organization", async () => {
    findByIdMock.mockResolvedValue(
      createWorkspaceDetail({
        userId: "user_2",
      }),
    );

    const { aiWorkspaceService } = await import("@/server/services/ai-workspace.service");

    await expect(
      aiWorkspaceService.saveAnnotation(
        "workspace_1",
        {
          id: "user_1",
          account: "employee",
          role: UserRole.EMPLOYEE,
          organizationId: "org_1",
        },
        {
          startOffset: 0,
          endOffset: 4,
          quotedText: "当前稿",
        },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("marks workspace decomposed after saving an annotation on a confirmed transcript", async () => {
    findByIdMock
      .mockResolvedValueOnce(createWorkspaceDetail())
      .mockResolvedValueOnce(
        createWorkspaceDetail({
          status: "DECOMPOSED",
          annotations: [
            {
              id: "annotation_1",
              segmentId: null,
              startOffset: 0,
              endOffset: 4,
              quotedText: "当前稿",
              function: null,
              argumentRole: null,
              technique: null,
              purpose: null,
              effectiveness: null,
              note: null,
              createdAt: new Date("2026-04-06T00:00:00.000Z"),
              updatedAt: new Date("2026-04-06T00:00:00.000Z"),
            },
          ],
        }),
      );
    upsertAnnotationMock.mockResolvedValue({ id: "annotation_1" });
    updateWorkspaceMock.mockResolvedValue({ id: "workspace_1", status: "DECOMPOSED" });

    const { aiWorkspaceService } = await import("@/server/services/ai-workspace.service");
    const result = await aiWorkspaceService.saveAnnotation("workspace_1", {
      id: "user_1",
      account: "employee",
      role: UserRole.EMPLOYEE,
      organizationId: "org_1",
    }, {
      startOffset: 0,
      endOffset: 4,
      quotedText: "当前稿",
    });

    expect(upsertAnnotationMock).toHaveBeenCalledWith(
      "workspace_1",
      "org_1",
      expect.objectContaining({
        startOffset: 0,
        endOffset: 4,
        quotedText: "当前稿",
        createdByUserId: "user_1",
      }),
    );
    expect(updateWorkspaceMock).toHaveBeenCalledWith("workspace_1", {
      status: "DECOMPOSED",
    });
    expect(result.status).toBe("DECOMPOSED");
  });

  it("rejects confirming an empty transcript", async () => {
    findByIdMock.mockResolvedValue(
      createWorkspaceDetail({
        transcript: {
          originalText: "",
          currentText: "",
          isConfirmed: false,
          confirmedAt: null,
          lastEditedAt: new Date("2026-04-06T00:00:00.000Z"),
          aiProviderKey: null,
          aiModel: null,
        },
      }),
    );

    const { aiWorkspaceService } = await import("@/server/services/ai-workspace.service");

    await expect(
      aiWorkspaceService.confirmTranscript("workspace_1", {
        id: "user_1",
        account: "employee",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      }),
    ).rejects.toMatchObject({ code: "TRANSCRIPT_REQUIRED" });
  });

  it("requires unlock before editing a confirmed transcript with analysis data", async () => {
    findByIdMock.mockResolvedValue(
      createWorkspaceDetail({
        annotations: [
          {
            id: "annotation_1",
            segmentId: null,
            startOffset: 0,
            endOffset: 4,
            quotedText: "当前稿",
            function: null,
            argumentRole: null,
            technique: null,
            purpose: null,
            effectiveness: null,
            note: null,
            createdAt: new Date("2026-04-06T00:00:00.000Z"),
            updatedAt: new Date("2026-04-06T00:00:00.000Z"),
          },
        ],
      }),
    );

    const { aiWorkspaceService } = await import("@/server/services/ai-workspace.service");

    await expect(
      aiWorkspaceService.saveTranscript(
        "workspace_1",
        {
          id: "user_1",
          account: "employee",
          role: UserRole.EMPLOYEE,
          organizationId: "org_1",
        },
        {
          currentText: "新的正文",
          segments: [],
        },
      ),
    ).rejects.toMatchObject({ code: "TRANSCRIPT_UNLOCK_REQUIRED" });
  });

  it("rejects entering rewrite before transcript confirmation", async () => {
    findByIdMock.mockResolvedValue(
      createWorkspaceDetail({
        transcript: {
          originalText: "原稿",
          currentText: "当前稿",
          isConfirmed: false,
          confirmedAt: null,
          lastEditedAt: new Date("2026-04-06T00:00:00.000Z"),
          aiProviderKey: "ark-default",
          aiModel: "ark/transcribe",
        },
      }),
    );

    const { aiWorkspaceService } = await import("@/server/services/ai-workspace.service");

    await expect(
      aiWorkspaceService.saveRewriteDraft(
        "workspace_1",
        {
          id: "user_1",
          account: "employee",
          role: UserRole.EMPLOYEE,
          organizationId: "org_1",
        },
        {
          currentDraft: "draft",
        },
      ),
    ).rejects.toMatchObject({ code: "TRANSCRIPT_CONFIRM_REQUIRED" });

    expect(upsertDraftMock).not.toHaveBeenCalled();
  });

  it("clears dependent decomposition and rewrite data atomically when unlocking transcript", async () => {
    findByIdMock
      .mockResolvedValueOnce(createWorkspaceDetail({
        annotations: [
          {
            id: "annotation_1",
            segmentId: null,
            startOffset: 0,
            endOffset: 4,
            quotedText: "当前稿",
            function: null,
            argumentRole: null,
            technique: null,
            purpose: null,
            effectiveness: null,
            note: null,
            createdAt: new Date("2026-04-06T00:00:00.000Z"),
            updatedAt: new Date("2026-04-06T00:00:00.000Z"),
          },
        ],
        rewriteDraft: {
          currentDraft: "draft",
          sourceTranscriptText: "当前稿",
          sourceDecompositionSnapshot: [],
        },
      }))
      .mockResolvedValueOnce(createWorkspaceDetail({ status: "TRANSCRIPT_DRAFT", annotations: [] }));
    resetTranscriptToDraftMock.mockResolvedValue(undefined);

    const { aiWorkspaceService } = await import("@/server/services/ai-workspace.service");
    await aiWorkspaceService.unlockTranscript("workspace_1", {
      id: "user_1",
      account: "employee",
      role: UserRole.EMPLOYEE,
      organizationId: "org_1",
    });

    expect(resetTranscriptToDraftMock).toHaveBeenCalledWith("workspace_1", "org_1", {
      lastEditedAt: expect.any(Date),
    });
  });
});
