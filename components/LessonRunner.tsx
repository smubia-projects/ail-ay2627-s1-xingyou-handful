"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BottomBar,
  ExerciseView,
  PRIMARY_BUTTON,
  useEnterKey,
  type Exercise,
} from "@/components/Exercises";
import SignCard, { type Sign } from "@/components/SignCard";
import { buildExercises, reshuffleExercise } from "@/lib/content";
import {
  clearMistakes,
  recordLessonComplete,
  recordMistakes,
  recordReviewResults,
  scheduleNewSigns,
} from "@/lib/progress";

export type SessionMode = "lesson" | "practice" | "review";

const COMPLETE_HEADINGS: Record<SessionMode, string> = {
  lesson: "Lesson complete!",
  practice: "Practice complete!",
  review: "Review complete!",
};

const XP_PER_FIRST_TRY = 5;
const XP_FOR_FINISHING = 10;

type QueueItem = { exercise: Exercise; retry: boolean };

function toQueue(exercises: Exercise[]): QueueItem[] {
  return exercises.map((exercise) => ({ exercise, retry: false }));
}

function xpFor(firstTryCorrect: number) {
  return firstTryCorrect * XP_PER_FIRST_TRY + XP_FOR_FINISHING;
}

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

function Stat({
  label,
  value,
  note,
  className,
}: {
  label: string;
  value: string;
  note?: string;
  className: string;
}) {
  return (
    <div className={`rounded-2xl px-2 py-4 text-center ${className}`}>
      <p className="text-xs font-extrabold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
      {note && <p className="text-xs font-bold text-muted">{note}</p>}
    </div>
  );
}

// Runs a lesson (intro cards, then exercises), or a practice/review session of known signs.
// Sessions skip the intro: they only mount in the browser after a click, so building their
// random exercises up front is safe.
export default function LessonRunner({
  mode,
  lessonId,
  title,
  signs,
}: {
  mode: SessionMode;
  lessonId?: string;
  title: string;
  signs: Sign[];
}) {
  const isPractice = mode !== "lesson";
  const [phase, setPhase] = useState<"intro" | "exercises" | "complete">(
    isPractice ? "exercises" : "intro",
  );
  const [introIndex, setIntroIndex] = useState(0);
  const [queue, setQueue] = useState<QueueItem[]>(() =>
    isPractice ? toQueue(buildExercises(signs)) : [],
  );
  const [position, setPosition] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [missedThisSession, setMissedThisSession] = useState<string[]>([]);
  const [clearedCount, setClearedCount] = useState(0);
  const router = useRouter();
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [streak, setStreak] = useState<{ count: number; note?: string }>({ count: 0 });

  function nextIntro() {
    if (introIndex < signs.length - 1) {
      setIntroIndex(introIndex + 1);
      return;
    }
    // Built on click, not during render, so the random order can't differ between server and browser.
    setQueue(toQueue(buildExercises(signs)));
    setPhase("exercises");
  }

  function finishExercise(correct: boolean, missedSignIds: string[]) {
    const item = queue[position];
    const firstTry = correct && !item.retry;
    if (firstTry) setFirstTryCorrect((count) => count + 1);

    // Saved straight away, so mistakes count even if the learner quits mid-lesson.
    recordMistakes(missedSignIds);
    const missed = [...missedThisSession, ...missedSignIds];
    setMissedThisSession(missed);

    // Missed multiple-choice questions come back at the end until answered correctly.
    // Match pairs is already finished once every pair is matched.
    const comesBack = !correct && item.exercise.type !== "match";
    const nextQueue = comesBack
      ? [...queue, { exercise: reshuffleExercise(item.exercise), retry: true }]
      : queue;
    if (!comesBack) setCompleted((count) => count + 1);
    setQueue(nextQueue);

    if (position + 1 < nextQueue.length) {
      setPosition(position + 1);
    } else {
      const xpEarned = xpFor(firstTryCorrect + (firstTry ? 1 : 0));
      const result = recordLessonComplete(mode === "lesson" ? (lessonId ?? null) : null, xpEarned);
      const signIds = signs.map((sign) => sign.id);
      const allRight = signIds.filter((id) => !missed.includes(id));
      if (mode === "lesson") scheduleNewSigns(signIds);
      // A practiced sign leaves the mistakes list once all its questions were right first time.
      if (mode === "practice") clearMistakes(allRight);
      // A reviewed sign answered right first time waits longer before its next review.
      if (mode === "review") recordReviewResults(signIds, missed);
      setClearedCount(allRight.length);
      setStreak({
        count: result.streak,
        note: result.earnedFreeze
          ? "Earned a freeze!"
          : result.usedFreezes > 0
            ? "Freeze saved it!"
            : result.increasedToday
              ? "+1 today!"
              : undefined,
      });
      setPhase("complete");
    }
  }

  useEnterKey(
    phase === "intro" ? nextIntro : phase === "complete" ? () => router.push("/") : undefined,
  );

  const total = queue.filter((item) => !item.retry).length;
  const progress = phase === "complete" ? 1 : total > 0 ? completed / total : 0;
  const xp = xpFor(firstTryCorrect);
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
              {title} · {introIndex + 1} of {signs.length}
            </p>
            <SignCard key={signs[introIndex].id} sign={signs[introIndex]} />
            <BottomBar>
              <button
                type="button"
                data-primary
                onClick={nextIntro}
                className={`ml-auto ${PRIMARY_BUTTON}`}
              >
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
            <h1 className="mt-8 text-3xl font-extrabold text-ink">
              {COMPLETE_HEADINGS[mode]}
            </h1>
            <p className="mt-1 text-muted">
              {mode === "practice"
                ? `${clearedCount} of ${signs.length} ${signs.length === 1 ? "sign" : "signs"} cleared from your mistakes`
                : mode === "review"
                  ? `${clearedCount} of ${signs.length} ${signs.length === 1 ? "sign" : "signs"} remembered. They'll come back later`
                  : title}
            </p>
            <div className="mt-8 grid w-full grid-cols-3 gap-3">
              <Stat label="XP earned" value={`+${xp}`} className="bg-peach-light" />
              <Stat label="First try" value={`${accuracy}%`} className="bg-sage-light" />
              <Stat
                label="Streak"
                value={`${streak.count} ${streak.count === 1 ? "day" : "days"}`}
                note={streak.note}
                className="bg-white ring-1 ring-sand"
              />
            </div>
            <BottomBar>
              <Link href="/" data-primary className={`ml-auto ${PRIMARY_BUTTON}`}>
                Continue
              </Link>
            </BottomBar>
          </div>
        )}
      </div>
    </div>
  );
}
