export type TranscriptionStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface TranscriptionDTO {
  id: string;
  videoId: string;
  status: TranscriptionStatus;
  aiModel: string;
  originalText: string | null;
  editedText: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TranscriptionSSEEvent =
  | {
      event: "status";
      data: { transcriptionId: string; status: "PROCESSING" };
    }
  | {
      event: "done";
      data: { transcriptionId: string; status: "COMPLETED"; originalText: string };
    }
  | {
      event: "error";
      data: { transcriptionId: string; status: "FAILED"; errorMessage: string | null };
    };
