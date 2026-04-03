import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAccountMock,
  findAccountByIdMock,
  findByProfileUrlMock,
  findManyAccountsMock,
  findVideosByAccountIdMock,
  fetchUserProfileMock,
  getSecUserIdMock,
} = vi.hoisted(() => ({
  createAccountMock: vi.fn(),
  findAccountByIdMock: vi.fn(),
  findByProfileUrlMock: vi.fn(),
  findManyAccountsMock: vi.fn(),
  findVideosByAccountIdMock: vi.fn(),
  fetchUserProfileMock: vi.fn(),
  getSecUserIdMock: vi.fn(),
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
    fetchUserProfile: fetchUserProfileMock,
    getSecUserId: getSecUserIdMock,
  },
}));

describe("douyinAccountService", () => {
  beforeEach(() => {
    createAccountMock.mockReset();
    findAccountByIdMock.mockReset();
    findByProfileUrlMock.mockReset();
    findManyAccountsMock.mockReset();
    findVideosByAccountIdMock.mockReset();
    fetchUserProfileMock.mockReset();
    getSecUserIdMock.mockReset();
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
          secUserId: "sec_123",
          nickname: "测试账号",
          avatar: "https://cdn.example.com/avatar.jpg",
          bio: null,
          signature: "十年磨一剑，逆风翻盘。",
          followersCount: 10,
          followingCount: 20,
          likesCount: 300,
          videosCount: 2,
          douyinNumber: "49001906753",
          ipLocation: "IP属地：湖北",
          age: 36,
          province: "湖北",
          city: "武汉",
          verificationLabel: "慧研智投科技有限公司一般证券从业人员",
          verificationIconUrl: "https://lf3-static.bytednsdoc.com/yellow-v.png",
          verificationType: 0,
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
          secUserId: "sec_123",
          nickname: "测试账号",
          avatar: "https://cdn.example.com/avatar.jpg",
          bio: null,
          signature: "十年磨一剑，逆风翻盘。",
          followersCount: 10,
          followingCount: 20,
          likesCount: 300,
          videosCount: 2,
          douyinNumber: "49001906753",
          ipLocation: "IP属地：湖北",
          age: 36,
          province: "湖北",
          city: "武汉",
          verificationLabel: "慧研智投科技有限公司一般证券从业人员",
          verificationIconUrl: "https://lf3-static.bytednsdoc.com/yellow-v.png",
          verificationType: 0,
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

  it("resolves secUserId before fetching the preview profile", async () => {
    getSecUserIdMock.mockResolvedValue("sec_123");
    fetchUserProfileMock.mockResolvedValue({
      secUserId: "sec_123",
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

    expect(getSecUserIdMock).toHaveBeenCalledWith("https://www.douyin.com/user/tester");
    expect(fetchUserProfileMock).toHaveBeenCalledWith("sec_123");
    expect(result.secUserId).toBe("sec_123");
    expect(result.nickname).toBe("测试账号");
  });
});
