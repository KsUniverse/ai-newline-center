import { getRewriteQueue } from "@/lib/bullmq";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { aiModelConfigRepository } from "@/server/repositories/ai-model-config.repository";
import { aiWorkspaceRepository } from "@/server/repositories/ai-workspace.repository";
import { douyinAccountRepository } from "@/server/repositories/douyin-account.repository";
import { rewriteRepository } from "@/server/repositories/rewrite.repository";
import type { SessionUser } from "@/types/session";
import type { GenerateRewriteInput, RewriteDTO } from "@/types/ai-workspace";

class RewriteService {
  private async getWorkspaceForCaller(videoId: string, callerId: string) {
    const workspace = await aiWorkspaceRepository.findByVideoIdAndUserId(videoId, callerId);
    if (!workspace) {
      throw new AppError("WORKSPACE_NOT_FOUND", "工作台不存在", 404);
    }
    return workspace;
  }

  async getOrNullByWorkspace(
    videoId: string,
    caller: SessionUser,
  ): Promise<RewriteDTO | null> {
    const workspace = await this.getWorkspaceForCaller(videoId, caller.id);
    return rewriteRepository.findByWorkspaceId(workspace.id);
  }

  async generate(
    videoId: string,
    input: GenerateRewriteInput,
    caller: SessionUser,
  ): Promise<{ rewriteVersionId: string; versionNumber: number }> {
    const workspace = await this.getWorkspaceForCaller(videoId, caller.id);

    // Verify annotations exist
    const workspaceDetails = await aiWorkspaceRepository.findById(workspace.id);
    if (!workspaceDetails || workspaceDetails.annotations.length === 0) {
      throw new AppError("ANNOTATIONS_REQUIRED", "请先完成 AI 拆解，再发起仿写", 400);
    }

    // Verify targetAccount belongs to caller (also checks account is not archived)
    const targetAccount = await douyinAccountRepository.findOwnedMyAccount(
      input.targetAccountId,
      caller.id,
      caller.organizationId,
    );
    if (!targetAccount) {
      throw new AppError("ACCOUNT_ACCESS_DENIED", "目标账号不属于当前用户", 403);
    }

    // Verify modelConfig exists
    const modelConfig = await aiModelConfigRepository.findByIdRaw(input.modelConfigId);
    if (!modelConfig) {
      throw new AppError("MODEL_NOT_FOUND", "指定的 AI 模型配置不存在", 400);
    }

    // Transaction: upsert Rewrite + create RewriteVersion
    const { version } = await prisma.$transaction(async (tx) => {
      const rewrite = await rewriteRepository.upsertByWorkspace(
        {
          workspaceId: workspace.id,
          targetAccountId: input.targetAccountId,
          organizationId: caller.organizationId,
          userId: caller.id,
        },
        tx,
      );

      const version = await rewriteRepository.createNextVersion(
        {
          rewriteId: rewrite.id,
          modelConfigId: input.modelConfigId,
          usedFragmentIds: input.usedFragmentIds,
          userInputContent: input.userInputContent,
        },
        tx,
      );

      return { rewrite, version };
    });

    // Enqueue BullMQ job
    const queue = getRewriteQueue();
    await queue.add("generate-rewrite", {
      rewriteVersionId: version.id,
      workspaceId: workspace.id,
      organizationId: caller.organizationId,
      userId: caller.id,
    });

    return { rewriteVersionId: version.id, versionNumber: version.versionNumber };
  }

  async saveEditedContent(
    videoId: string,
    versionId: string,
    editedContent: string,
    caller: SessionUser,
  ): Promise<{ id: string; editedContent: string; updatedAt: string }> {
    const workspace = await this.getWorkspaceForCaller(videoId, caller.id);

    const version = await rewriteRepository.findVersionById(versionId);
    if (!version || version.rewrite.workspaceId !== workspace.id) {
      throw new AppError("VERSION_NOT_FOUND", "版本不存在或无权访问", 404);
    }

    if (version.status !== "COMPLETED") {
      throw new AppError("VERSION_NOT_EDITABLE", "只能编辑已完成生成的版本", 400);
    }

    const updated = await rewriteRepository.updateVersionContent(versionId, editedContent);
    return {
      id: updated.id,
      editedContent: updated.editedContent ?? editedContent,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}

export const rewriteService = new RewriteService();
