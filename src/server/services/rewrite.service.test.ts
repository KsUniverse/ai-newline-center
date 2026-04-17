import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findByVideoIdAndUserIdMock,
  findByIdMock,
  findByIdRawMock,
  upsertByWorkspaceMock,
  createVersionMock,
  findByWorkspaceIdMock,
  findVersionByIdMock,
  updateVersionContentMock,
  addJobMock,
  findUniqueAccountMock,
} = vi.hoisted(() => ({
  findByVideoIdAndUserIdMock: vi.fn(),
  findByIdMock: vi.fn(),
  findByIdRawMock: vi.fn(),
  upsertByWorkspaceMock: vi.fn(),
  createVersionMock: vi.fn(),
  findByWorkspaceIdMock: vi.fn(),
  findVersionByIdMock: vi.fn(),
  updateVersionContentMock: vi.fn(),
  addJobMock: vi.fn(),
  findUniqueAccountMock: vi.fn(),
}));

vi.mock("@/server/repositories/ai-workspace.repository", () => ({
  aiWorkspaceRepository: {
    findByVideoIdAndUserId: findByVideoIdAndUserIdMock,
    findById: findByIdMock,
  },
}));

vi.mock("@/server/repositories/rewrite.repository", () => ({
  rewriteRepository: {
    findByWorkspaceId: findByWorkspaceIdMock,
    upsertByWorkspace: upsertByWorkspaceMock,
    createVersion: createVersionMock,
    findVersionById: findVersionByIdMock,
    updateVersionContent: updateVersionContentMock,
  },
}));

vi.mock("@/server/repositories/ai-model-config.repository", () => ({
  aiModelConfigRepository: {
    findByIdRaw: findByIdRawMock,
  },
}));

vi.mock("@/lib/bullmq", () => ({
  getRewriteQueue: () => ({ add: addJobMock }),
}));

vi.mock("@/server/repositories/douyin-account.repository", () => ({
  douyinAccountRepository: {
    findOwnedMyAccount: findUniqueAccountMock,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
      const fakeTx = {
        rewriteVersion: {
          aggregate: vi.fn().mockResolvedValue({ _max: { versionNumber: null } }),
        },
      };
      return fn(fakeTx);
    }),
  },
}));

import { AppError } from "@/lib/errors";
import { rewriteService } from "@/server/services/rewrite.service";

const mockCaller = {
  id: "user_1",
  account: "employee",
  name: "员工A",
  role: UserRole.EMPLOYEE,
  organizationId: "org_1",
};

describe("rewriteService.getOrNullByWorkspace", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws WORKSPACE_NOT_FOUND when workspace does not exist", async () => {
    findByVideoIdAndUserIdMock.mockResolvedValue(null);

    await expect(
      rewriteService.getOrNullByWorkspace("video_1", mockCaller),
    ).rejects.toThrow(AppError);

    await expect(
      rewriteService.getOrNullByWorkspace("video_1", mockCaller),
    ).rejects.toMatchObject({ code: "WORKSPACE_NOT_FOUND" });
  });

  it("returns null when no rewrite exists for the workspace", async () => {
    findByVideoIdAndUserIdMock.mockResolvedValue({ id: "ws_1" });
    findByWorkspaceIdMock.mockResolvedValue(null);

    const result = await rewriteService.getOrNullByWorkspace("video_1", mockCaller);
    expect(result).toBeNull();
    expect(findByWorkspaceIdMock).toHaveBeenCalledWith("ws_1");
  });

  it("returns RewriteDTO when rewrite exists", async () => {
    const mockRewriteDTO = {
      id: "rw_1",
      workspaceId: "ws_1",
      targetAccountId: "acc_1",
      organizationId: "org_1",
      userId: "user_1",
      createdAt: "2026-04-11T00:00:00.000Z",
      updatedAt: "2026-04-11T00:00:00.000Z",
      versions: [],
      targetAccount: null,
    };
    findByVideoIdAndUserIdMock.mockResolvedValue({ id: "ws_1" });
    findByWorkspaceIdMock.mockResolvedValue(mockRewriteDTO);

    const result = await rewriteService.getOrNullByWorkspace("video_1", mockCaller);
    expect(result).toEqual(mockRewriteDTO);
  });
});

describe("rewriteService.generate — 前置校验", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws WORKSPACE_NOT_FOUND when workspace does not exist", async () => {
    findByVideoIdAndUserIdMock.mockResolvedValue(null);

    await expect(
      rewriteService.generate(
        "video_1",
        {
          targetAccountId: "acc_1",
          modelConfigId: "model_1",
          usedFragmentIds: [],
        },
        mockCaller,
      ),
    ).rejects.toMatchObject({ code: "WORKSPACE_NOT_FOUND" });
  });

  it("throws ANNOTATIONS_REQUIRED when workspace has no annotations", async () => {
    findByVideoIdAndUserIdMock.mockResolvedValue({ id: "ws_1" });
    findByIdMock.mockResolvedValue({ id: "ws_1", annotations: [] });

    await expect(
      rewriteService.generate(
        "video_1",
        {
          targetAccountId: "acc_1",
          modelConfigId: "model_1",
          usedFragmentIds: [],
        },
        mockCaller,
      ),
    ).rejects.toMatchObject({ code: "ANNOTATIONS_REQUIRED" });
  });

  it("throws ACCOUNT_ACCESS_DENIED when targetAccount does not belong to caller", async () => {
    findByVideoIdAndUserIdMock.mockResolvedValue({ id: "ws_1" });
    findByIdMock.mockResolvedValue({
      id: "ws_1",
      annotations: [{ id: "ann_1" }],
    });
    findUniqueAccountMock.mockResolvedValue(null);

    await expect(
      rewriteService.generate(
        "video_1",
        {
          targetAccountId: "acc_1",
          modelConfigId: "model_1",
          usedFragmentIds: [],
        },
        mockCaller,
      ),
    ).rejects.toMatchObject({ code: "ACCOUNT_ACCESS_DENIED" });
  });

  it("throws MODEL_NOT_FOUND when modelConfigId does not exist", async () => {
    findByVideoIdAndUserIdMock.mockResolvedValue({ id: "ws_1" });
    findByIdMock.mockResolvedValue({
      id: "ws_1",
      annotations: [{ id: "ann_1" }],
    });
    findUniqueAccountMock.mockResolvedValue({ id: "acc_1" });
    findByIdRawMock.mockResolvedValue(null);

    await expect(
      rewriteService.generate(
        "video_1",
        {
          targetAccountId: "acc_1",
          modelConfigId: "model_1",
          usedFragmentIds: [],
        },
        mockCaller,
      ),
    ).rejects.toMatchObject({ code: "MODEL_NOT_FOUND" });
  });
});
