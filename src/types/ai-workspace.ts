import type { AiStep } from "@/types/ai-config";

export type AiWorkspaceStatus =
  | "IDLE"
  | "TRANSCRIBING"
  | "TRANSCRIPT_DRAFT"
  | "TRANSCRIPT_CONFIRMED"
  | "DECOMPOSING"
  | "DECOMPOSED"
  | "REWRITING";

export interface AiWorkspaceVideoSummaryDTO {
  id: string;
  title: string;
  coverUrl: string | null;
  shareUrl: string | null;
  publishedAt: string | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

export interface AiWorkspaceTranscriptDTO {
  originalText: string | null;
  currentText: string | null;
  isConfirmed: boolean;
  confirmedAt: string | null;
  lastEditedAt: string | null;
  aiProviderKey: string | null;
  aiModel: string | null;
}

export interface AiTranscriptSegmentDTO {
  id: string;
  sortOrder: number;
  text: string;
  summary: string | null;
  purpose: string | null;
  startOffset: number;
  endOffset: number;
}

export interface AiDecompositionAnnotationDTO {
  id: string;
  segmentId: string | null;
  startOffset: number;
  endOffset: number;
  quotedText: string;
  function: string | null;
  argumentRole: string | null;
  technique: string | null;
  purpose: string | null;
  effectiveness: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiRewriteDraftDTO {
  currentDraft: string | null;
  sourceTranscriptText: string | null;
  sourceDecompositionSnapshot: unknown;
}

export interface AiWorkspaceDTO {
  id: string;
  videoId: string;
  userId: string;
  organizationId: string;
  status: AiWorkspaceStatus;
  enteredRewriteAt: string | null;
  createdAt: string;
  updatedAt: string;
  video: AiWorkspaceVideoSummaryDTO;
  transcript: AiWorkspaceTranscriptDTO | null;
  segments: AiTranscriptSegmentDTO[];
  annotations: AiDecompositionAnnotationDTO[];
  rewriteDraft: AiRewriteDraftDTO | null;
}

export interface SaveTranscriptInput {
  currentText: string;
  segments: Array<{
    sortOrder: number;
    text: string;
    summary?: string | null;
    purpose?: string | null;
    startOffset: number;
    endOffset: number;
  }>;
}

export interface SaveAnnotationInput {
  segmentId?: string | null;
  startOffset: number;
  endOffset: number;
  quotedText: string;
  function?: string | null;
  argumentRole?: string | null;
  technique?: string | null;
  purpose?: string | null;
  effectiveness?: string | null;
  note?: string | null;
}

export interface SaveRewriteDraftInput {
  currentDraft: string;
}

export interface AiWorkspaceEntryContext {
  videoId: string;
  step: AiStep;
}

