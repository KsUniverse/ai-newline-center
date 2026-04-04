import { DouyinAccountLoginStatus, DouyinLoginSessionPurpose, DouyinLoginSessionStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";

const {
  updateLoginStateBindingMock,
  clearLoginStateBindingMock,
  findLoginStateMetaMock,
  findAccountByIdMock,
  createLoginSessionMock,
  findActiveSessionsMock,
  findLoginSessionByIdMock,
  updateLoginSessionStatusMock,
  updateLoginSessionQrcodeMock,
  updateResolvedIdentityMock,
  markLoginSessionFailedMock,
  markLoginSessionCancelledMock,
  markLoginSessionExpiredMock,
  markLoginSessionSuccessMock,
  getOwnAccountForReloginMock,
  startSessionMock,
  pollSessionMock,
  resolveIdentityMock,
  cancelSessionMock,
  finishSessionMock,
  getTempStatePathMock,
  moveTempStateToAccountMock,
  deleteStateFileMock,
} = vi.hoisted(() => ({
  updateLoginStateBindingMock: vi.fn(),
  clearLoginStateBindingMock: vi.fn(),
  findLoginStateMetaMock: vi.fn(),
  findAccountByIdMock: vi.fn(),
  createLoginSessionMock: vi.fn(),
  findActiveSessionsMock: vi.fn(),
  findLoginSessionByIdMock: vi.fn(),
  updateLoginSessionStatusMock: vi.fn(),
  updateLoginSessionQrcodeMock: vi.fn(),
  updateResolvedIdentityMock: vi.fn(),
  markLoginSessionFailedMock: vi.fn(),
  markLoginSessionCancelledMock: vi.fn(),
  markLoginSessionExpiredMock: vi.fn(),
  markLoginSessionSuccessMock: vi.fn(),
  getOwnAccountForReloginMock: vi.fn(),
  startSessionMock: vi.fn(),
  pollSessionMock: vi.fn(),
  resolveIdentityMock: vi.fn(),
  cancelSessionMock: vi.fn(),
  finishSessionMock: vi.fn(),
  getTempStatePathMock: vi.fn(),
  moveTempStateToAccountMock: vi.fn(),
  deleteStateFileMock: vi.fn(),
}));

vi.mock("@/server/repositories/douyin-account.repository", () => ({
  douyinAccountRepository: {
    updateLoginStateBinding: updateLoginStateBindingMock,
    clearLoginStateBinding: clearLoginStateBindingMock,
    findLoginStateMeta: findLoginStateMetaMock,
    findById: findAccountByIdMock,
  },
}));

vi.mock("@/server/repositories/douyin-login-session.repository", () => ({
  douyinLoginSessionRepository: {
    create: createLoginSessionMock,
    findActiveByOwner: findActiveSessionsMock,
    findById: findLoginSessionByIdMock,
    updateStatus: updateLoginSessionStatusMock,
    updateQrcode: updateLoginSessionQrcodeMock,
    updateResolvedIdentity: updateResolvedIdentityMock,
    markFailed: markLoginSessionFailedMock,
    markCancelled: markLoginSessionCancelledMock,
    markExpired: markLoginSessionExpiredMock,
    markSuccess: markLoginSessionSuccessMock,
  },
}));

vi.mock("@/server/services/douyin-account.service", () => ({
  douyinAccountService: {
    getOwnAccountForRelogin: getOwnAccountForReloginMock,
  },
}));

vi.mock("@/server/services/douyin-login-session-manager", () => ({
  douyinLoginSessionManager: {
    startSession: startSessionMock,
    refreshSession: vi.fn(),
    pollSession: pollSessionMock,
    resolveIdentity: resolveIdentityMock,
    cancelSession: cancelSessionMock,
    finishSession: finishSessionMock,
  },
}));

vi.mock("@/server/services/douyin-login-state-storage.service", () => ({
  douyinLoginStateStorageService: {
    getTempStatePath: getTempStatePathMock,
    moveTempStateToAccount: moveTempStateToAccountMock,
    deleteStateFile: deleteStateFileMock,
  },
}));

vi.mock("@/server/services/crawler.service", () => ({
  crawlerService: {},
}));

function createCaller() {
  return {
    id: "user_1",
    account: "employee-001",
    role: "EMPLOYEE" as const,
    organizationId: "org_1",
  };
}

function createAccount() {
  return {
    id: "account_1",
    userId: "user_1",
    organizationId: "org_1",
    secUserId: "target_sec_user",
    loginStatus: DouyinAccountLoginStatus.LOGGED_IN,
    loginErrorMessage: null,
    loginStateExpiresAt: null,
  };
}

function createLoginSession(status: DouyinLoginSessionStatus = DouyinLoginSessionStatus.CREATED) {
  return {
    id: "cm9login00001abc123456789",
    userId: "user_1",
    organizationId: "org_1",
    accountId: "account_1",
    purpose: DouyinLoginSessionPurpose.RELOGIN,
    status,
    qrcodeDataUrl: null,
    tempStatePath: "D:/private/tmp/cm9login00001abc123456789.json",
    resolvedSecUserId: null,
    errorCode: null,
    errorMessage: null,
    expiresAt: null,
    startedAt: new Date("2026-04-04T08:00:00.000Z"),
    finishedAt: null,
    createdAt: new Date("2026-04-04T08:00:00.000Z"),
    updatedAt: new Date("2026-04-04T08:00:00.000Z"),
  };
}

describe("douyinAuthService relogin flow", () => {
  beforeEach(() => {
    vi.resetModules();
    updateLoginStateBindingMock.mockReset();
    clearLoginStateBindingMock.mockReset();
    findLoginStateMetaMock.mockReset();
    findAccountByIdMock.mockReset();
    createLoginSessionMock.mockReset();
    findActiveSessionsMock.mockReset();
    findLoginSessionByIdMock.mockReset();
    updateLoginSessionStatusMock.mockReset();
    updateLoginSessionQrcodeMock.mockReset();
    updateResolvedIdentityMock.mockReset();
    markLoginSessionFailedMock.mockReset();
    markLoginSessionCancelledMock.mockReset();
    markLoginSessionExpiredMock.mockReset();
    markLoginSessionSuccessMock.mockReset();
    getOwnAccountForReloginMock.mockReset();
    startSessionMock.mockReset();
    pollSessionMock.mockReset();
    resolveIdentityMock.mockReset();
    cancelSessionMock.mockReset();
    finishSessionMock.mockReset();
    getTempStatePathMock.mockReset();
    moveTempStateToAccountMock.mockReset();
    deleteStateFileMock.mockReset();

    updateLoginStateBindingMock.mockResolvedValue(undefined);
    clearLoginStateBindingMock.mockResolvedValue(undefined);
    findLoginStateMetaMock.mockResolvedValue(null);
    findAccountByIdMock.mockResolvedValue(createAccount());
    createLoginSessionMock.mockResolvedValue(createLoginSession());
    findActiveSessionsMock.mockResolvedValue([]);
    findLoginSessionByIdMock.mockResolvedValue(createLoginSession(DouyinLoginSessionStatus.QRCODE_READY));
    updateLoginSessionStatusMock.mockResolvedValue(createLoginSession(DouyinLoginSessionStatus.CONFIRMED));
    updateLoginSessionQrcodeMock.mockResolvedValue({
      ...createLoginSession(DouyinLoginSessionStatus.QRCODE_READY),
      qrcodeDataUrl: "data:image/png;base64,abc",
      expiresAt: new Date("2026-04-04T08:03:00.000Z"),
    });
    updateResolvedIdentityMock.mockResolvedValue(createLoginSession(DouyinLoginSessionStatus.CONFIRMED));
    markLoginSessionFailedMock.mockImplementation(async (_id, errorCode: string, errorMessage: string) => ({
      ...createLoginSession(DouyinLoginSessionStatus.FAILED),
      errorCode,
      errorMessage,
    }));
    markLoginSessionCancelledMock.mockResolvedValue(createLoginSession(DouyinLoginSessionStatus.CANCELLED));
    markLoginSessionExpiredMock.mockResolvedValue(createLoginSession(DouyinLoginSessionStatus.EXPIRED));
    markLoginSessionSuccessMock.mockResolvedValue(createLoginSession(DouyinLoginSessionStatus.SUCCESS));
    getOwnAccountForReloginMock.mockResolvedValue(createAccount());
    getTempStatePathMock.mockReturnValue("D:/private/tmp/cm9login00001abc123456789.json");
    moveTempStateToAccountMock.mockResolvedValue("D:/private/accounts/account_1.json");
    deleteStateFileMock.mockResolvedValue(undefined);
    cancelSessionMock.mockResolvedValue(undefined);
    finishSessionMock.mockResolvedValue(undefined);
  });

  it("restores the original login state when relogin session creation fails", async () => {
    startSessionMock.mockRejectedValue(
      new AppError(
        "PLAYWRIGHT_RUNTIME_UNAVAILABLE",
        "Chromium 无法启动，请检查 Playwright 运行环境和目录权限",
        500,
      ),
    );

    const { douyinAuthService } = await import("@/server/services/douyin-auth.service");

    await expect(
      douyinAuthService.createSession(createCaller(), {
        purpose: DouyinLoginSessionPurpose.RELOGIN,
        accountId: "account_1",
      }),
    ).rejects.toMatchObject({ code: "PLAYWRIGHT_RUNTIME_UNAVAILABLE" });

    expect(updateLoginStateBindingMock).toHaveBeenNthCalledWith(1, "account_1", {
      loginStatus: DouyinAccountLoginStatus.PENDING,
      loginErrorMessage: null,
    });
    expect(updateLoginStateBindingMock).toHaveBeenNthCalledWith(2, "account_1", {
      loginStatus: DouyinAccountLoginStatus.LOGGED_IN,
      loginErrorMessage: null,
      loginStateExpiresAt: null,
    });
    expect(finishSessionMock).toHaveBeenCalledWith("cm9login00001abc123456789");
  });

  it("fails relogin when the scanned account does not match the target secUserId", async () => {
    startSessionMock.mockResolvedValue({
      status: DouyinLoginSessionStatus.QRCODE_READY,
      qrcodeDataUrl: "data:image/png;base64,abc",
      expiresAt: new Date("2026-04-04T08:03:00.000Z"),
      currentUrl: "https://creator.douyin.com/",
    });
    pollSessionMock.mockResolvedValue({
      status: DouyinLoginSessionStatus.CONFIRMED,
      qrcodeDataUrl: "data:image/png;base64,abc",
      expiresAt: new Date("2026-04-04T08:03:00.000Z"),
      currentUrl: "https://creator.douyin.com/creator-micro/content/upload",
    });
    resolveIdentityMock.mockResolvedValue({
      secUserId: "wrong_sec_user",
      displayName: null,
      douyinNumber: null,
      rawCookie: "sessionid=wrong",
    });

    const { douyinAuthService } = await import("@/server/services/douyin-auth.service");

    await douyinAuthService.createSession(createCaller(), {
      purpose: DouyinLoginSessionPurpose.RELOGIN,
      accountId: "account_1",
    });

    const result = await douyinAuthService.getSession(createCaller(), "cm9login00001abc123456789");

    expect(result.status).toBe(DouyinLoginSessionStatus.FAILED);
    expect(result.errorCode).toBe("RELOGIN_ACCOUNT_MISMATCH");
    expect(updateResolvedIdentityMock).toHaveBeenCalledWith("cm9login00001abc123456789", {
      resolvedSecUserId: "wrong_sec_user",
    });
    expect(moveTempStateToAccountMock).not.toHaveBeenCalled();
    expect(markLoginSessionSuccessMock).not.toHaveBeenCalled();
    expect(deleteStateFileMock).toHaveBeenCalledWith("D:/private/tmp/cm9login00001abc123456789.json");
    expect(updateLoginStateBindingMock).toHaveBeenNthCalledWith(1, "account_1", {
      loginStatus: DouyinAccountLoginStatus.PENDING,
      loginErrorMessage: null,
    });
    expect(updateLoginStateBindingMock).toHaveBeenNthCalledWith(2, "account_1", {
      loginStatus: DouyinAccountLoginStatus.LOGGED_IN,
      loginErrorMessage: null,
      loginStateExpiresAt: null,
    });
  });
});
