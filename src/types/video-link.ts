export interface VideoSnapshotDTO {
  id: string;
  timestamp: string;
  playsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
}

export interface VideoRewriteLinkDTO {
  id: string;
  rewriteId: string;
  rewriteMode: "WORKSPACE" | "DIRECT";
  rewriteTopic: string | null;
  targetAccountNickname: string | null;
  finalContent: string | null;
  linkedAt: string;
}

export interface ExperienceSummaryDTO {
  playsCount: number;
  likesCount: number;
}

export interface RewritePickerItemDTO {
  id: string;
  mode: "WORKSPACE" | "DIRECT";
  topic: string | null;
  benchmarkVideoTitle: string | null;
  targetAccountNickname: string | null;
  targetAccountId: string | null;
  finalContent: string | null;
  createdAt: string;
  experienceSummary: ExperienceSummaryDTO | null;
}
