import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findDashboardVideosMock, updateBringOrderMock, updateCustomTagMock } = vi.hoisted(() => ({
  findDashboardVideosMock: vi.fn(),
  updateBringOrderMock: vi.fn(),
  updateCustomTagMock: vi.fn(),
}));

vi.mock("@/server/repositories/benchmark-video.repository", () => ({
  benchmarkVideoRepository: {
    findDashboardVideos: findDashboardVideosMock,
    updateBringOrder: updateBringOrderMock,
    updateCustomTag: updateCustomTagMock,
  },
}));

describe("benchmarkVideoService", () => {
  beforeEach(() => {
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
});
