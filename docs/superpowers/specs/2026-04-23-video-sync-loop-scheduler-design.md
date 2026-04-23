# Video Sync Loop Scheduler Design

**Date:** 2026-04-23  
**Scope:** Replace only the video sync cron trigger with a database-driven long-running scheduler loop.

## Goal

Change video sync from fixed cron batch triggering to a single long-running scheduler loop that always waits for the nearest `nextSyncAt` in the database, then enqueues due video sync jobs when their execution time arrives.

## Decision

Adopt a dedicated `video sync scheduler loop` for the video sync chain only.

- Keep `Account sync`, `Video snapshot sync`, and `Collection sync` on their existing cron triggers.
- Remove only the `Video sync` cron registration from `scheduler.ts`.
- Start a dedicated video sync scheduler service from server bootstrap alongside the existing worker processes.

## Architecture

The profile table remains the source of truth for cadence.

- `account_video_sync_profiles.nextSyncAt` continues to represent the next intended execution time for each account.
- `calculateNextSyncPlan()` continues to produce the business cadence, but now writes production-only randomized execution times around the target interval.
- A new long-running scheduler loop repeatedly:
  1. queries the nearest eligible `nextSyncAt`
  2. sleeps until that time if it is still in the future
  3. loads a bounded batch of due profiles
  4. enqueues queue jobs for those profiles
  5. immediately repeats by querying the next nearest execution time

This keeps cadence decisions in profile state, queue execution in workers, and timing orchestration in one dedicated scheduler service.

## Behavior

- The video sync loop should run continuously in production.
- If there are no eligible profiles, it should sleep for a small fallback duration and re-check.
- If the nearest due time is in the future, it should wait exactly until that time rather than polling on a fixed cron cadence.
- When time arrives, it should enqueue a bounded batch of due profiles and then re-evaluate the next nearest due time.
- Production `nextSyncAt` values should include bounded random jitter sampled from a normal-like distribution around the target interval so account execution times look less batch-like.
- Non-production environments should remain deterministic and avoid random jitter.

## Randomization Rules

- Randomization applies only to the computed next execution time for active video sync profiles.
- The randomization is centered around the target interval returned by the cadence logic.
- The jitter must be bounded so it cannot collapse many accounts into the exact same timestamp or push execution unreasonably far away.
- The randomization logic must be deterministic in tests and disabled outside production.

## Logging

The new loop should emit enough logs to diagnose timing behavior:

- loop started
- nearest profile lookup result
- sleep duration until next due time
- due batch size loaded
- jobs enqueued
- loop error and retry behavior

Existing planner and worker logs should remain useful after the refactor.

## Risks

- The loop must avoid busy polling when there are no due profiles.
- It must not double-enqueue the same due batch within one wake cycle.
- Sleep/wake logic must tolerate clock drift and process restarts.
- Randomized `nextSyncAt` must not obscure testability or break the current low-activity / failure-backoff rules.
