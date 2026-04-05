import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findIdsByOrganizationIdMock,
  findMyAccountIdsByUserIdMock,
  findIdsByUserIdMock,
  findManyWithAccountMock,
} = vi.hoisted(() => ({
  findIdsByOrganizationIdMock: vi.fn(),
  findMyAccountIdsByUserIdMock: vi.fn(),
  findIdsByUserIdMock: vi.fn(),
  findManyWithAccountMock: vi.fn(),
}));

vi.mock("@/server/repositories/douyin-account.repository", () => ({
  douyinAccountRepository: {
    findIdsByOrganizationId: findIdsByOrganizationIdMock,
    findIdsByUserId: findIdsByUserIdMock,
    findMyAccountIdsByUserId: findMyAccountIdsByUserIdMock,
  },
}));

vi.mock("@/server/repositories/douyin-video.repository", () => ({
  douyinVideoRepository: {
    findManyWithAccount: findManyWithAccountMock,
  },
}));

describe("videoService", () => {
  beforeEach(() => {
    findIdsByOrganizationIdMock.mockReset();
    findMyAccountIdsByUserIdMock.mockReset();
    findIdsByUserIdMock.mockReset();
    findManyWithAccountMock.mockReset();
  });

  it("limits employees to their own account videos", async () => {
    findMyAccountIdsByUserIdMock.mockResolvedValue(["account_1"]);
    findManyWithAccountMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    const { videoService } = await import("@/server/services/video.service");
    const result = await videoService.listVideos(
      {
        id: "user_1",
        account: "employee",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
      {
        page: 1,
        limit: 20,
        sort: "publishedAt",
        order: "desc",
      },
    );

    expect(findManyWithAccountMock).toHaveBeenCalledWith({
      accountIds: ["account_1"],
      page: 1,
      limit: 20,
      sort: "publishedAt",
      order: "desc",
      tag: undefined,
    });
    expect(result.total).toBe(0);
  });

  it("rejects accountId outside employee scope", async () => {
    findMyAccountIdsByUserIdMock.mockResolvedValue(["account_1"]);

    const { videoService } = await import("@/server/services/video.service");

    await expect(
      videoService.listVideos(
        {
          id: "user_1",
          account: "employee",
          role: UserRole.EMPLOYEE,
          organizationId: "org_1",
        },
        {
          page: 1,
          limit: 20,
          accountId: "account_2",
          sort: "publishedAt",
          order: "desc",
        },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  it("lets branch managers see organization account videos", async () => {
    findIdsByOrganizationIdMock.mockResolvedValue(["account_1", "account_2"]);
    findManyWithAccountMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    const { videoService } = await import("@/server/services/video.service");
    await videoService.listVideos(
      {
        id: "manager_1",
        account: "manager",
        role: UserRole.BRANCH_MANAGER,
        organizationId: "org_1",
      },
      {
        page: 1,
        limit: 20,
        sort: "likeCount",
        order: "asc",
      },
    );

    expect(findManyWithAccountMock).toHaveBeenCalledWith({
      accountIds: ["account_1", "account_2"],
      page: 1,
      limit: 20,
      sort: "likeCount",
      order: "asc",
      tag: undefined,
    });
  });
});
