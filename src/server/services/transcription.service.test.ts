import { TranscriptionStatus, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  addJobMock,
  createTranscriptionMock,
  findTranscriptionByIdMock,
  findTranscriptionByVideoIdMock,
  findVideoByIdWithOrgMock,
  resetTranscriptionMock,
  updateEditedTextMock,
} = vi.hoisted(() => ({
  addJobMock: vi.fn(),
  createTranscriptionMock: vi.fn(),
  findTranscriptionByIdMock: vi.fn(),
  findTranscriptionByVideoIdMock: vi.fn(),
  findVideoByIdWithOrgMock: vi.fn(),
  resetTranscriptionMock: vi.fn(),
  updateEditedTextMock: vi.fn(),
}));

vi.mock("@/lib/bullmq", () => ({
  TRANSCRIPTION_QUEUE_NAME: "transcription",
  getTranscriptionQueue: () => ({
    add: addJobMock,
  }),
}));

vi.mock("@/server/repositories/transcription.repository", () => ({
  transcriptionRepository: {
    create: createTranscriptionMock,
    findById: findTranscriptionByIdMock,
    findByVideoId: findTranscriptionByVideoIdMock,
    reset: resetTranscriptionMock,
    updateEditedText: updateEditedTextMock,
  },
}));

vi.mock("@/server/repositories/douyin-video.repository", () => ({
  douyinVideoRepository: {
    findByIdWithAccountOrganization: findVideoByIdWithOrgMock,
  },
}));

import { transcriptionService } from "@/server/services/transcription.service";

describe("transcriptionService", () => {
  beforeEach(() => {
    addJobMock.mockReset();
    createTranscriptionMock.mockReset();
    findTranscriptionByIdMock.mockReset();
    findTranscriptionByVideoIdMock.mockReset();
    findVideoByIdWithOrgMock.mockReset();
    resetTranscriptionMock.mockReset();
    updateEditedTextMock.mockReset();
  });

  it("creates a new transcription job when the video is accessible and downloaded", async () => {
    findVideoByIdWithOrgMock.mockResolvedValue({
      id: "video_1",
      videoStoragePath: "D:/videos/video.mp4",
      account: { organizationId: "org_1" },
    });
    findTranscriptionByVideoIdMock.mockResolvedValue(null);
    createTranscriptionMock.mockResolvedValue({
      id: "tr_1",
      videoId: "video_1",
      status: TranscriptionStatus.PENDING,
      aiModel: "openai/whisper-1",
    });
    findTranscriptionByIdMock.mockResolvedValue({
      id: "tr_1",
      videoId: "video_1",
      status: TranscriptionStatus.PENDING,
      aiModel: "openai/whisper-1",
      originalText: null,
      editedText: null,
      errorMessage: null,
      createdAt: new Date("2026-04-04T00:00:00.000Z"),
      updatedAt: new Date("2026-04-04T00:00:00.000Z"),
      video: { account: { organizationId: "org_1" } },
    });

    const result = await transcriptionService.createTranscription("video_1", {
      id: "user_1",
      account: "employee",
      name: "员工",
      role: UserRole.EMPLOYEE,
      organizationId: "org_1",
    });

    expect(createTranscriptionMock).toHaveBeenCalledWith({
      videoId: "video_1",
      aiModel: "openai/whisper-1",
    });
    expect(addJobMock).toHaveBeenCalledWith("transcription", {
      transcriptionId: "tr_1",
      videoStoragePath: "D:/videos/video.mp4",
      aiModel: "openai/whisper-1",
      organizationId: "org_1",
    });
    expect(result).toMatchObject({
      id: "tr_1",
      status: "PENDING",
    });
  });

  it("rejects creating a transcription when one is already in progress", async () => {
    findVideoByIdWithOrgMock.mockResolvedValue({
      id: "video_1",
      videoStoragePath: "D:/videos/video.mp4",
      account: { organizationId: "org_1" },
    });
    findTranscriptionByVideoIdMock.mockResolvedValue({
      id: "tr_1",
      status: TranscriptionStatus.PROCESSING,
    });

    await expect(
      transcriptionService.createTranscription("video_1", {
        id: "user_1",
        account: "employee",
        name: "员工",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      }),
    ).rejects.toMatchObject({
      code: "TRANSCRIPTION_IN_PROGRESS",
      statusCode: 409,
    });
  });

  it("only allows editing completed transcriptions", async () => {
    findTranscriptionByIdMock.mockResolvedValue({
      id: "tr_1",
      videoId: "video_1",
      status: TranscriptionStatus.FAILED,
      aiModel: "openai/whisper-1",
      originalText: null,
      editedText: null,
      errorMessage: "failed",
      createdAt: new Date("2026-04-04T00:00:00.000Z"),
      updatedAt: new Date("2026-04-04T00:00:00.000Z"),
      video: { account: { organizationId: "org_1" } },
    });

    await expect(
      transcriptionService.updateEditedText("tr_1", "人工校对", {
        id: "user_1",
        account: "employee",
        name: "员工",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      }),
    ).rejects.toMatchObject({
      code: "TRANSCRIPTION_NOT_COMPLETED",
      statusCode: 400,
    });
  });
});
