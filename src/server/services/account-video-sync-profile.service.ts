const SHANGHAI_TIMEZONE = "Asia/Shanghai";
const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_PUBLISH_WINDOWS = [
  { startMinuteOfDay: 7 * 60, endMinuteOfDay: 9 * 60 + 30, source: "default", weight: 1 },
  { startMinuteOfDay: 11 * 60, endMinuteOfDay: 13 * 60 + 30, source: "default", weight: 1 },
  { startMinuteOfDay: 18 * 60, endMinuteOfDay: 21 * 60 + 30, source: "default", weight: 1 },
] satisfies AccountPublishWindow[];

const FAILURE_BACKOFF_MINUTES = [15, 60, 4 * 60, 12 * 60, 24 * 60] as const;

export type AccountSyncType = "MY_ACCOUNT" | "BENCHMARK_ACCOUNT";
export type AccountVideoSyncStatus =
  | "ACTIVE"
  | "COOLDOWN"
  | "LOW_ACTIVITY"
  | "STOPPED_BANNED";

export interface AccountPublishWindow {
  startMinuteOfDay: number;
  endMinuteOfDay: number;
  source: "default" | "historical" | "temporary";
  weight: number;
  expiresAt?: string | null;
}

interface OutOfWindowHitRecord {
  count: number;
  lastSeenAt: string;
}

interface AccountVideoSyncNotes {
  outOfWindowHits?: Record<string, OutOfWindowHitRecord>;
}

export interface AccountVideoSyncProfileState {
  accountType: AccountSyncType;
  accountId: string;
  organizationId: string;
  status: AccountVideoSyncStatus;
  priority: number;
  lastVideoPublishedAt: Date | null;
  lastSyncAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastAttemptAt: Date | null;
  nextSyncAt: Date | null;
  cooldownUntil: Date | null;
  fastFollowUntil: Date | null;
  consecutiveFailureCount: number;
  consecutiveNoNewCount: number;
  publishWindows: AccountPublishWindow[];
  hourlyDistribution: number[];
  notes: unknown;
}

export interface NextSyncPlan {
  status: AccountVideoSyncStatus;
  priority: number;
  intervalMinutes: number;
  nextSyncAt: Date;
}

interface ApplySyncSuccessInput {
  now: Date;
  newestVideoPublishedAt: Date | null;
  discoveredVideoPublishedAts: Date[];
}

function cloneWindows(windows: AccountPublishWindow[]): AccountPublishWindow[] {
  return windows.map((window) => ({ ...window }));
}

function getLocalDateParts(date: Date): { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: SHANGHAI_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return { hour, minute };
}

function getMinuteOfDay(date: Date): number {
  const { hour, minute } = getLocalDateParts(date);
  return hour * 60 + minute;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number): Date {
  return addMinutes(date, days * 24 * 60);
}

function sampleStandardNormal(): number {
  const u1 = Math.max(Math.random(), Number.EPSILON);
  const u2 = Math.random();

  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function applyProductionJitter(
  now: Date,
  plan: NextSyncPlan,
): NextSyncPlan {
  if (process.env.NODE_ENV !== "production" || plan.status !== "ACTIVE") {
    return plan;
  }

  const sigmaMinutes = Math.max(2, Math.round(plan.intervalMinutes * 0.15));
  const maxOffsetMinutes = Math.max(3, Math.round(plan.intervalMinutes * 0.35));
  const rawOffsetMinutes = Math.round(sampleStandardNormal() * sigmaMinutes);
  const boundedOffsetMinutes = Math.max(
    -maxOffsetMinutes,
    Math.min(maxOffsetMinutes, rawOffsetMinutes),
  );
  const jitteredNextSyncAt = addMinutes(plan.nextSyncAt, boundedOffsetMinutes);
  const minNextSyncAt = addMinutes(now, 1);

  return {
    ...plan,
    nextSyncAt:
      jitteredNextSyncAt.getTime() < minNextSyncAt.getTime()
        ? minNextSyncAt
        : jitteredNextSyncAt,
  };
}

function startOfNextShanghaiDay(date: Date): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = formatter.format(date).split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error("Unable to resolve next Shanghai day");
  }

  return new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0) + 24 * 60 * 60 * 1000);
}

function pruneExpiredWindows(
  windows: AccountPublishWindow[],
  now: Date,
): AccountPublishWindow[] {
  return windows.filter((window) => {
    if (window.source !== "temporary" || !window.expiresAt) {
      return true;
    }

    return new Date(window.expiresAt).getTime() > now.getTime();
  });
}

function parseNotes(notes: unknown): AccountVideoSyncNotes {
  if (!notes || typeof notes !== "object") {
    return {};
  }

  return notes as AccountVideoSyncNotes;
}

function buildTemporaryWindow(hour: number, expiresAt: Date): AccountPublishWindow {
  return {
    startMinuteOfDay: hour * 60,
    endMinuteOfDay: (hour + 1) * 60 - 1,
    source: "temporary",
    weight: 1,
    expiresAt: expiresAt.toISOString(),
  };
}

function isMinuteInWindow(minuteOfDay: number, window: AccountPublishWindow): boolean {
  return (
    minuteOfDay >= window.startMinuteOfDay && minuteOfDay <= window.endMinuteOfDay
  );
}

function getMinutesUntilNextWindowStart(
  minuteOfDay: number,
  windows: AccountPublishWindow[],
): number | null {
  if (windows.length === 0) {
    return null;
  }

  let nearestMinutes: number | null = null;

  for (const window of windows) {
    if (isMinuteInWindow(minuteOfDay, window)) {
      return 0;
    }

    const rawDelta = window.startMinuteOfDay - minuteOfDay;
    const wrappedDelta = rawDelta >= 0 ? rawDelta : rawDelta + MINUTES_PER_DAY;

    if (nearestMinutes === null || wrappedDelta < nearestMinutes) {
      nearestMinutes = wrappedDelta;
    }
  }

  return nearestMinutes;
}

function getWindowPhase(
  minuteOfDay: number,
  windows: AccountPublishWindow[],
): "hot" | "post" | "idle" {
  for (const window of windows) {
    const hotStart = Math.max(window.startMinuteOfDay - 90, 0);
    if (minuteOfDay >= hotStart && minuteOfDay <= window.endMinuteOfDay) {
      return "hot";
    }

    if (
      minuteOfDay > window.endMinuteOfDay &&
      minuteOfDay <= Math.min(window.endMinuteOfDay + 120, MINUTES_PER_DAY - 1)
    ) {
      return "post";
    }
  }

  return "idle";
}

export function defaultPublishWindows(): AccountPublishWindow[] {
  return cloneWindows(DEFAULT_PUBLISH_WINDOWS);
}

export function learnPublishWindowsFromHistory(
  publishedAts: Date[],
): AccountPublishWindow[] {
  if (publishedAts.length < 5) {
    return defaultPublishWindows();
  }

  const hourlyCounts = new Array<number>(24).fill(0);
  for (const publishedAt of publishedAts) {
    const hour = getLocalDateParts(publishedAt).hour;
    hourlyCounts[hour] = (hourlyCounts[hour] ?? 0) + 1;
  }

  const segments: Array<{ startHour: number; endHour: number; score: number }> = [];
  let hour = 0;
  while (hour < 24) {
    if ((hourlyCounts[hour] ?? 0) === 0) {
      hour += 1;
      continue;
    }

    const startHour = hour;
    let score = 0;
    while (hour < 24 && (hourlyCounts[hour] ?? 0) > 0) {
      score += hourlyCounts[hour] ?? 0;
      hour += 1;
    }

    segments.push({
      startHour,
      endHour: hour - 1,
      score,
    });
  }

  return segments
    .sort((left, right) => right.score - left.score || left.startHour - right.startHour)
    .slice(0, 3)
    .sort((left, right) => left.startHour - right.startHour)
    .map((segment) => ({
      startMinuteOfDay: segment.startHour * 60,
      endMinuteOfDay: (segment.endHour + 1) * 60 - 1,
      source: "historical" as const,
      weight: segment.score,
    }));
}

export function buildHourlyDistributionFromHistory(publishedAts: Date[]): number[] {
  const hourlyCounts = new Array<number>(24).fill(0);
  for (const publishedAt of publishedAts) {
    const hour = getLocalDateParts(publishedAt).hour;
    hourlyCounts[hour] = (hourlyCounts[hour] ?? 0) + 1;
  }

  return hourlyCounts;
}

export function mergeLearnedAndTemporaryWindows(
  learnedWindows: AccountPublishWindow[],
  existingWindows: AccountPublishWindow[],
  now: Date,
): AccountPublishWindow[] {
  const temporaryWindows = pruneExpiredWindows(existingWindows, now).filter(
    (window) => window.source === "temporary",
  );
  const merged = [...learnedWindows.map((window) => ({ ...window })), ...temporaryWindows];

  return merged
    .slice()
    .sort((left, right) => left.startMinuteOfDay - right.startMinuteOfDay);
}

export function calculateNextSyncPlan(
  profile: AccountVideoSyncProfileState,
  now: Date,
): NextSyncPlan {
  if (profile.status === "STOPPED_BANNED") {
    return {
      status: "STOPPED_BANNED",
      priority: 0,
      intervalMinutes: 24 * 60,
      nextSyncAt: addDays(now, 1),
    };
  }

  if (profile.cooldownUntil && profile.cooldownUntil.getTime() > now.getTime()) {
    return {
      status: "COOLDOWN",
      priority: 0,
      intervalMinutes: Math.ceil(
        (profile.cooldownUntil.getTime() - now.getTime()) / 60_000,
      ),
      nextSyncAt: profile.cooldownUntil,
    };
  }

  const ageInMs = profile.lastVideoPublishedAt
    ? now.getTime() - profile.lastVideoPublishedAt.getTime()
    : 0;
  const daysSinceLastVideo = ageInMs / (24 * 60 * 60 * 1000);

  const windows = pruneExpiredWindows(profile.publishWindows, now);

  if (profile.fastFollowUntil && profile.fastFollowUntil.getTime() > now.getTime()) {
    const minutesUntilNextWindowStart = getMinutesUntilNextWindowStart(
      getMinuteOfDay(now),
      windows,
    );

    if (minutesUntilNextWindowStart !== null && minutesUntilNextWindowStart <= 30) {
      return applyProductionJitter(now, {
        status: "ACTIVE",
        priority: 90,
        intervalMinutes: 10,
        nextSyncAt: addMinutes(now, 10),
      });
    }

    if (minutesUntilNextWindowStart !== null && minutesUntilNextWindowStart <= 60) {
      return applyProductionJitter(now, {
        status: "ACTIVE",
        priority: 80,
        intervalMinutes: 30,
        nextSyncAt: addMinutes(now, 30),
      });
    }

    return applyProductionJitter(now, {
      status: "ACTIVE",
      priority: 60,
      intervalMinutes: 60,
      nextSyncAt: addMinutes(now, 60),
    });
  }

  if (profile.lastVideoPublishedAt && daysSinceLastVideo >= 30) {
    return {
      status: "LOW_ACTIVITY",
      priority: 10,
      intervalMinutes: 24 * 60,
      nextSyncAt: addDays(now, 1),
    };
  }

  if (profile.lastVideoPublishedAt && daysSinceLastVideo >= 7) {
    return {
      status: "LOW_ACTIVITY",
      priority: 20,
      intervalMinutes: 6 * 60,
      nextSyncAt: addMinutes(now, 6 * 60),
    };
  }

  const phase = getWindowPhase(getMinuteOfDay(now), windows);

  if (phase === "hot") {
    return applyProductionJitter(now, {
      status: "ACTIVE",
      priority: 90,
      intervalMinutes: 10,
      nextSyncAt: addMinutes(now, 10),
    });
  }

  if (phase === "post") {
    return applyProductionJitter(now, {
      status: "ACTIVE",
      priority: 60,
      intervalMinutes: 30,
      nextSyncAt: addMinutes(now, 30),
    });
  }

  return applyProductionJitter(now, {
    status: "ACTIVE",
    priority: 30,
    intervalMinutes: 2 * 60,
    nextSyncAt: addMinutes(now, 2 * 60),
  });
}

export function applySyncFailure(
  profile: AccountVideoSyncProfileState,
  now: Date,
): AccountVideoSyncProfileState {
  const nextFailureCount = profile.consecutiveFailureCount + 1;
  const nextProfile: AccountVideoSyncProfileState = {
    ...profile,
    lastAttemptAt: now,
    lastFailureAt: now,
    consecutiveFailureCount: nextFailureCount,
  };

  if (nextFailureCount >= 5) {
    const cooldownUntil = startOfNextShanghaiDay(now);
    return {
      ...nextProfile,
      status: "COOLDOWN",
      priority: 0,
      cooldownUntil,
      nextSyncAt: cooldownUntil,
    };
  }

  const intervalMinutes = Number(
    FAILURE_BACKOFF_MINUTES[Math.min(nextFailureCount - 1, FAILURE_BACKOFF_MINUTES.length - 1)] ??
      FAILURE_BACKOFF_MINUTES[FAILURE_BACKOFF_MINUTES.length - 1] ??
      24 * 60,
  );

  return {
    ...nextProfile,
    nextSyncAt: addMinutes(now, intervalMinutes),
    priority: 0,
  };
}

export function applySyncSuccess(
  profile: AccountVideoSyncProfileState,
  input: ApplySyncSuccessInput,
): AccountVideoSyncProfileState {
  const windows = pruneExpiredWindows(profile.publishWindows, input.now);
  const notes = parseNotes(profile.notes);
  const nextProfile: AccountVideoSyncProfileState = {
    ...profile,
    status: "ACTIVE",
    priority: profile.priority,
    cooldownUntil: null,
    lastAttemptAt: input.now,
    lastSyncAt: input.now,
    lastSuccessAt: input.now,
    consecutiveFailureCount: 0,
    publishWindows: cloneWindows(windows),
    notes: notes,
  };

  if (input.newestVideoPublishedAt) {
    nextProfile.lastVideoPublishedAt =
      profile.lastVideoPublishedAt &&
      profile.lastVideoPublishedAt.getTime() > input.newestVideoPublishedAt.getTime()
        ? profile.lastVideoPublishedAt
        : input.newestVideoPublishedAt;
  }

  if (input.discoveredVideoPublishedAts.length === 0) {
    return {
      ...nextProfile,
      consecutiveNoNewCount: profile.consecutiveNoNewCount + 1,
    };
  }

  const outOfWindowHits = { ...(notes.outOfWindowHits ?? {}) };
  for (const publishedAt of input.discoveredVideoPublishedAts) {
    const minuteOfDay = getMinuteOfDay(publishedAt);
    const isInsideKnownWindow = windows.some((window) =>
      isMinuteInWindow(minuteOfDay, window),
    );
    if (isInsideKnownWindow) {
      continue;
    }

    const hourKey = String(Math.floor(minuteOfDay / 60));
    const previous = outOfWindowHits[hourKey] ?? {
      count: 0,
      lastSeenAt: publishedAt.toISOString(),
    };
    const nextCount = previous.count + 1;
    outOfWindowHits[hourKey] = {
      count: nextCount,
      lastSeenAt: publishedAt.toISOString(),
    };

    if (nextCount < 2) {
      continue;
    }

    const existingTemporaryWindow = windows.find(
      (window) => window.source === "temporary" && window.startMinuteOfDay === Number(hourKey) * 60,
    );
    if (!existingTemporaryWindow) {
      const hour = Number(hourKey);
      windows.push(buildTemporaryWindow(hour, addDays(input.now, 7)));
    }
  }

  return {
    ...nextProfile,
    publishWindows: windows
      .slice()
      .sort((left, right) => left.startMinuteOfDay - right.startMinuteOfDay),
    notes: {
      ...notes,
      outOfWindowHits,
    },
    consecutiveNoNewCount: 0,
    fastFollowUntil: addMinutes(input.now, 120),
  };
}
