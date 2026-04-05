import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

export interface DouyinStorageStateCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export interface DouyinStorageStateOrigin {
  origin: string;
  localStorage: Array<{
    name: string;
    value: string;
  }>;
}

export interface DouyinStorageState {
  cookies: DouyinStorageStateCookie[];
  origins?: DouyinStorageStateOrigin[];
}

interface AccountStoragePathParams {
  organizationId: string;
  userId: string;
  accountId: string;
}

class DouyinLoginStateStorageService {
  private readonly rootDir = path.resolve(
    env.DOUYIN_LOGIN_STATE_DIR ?? path.join(process.cwd(), ".private", "douyin-login-state"),
  );

  private readonly publicDir = path.resolve(path.join(process.cwd(), "public"));

  private readyPromise: Promise<void> | null = null;

  getRootDir(): string {
    return this.rootDir;
  }

  getAccountStatePath(params: AccountStoragePathParams): string {
    return path.join(
      this.rootDir,
      "organizations",
      params.organizationId,
      "users",
      params.userId,
      "accounts",
      `${params.accountId}.json`,
    );
  }

  async ensureReady(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.ensureReadyInternal();
    }

    return this.readyPromise;
  }

  async writeStorageState(filePath: string, storageState: DouyinStorageState): Promise<void> {
    await this.ensureReady();
    this.ensureInsideRoot(filePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      JSON.stringify({
        cookies: storageState.cookies,
        origins: storageState.origins ?? [],
      }),
      "utf8",
    );
  }

  async deleteStateFile(filePath: string | null | undefined): Promise<void> {
    if (!filePath) {
      return;
    }

    this.ensureInsideRoot(filePath);
    await rm(filePath, { force: true });
  }

  async readStorageState(filePath: string): Promise<DouyinStorageState> {
    this.ensureInsideRoot(filePath);

    const content = await readFile(filePath, "utf8");
    // file is written exclusively by this service; shape is known at write-time
    const parsed = JSON.parse(content) as Partial<DouyinStorageState>;

    if (!Array.isArray(parsed.cookies)) {
      throw new AppError("INVALID_LOGIN_STATE", "账号登录态文件无效", 500);
    }

    return {
      cookies: parsed.cookies,
      origins: parsed.origins ?? [],
    };
  }

  async hasStateFile(filePath: string): Promise<boolean> {
    this.ensureInsideRoot(filePath);

    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureReadyInternal(): Promise<void> {
    this.ensurePrivateRoot();

    await mkdir(this.rootDir, { recursive: true });
    await access(this.rootDir, fsConstants.R_OK | fsConstants.W_OK);

    const probeFilePath = path.join(this.rootDir, ".write-probe");
    await writeFile(probeFilePath, "ok", "utf8");
    await rm(probeFilePath, { force: true });
  }

  private ensurePrivateRoot(): void {
    if (this.isPathInside(this.publicDir, this.rootDir)) {
      throw new AppError(
        "INVALID_LOGIN_STATE_DIR",
        "抖音登录态目录不能位于 public 下，请配置私有可写目录",
        500,
      );
    }
  }

  private ensureInsideRoot(targetPath: string): void {
    const resolvedPath = path.resolve(targetPath);

    if (!this.isPathInside(this.rootDir, resolvedPath)) {
      throw new AppError("INVALID_LOGIN_STATE_PATH", "登录态文件路径不合法", 500);
    }
  }

  private isPathInside(parentPath: string, childPath: string): boolean {
    const relativePath = path.relative(parentPath, childPath);

    return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
  }
}

export const douyinLoginStateStorageService = new DouyinLoginStateStorageService();
