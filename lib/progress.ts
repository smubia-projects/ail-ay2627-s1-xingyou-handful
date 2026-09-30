import { useSyncExternalStore } from "react";

// Learner progress, saved in this browser's localStorage. XP and streak join this in step 6.
export type Progress = {
  completedLessons: string[];
};

const STORAGE_KEY = "signpath:progress";
const EMPTY: Progress = { completedLessons: [] };

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedProgress: Progress = EMPTY;

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
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    cachedProgress = Array.isArray(parsed?.completedLessons)
      ? { completedLessons: parsed.completedLessons.filter((id: unknown) => typeof id === "string") }
      : EMPTY;
  } catch {
    cachedProgress = EMPTY;
  }
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

export function markLessonComplete(lessonId: string) {
  const progress = readProgress();
  if (progress.completedLessons.includes(lessonId)) return;
  writeProgress({ ...progress, completedLessons: [...progress.completedLessons, lessonId] });
}
