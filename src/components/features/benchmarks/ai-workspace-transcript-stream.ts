import type {
  AiStreamDeltaEvent,
  AiStreamDoneEvent,
  AiStreamErrorEvent,
  AiStreamStartEvent,
} from "@/types/ai-stream";

export type TranscriptStreamStatus = "idle" | "streaming" | "done" | "error";

export interface TranscriptStreamState {
  text: string;
  status: TranscriptStreamStatus;
  errorMessage: string | null;
}

export interface TranscriptStreamMessage {
  event: string;
  data: unknown;
}

function isTranscriptStartEvent(payload: unknown): payload is AiStreamStartEvent {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "kind" in payload &&
    payload.kind === "transcript"
  );
}

function isTranscriptDeltaEvent(payload: unknown): payload is AiStreamDeltaEvent {
  return (
    isTranscriptStartEvent(payload) &&
    "delta" in payload &&
    typeof payload.delta === "string"
  );
}

function isTranscriptDoneEvent(payload: unknown): payload is AiStreamDoneEvent {
  return (
    isTranscriptStartEvent(payload) &&
    "text" in payload &&
    typeof payload.text === "string"
  );
}

function isTranscriptErrorEvent(payload: unknown): payload is AiStreamErrorEvent {
  return (
    isTranscriptStartEvent(payload) &&
    "message" in payload &&
    typeof payload.message === "string"
  );
}

export function createTranscriptStreamState(
  text: string = "",
): TranscriptStreamState {
  return {
    text,
    status: text ? "done" : "idle",
    errorMessage: null,
  };
}

export function applyTranscriptStreamEvent(
  state: TranscriptStreamState,
  message: TranscriptStreamMessage,
): TranscriptStreamState {
  if (!isTranscriptStartEvent(message.data)) {
    return state;
  }

  switch (message.event) {
    case "start":
      return {
        text: "",
        status: "streaming",
        errorMessage: null,
      };
    case "delta":
      if (!isTranscriptDeltaEvent(message.data)) {
        return state;
      }
      return {
        text: state.text + message.data.delta,
        status: "streaming",
        errorMessage: null,
      };
    case "done":
      if (!isTranscriptDoneEvent(message.data)) {
        return state;
      }
      return {
        text: message.data.text,
        status: "done",
        errorMessage: null,
      };
    case "error":
      if (!isTranscriptErrorEvent(message.data)) {
        return state;
      }
      return {
        text: state.text,
        status: "error",
        errorMessage: message.data.message,
      };
    default:
      return state;
  }
}
