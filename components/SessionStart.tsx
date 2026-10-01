"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomBar, PRIMARY_BUTTON } from "@/components/Exercises";
import LessonRunner, { type SessionMode } from "@/components/LessonRunner";
import type { Sign } from "@/components/SignCard";

// Start screen for a practice, review or test session: describes it, then runs it on Start.
export default function SessionStart({
  mode,
  title,
  description,
  emptyText,
  icon,
  signs,
  loaded,
  unitId,
  listSigns = true,
}: {
  mode: Exclude<SessionMode, "lesson">;
  // For checkpoint and skip-ahead tests: the unit being tested for, and no need to list
  // every sign that might come up.
  unitId?: string;
  listSigns?: boolean;
  title: string;
  description: string;
  emptyText: string;
  icon: React.ReactNode;
  signs: Sign[];
  loaded: boolean;
}) {
  // The signs are fixed when the session starts, so progress saved mid-session doesn't change it.
  const [sessionSigns, setSessionSigns] = useState<Sign[] | null>(null);

  if (sessionSigns) {
    return <LessonRunner mode={mode} title={title} signs={sessionSigns} unitId={unitId} />;
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 pt-6 pb-40">
      <Link
        href="/"
        aria-label="Back to home"
        className="inline-block rounded-full p-1 text-muted transition hover:bg-line hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </svg>
      </Link>

      {icon}
      <h1 className="mt-5 font-display text-4xl font-bold text-ink">{title}</h1>

      {!loaded ? null : signs.length === 0 ? (
        <>
          <p className="mt-2 text-muted">{emptyText}</p>
          <BottomBar>
            <Link href="/" data-primary className={`ml-auto ${PRIMARY_BUTTON}`}>
              Back home
            </Link>
          </BottomBar>
        </>
      ) : (
        <>
          <p className="mt-2 text-muted">{description}</p>
          {listSigns && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {signs.map((sign) => (
                <li key={sign.id} className="rounded-full bg-surface px-4 py-2 font-semibold text-ink">
                  {sign.word}
                </li>
              ))}
            </ul>
          )}
          <BottomBar>
            <button
              type="button"
              data-primary
              onClick={() => setSessionSigns(signs)}
              className={`ml-auto ${PRIMARY_BUTTON}`}
            >
              Start
            </button>
          </BottomBar>
        </>
      )}
    </div>
  );
}
