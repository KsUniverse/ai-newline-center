import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { rewritePublicationService } from "@/server/services/rewrite-publication.service";
import type { RewritePublicationDTO } from "@/types/rewrite-publication";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const linkBodySchema = z.object({
  publishedVideoId: z.string().min(1),
});

function toPublicationDto(
  publication: NonNullable<Awaited<ReturnType<typeof rewritePublicationService.getPublication>>>,
): RewritePublicationDTO {
  return {
    id: publication.id,
    rewriteVersionId: publication.rewriteVersionId,
    rewriteId: publication.rewriteId,
    rewriteMode: publication.rewriteVersion.rewrite.mode as "WORKSPACE" | "DIRECT",
    rewriteTopic: publication.rewriteVersion.rewrite.topic ?? null,
    targetAccountNickname: publication.rewriteVersion.rewrite.targetAccount?.nickname ?? null,
    linkedAt: publication.linkedAt.toISOString(),
    publishedVideo: {
      id: publication.publishedVideo.id,
      title: publication.publishedVideo.title,
      coverUrl: publication.publishedVideo.coverUrl ?? null,
      publishedAt: publication.publishedVideo.publishedAt?.toISOString() ?? null,
      playCount: publication.publishedVideo.playCount,
      likeCount: publication.publishedVideo.likeCount,
      commentCount: publication.publishedVideo.commentCount,
      shareCount: publication.publishedVideo.shareCount,
      collectCount: publication.publishedVideo.collectCount,
      admireCount: publication.publishedVideo.admireCount,
      recommendCount: publication.publishedVideo.recommendCount,
    },
    learningSummary: publication.learningCase
      ? {
          id: publication.learningCase.id,
          performanceScore: publication.learningCase.performanceScore,
          status: publication.learningCase.status as "ACTIVE" | "ARCHIVED",
          metricsSnapshot: publication.learningCase.metricsSnapshot,
        }
      : null,
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE);

    const { id } = await params;
    const publication = await rewritePublicationService.getPublication(id, session.user);
    return successResponse(publication ? toPublicationDto(publication) : null);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE);

    const { id } = await params;
    const body = linkBodySchema.parse(await request.json());
    const publication = await rewritePublicationService.linkPublishedVideo(id, body, session.user);
    return successResponse(toPublicationDto(publication));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE);

    const { id } = await params;
    await rewritePublicationService.unlinkPublishedVideo(id, session.user);
    return successResponse({ unlinked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
