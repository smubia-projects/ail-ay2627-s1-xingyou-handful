"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomBar, PRIMARY_BUTTON } from "@/components/Exercises";
import LessonRunner, { type SessionMode } from "@/components/LessonRunner";
import type { Sign } from "@/components/SignCard";

// Start screen for a practice or review session: lists the signs, then runs them on Start.
export default function SessionStart({
  mode,
  title,
  description,
  emptyText,
  icon,
  signs,
  loaded,
}: {
  mode: Exclude<SessionMode, "lesson">;
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
    return <LessonRunner mode={mode} title={title} signs={sessionSigns} />;
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 pt-6 pb-40">
      <Link
        href="/"
        aria-label="Back to home"
        className="inline-block rounded-full p-1 text-muted transition hover:bg-sand hover:text-ink"
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
      <h1 className="mt-5 text-3xl font-extrabold text-ink">{title}</h1>

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
          <ul className="mt-6 flex flex-wrap gap-2">
            {signs.map((sign) => (
              <li key={sign.id} className="rounded-full bg-white px-4 py-2 font-bold text-ink ring-1 ring-sand">
                {sign.word}
              </li>
            ))}
          </ul>
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
