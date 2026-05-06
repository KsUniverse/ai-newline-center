# Windows Server Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Mac-built Windows Server deployment package plus Windows setup/start/update scripts for the standalone Next.js app.

**Architecture:** Keep the existing standalone packaging flow, add target-aware archive naming and compression, and include PowerShell deployment scripts for Windows Server. Reuse the existing Prisma bootstrap pattern so the runtime client is regenerated on the Windows host instead of relying on Mac-built binaries.

**Tech Stack:** Node.js 20+, Next.js standalone output, PowerShell 5+, PM2, Prisma, Vitest

---

### Task 1: Lock target parsing with tests

**Files:**
- Create: `src/lib/deploy-pack-target.test.ts`
- Create: `scripts/pack-target.mjs`

- [ ] Add a failing Vitest test for package target parsing and output filename generation.
- [ ] Run the focused Vitest command and confirm it fails because the helper module does not exist yet.
- [ ] Implement the minimal helper for `linux` and `windows` targets.
- [ ] Re-run the focused Vitest command and confirm it passes.

### Task 2: Extend the pack script for Windows archives

**Files:**
- Modify: `scripts/pack.mjs`
- Modify: `package.json`

- [ ] Wire `scripts/pack.mjs` to use the new target helper, keep Linux tar output unchanged, and emit a Windows zip archive for `--target=windows`.
- [ ] Fix environment template packaging to use the actual project template filename.
- [ ] Add a dedicated `pnpm deploy:pack:win` command.

### Task 3: Add Windows Server deployment scripts

**Files:**
- Create: `scripts/server/windows/setup.ps1`
- Create: `scripts/server/windows/start.ps1`
- Create: `scripts/server/windows/update.ps1`

- [ ] Add a Windows setup script that checks Node.js, prepares PM2 directories, installs PM2, regenerates Prisma Client, runs migrations, starts the app, and creates a boot-time PM2 resurrect task.
- [ ] Add a Windows start script that loads `.env.production`, prepares writable directories, starts or reloads PM2, and persists the PM2 process list.
- [ ] Add a Windows update script that expands the packaged zip, refreshes Prisma artifacts, and restarts the PM2-managed app.

### Task 4: Verify end-to-end

**Files:**
- Verify: `src/lib/deploy-pack-target.test.ts`
- Verify: `scripts/pack.mjs`
- Verify: `scripts/server/windows/setup.ps1`
- Verify: `scripts/server/windows/start.ps1`
- Verify: `scripts/server/windows/update.ps1`

- [ ] Run the focused Vitest test for target parsing.
- [ ] Run the full project build/package command for the Windows target.
- [ ] Inspect the generated archive contents to confirm the Windows scripts are included.
