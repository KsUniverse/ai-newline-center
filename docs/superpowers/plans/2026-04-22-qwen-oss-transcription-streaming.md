# Qwen OSS Transcription Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Qwen `OSS_FILE` transcription path emit true streaming transcript deltas without bypassing the current AI configuration architecture.

**Architecture:** Extend `AiGatewayService` with a provider-agnostic transcription streaming API that returns `AsyncIterable<string>`, keep `generateTranscriptionFromVideo()` as a compatibility wrapper over that stream, and update `transcription-worker` to publish provider chunks directly instead of locally chunking a buffered final string. Keep provider branching isolated inside the gateway so worker and controller code remain model-agnostic.

**Tech Stack:** TypeScript, Vitest, BullMQ worker, OpenAI-compatible DashScope API

---

### Task 1: Add Gateway-Level Transcription Streaming

**Files:**
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/ai-gateway.service.test.ts`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/ai-gateway.service.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/ai-gateway.service.test.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Add `streamTranscriptionFromVideo()` and keep `generateTranscriptionFromVideo()` as a stream consumer**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: Switch Worker To Provider Deltas

**Files:**
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/transcription-worker.test.ts`
- Modify: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/transcription-worker.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/transcription-worker.test.ts`

- [ ] **Step 1: Write the failing worker test for streamed delta forwarding**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Update the worker to consume gateway chunks directly and persist the accumulated text**
- [ ] **Step 4: Run test to verify it passes**

### Task 3: Verify End-To-End Contract Stability

**Files:**
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/server/services/ai-gateway.service.test.ts`
- Test: `/Users/wxy/code/yewu/2026/ai-newline-center/src/lib/transcription-worker.test.ts`

- [ ] **Step 1: Run focused transcription test suite**
- [ ] **Step 2: Run type-check**
