export type AiStreamKind = "transcript" | "decompose" | "rewrite";

export interface AiStreamStartEvent {
  kind: AiStreamKind;
  modelConfigId?: string | null;
  modelName?: string | null;
}

export interface AiStreamDeltaEvent {
  kind: AiStreamKind;
  delta: string;
}

export interface AiStreamDoneEvent {
  kind: AiStreamKind;
  text: string;
  modelConfigId?: string | null;
  modelName?: string | null;
}

export interface AiStreamErrorEvent {
  kind: AiStreamKind;
  code: string;
  message: string;
}

export interface GenerateAnnotationDraftInput {
  segmentId?: string | null;
  startOffset: number;
  endOffset: number;
  quotedText: string;
}

export interface GenerateRewriteDraftInput {
  currentDraft?: string;
  selectedViewpoints?: string[];
}
