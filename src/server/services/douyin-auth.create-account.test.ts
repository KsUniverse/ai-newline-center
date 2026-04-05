import { DouyinAccountLoginStatus, DouyinLoginSessionPurpose, DouyinLoginSessionStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cuidMock,
  prismaTransactionMock,
  transactionClientMock,
  findLoginSessionByIdMock,
  updateLoginSessionStatusMock,
  updateResolvedIdentityMock,
  attachAccountMock,
  markLoginSessionFailedMock,
  markLoginSessionSuccessMock,
  createLoggedInAccountMock,
  pollSessionMock,
  resolveIdentityMock,
  finishSessionMock,
  getStorageStateMock,
  getAccountStatePathMock,
  writeStorageStateMock,
  deleteStateFileMock,
  fetchUserProfileMock,
} = vi.hoisted(() => ({
  cuidMock: vi.fn(() => "caccount00001abc1234567890"),
  prismaTransactionMock: vi.fn(),
  transactionClientMock: { kind: "tx" },
  findLoginSessionByIdMock: vi.fn(),
  updateLoginSessionStatusMock: vi.fn(),
  updateResolvedIdentityMock: vi.fn(),
  attachAccountMock: vi.fn(),
  markLoginSessionFailedMock: vi.fn(),
  markLoginSessionSuccessMock: vi.fn(),
  createLoggedInAccountMock: vi.fn(),
  pollSessionMock: vi.fn(),
  resolveIdentityMock: vi.fn(),
  finishSessionMock: vi.fn(),
  getStorageStateMock: vi.fn(),
  getAccountStatePathMock: vi.fn(),
  writeStorageStateMock: vi.fn(),
  deleteStateFileMock: vi.fn(),
  fetchUserProfileMock: vi.fn(),
}));

vi.mock("cuid", () => ({
  default: cuidMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: prismaTransactionMock,
  },
}));

vi.mock("@/server/repositories/douyin-account.repository", () => ({
  douyinAccountRepository: {
    updateLoginStateBinding: vi.fn(),
    findLoginStateMeta: vi.fn(),
    clearLoginStateBinding: vi.fn(),
  },
}));

vi.mock("@/server/repositories/douyin-login-session.repository", () => ({
  douyinLoginSessionRepository: {
    findById: findLoginSessionByIdMock,
    updateStatus: updateLoginSessionStatusMock,
    updateResolvedIdentity: updateResolvedIdentityMock,
    attachAccount: attachAccountMock,
    markFailed: markLoginSessionFailedMock,
    markSuccess: markLoginSessionSuccessMock,
  },
}));

vi.mock("@/server/services/douyin-account.service", () => ({
  douyinAccountService: {
    createLoggedInAccount: createLoggedInAccountMock,
  },
}));

vi.mock("@/server/services/douyin-login-session-manager", () => ({
  douyinLoginSessionManager: {
    pollSession: pollSessionMock,
    resolveIdentity: resolveIdentityMock,
    finishSession: finishSessionMock,
    getStorageState: getStorageStateMock,
    getProgressStep: vi.fn((_, status) => {
      switch (status) {
        case DouyinLoginSessionStatus.SUCCESS:
          return "SUCCESS";
        case DouyinLoginSessionStatus.EXPIRED:
          return "EXPIRED";
        case DouyinLoginSessionStatus.CANCELLED:
          return "CANCELLED";
        case DouyinLoginSessionStatus.CONFIRMED:
          return "PERSISTING_LOGIN_STATE";
        case DouyinLoginSessionStatus.QRCODE_READY:
          return "WAITING_FOR_SCAN";
        default:
          return "FAILED";
      }
    }),
    setProgressStep: vi.fn(),
  },
}));

vi.mock("@/server/services/douyin-login-state-storage.service", () => ({
  douyinLoginStateStorageService: {
    getAccountStatePath: getAccountStatePathMock,
    writeStorageState: writeStorageStateMock,
    deleteStateFile: deleteStateFileMock,
  },
}));

vi.mock("@/server/services/crawler.service", () => ({
  crawlerService: {
    fetchUserProfile: fetchUserProfileMock,
  },
}));

function createCaller() {
  return {
    id: "user_1",
    account: "employee-001",
    role: "EMPLOYEE" as const,
    organizationId: "org_1",
  };
}

function createCreateAccountSession(
  status: DouyinLoginSessionStatus = DouyinLoginSessionStatus.QRCODE_READY,
) {
  return {
    id: "cm9login00001abc123456789",
    userId: "user_1",
    organizationId: "org_1",
    accountId: null,
    purpose: DouyinLoginSessionPurpose.CREATE_ACCOUNT,
    status,
    qrcodeDataUrl: "data:image/png;base64,abc",
    resolvedSecUserId: null,
    errorCode: null,
    errorMessage: null,
    expiresAt: new Date("2026-04-04T08:03:00.000Z"),
    startedAt: new Date("2026-04-04T08:00:00.000Z"),
    finishedAt: null,
    createdAt: new Date("2026-04-04T08:00:00.000Z"),
    updatedAt: new Date("2026-04-04T08:00:00.000Z"),
  };
}

describe("douyinAuthService create-account finalization", () => {
  beforeEach(() => {
    vi.resetModules();
    cuidMock.mockClear();
    prismaTransactionMock.mockReset();
    findLoginSessionByIdMock.mockReset();
    updateLoginSessionStatusMock.mockReset();
    updateResolvedIdentityMock.mockReset();
    attachAccountMock.mockReset();
    markLoginSessionFailedMock.mockReset();
    markLoginSessionSuccessMock.mockReset();
    createLoggedInAccountMock.mockReset();
    pollSessionMock.mockReset();
    resolveIdentityMock.mockReset();
    finishSessionMock.mockReset();
    getStorageStateMock.mockReset();
    getAccountStatePathMock.mockReset();
    writeStorageStateMock.mockReset();
    deleteStateFileMock.mockReset();
    fetchUserProfileMock.mockReset();

    prismaTransactionMock.mockImplementation(async (callback) => callback(transactionClientMock));
    findLoginSessionByIdMock.mockResolvedValue(createCreateAccountSession());
    updateLoginSessionStatusMock.mockResolvedValue(
      createCreateAccountSession(DouyinLoginSessionStatus.CONFIRMED),
    );
    updateResolvedIdentityMock.mockResolvedValue(
      createCreateAccountSession(DouyinLoginSessionStatus.CONFIRMED),
    );
    markLoginSessionFailedMock.mockImplementation(async (_id, errorCode: string, errorMessage: string) => ({
      ...createCreateAccountSession(DouyinLoginSessionStatus.FAILED),
      errorCode,
      errorMessage,
    }));
    markLoginSessionSuccessMock.mockResolvedValue({
      ...createCreateAccountSession(DouyinLoginSessionStatus.SUCCESS),
      accountId: "account_1",
    });
    pollSessionMock.mockResolvedValue({
      status: DouyinLoginSessionStatus.CONFIRMED,
      qrcodeDataUrl: "data:image/png;base64,abc",
      expiresAt: new Date("2026-04-04T08:03:00.000Z"),
      currentUrl: "https://www.douyin.com/jingxuan",
      currentStep: "PERSISTING_LOGIN_STATE",
    });
    finishSessionMock.mockResolvedValue(undefined);
    getStorageStateMock.mockReturnValue({
      cookies: [{ name: "sid_tt", value: "1", domain: ".douyin.com", path: "/", expires: -1 }],
      origins: [],
    });
    getAccountStatePathMock.mockReturnValue(
      "D:/private/organizations/org_1/users/user_1/accounts/caccount00001abc1234567890.json",
    );
    writeStorageStateMock.mockResolvedValue(undefined);
    deleteStateFileMock.mockResolvedValue(undefined);
  });

  it("fails the session when secUserId cannot be resolved", async () => {
    resolveIdentityMock.mockResolvedValue({
      secUserId: null,
      displayName: null,
      douyinNumber: null,
      rawCookie: null,
    });

    const { douyinAuthService } = await import("@/server/services/douyin-auth.service");

    const result = await douyinAuthService.getSession(createCaller(), "cm9login00001abc123456789");

    expect(result.status).toBe(DouyinLoginSessionStatus.FAILED);
    expect(updateResolvedIdentityMock).toHaveBeenCalledWith("cm9login00001abc123456789", {
      resolvedSecUserId: null,
    });
    expect(createLoggedInAccountMock).not.toHaveBeenCalled();
    expect(writeStorageStateMock).not.toHaveBeenCalled();
    expect(finishSessionMock).toHaveBeenCalledWith("cm9login00001abc123456789");
  });

  it("deletes the moved state file when the create-account transaction fails", async () => {
    resolveIdentityMock.mockResolvedValue({
      secUserId: "sec_user_1",
      displayName: null,
      douyinNumber: null,
      rawCookie: "sessionid=abc123; uid_tt=xyz456",
    });
    fetchUserProfileMock.mockResolvedValue({
      secUserId: "sec_user_1",
      nickname: "测试账号",
      avatar: "https://cdn.example.com/avatar.jpg",
      bio: null,
      signature: null,
      followersCount: 100,
      followingCount: 10,
      likesCount: 20,
      videosCount: 5,
      douyinNumber: null,
      ipLocation: null,
      age: null,
      province: null,
      city: null,
      verificationLabel: null,
      verificationIconUrl: null,
      verificationType: null,
    });
    createLoggedInAccountMock.mockResolvedValue({
      id: "caccount00001abc1234567890",
      userId: "user_1",
      organizationId: "org_1",
      loginStatus: DouyinAccountLoginStatus.LOGGED_IN,
    });
    attachAccountMock.mockResolvedValue({
      ...createCreateAccountSession(DouyinLoginSessionStatus.CONFIRMED),
      accountId: "caccount00001abc1234567890",
    });
    prismaTransactionMock.mockImplementationOnce(async (callback) => {
      await callback(transactionClientMock);
      throw new Error("commit failed");
    });

    const { douyinAuthService } = await import("@/server/services/douyin-auth.service");

    const result = await douyinAuthService.getSession(createCaller(), "cm9login00001abc123456789");

    expect(result.status).toBe(DouyinLoginSessionStatus.FAILED);
    expect(createLoggedInAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user_1", organizationId: "org_1" }),
      expect.objectContaining({
        profileUrl: "https://www.douyin.com/user/sec_user_1",
        secUserId: "sec_user_1",
        loginStatus: DouyinAccountLoginStatus.LOGGED_IN,
        favoriteCookieHeader: "sessionid=abc123; uid_tt=xyz456",
      }),
      expect.objectContaining({
        accountId: "caccount00001abc1234567890",
        loginStatePath:
          "D:/private/organizations/org_1/users/user_1/accounts/caccount00001abc1234567890.json",
        db: transactionClientMock,
      }),
    );
    expect(writeStorageStateMock).toHaveBeenCalledWith(
      "D:/private/organizations/org_1/users/user_1/accounts/caccount00001abc1234567890.json",
      expect.objectContaining({
        cookies: expect.any(Array),
      }),
    );
    expect(deleteStateFileMock).toHaveBeenCalledWith(
      "D:/private/organizations/org_1/users/user_1/accounts/caccount00001abc1234567890.json",
    );
  });
});
