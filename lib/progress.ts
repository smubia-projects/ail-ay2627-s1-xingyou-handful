import { useSyncExternalStore } from "react";

// Learner progress, saved in this browser's localStorage.
export type Progress = {
  completedLessons: string[];
  xp: number;
  // lastDay is the learner's local date ("2026-09-30") of the last finished lesson.
  // freezes each cover one missed day, so the streak survives it.
  streak: { count: number; lastDay: string | null; freezes: number };
  // Sign IDs the learner got wrong, most recent first.
  mistakes: string[];
};

const STORAGE_KEY = "signpath:progress";

// A streak freeze is earned every 7 streak days, holding at most 2.
export const MAX_FREEZES = 2;
const DAYS_PER_FREEZE = 7;
const EMPTY: Progress = {
  completedLessons: [],
  xp: 0,
  streak: { count: 0, lastDay: null, freezes: 0 },
  mistakes: [],
};

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedProgress: Progress = EMPTY;

// Anything missing or malformed (e.g. progress saved before XP existed) falls back to the empty value.
function parseProgress(raw: string | null): Progress {
  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    return EMPTY;
  }
  const stringList = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const completedLessons = stringList(parsed?.completedLessons);
  const mistakes = stringList(parsed?.mistakes);
  const xp = Number.isFinite(parsed?.xp) && parsed.xp > 0 ? parsed.xp : 0;
  const freezes = Number.isInteger(parsed?.streak?.freezes)
    ? Math.min(Math.max(parsed.streak.freezes, 0), MAX_FREEZES)
    : 0;
  const streak =
    Number.isInteger(parsed?.streak?.count) && typeof parsed?.streak?.lastDay === "string"
      ? { count: parsed.streak.count, lastDay: parsed.streak.lastDay, freezes }
      : EMPTY.streak;
  return { completedLessons, xp, streak, mistakes };
}

function readProgress(): Progress {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  // Return the same object while nothing changed, as useSyncExternalStore requires.
  if (raw === cachedRaw) return cachedProgress;
  cachedRaw = raw;
  cachedProgress = parseProgress(raw);
  return cachedProgress;
}

function writeProgress(progress: Progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be full or blocked (e.g. some private windows); progress just isn't kept.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keeps other open tabs in sync.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, readProgress, () => EMPTY);
}

// The learner's local calendar date, so a new day starts at their own midnight.
export function dayKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysBetween(from: string, to: string): number {
  const toUtc = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

// Whether the streak is still alive today: each missed day needs a freeze to cover it.
function survives(streak: Progress["streak"], today: string) {
  if (!streak.lastDay) return { alive: false, freezesLeft: streak.freezes, used: 0 };
  const missedDays = Math.max(0, daysBetween(streak.lastDay, today) - 1);
  if (missedDays <= streak.freezes) {
    return { alive: true, freezesLeft: streak.freezes - missedDays, used: missedDays };
  }
  return { alive: false, freezesLeft: streak.freezes, used: 0 };
}

// The streak and freezes as they stand today, before any lesson is finished.
export function currentStreak(streak: Progress["streak"], today = dayKey()) {
  const { alive, freezesLeft } = survives(streak, today);
  return { count: alive ? streak.count : 0, freezes: freezesLeft };
}

// The streak after finishing a lesson today: +1 once per day (using freezes for missed days),
// or back to 1 when there weren't enough freezes. Every 7th day earns a freeze, up to the max.
export function nextStreak(streak: Progress["streak"], today = dayKey()) {
  if (streak.lastDay === today) return { streak, usedFreezes: 0, earnedFreeze: false };
  const { alive, freezesLeft, used } = survives(streak, today);
  const count = alive ? streak.count + 1 : 1;
  const earnedFreeze = count % DAYS_PER_FREEZE === 0 && freezesLeft < MAX_FREEZES;
  return {
    streak: { count, lastDay: today, freezes: freezesLeft + (earnedFreeze ? 1 : 0) },
    usedFreezes: used,
    earnedFreeze,
  };
}

// Saves a finished lesson (or practice session, when lessonId is null) and its XP.
// Returns the new streak, whether it went up today, and any freezes used or earned.
export function recordLessonComplete(lessonId: string | null, xpEarned: number) {
  const progress = readProgress();
  const { streak, usedFreezes, earnedFreeze } = nextStreak(progress.streak);
  writeProgress({
    ...progress,
    completedLessons:
      lessonId === null || progress.completedLessons.includes(lessonId)
        ? progress.completedLessons
        : [...progress.completedLessons, lessonId],
    xp: progress.xp + xpEarned,
    streak,
  });
  return {
    streak: streak.count,
    increasedToday: streak.lastDay !== progress.streak.lastDay,
    usedFreezes,
    earnedFreeze,
  };
}

// Adds signs to the mistakes list, moving them to the front if they're already there.
export function recordMistakes(signIds: string[]) {
  if (signIds.length === 0) return;
  const progress = readProgress();
  const fresh = [...new Set(signIds)];
  writeProgress({
    ...progress,
    mistakes: [...fresh, ...progress.mistakes.filter((id) => !fresh.includes(id))],
  });
}

export function clearMistakes(signIds: string[]) {
  const progress = readProgress();
  const mistakes = progress.mistakes.filter((id) => !signIds.includes(id));
  if (mistakes.length !== progress.mistakes.length) writeProgress({ ...progress, mistakes });
}
