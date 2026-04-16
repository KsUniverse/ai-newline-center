# Production Scheduler Design

**Date:** 2026-04-16  
**Scope:** Only start cron scheduler in production runtime

## Goal

Ensure `node-cron` jobs are started only when the app is running with `NODE_ENV=production`.
Development and test environments must not register the scheduler.

## Current State

`/src/lib/server-bootstrap.ts` starts two background services during server bootstrap:

- `startScheduler()`
- `startTranscriptionWorker()`

This means local development currently starts cron registration together with the worker.

## Design

Adopt the environment gate at the bootstrap layer.

- Keep `startScheduler()` unchanged
- Keep `startTranscriptionWorker()` unchanged
- Change `ensureServerBootstrap()` so it only calls `startScheduler()` when `process.env.NODE_ENV === "production"`

This keeps the decision about which background services should boot in one place and avoids spreading environment checks into individual service modules.

## Behavior

Expected runtime behavior:

- `production`: start scheduler and transcription worker
- `development`: skip scheduler, still start transcription worker
- `test`: keep existing bootstrap short-circuit, start neither service

## Testing

Add or update bootstrap tests to cover:

- scheduler does not start in `development`
- scheduler starts in `production`
- transcription worker still starts once in non-test bootstrap

## Risks

The main behavior change is that developers will no longer see cron-driven sync jobs running automatically in local development. This is intentional and matches the requested deployment policy.
