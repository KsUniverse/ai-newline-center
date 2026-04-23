import { describe, expect, it } from "vitest";

import {
  applyTranscriptStreamEvent,
  createTranscriptStreamState,
} from "./ai-workspace-transcript-stream";

describe("ai workspace transcript stream state", () => {
  it("accumulates transcript deltas and finalizes with the completed text", () => {
    let state = createTranscriptStreamState("旧正文");

    state = applyTranscriptStreamEvent(state, {
      event: "start",
      data: {
        kind: "transcript",
      },
    });

    expect(state).toMatchObject({
      text: "",
      status: "streaming",
      errorMessage: null,
    });

    state = applyTranscriptStreamEvent(state, {
      event: "delta",
      data: {
        kind: "transcript",
        delta: "第一段",
      },
    });

    state = applyTranscriptStreamEvent(state, {
      event: "delta",
      data: {
        kind: "transcript",
        delta: "第二段",
      },
    });

    expect(state.text).toBe("第一段第二段");

    state = applyTranscriptStreamEvent(state, {
      event: "done",
      data: {
        kind: "transcript",
        text: "完整正文",
      },
    });

    expect(state).toMatchObject({
      text: "完整正文",
      status: "done",
      errorMessage: null,
    });
  });

  it("preserves partial text when the stream errors", () => {
    let state = createTranscriptStreamState();

    state = applyTranscriptStreamEvent(state, {
      event: "start",
      data: {
        kind: "transcript",
      },
    });

    state = applyTranscriptStreamEvent(state, {
      event: "delta",
      data: {
        kind: "transcript",
        delta: "已生成片段",
      },
    });

    state = applyTranscriptStreamEvent(state, {
      event: "error",
      data: {
        kind: "transcript",
        code: "TRANSCRIPTION_FAILED",
        message: "转录失败",
      },
    });

    expect(state).toMatchObject({
      text: "已生成片段",
      status: "error",
      errorMessage: "转录失败",
    });
  });
});
