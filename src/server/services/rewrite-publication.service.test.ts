import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findVersionByIdMock,
  findOwnedMyAccountMock,
  findByIdMock,
  findActiveByVersionIdMock,
  findActiveByPublishedVideoIdMock,
  createMock,
} = vi.hoisted(() => ({
  findVersionByIdMock: vi.fn(),
  findOwnedMyAccountMock: vi.fn(),
  findByIdMock: vi.fn(),
  findActiveByVersionIdMock: vi.fn(),
  findActiveByPublishedVideoIdMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("@/server/repositories/rewrite.repository", () => ({
  rewriteRepository: {
    findVersionById: findVersionByIdMock,
  },
}));

vi.mock("@/server/repositories/douyin-account.repository", () => ({
  douyinAccountRepository: {
    findOwnedMyAccount: findOwnedMyAccountMock,
  },
}));

vi.mock("@/server/repositories/douyin-video.repository", () => ({
  douyinVideoRepository: {
    findById: findByIdMock,
  },
}));

vi.mock("@/server/repositories/rewrite-publication.repository", () => ({
  rewritePublicationRepository: {
    findActiveByVersionId: findActiveByVersionIdMock,
    findActiveByPublishedVideoId: findActiveByPublishedVideoIdMock,
    create: createMock,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rewritePublication: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

const caller = {
  id: "user_1",
  name: "员工A",
  account: "employee",
  role: UserRole.EMPLOYEE,
  organizationId: "org_1",
};

describe("rewritePublicationService.linkPublishedVideo", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects binding when the final content is empty", async () => {
    findVersionByIdMock.mockResolvedValue({
      id: "version_1",
      rewriteId: "rewrite_1",
      generatedContent: null,
      editedContent: null,
      status: "COMPLETED",
      rewrite: {
        id: "rewrite_1",
        targetAccountId: "account_1",
        userId: caller.id,
        organizationId: caller.organizationId,
      },
    });
    findOwnedMyAccountMock.mockResolvedValue({ id: "account_1" });
    findByIdMock.mockResolvedValue({
      id: "video_1",
      accountId: "account_1",
    });

    const { rewritePublicationService } = await import(
      "@/server/services/rewrite-publication.service"
    );

    await expect(
      rewritePublicationService.linkPublishedVideo(
        "version_1",
        { publishedVideoId: "video_1" },
        caller,
      ),
    ).rejects.toMatchObject({
      code: "REWRITE_VERSION_EMPTY_FINAL_CONTENT",
    });
  });

  it("rejects binding when the published video is already linked to another version", async () => {
    findVersionByIdMock.mockResolvedValue({
      id: "version_1",
      rewriteId: "rewrite_1",
      generatedContent: "AI 原稿",
      editedContent: "最终稿",
      status: "COMPLETED",
      rewrite: {
        id: "rewrite_1",
        targetAccountId: "account_1",
        userId: caller.id,
        organizationId: caller.organizationId,
      },
    });
    findOwnedMyAccountMock.mockResolvedValue({ id: "account_1" });
    findByIdMock.mockResolvedValue({
      id: "video_1",
      accountId: "account_1",
    });
    findActiveByPublishedVideoIdMock.mockResolvedValue({
      id: "publication_occupied",
      rewriteVersionId: "version_other",
      publishedVideoId: "video_1",
    });

    const { rewritePublicationService } = await import(
      "@/server/services/rewrite-publication.service"
    );

    await expect(
      rewritePublicationService.linkPublishedVideo(
        "version_1",
        { publishedVideoId: "video_1" },
        caller,
      ),
    ).rejects.toMatchObject({
      code: "PUBLISHED_VIDEO_ALREADY_LINKED",
    });
  });
});
