import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findByVideoIdAndUserIdMock,
  findByIdMock,
  findByIdRawMock,
  upsertByWorkspaceMock,
  createDirectMock,
  createVersionMock,
  createNextVersionMock,
  findByIdAndUserMock,
  updateDirectTaskContextMock,
  findByWorkspaceIdMock,
  findVersionByIdMock,
  updateVersionContentMock,
  markVersionFailedMock,
  addJobMock,
  findUniqueAccountMock,
} = vi.hoisted(() => ({
  findByVideoIdAndUserIdMock: vi.fn(),
  findByIdMock: vi.fn(),
  findByIdRawMock: vi.fn(),
  upsertByWorkspaceMock: vi.fn(),
  createDirectMock: vi.fn(),
  createVersionMock: vi.fn(),
  createNextVersionMock: vi.fn(),
  findByIdAndUserMock: vi.fn(),
  updateDirectTaskContextMock: vi.fn(),
  findByWorkspaceIdMock: vi.fn(),
  findVersionByIdMock: vi.fn(),
  updateVersionContentMock: vi.fn(),
  markVersionFailedMock: vi.fn(),
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
    createDirect: createDirectMock,
    createVersion: createVersionMock,
    createNextVersion: createNextVersionMock,
    findByIdAndUser: findByIdAndUserMock,
    updateDirectTaskContext: updateDirectTaskContextMock,
    findVersionById: findVersionByIdMock,
    updateVersionContent: updateVersionContentMock,
    markVersionFailed: markVersionFailedMock,
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

  it("maps a missing rewrite table to a migration guidance error", async () => {
    findByVideoIdAndUserIdMock.mockResolvedValue({ id: "ws_1" });
    findByWorkspaceIdMock.mockRejectedValue({
      code: "P2021",
      meta: { table: "rewrites" },
    });

    await expect(
      rewriteService.getOrNullByWorkspace("video_1", mockCaller),
    ).rejects.toMatchObject({
      code: "REWRITE_TABLE_MISSING",
      statusCode: 503,
    });
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

  it("maps rewrite queue failures to a user-facing AppError instead of INTERNAL_ERROR", async () => {
    findByVideoIdAndUserIdMock.mockResolvedValue({ id: "ws_1" });
    findByIdMock.mockResolvedValue({
      id: "ws_1",
      annotations: [{ id: "ann_1" }],
    });
    findUniqueAccountMock.mockResolvedValue({ id: "acc_1" });
    findByIdRawMock.mockResolvedValue({ id: "model_1" });
    upsertByWorkspaceMock.mockResolvedValue({ id: "rewrite_1" });
    createNextVersionMock.mockResolvedValue({ id: "version_1", versionNumber: 1 });
    addJobMock.mockRejectedValue(new Error("REDIS_URL is not configured"));

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
    ).rejects.toMatchObject({
      code: "REWRITE_QUEUE_UNAVAILABLE",
      statusCode: 503,
    });
    expect(markVersionFailedMock).toHaveBeenCalledWith(
      "version_1",
      "REDIS_URL is not configured",
    );
  });
});

describe("rewriteService.generateDirect", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates a new DIRECT rewrite task and version when rewriteId is omitted", async () => {
    findUniqueAccountMock.mockResolvedValue({ id: "acc_1" });
    findByIdRawMock.mockResolvedValue({ id: "model_1" });
    createDirectMock.mockResolvedValue({ id: "rewrite_1" });
    createVersionMock.mockResolvedValue({ id: "version_1", versionNumber: 1 });

    const result = await rewriteService.generateDirect(
      {
        targetAccountId: "acc_1",
        modelConfigId: "model_1",
        usedFragmentIds: ["frag_1"],
        userInputContent: "补充素材",
        topic: "创作主题",
      },
      mockCaller,
    );

    expect(result).toEqual({
      rewriteId: "rewrite_1",
      rewriteVersionId: "version_1",
      versionNumber: 1,
    });
    expect(createDirectMock).toHaveBeenCalledWith(
      {
        targetAccountId: "acc_1",
        organizationId: "org_1",
        userId: "user_1",
        topic: "创作主题",
      },
      expect.anything(),
    );
    expect(createVersionMock).toHaveBeenCalledWith(
      {
        rewriteId: "rewrite_1",
        versionNumber: 1,
        modelConfigId: "model_1",
        usedFragmentIds: ["frag_1"],
        userInputContent: "补充素材",
      },
      expect.anything(),
    );
    expect(addJobMock).toHaveBeenCalledWith("generate-rewrite", {
      rewriteVersionId: "version_1",
      organizationId: "org_1",
      userId: "user_1",
      mode: "direct",
    });
  });

  it("appends a new version to an existing DIRECT rewrite task", async () => {
    findUniqueAccountMock.mockResolvedValue({ id: "acc_1" });
    findByIdRawMock.mockResolvedValue({ id: "model_1" });
    findByIdAndUserMock.mockResolvedValue({ id: "rewrite_1", mode: "DIRECT" });
    updateDirectTaskContextMock.mockResolvedValue({ id: "rewrite_1" });
    createNextVersionMock.mockResolvedValue({ id: "version_2", versionNumber: 2 });

    const result = await rewriteService.generateDirect(
      {
        rewriteId: "rewrite_1",
        targetAccountId: "acc_1",
        modelConfigId: "model_1",
        usedFragmentIds: [],
        topic: "新的主题",
      },
      mockCaller,
    );

    expect(result).toEqual({
      rewriteId: "rewrite_1",
      rewriteVersionId: "version_2",
      versionNumber: 2,
    });
    expect(findByIdAndUserMock).toHaveBeenCalledWith(
      "rewrite_1",
      "user_1",
      "org_1",
      "DIRECT",
      expect.anything(),
    );
    expect(updateDirectTaskContextMock).toHaveBeenCalledWith(
      "rewrite_1",
      { topic: "新的主题", targetAccountId: "acc_1" },
      expect.anything(),
    );
    expect(addJobMock).toHaveBeenCalledWith("generate-rewrite", {
      rewriteVersionId: "version_2",
      organizationId: "org_1",
      userId: "user_1",
      mode: "direct",
    });
  });

  it("rejects appending to a DIRECT rewrite task owned by another user", async () => {
    findUniqueAccountMock.mockResolvedValue({ id: "acc_1" });
    findByIdRawMock.mockResolvedValue({ id: "model_1" });
    findByIdAndUserMock.mockResolvedValue(null);

    await expect(
      rewriteService.generateDirect(
        {
          rewriteId: "rewrite_other",
          targetAccountId: "acc_1",
          modelConfigId: "model_1",
          usedFragmentIds: [],
          topic: "主题",
        },
        mockCaller,
      ),
    ).rejects.toMatchObject({ code: "REWRITE_NOT_FOUND" });
  });
});
