export interface RewritePublicationCandidateDTO {
  id: string;
  title: string;
  coverUrl: string | null;
  publishedAt: string | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  disabled: boolean;
  disabledReason: string | null;
}

export interface RewriteLearningSummaryDTO {
  id: string;
  performanceScore: number;
  status: "ACTIVE" | "ARCHIVED";
  metricsSnapshot: unknown;
}

export interface RewritePublicationDTO {
  id: string;
  rewriteVersionId: string;
  rewriteId: string;
  rewriteMode: "WORKSPACE" | "DIRECT";
  rewriteTopic: string | null;
  targetAccountNickname: string | null;
  linkedAt: string;
  publishedVideo: {
    id: string;
    title: string;
    coverUrl: string | null;
    publishedAt: string | null;
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    collectCount: number;
    admireCount: number;
    recommendCount: number;
  };
  learningSummary: RewriteLearningSummaryDTO | null;
}
