import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, createTranscriptionMock, getByVideoIdMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  createTranscriptionMock: vi.fn(),
  getByVideoIdMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/transcription.service", () => ({
  transcriptionService: {
    createTranscription: createTranscriptionMock,
    getByVideoId: getByVideoIdMock,
  },
}));

describe("/api/transcriptions", () => {
  beforeEach(() => {
    authMock.mockReset();
    createTranscriptionMock.mockReset();
    getByVideoIdMock.mockReset();
  });

  it("creates a transcription job for an authenticated caller", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    createTranscriptionMock.mockResolvedValue({
      id: "tr_1",
      videoId: "video_1",
      status: "PENDING",
    });

    const { POST } = await import("@/app/api/transcriptions/route");
    const response = await POST(
      new Request("http://localhost/api/transcriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: "ckv1234567890123456789012" }),
      }) as never,
    );

    expect(response.status).toBe(201);
    expect(createTranscriptionMock).toHaveBeenCalledWith(
      "ckv1234567890123456789012",
      expect.objectContaining({ id: "user_1" }),
    );
  });

  it("queries transcription by videoId", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    getByVideoIdMock.mockResolvedValue({
      id: "tr_1",
      videoId: "ckv1234567890123456789012",
      status: "COMPLETED",
    });

    const { GET } = await import("@/app/api/transcriptions/route");
    const response = await GET(
      new NextRequest(
        "http://localhost/api/transcriptions?videoId=ckv1234567890123456789012",
      ),
    );

    expect(response.status).toBe(200);
    expect(getByVideoIdMock).toHaveBeenCalledWith(
      "ckv1234567890123456789012",
      expect.objectContaining({ id: "user_1" }),
    );
  });
});
