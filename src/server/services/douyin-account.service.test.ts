import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAccountMock,
  findAccountByIdMock,
  findByProfileUrlMock,
  findManyAccountsMock,
  findVideosByAccountIdMock,
  previewProfileMock,
} = vi.hoisted(() => ({
  createAccountMock: vi.fn(),
  findAccountByIdMock: vi.fn(),
  findByProfileUrlMock: vi.fn(),
  findManyAccountsMock: vi.fn(),
  findVideosByAccountIdMock: vi.fn(),
  previewProfileMock: vi.fn(),
}));

vi.mock("@/server/repositories/douyin-account.repository", () => ({
  douyinAccountRepository: {
    create: createAccountMock,
    findById: findAccountByIdMock,
    findByProfileUrl: findByProfileUrlMock,
    findMany: findManyAccountsMock,
  },
}));

vi.mock("@/server/repositories/douyin-video.repository", () => ({
  douyinVideoRepository: {
    findByAccountId: findVideosByAccountIdMock,
  },
}));

vi.mock("@/server/services/crawler.service", () => ({
  crawlerService: {
    fetchDouyinProfile: previewProfileMock,
  },
}));

describe("douyinAccountService", () => {
  beforeEach(() => {
    createAccountMock.mockReset();
    findAccountByIdMock.mockReset();
    findByProfileUrlMock.mockReset();
    findManyAccountsMock.mockReset();
    findVideosByAccountIdMock.mockReset();
    previewProfileMock.mockReset();
  });

  it("only allows employees to create accounts", async () => {
    const { douyinAccountService } = await import("@/server/services/douyin-account.service");

    await expect(
      douyinAccountService.createAccount(
        {
          id: "manager_1",
          account: "manager",
          name: "负责人",
          role: UserRole.BRANCH_MANAGER,
          organizationId: "org_1",
        },
        {
          profileUrl: "https://www.douyin.com/user/tester",
          nickname: "测试账号",
          avatar: "https://cdn.example.com/avatar.jpg",
          bio: null,
          followersCount: 10,
          videosCount: 2,
        },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  it("rejects duplicated profile urls", async () => {
    findByProfileUrlMock.mockResolvedValue({
      id: "account_1",
    });

    const { douyinAccountService } = await import("@/server/services/douyin-account.service");

    await expect(
      douyinAccountService.createAccount(
        {
          id: "user_1",
          account: "employee",
          name: "员工",
          role: UserRole.EMPLOYEE,
          organizationId: "org_1",
        },
        {
          profileUrl: "https://www.douyin.com/user/tester",
          nickname: "测试账号",
          avatar: "https://cdn.example.com/avatar.jpg",
          bio: null,
          followersCount: 10,
          videosCount: 2,
        },
      ),
    ).rejects.toMatchObject({
      code: "ACCOUNT_EXISTS",
      statusCode: 409,
    });
  });

  it("filters list queries by caller role", async () => {
    findManyAccountsMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    const { douyinAccountService } = await import("@/server/services/douyin-account.service");

    await douyinAccountService.listAccounts(
      {
        id: "user_1",
        account: "employee",
        name: "员工",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
      { page: 1, limit: 20 },
    );
    expect(findManyAccountsMock).toHaveBeenLastCalledWith({
      userId: "user_1",
      page: 1,
      limit: 20,
    });

    await douyinAccountService.listAccounts(
      {
        id: "manager_1",
        account: "manager",
        name: "负责人",
        role: UserRole.BRANCH_MANAGER,
        organizationId: "org_2",
      },
      { page: 1, limit: 20 },
    );
    expect(findManyAccountsMock).toHaveBeenLastCalledWith({
      organizationId: "org_2",
      page: 1,
      limit: 20,
    });
  });

  it("uses crawlerService for account preview", async () => {
    previewProfileMock.mockResolvedValue({
      profileUrl: "https://www.douyin.com/user/tester",
      nickname: "测试账号",
      avatar: "https://cdn.example.com/avatar.jpg",
      bio: null,
      followersCount: 10,
      videosCount: 2,
    });

    const { douyinAccountService } = await import("@/server/services/douyin-account.service");
    const result = await douyinAccountService.previewAccount(
      {
        id: "user_1",
        account: "employee",
        name: "员工",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
      "https://www.douyin.com/user/tester",
    );

    expect(previewProfileMock).toHaveBeenCalledWith("https://www.douyin.com/user/tester");
    expect(result.nickname).toBe("测试账号");
  });
});
