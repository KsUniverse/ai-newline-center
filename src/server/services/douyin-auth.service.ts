import {
  DouyinAccountLoginStatus,
  DouyinLoginSessionPurpose,
  DouyinLoginSessionStatus,
  UserRole,
  type DouyinAccount,
  type DouyinLoginSession,
} from "@prisma/client";
import cuid from "cuid";

import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { douyinAccountRepository } from "@/server/repositories/douyin-account.repository";
import { douyinLoginSessionRepository } from "@/server/repositories/douyin-login-session.repository";
import { crawlerService } from "@/server/services/crawler.service";
import { douyinAccountService, type CreateDouyinAccountData } from "@/server/services/douyin-account.service";
import { douyinLoginSessionManager } from "@/server/services/douyin-login-session-manager";
import { douyinLoginStateStorageService } from "@/server/services/douyin-login-state-storage.service";
import { syncService } from "@/server/services/sync.service";
import type { SessionUser } from "@/server/services/user.service";
import type {
  DouyinLoginSessionCurrentStep,
  DouyinLoginSessionDTO,
} from "@/types/douyin-account";

interface CreateLoginSessionInput {
  purpose: DouyinLoginSessionPurpose;
  accountId?: string;
}

interface ReloginAccountStateSnapshot {
  loginStatus: DouyinAccountLoginStatus;
  loginErrorMessage: string | null;
  loginStateExpiresAt: Date | null;
}

class DouyinAuthService {
  private readonly reloginAccountStateSnapshots = new Map<string, ReloginAccountStateSnapshot>();

  private readonly finalizingSessions = new Map<string, Promise<DouyinLoginSession>>();

  async createSession(
    caller: SessionUser,
    input: CreateLoginSessionInput,
  ): Promise<DouyinLoginSessionDTO> {
    this.ensureEmployee(caller);

    const account =
      input.purpose === DouyinLoginSessionPurpose.RELOGIN && input.accountId
        ? await douyinAccountService.getOwnAccountForRelogin(caller, input.accountId)
        : null;

    await this.abortActiveSessionsForOwner(caller, input, account);

    const loginSession = await douyinLoginSessionRepository.create({
      userId: caller.id,
      organizationId: caller.organizationId,
      accountId: account?.id ?? null,
      purpose: input.purpose,
    });

    try {
      if (account) {
        this.rememberReloginAccountSnapshot(loginSession.id, account);
        await this.markReloginAccountPending(account.id);
      }

      const runtimeSnapshot = await douyinLoginSessionManager.startSession(loginSession.id);
      const updatedSession = await douyinLoginSessionRepository.updateQrcode(loginSession.id, {
        qrcodeDataUrl: runtimeSnapshot.qrcodeDataUrl,
        expiresAt: runtimeSnapshot.expiresAt,
      });

      return this.toDto(updatedSession);
    } catch (error) {
      await this.finishRuntimeSessionQuietly(loginSession.id);
      await douyinLoginSessionRepository.markFailed(
        loginSession.id,
        error instanceof AppError ? error.code : "LOGIN_SESSION_CREATE_FAILED",
        error instanceof AppError ? error.message : "创建抖音登录会话失败",
      );

      if (account) {
        await this.restoreReloginAccountState(loginSession.id, account.id);
      }

      throw error;
    }
  }

  async relogin(caller: SessionUser, accountId: string): Promise<DouyinLoginSessionDTO> {
    return this.createSession(caller, {
      purpose: DouyinLoginSessionPurpose.RELOGIN,
      accountId,
    });
  }

  async getSession(caller: SessionUser, id: string): Promise<DouyinLoginSessionDTO> {
    this.ensureEmployee(caller);

    const loginSession = await this.getOwnedSession(caller, id);
    const updatedSession = await this.syncSession(loginSession, caller);
    return this.toDto(updatedSession);
  }

  async refreshSession(caller: SessionUser, id: string): Promise<DouyinLoginSessionDTO> {
    this.ensureEmployee(caller);

    const loginSession = await this.getOwnedSession(caller, id);
    if (this.isTerminalStatus(loginSession.status)) {
      throw new AppError("LOGIN_SESSION_INVALID_STATE", "当前会话状态不支持刷新二维码", 409);
    }

    const runtimeSnapshot = await douyinLoginSessionManager.refreshSession(loginSession.id);
    const updatedSession = await douyinLoginSessionRepository.updateQrcode(loginSession.id, {
      qrcodeDataUrl: runtimeSnapshot.qrcodeDataUrl,
      expiresAt: runtimeSnapshot.expiresAt,
    });

    if (loginSession.accountId) {
      await this.markReloginAccountPending(loginSession.accountId);
    }

    return this.toDto(updatedSession);
  }

  async cancelSession(caller: SessionUser, id: string): Promise<DouyinLoginSessionDTO> {
    this.ensureEmployee(caller);

    const loginSession = await this.getOwnedSession(caller, id);
    if (!this.isTerminalStatus(loginSession.status)) {
      await douyinLoginSessionManager.cancelSession(loginSession.id);
    }

    const updatedSession =
      loginSession.status === DouyinLoginSessionStatus.CANCELLED
        ? loginSession
        : await douyinLoginSessionRepository.markCancelled(loginSession.id);

    await this.restoreAccountStatusAfterAbort(loginSession);
    return this.toDto(updatedSession);
  }

  private async syncSession(
    loginSession: DouyinLoginSession,
    caller: SessionUser,
  ): Promise<DouyinLoginSession> {
    if (this.isTerminalStatus(loginSession.status)) {
      return loginSession;
    }

    if (
      loginSession.status === DouyinLoginSessionStatus.CONFIRMED ||
      this.finalizingSessions.has(loginSession.id)
    ) {
      return this.finalizeConfirmedSessionOnce(loginSession, caller);
    }

    const runtimeSnapshot = await douyinLoginSessionManager.pollSession(loginSession.id);

    switch (runtimeSnapshot.status) {
      case DouyinLoginSessionStatus.QRCODE_READY:
        return douyinLoginSessionRepository.updateQrcode(loginSession.id, {
          qrcodeDataUrl: runtimeSnapshot.qrcodeDataUrl,
          expiresAt: runtimeSnapshot.expiresAt,
        });
      case DouyinLoginSessionStatus.SCANNED:
        return douyinLoginSessionRepository.updateStatus(
          loginSession.id,
          DouyinLoginSessionStatus.SCANNED,
          {
            qrcodeDataUrl: runtimeSnapshot.qrcodeDataUrl,
            expiresAt: runtimeSnapshot.expiresAt,
          },
        );
      case DouyinLoginSessionStatus.CONFIRMED:
        return this.finalizeConfirmedSessionOnce(loginSession, caller);
      case DouyinLoginSessionStatus.EXPIRED:
        await this.finishRuntimeSessionQuietly(loginSession.id);
        await this.restoreAccountStatusAfterAbort(loginSession, true);
        return douyinLoginSessionRepository.markExpired(loginSession.id);
      case DouyinLoginSessionStatus.FAILED:
        await this.finishRuntimeSessionQuietly(loginSession.id);
        await this.restoreAccountStatusAfterAbort(loginSession);
        return douyinLoginSessionRepository.markFailed(
          loginSession.id,
          runtimeSnapshot.errorCode ?? "LOGIN_SESSION_FAILED",
          runtimeSnapshot.errorMessage ?? "登录会话已失败，请重新发起",
        );
      default:
        return loginSession;
    }
  }

  private async finalizeConfirmedSession(
    loginSession: DouyinLoginSession,
    caller: SessionUser,
  ): Promise<DouyinLoginSession> {
    try {
      if (loginSession.purpose === DouyinLoginSessionPurpose.CREATE_ACCOUNT) {
        return await this.finalizeCreateAccount(loginSession, caller);
      }

      return await this.finalizeRelogin(loginSession);
    } catch (error) {
      await this.finishRuntimeSessionQuietly(loginSession.id);
      await this.restoreAccountStatusAfterAbort(loginSession);

      return douyinLoginSessionRepository.markFailed(
        loginSession.id,
        error instanceof AppError ? error.code : "LOGIN_SESSION_FINALIZE_FAILED",
        error instanceof AppError ? error.message : "登录处理失败，请重试",
      );
    }
  }

  private async finalizeConfirmedSessionOnce(
    loginSession: DouyinLoginSession,
    caller: SessionUser,
  ): Promise<DouyinLoginSession> {
    const existingPromise = this.finalizingSessions.get(loginSession.id);
    if (existingPromise) {
      console.log("[DouyinAuthService] reuse finalizing session", {
        loginSessionId: loginSession.id,
        status: loginSession.status,
      });
      return existingPromise;
    }

    const finalizePromise = (async () => {
      await douyinLoginSessionRepository.updateStatus(
        loginSession.id,
        DouyinLoginSessionStatus.CONFIRMED,
      );
      return this.finalizeConfirmedSession(loginSession, caller);
    })();

    this.finalizingSessions.set(loginSession.id, finalizePromise);

    try {
      return await finalizePromise;
    } finally {
      this.finalizingSessions.delete(loginSession.id);
    }
  }

  private async finalizeCreateAccount(
    loginSession: DouyinLoginSession,
    caller: SessionUser,
  ): Promise<DouyinLoginSession> {
    douyinLoginSessionManager.setProgressStep(loginSession.id, "RESOLVING_IDENTITY");
    const identity = await douyinLoginSessionManager.resolveIdentity(loginSession.id);
    await douyinLoginSessionRepository.updateResolvedIdentity(loginSession.id, {
      resolvedSecUserId: identity.secUserId,
    });

    if (!identity.secUserId) {
      throw new AppError("SEC_USER_ID_UNRESOLVED", "未能识别当前登录抖音账号，请重试", 409);
    }

    if (!identity.rawCookie) {
      throw new AppError("COOKIE_HEADER_UNRESOLVED", "未能获取收藏同步所需的完整 Cookie，请重试", 409);
    }

    const storageState = this.getRequiredStorageState(loginSession.id);
    douyinLoginSessionManager.setProgressStep(loginSession.id, "FETCHING_PROFILE");
    const profile = await crawlerService.fetchUserProfile(identity.secUserId);
    const now = new Date();
    const accountId = cuid();
    const createAccountPayload: CreateDouyinAccountData = {
      profileUrl: `https://www.douyin.com/user/${identity.secUserId}`,
      secUserId: identity.secUserId,
      nickname: profile.nickname,
      avatar: profile.avatar,
      bio: profile.bio,
      signature: profile.signature,
      followersCount: profile.followersCount,
      followingCount: profile.followingCount,
      likesCount: profile.likesCount,
      videosCount: profile.videosCount,
      douyinNumber: profile.douyinNumber,
      ipLocation: profile.ipLocation,
      age: profile.age,
      province: profile.province,
      city: profile.city,
      verificationLabel: profile.verificationLabel,
      verificationIconUrl: profile.verificationIconUrl,
      verificationType: profile.verificationType,
      loginStatus: DouyinAccountLoginStatus.LOGGED_IN,
      loginStateUpdatedAt: now,
      loginStateCheckedAt: now,
      loginStateExpiresAt: null,
      loginErrorMessage: null,
      favoriteCookieHeader: identity.rawCookie,
      lastSyncedAt: now,
    };

    const loginStatePath = douyinLoginStateStorageService.getAccountStatePath({
      organizationId: caller.organizationId,
      userId: caller.id,
      accountId,
    });
    douyinLoginSessionManager.setProgressStep(loginSession.id, "PERSISTING_LOGIN_STATE");
    await douyinLoginStateStorageService.writeStorageState(loginStatePath, storageState);

    try {
      douyinLoginSessionManager.setProgressStep(loginSession.id, "CREATING_ACCOUNT");
      const updatedSession = await prisma.$transaction(async (tx) => {
        const account = await douyinAccountService.createLoggedInAccount(caller, createAccountPayload, {
          accountId,
          loginStatePath,
          db: tx,
        });

        await douyinLoginSessionRepository.attachAccount(loginSession.id, account.id, tx);
        return douyinLoginSessionRepository.markSuccess(loginSession.id, tx);
      });

      douyinLoginSessionManager.setProgressStep(loginSession.id, "SYNCING_ACCOUNT");
      await this.finishRuntimeSessionQuietly(loginSession.id);

      // 账号创建成功后立即触发一次全量同步（信息 + 视频），不阻塞登录流程
      // intentional: fire-and-forget — sync errors are non-fatal and must not roll back account creation
      void syncService.syncAccount(accountId, caller.id, caller.organizationId).catch((error) => {
        console.error("[DouyinAuth] Post-creation sync failed:", { accountId, error });
      });

      return updatedSession;
    } catch (error) {
      await this.deleteStateFileQuietly(loginStatePath);
      throw error;
    }
  }

  private async finalizeRelogin(
    loginSession: DouyinLoginSession,
  ): Promise<DouyinLoginSession> {
    if (!loginSession.accountId) {
      throw new AppError("ACCOUNT_NOT_FOUND", "重登录目标账号不存在", 404);
    }

    const account = await douyinAccountRepository.findById(loginSession.accountId);
    if (!account) {
      throw new AppError("ACCOUNT_NOT_FOUND", "重登录目标账号不存在", 404);
    }

    douyinLoginSessionManager.setProgressStep(loginSession.id, "RESOLVING_IDENTITY");
    const identity = await douyinLoginSessionManager.resolveIdentity(loginSession.id);
    await douyinLoginSessionRepository.updateResolvedIdentity(loginSession.id, {
      resolvedSecUserId: identity.secUserId,
    });

    console.log("[DouyinAuthService] relogin resolved identity", {
      loginSessionId: loginSession.id,
      accountId: loginSession.accountId,
      targetSecUserId: account.secUserId,
      resolvedSecUserId: identity.secUserId,
      hasRawCookie: Boolean(identity.rawCookie),
    });

    if (!account.secUserId) {
      throw new AppError(
        "RELOGIN_TARGET_SEC_USER_ID_MISSING",
        "目标账号缺少 secUserId，请先重新录入该账号后再尝试更新登录态",
        409,
      );
    }

    if (!identity.secUserId) {
      throw new AppError(
        "RELOGIN_ACCOUNT_UNVERIFIED",
        "未能识别当前扫码登录抖音账号，请确认使用目标账号重新扫码",
        409,
      );
    }

    if (identity.secUserId !== account.secUserId) {
      throw new AppError(
        "RELOGIN_ACCOUNT_MISMATCH",
        "当前扫码登录账号与目标账号不一致，请使用目标账号重新扫码",
        409,
      );
    }

    if (!identity.rawCookie) {
      throw new AppError("COOKIE_HEADER_UNRESOLVED", "未能获取收藏同步所需的完整 Cookie，请重试", 409);
    }

    const storageState = this.getRequiredStorageState(loginSession.id);
    const now = new Date();
    const loginStatePath = douyinLoginStateStorageService.getAccountStatePath({
      organizationId: account.organizationId,
      userId: account.userId,
      accountId: account.id,
    });
    douyinLoginSessionManager.setProgressStep(loginSession.id, "PERSISTING_LOGIN_STATE");
    await douyinLoginStateStorageService.writeStorageState(loginStatePath, storageState);

    douyinLoginSessionManager.setProgressStep(loginSession.id, "UPDATING_ACCOUNT_LOGIN_STATE");
    await douyinAccountRepository.updateLoginStateBinding(account.id, {
      loginStatus: DouyinAccountLoginStatus.LOGGED_IN,
      loginStatePath,
      loginStateUpdatedAt: now,
      loginStateCheckedAt: now,
      loginStateExpiresAt: null,
      loginErrorMessage: null,
      favoriteCookieHeader: identity.rawCookie,
    });

    const updatedSession = await douyinLoginSessionRepository.markSuccess(loginSession.id);
    await this.finishRuntimeSessionQuietly(loginSession.id);
    this.clearReloginAccountState(loginSession.id);

    return updatedSession;
  }

  private async restoreAccountStatusAfterAbort(
    loginSession: DouyinLoginSession,
    expired: boolean = false,
  ): Promise<void> {
    if (!loginSession.accountId) {
      return;
    }

    if (await this.restoreReloginAccountState(loginSession.id, loginSession.accountId)) {
      return;
    }

    const loginStateMeta = await douyinAccountRepository.findLoginStateMeta(loginSession.accountId);
    if (!loginStateMeta || loginStateMeta.loginStatus === DouyinAccountLoginStatus.LOGGED_IN) {
      return;
    }

    if (loginStateMeta.loginStatePath) {
      await douyinAccountRepository.updateLoginStateBinding(loginStateMeta.id, {
        loginStatus: expired ? DouyinAccountLoginStatus.EXPIRED : DouyinAccountLoginStatus.FAILED,
        loginErrorMessage: expired ? "二维码已失效，请重新扫码" : "登录已取消或失败，请重试",
      });
      return;
    }

    await douyinAccountRepository.clearLoginStateBinding(loginStateMeta.id);
  }

  private async abortActiveSessionsForOwner(
    caller: SessionUser,
    input: CreateLoginSessionInput,
    account: DouyinAccount | null,
  ): Promise<void> {
    const activeSessions = await douyinLoginSessionRepository.findActiveByOwner({
      userId: caller.id,
      organizationId: caller.organizationId,
      accountId: input.purpose === DouyinLoginSessionPurpose.RELOGIN ? account?.id ?? null : undefined,
      purpose: input.purpose,
    });

    for (const activeSession of activeSessions) {
      await this.finishRuntimeSessionQuietly(activeSession.id);
      await douyinLoginSessionRepository.markCancelled(activeSession.id);
      await this.restoreAccountStatusAfterAbort(activeSession);
    }
  }

  private rememberReloginAccountSnapshot(loginSessionId: string, account: DouyinAccount): void {
    if (this.reloginAccountStateSnapshots.has(loginSessionId)) {
      return;
    }

    this.reloginAccountStateSnapshots.set(loginSessionId, {
      loginStatus: account.loginStatus,
      loginErrorMessage: account.loginErrorMessage,
      loginStateExpiresAt: account.loginStateExpiresAt,
    });
  }

  private async markReloginAccountPending(accountId: string): Promise<void> {
    await douyinAccountRepository.updateLoginStateBinding(accountId, {
      loginStatus: DouyinAccountLoginStatus.PENDING,
      loginErrorMessage: null,
    });
  }

  private async restoreReloginAccountState(
    loginSessionId: string,
    accountId: string,
  ): Promise<boolean> {
    const snapshot = this.reloginAccountStateSnapshots.get(loginSessionId);
    if (!snapshot) {
      return false;
    }

    this.reloginAccountStateSnapshots.delete(loginSessionId);
    await douyinAccountRepository.updateLoginStateBinding(accountId, {
      loginStatus: snapshot.loginStatus,
      loginErrorMessage: snapshot.loginErrorMessage,
      loginStateExpiresAt: snapshot.loginStateExpiresAt,
    });

    return true;
  }

  private clearReloginAccountState(loginSessionId: string): void {
    this.reloginAccountStateSnapshots.delete(loginSessionId);
  }

  private async deleteStateFileQuietly(filePath: string | null | undefined): Promise<void> {
    try {
      await douyinLoginStateStorageService.deleteStateFile(filePath);
    } catch {
      return;
    }
  }

  private async finishRuntimeSessionQuietly(loginSessionId: string): Promise<void> {
    try {
      await douyinLoginSessionManager.finishSession(loginSessionId);
    } catch {
      return;
    }
  }

  private getRequiredStorageState(loginSessionId: string) {
    const storageState = douyinLoginSessionManager.getStorageState(loginSessionId);
    if (!storageState) {
      throw new AppError("LOGIN_STATE_UNAVAILABLE", "鏈兘淇濆瓨褰撳墠鐧诲綍鎬侊紝璇烽噸璇?", 409);
    }

    return storageState;
  }

  private async getOwnedSession(caller: SessionUser, id: string): Promise<DouyinLoginSession> {
    const loginSession = await douyinLoginSessionRepository.findById(id, caller.organizationId);

    if (!loginSession || loginSession.userId !== caller.id) {
      throw new AppError("NOT_FOUND", "登录会话不存在", 404);
    }

    return loginSession;
  }

  private ensureEmployee(caller: SessionUser): void {
    if (caller.role !== UserRole.EMPLOYEE) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }
  }

  private isTerminalStatus(status: DouyinLoginSessionStatus): boolean {
    return (
      status === DouyinLoginSessionStatus.SUCCESS ||
      status === DouyinLoginSessionStatus.FAILED ||
      status === DouyinLoginSessionStatus.EXPIRED ||
      status === DouyinLoginSessionStatus.CANCELLED
    );
  }

  private toDto(loginSession: DouyinLoginSession): DouyinLoginSessionDTO {
    const currentStep = douyinLoginSessionManager.getProgressStep(loginSession.id, loginSession.status);

    return {
      id: loginSession.id,
      purpose: loginSession.purpose,
      status: loginSession.status,
      currentStep,
      qrcodeDataUrl: loginSession.qrcodeDataUrl,
      expiresAt: loginSession.expiresAt?.toISOString() ?? null,
      resolvedSecUserId: loginSession.resolvedSecUserId,
      accountId: loginSession.accountId,
      errorCode: loginSession.errorCode,
      errorMessage: loginSession.errorMessage,
      message: this.getCurrentStepMessage(loginSession, currentStep),
    };
  }

  private getCurrentStepMessage(
    loginSession: DouyinLoginSession,
    currentStep: DouyinLoginSessionCurrentStep,
  ): string {
    switch (currentStep) {
      case "PREPARING_BROWSER":
        return "正在准备登录二维码";
      case "OPENING_LOGIN_PAGE":
        return "正在打开抖音登录页面";
      case "FETCHING_QRCODE":
        return "正在抓取登录二维码";
      case "WAITING_FOR_SCAN":
        return "请使用抖音 App 扫码登录";
      case "WAITING_FOR_CONFIRM":
        return "已扫码，请在手机上确认登录";
      case "PERSISTING_LOGIN_STATE":
        return "登录已确认，正在保存登录态";
      case "RESOLVING_IDENTITY":
        return "正在识别当前扫码账号";
      case "FETCHING_PROFILE":
        return "正在同步抖音账号信息";
      case "CREATING_ACCOUNT":
        return "登录成功，正在创建账号";
      case "UPDATING_ACCOUNT_LOGIN_STATE":
        return "登录成功，正在更新登录态";
      case "SYNCING_ACCOUNT":
        return "账号已创建，正在启动首次同步";
      case "SUCCESS":
        return loginSession.purpose === DouyinLoginSessionPurpose.CREATE_ACCOUNT
          ? "登录成功，账号已创建"
          : "登录成功，登录态已更新";
      case "EXPIRED":
        return "二维码已失效，请刷新后重新扫码";
      case "CANCELLED":
        return "登录已取消";
      case "FAILED":
      default:
        return loginSession.errorMessage ?? "登录失败，请重试";
    }
  }

  private getStatusMessage(
    loginSession: DouyinLoginSession,
    _currentStep: DouyinLoginSessionCurrentStep,
  ): string {
    void _currentStep;
    switch (loginSession.status) {
      case DouyinLoginSessionStatus.CREATED:
        return "正在准备登录二维码";
      case DouyinLoginSessionStatus.QRCODE_READY:
        return "请使用抖音 App 扫码登录";
      case DouyinLoginSessionStatus.SCANNED:
        return "已扫码，请在手机上确认登录";
      case DouyinLoginSessionStatus.CONFIRMED:
        return loginSession.purpose === DouyinLoginSessionPurpose.CREATE_ACCOUNT
          ? "登录成功，正在创建账号"
          : "登录成功，正在更新登录态";
      case DouyinLoginSessionStatus.SUCCESS:
        return loginSession.purpose === DouyinLoginSessionPurpose.CREATE_ACCOUNT
          ? "登录成功，账号已创建"
          : "登录成功，登录态已更新";
      case DouyinLoginSessionStatus.EXPIRED:
        return "二维码已失效，请刷新后重新扫码";
      case DouyinLoginSessionStatus.CANCELLED:
        return "登录已取消";
      case DouyinLoginSessionStatus.FAILED:
      default:
        return loginSession.errorMessage ?? "登录失败，请重试";
    }
  }
}

export const douyinAuthService = new DouyinAuthService();
