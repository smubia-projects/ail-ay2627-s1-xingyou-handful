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
  // Spaced review per sign: box 1-5 sets how long until it comes back; due is a dayKey.
  reviews: Record<string, Review>;
  // Sessions (lessons, reviews, practice) to finish each day, and how many are done today.
  dailyGoal: number;
  today: { day: string | null; sessions: number };
};

export type Review = { box: number; due: string };

const STORAGE_KEY = "signpath:progress";

// Days until a sign comes back for review, by box. Right answers move a sign up a box.
const REVIEW_INTERVALS = [1, 3, 7, 14, 30];
const MAX_BOX = REVIEW_INTERVALS.length;

// A streak freeze is earned every 7 streak days, holding at most 2.
export const MAX_FREEZES = 2;
const DAYS_PER_FREEZE = 7;
const EMPTY: Progress = {
  completedLessons: [],
  xp: 0,
  streak: { count: 0, lastDay: null, freezes: 0 },
  mistakes: [],
  reviews: {},
  dailyGoal: 1,
  today: { day: null, sessions: 0 },
};

export const DAILY_GOALS = [1, 2, 3, 5];

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
  const reviews: Record<string, Review> = {};
  if (parsed?.reviews && typeof parsed.reviews === "object") {
    for (const [id, review] of Object.entries(parsed.reviews as Record<string, Partial<Review>>)) {
      if (Number.isInteger(review?.box) && typeof review?.due === "string") {
        reviews[id] = { box: Math.min(Math.max(review.box!, 1), MAX_BOX), due: review.due };
      }
    }
  }
  const dailyGoal = DAILY_GOALS.includes(parsed?.dailyGoal) ? parsed.dailyGoal : EMPTY.dailyGoal;
  const today =
    typeof parsed?.today?.day === "string" && Number.isInteger(parsed?.today?.sessions)
      ? { day: parsed.today.day, sessions: Math.max(parsed.today.sessions, 0) }
      : EMPTY.today;
  return { completedLessons, xp, streak, mistakes, reviews, dailyGoal, today };
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

const subscribeToNothing = () => () => {};

// False while the page is prepared on the server and during the first paint, before saved
// progress is read. Hide progress-based UI until then, so it doesn't flash the empty state.
export function useProgressLoaded(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

// The learner's local calendar date, so a new day starts at their own midnight.
export function dayKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return dayKey(new Date(year, month - 1, day + days));
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

// Sessions finished today; the count resets on a new day.
export function sessionsToday(progress: Progress, today = dayKey()): number {
  return progress.today.day === today ? progress.today.sessions : 0;
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
    today: { day: dayKey(), sessions: sessionsToday(progress) + 1 },
  });
  return {
    streak: streak.count,
    increasedToday: streak.lastDay !== progress.streak.lastDay,
    usedFreezes,
    earnedFreeze,
  };
}

// Adds signs to the mistakes list, moving them to the front if they're already there.
// A sign the learner was reviewing drops back to box 1, so it comes back tomorrow.
export function recordMistakes(signIds: string[], today = dayKey()) {
  if (signIds.length === 0) return;
  const progress = readProgress();
  const fresh = [...new Set(signIds)];
  const reviews = { ...progress.reviews };
  for (const id of fresh) {
    if (reviews[id]) reviews[id] = nextReview(reviews[id], false, today);
  }
  writeProgress({
    ...progress,
    mistakes: [...fresh, ...progress.mistakes.filter((id) => !fresh.includes(id))],
    reviews,
  });
}

// Where a sign goes after a review: up a box when right, back to box 1 when wrong.
export function nextReview(review: Review | undefined, correct: boolean, today = dayKey()): Review {
  const box = correct ? Math.min((review?.box ?? 0) + 1, MAX_BOX) : 1;
  return { box, due: addDays(today, REVIEW_INTERVALS[box - 1]) };
}

// Starts review scheduling for newly learned signs (signs already scheduled are left alone).
export function scheduleNewSigns(signIds: string[], today = dayKey()) {
  const progress = readProgress();
  const reviews = { ...progress.reviews };
  let changed = false;
  for (const id of signIds) {
    if (!reviews[id]) {
      reviews[id] = nextReview(undefined, true, today);
      changed = true;
    }
  }
  if (changed) writeProgress({ ...progress, reviews });
}

// Saves the results of a review session: signs answered right first time move up a box.
// (Missed signs were already moved back to box 1 by recordMistakes.)
export function recordReviewResults(signIds: string[], missedIds: string[], today = dayKey()) {
  const progress = readProgress();
  const reviews = { ...progress.reviews };
  for (const id of signIds) {
    if (!missedIds.includes(id)) reviews[id] = nextReview(reviews[id], true, today);
  }
  writeProgress({ ...progress, reviews });
}

// Learned signs that are due today, most overdue first. Learned signs that were never
// scheduled (finished before reviews existed) count as due.
export function dueSignIds(
  reviews: Progress["reviews"],
  learnedIds: string[],
  today = dayKey(),
): string[] {
  return learnedIds
    .filter((id) => !reviews[id] || reviews[id].due <= today)
    .sort((a, b) => (reviews[a]?.due ?? "").localeCompare(reviews[b]?.due ?? ""));
}

export function clearMistakes(signIds: string[]) {
  const progress = readProgress();
  const mistakes = progress.mistakes.filter((id) => !signIds.includes(id));
  if (mistakes.length !== progress.mistakes.length) writeProgress({ ...progress, mistakes });
}

export function setDailyGoal(goal: number) {
  if (!DAILY_GOALS.includes(goal)) return;
  writeProgress({ ...readProgress(), dailyGoal: goal });
}

export function resetProgress() {
  writeProgress(EMPTY);
}

// A backup file: the progress plus a marker so other JSON files are rejected on restore.
export function exportProgress(): string {
  const backup = { app: "signpath", exportedAt: new Date().toISOString(), progress: readProgress() };
  return JSON.stringify(backup, null, 2);
}

// Reads a backup file. Returns the progress inside, or null if it isn't a SignPath backup.
export function readBackup(text: string): Progress | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed?.app !== "signpath" || typeof parsed.progress !== "object") return null;
    return parseProgress(JSON.stringify(parsed.progress));
  } catch {
    return null;
  }
}

export function restoreProgress(progress: Progress) {
  writeProgress(progress);
}
