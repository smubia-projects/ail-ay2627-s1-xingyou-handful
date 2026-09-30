import { useSyncExternalStore } from "react";

// Learner progress, saved in this browser's localStorage.
export type Progress = {
  completedLessons: string[];
  xp: number;
  // lastDay is the learner's local date ("2026-09-30") of the last finished lesson.
  streak: { count: number; lastDay: string | null };
};

const STORAGE_KEY = "signpath:progress";
const EMPTY: Progress = { completedLessons: [], xp: 0, streak: { count: 0, lastDay: null } };

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
  const completedLessons = Array.isArray(parsed?.completedLessons)
    ? parsed.completedLessons.filter((id: unknown) => typeof id === "string")
    : [];
  const xp = Number.isFinite(parsed?.xp) && parsed.xp > 0 ? parsed.xp : 0;
  const streak =
    Number.isInteger(parsed?.streak?.count) && typeof parsed?.streak?.lastDay === "string"
      ? { count: parsed.streak.count, lastDay: parsed.streak.lastDay }
      : EMPTY.streak;
  return { completedLessons, xp, streak };
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

// The streak as it stands today: it's broken once a whole day passes with no lesson.
export function currentStreak(streak: Progress["streak"], today = dayKey()): number {
  if (!streak.lastDay) return 0;
  return daysBetween(streak.lastDay, today) <= 1 ? streak.count : 0;
}

// The streak after finishing a lesson today: +1 once per day, or back to 1 after a missed day.
export function nextStreak(streak: Progress["streak"], today = dayKey()): Progress["streak"] {
  if (streak.lastDay === today) return streak;
  const continues = streak.lastDay !== null && daysBetween(streak.lastDay, today) === 1;
  return { count: continues ? streak.count + 1 : 1, lastDay: today };
}

// Saves a finished lesson and its XP. Returns the new streak and whether it went up today.
export function recordLessonComplete(lessonId: string, xpEarned: number) {
  const progress = readProgress();
  const streak = nextStreak(progress.streak);
  writeProgress({
    completedLessons: progress.completedLessons.includes(lessonId)
      ? progress.completedLessons
      : [...progress.completedLessons, lessonId],
    xp: progress.xp + xpEarned,
    streak,
  });
  return { streak: streak.count, increasedToday: streak.lastDay !== progress.streak.lastDay };
}
