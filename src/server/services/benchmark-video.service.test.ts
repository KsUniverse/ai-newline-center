import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findByIdWithAccountOrganizationMock,
  findDashboardVideosMock,
  updateBringOrderMock,
  updateCustomTagMock,
} = vi.hoisted(() => ({
  findByIdWithAccountOrganizationMock: vi.fn(),
  findDashboardVideosMock: vi.fn(),
  updateBringOrderMock: vi.fn(),
  updateCustomTagMock: vi.fn(),
}));

vi.mock("@/server/repositories/benchmark-video.repository", () => ({
  benchmarkVideoRepository: {
    findByIdWithAccountOrganization: findByIdWithAccountOrganizationMock,
    findDashboardVideos: findDashboardVideosMock,
    updateBringOrder: updateBringOrderMock,
    updateCustomTag: updateCustomTagMock,
  },
}));

describe("benchmarkVideoService", () => {
  beforeEach(() => {
    findByIdWithAccountOrganizationMock.mockReset();
    findDashboardVideosMock.mockReset();
    updateBringOrderMock.mockReset();
    updateCustomTagMock.mockReset();
    findDashboardVideosMock.mockResolvedValue({
      items: [],
      nextCursor: null,
      total: 0,
    });
    updateCustomTagMock.mockResolvedValue({ id: "video_1", customTag: "RECAP" });
    updateBringOrderMock.mockResolvedValue({ id: "video_1", isBringOrder: true });
  });

  it("does not restrict super admins to a single organization in dashboard list", async () => {
    const { benchmarkVideoService } = await import("@/server/services/benchmark-video.service");

    await benchmarkVideoService.listDashboardVideos(
      {
        id: "admin_1",
        account: "admin",
        role: UserRole.SUPER_ADMIN,
        organizationId: "org_admin",
      },
      {
        dateRange: "today",
      },
    );

    expect(findDashboardVideosMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: undefined,
      }),
    );
  });

  it("does not restrict super admins when updating a video tag", async () => {
    const { benchmarkVideoService } = await import("@/server/services/benchmark-video.service");

    await benchmarkVideoService.updateVideoTag(
      {
        id: "admin_1",
        account: "admin",
        role: UserRole.SUPER_ADMIN,
        organizationId: "org_admin",
      },
      "video_1",
      "RECAP",
    );

    expect(updateCustomTagMock).toHaveBeenCalledWith("video_1", undefined, "RECAP");
  });

  it("does not restrict super admins when updating bring-order state", async () => {
    const { benchmarkVideoService } = await import("@/server/services/benchmark-video.service");

    await benchmarkVideoService.updateVideoBringOrder(
      {
        id: "admin_1",
        account: "admin",
        role: UserRole.SUPER_ADMIN,
        organizationId: "org_admin",
      },
      "video_1",
      true,
    );

    expect(updateBringOrderMock).toHaveBeenCalledWith("video_1", undefined, true);
  });

  it("returns a full benchmark video dto for accessible videos", async () => {
    findByIdWithAccountOrganizationMock.mockResolvedValue({
      id: "video_1",
      videoId: "aweme_1",
      title: "测试视频",
      shareUrl: "https://example.com/share",
      coverUrl: "https://example.com/cover.jpg",
      coverSourceUrl: "https://example.com/cover-source.jpg",
      coverStoragePath: "/storage/covers/cover.jpg",
      videoUrl: "https://example.com/video.mp4",
      videoSourceUrl: "https://example.com/video-source.mp4",
      videoStoragePath: "/storage/videos/video.mp4",
      publishedAt: new Date("2026-04-17T02:33:41.000Z"),
      playCount: 100,
      likeCount: 10,
      commentCount: 5,
      shareCount: 1,
      collectCount: 2,
      admireCount: 3,
      recommendCount: 4,
      tags: ["题材梳理"],
      createdAt: new Date("2026-04-17T02:44:10.105Z"),
      account: {
        organizationId: "org_1",
      },
    });

    const { benchmarkVideoService } = await import("@/server/services/benchmark-video.service");
    const result = await benchmarkVideoService.getVideoDetail(
      {
        id: "user_1",
        account: "employee",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
      "video_1",
    );

    expect(result).toMatchObject({
      id: "video_1",
      videoId: "aweme_1",
      title: "测试视频",
      tags: ["题材梳理"],
      createdAt: "2026-04-17T02:44:10.105Z",
    });
  });
});
