# Qwen OSS Transcription Streaming Design

**Date:** 2026-04-22  
**Scope:** Make `TRANSCRIBE` on the existing Qwen `OSS_FILE` configuration produce true streaming deltas.

## Goal

Keep the current AI configuration architecture intact while changing the Qwen OSS transcription path from buffered full-response behavior to provider-driven streaming.

## Design

The stable abstraction boundary remains `AiGatewayService`.

- Add a transcription streaming entrypoint to `AiGatewayService` so worker code depends on a provider-agnostic `AsyncIterable<string>` instead of a Qwen-specific implementation.
- Keep the existing `generateTranscriptionFromVideo()` method for compatibility by consuming the same stream and joining the final text.
- Implement true provider streaming only inside the `OSS_FILE` branch using DashScope OpenAI-compatible `stream: true`.
- Keep `GOOGLE_FILE` under the same abstraction by exposing a one-shot async generator for now, so callers do not branch on provider mode.
- Update `transcription-worker` to forward gateway chunks directly as transcript `delta` events and accumulate the final text for persistence.

## Behavior

- `OSS_FILE` + Qwen: first transcript chunks should reach the frontend as soon as DashScope emits them.
- `GOOGLE_FILE`: continues to work through the same gateway interface, even if its provider path is not yet truly streaming.
- Final DB persistence and `done` event behavior remain unchanged.

## Testing

- Add gateway tests to verify the streaming transcription API returns real incrementally emitted chunks for `OSS_FILE`.
- Update worker tests to verify it consumes the streaming gateway method, publishes direct deltas, and persists the concatenated transcript.

## Risks

- DashScope streaming chunks may include empty or non-content frames; gateway parsing must ignore those safely.
- The worker must preserve the current repository writeback contract and failure handling while switching from buffered text to chunk accumulation.
