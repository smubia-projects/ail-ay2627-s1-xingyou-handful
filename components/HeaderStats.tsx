"use client";

import { currentStreak, useProgress, useProgressLoaded } from "@/lib/progress";

export default function HeaderStats() {
  const progress = useProgress();
  const { count: streak, freezes } = currentStreak(progress.streak);
  const loaded = useProgressLoaded();

  return (
    <div
      className={`ml-auto flex items-center gap-3 font-display text-lg font-bold ${loaded ? "motion-safe:animate-fade-in" : "invisible"}`}
    >
      <span className="flex items-center gap-1">
        <svg
          viewBox="0 0 24 24"
          className={`h-6 w-6 ${streak > 0 ? "fill-coral" : "fill-line-strong"}`}
          aria-hidden="true"
        >
          <path d="M12 2c1 3.5 5.5 6.2 5.5 11.2A5.5 5.5 0 0 1 6.5 13.2c0-2.2 1.1-3.8 2.3-5 .2 1.7.9 2.9 2 3.4C10.6 8 11 4.8 12 2z" />
        </svg>
        <span className={streak > 0 ? "text-ink" : "text-muted"}>{streak}</span>
        <span className="sr-only">day streak</span>
      </span>
      {freezes > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-ice-soft px-2 py-0.5">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 fill-none stroke-ice-dark"
            strokeWidth={2.2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" />
          </svg>
          <span className="text-ink">{freezes}</span>
          <span className="sr-only">{freezes === 1 ? "streak freeze" : "streak freezes"}</span>
        </span>
      )}
      <span className="flex items-center gap-1">
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-brand" aria-hidden="true">
          <path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5L13.5 2z" />
        </svg>
        <span className="text-ink">{progress.xp}</span>
        <span className="font-sans text-xs font-semibold text-muted">XP</span>
      </span>
    </div>
  );
}
