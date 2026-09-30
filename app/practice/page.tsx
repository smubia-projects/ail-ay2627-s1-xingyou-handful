"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomBar, PRIMARY_BUTTON } from "@/components/Exercises";
import LessonRunner from "@/components/LessonRunner";
import type { Sign } from "@/components/SignCard";
import { getSign } from "@/lib/content";
import { useProgress } from "@/lib/progress";

const MAX_PRACTICE_SIGNS = 5;

export default function PracticePage() {
  const { mistakes } = useProgress();
  // The signs are fixed when the session starts, so saving new mistakes mid-session doesn't change it.
  const [sessionSigns, setSessionSigns] = useState<Sign[] | null>(null);

  if (sessionSigns) {
    return <LessonRunner lessonId={null} title="Practice mistakes" signs={sessionSigns} />;
  }

  const signs = mistakes
    .map((id) => getSign(id))
    .filter((sign): sign is Sign => sign !== undefined)
    .slice(0, MAX_PRACTICE_SIGNS);

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

      <h1 className="mt-8 text-3xl font-extrabold text-ink">Practice mistakes</h1>

      {signs.length === 0 ? (
        <>
          <p className="mt-2 text-muted">No mistakes to review. Nice work!</p>
          <BottomBar>
            <Link href="/" className={`ml-auto ${PRIMARY_BUTTON}`}>
              Back home
            </Link>
          </BottomBar>
        </>
      ) : (
        <>
          <p className="mt-2 text-muted">
            A quick round on {signs.length === 1 ? "the sign" : `the ${signs.length} signs`} you
            missed most recently. A sign leaves your list once you get all its questions right the
            first time.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {signs.map((sign) => (
              <li
                key={sign.id}
                className="rounded-full bg-peach-light px-4 py-2 font-bold text-ink"
              >
                {sign.word}
              </li>
            ))}
          </ul>
          <BottomBar>
            <button
              type="button"
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
