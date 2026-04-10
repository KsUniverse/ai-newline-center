import { UserRole } from "@prisma/client";

import { AppError } from "@/lib/errors";
import {
  fragmentRepository,
  type FragmentWithCreator,
} from "@/server/repositories/fragment.repository";
import type { FragmentDTO, CreateFragmentsInput, CreateFragmentsResult, ListFragmentsParams } from "@/types/fragment";
import type { SessionUser } from "@/types/session";
import type { CursorPaginatedData } from "@/types/api";

class FragmentService {
  private toDto(fragment: FragmentWithCreator): FragmentDTO {
    return {
      id: fragment.id,
      content: fragment.content,
      organizationId: fragment.organizationId,
      createdByUserId: fragment.createdByUserId,
      createdByUser: {
        id: fragment.createdByUser.id,
        name: fragment.createdByUser.name,
      },
      createdAt: fragment.createdAt.toISOString(),
    };
  }

  async listFragments(
    caller: SessionUser,
    params: ListFragmentsParams,
  ): Promise<CursorPaginatedData<FragmentDTO>> {
    const result = await fragmentRepository.findMany({
      organizationId: caller.organizationId,
      q: params.q,
      cursor: params.cursor,
      limit: params.limit ?? 20,
    });

    return {
      ...result,
      items: result.items.map((fragment) => this.toDto(fragment)),
    };
  }

  async createFragments(
    caller: SessionUser,
    input: CreateFragmentsInput,
  ): Promise<CreateFragmentsResult> {
    const contents = input.contents
      .map((content) => content.trim())
      .filter((content) => content.length > 0);

    if (contents.length === 0) {
      throw new AppError("VALIDATION_ERROR", "至少需要一条有效观点", 400);
    }

    const invalidContent = contents.find((content) => content.length > 500);
    if (invalidContent) {
      throw new AppError("VALIDATION_ERROR", "观点内容不能超过 500 个字符", 400);
    }

    const created = await fragmentRepository.createManyPrecisely(
      contents.map((content) => ({
        content,
        organizationId: caller.organizationId,
        createdByUserId: caller.id,
      })),
    );

    return {
      created: created.length,
      items: created.map((fragment) => this.toDto(fragment)),
    };
  }

  async deleteFragment(
    caller: SessionUser,
    fragmentId: string,
  ): Promise<{ id: string }> {
    const fragment = await fragmentRepository.findById(fragmentId, caller.organizationId);

    if (!fragment) {
      throw new AppError("NOT_FOUND", "观点不存在", 404);
    }

    if (caller.role === UserRole.EMPLOYEE && fragment.createdByUserId !== caller.id) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    const deleted = await fragmentRepository.softDelete({
      id: fragmentId,
      organizationId: caller.organizationId,
    });

    if (!deleted) {
      throw new AppError("NOT_FOUND", "观点不存在", 404);
    }

    return {
      id: fragmentId,
    };
  }
}

export const fragmentService = new FragmentService();
