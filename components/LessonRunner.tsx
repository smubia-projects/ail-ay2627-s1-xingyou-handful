"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomBar, ExerciseView, PRIMARY_BUTTON, type Exercise } from "@/components/Exercises";
import SignCard, { type Sign } from "@/components/SignCard";
import { buildLessonExercises, reshuffleExercise, type Lesson } from "@/lib/content";

const XP_PER_FIRST_TRY = 5;
const XP_FOR_FINISHING = 10;

type QueueItem = { exercise: Exercise; retry: boolean };

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="h-4 flex-1 overflow-hidden rounded-full bg-sand"
      role="progressbar"
      aria-label="Lesson progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <div
        className="h-full rounded-full bg-sage transition-all duration-500"
        style={{ width: `${value * 100}%` }}
      />
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className={`rounded-2xl p-4 text-center ${className}`}>
      <p className="text-xs font-extrabold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-ink">{value}</p>
    </div>
  );
}

export default function LessonRunner({ lesson, signs }: { lesson: Lesson; signs: Sign[] }) {
  const [phase, setPhase] = useState<"intro" | "exercises" | "complete">("intro");
  const [introIndex, setIntroIndex] = useState(0);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);

  function nextIntro() {
    if (introIndex < signs.length - 1) {
      setIntroIndex(introIndex + 1);
      return;
    }
    // Built on click, not during render, so the random order can't differ between server and browser.
    const exercises = buildLessonExercises(lesson);
    setQueue(exercises.map((exercise) => ({ exercise, retry: false })));
    setTotal(exercises.length);
    setPhase("exercises");
  }

  function finishExercise(correct: boolean) {
    const item = queue[position];
    if (correct && !item.retry) setFirstTryCorrect((count) => count + 1);

    // Missed multiple-choice questions come back at the end until answered correctly.
    // Match pairs is already finished once every pair is matched.
    const comesBack = !correct && item.exercise.type !== "match";
    const nextQueue = comesBack
      ? [...queue, { exercise: reshuffleExercise(item.exercise), retry: true }]
      : queue;
    if (!comesBack) setCompleted((count) => count + 1);
    setQueue(nextQueue);

    if (position + 1 < nextQueue.length) setPosition(position + 1);
    else setPhase("complete");
  }

  const progress = phase === "complete" ? 1 : total > 0 ? completed / total : 0;
  const xp = firstTryCorrect * XP_PER_FIRST_TRY + XP_FOR_FINISHING;
  const accuracy = total > 0 ? Math.round((firstTryCorrect / total) * 100) : 0;
  const current = queue[position];

  return (
    <div className="mx-auto w-full max-w-md px-5 pt-6 pb-40">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          aria-label="Quit lesson"
          className="rounded-full p-1 text-muted transition hover:bg-sand hover:text-ink"
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
        <ProgressBar value={progress} />
      </div>

      <div className="mt-8">
        {phase === "intro" && (
          <>
            <p className="mb-4 text-sm font-extrabold uppercase tracking-widest text-muted">
              {lesson.title} · {introIndex + 1} of {signs.length}
            </p>
            <SignCard key={signs[introIndex].id} sign={signs[introIndex]} />
            <BottomBar>
              <button type="button" onClick={nextIntro} className={`ml-auto ${PRIMARY_BUTTON}`}>
                Continue
              </button>
            </BottomBar>
          </>
        )}

        {phase === "exercises" && current && (
          <>
            {current.retry && (
              <p className="mb-3 inline-block rounded-full bg-peach-light px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-ink">
                Earlier mistake · try again
              </p>
            )}
            <ExerciseView key={position} exercise={current.exercise} onDone={finishExercise} />
          </>
        )}

        {phase === "complete" && (
          <div className="flex flex-col items-center pt-6 text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-sage shadow-[0_6px_0_0_var(--color-sage-dark)] ring-8 ring-sage-light">
              <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" aria-hidden="true">
                <path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  stroke="white"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h1 className="mt-8 text-3xl font-extrabold text-ink">Lesson complete!</h1>
            <p className="mt-1 text-muted">{lesson.title}</p>
            <div className="mt-8 grid w-full grid-cols-2 gap-3">
              <Stat label="XP earned" value={`+${xp}`} className="bg-peach-light" />
              <Stat label="First try" value={`${accuracy}%`} className="bg-sage-light" />
            </div>
            <BottomBar>
              <Link href="/" className={`ml-auto ${PRIMARY_BUTTON}`}>
                Continue
              </Link>
            </BottomBar>
          </div>
        )}
      </div>
    </div>
  );
}
