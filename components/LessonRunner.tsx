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
import {
  buildExercises,
  buildLessonSteps,
  getLearnedSignIds,
  getSign,
  MAX_REVIEWS,
  questionCount,
  reshuffleExercise,
  shuffle,
  TARGET_QUESTIONS,
  type LessonStep,
} from "@/lib/content";
import {
  clearMistakes,
  recordLessonComplete,
  recordMistakes,
  recordReviewResults,
  dueSignIds,
  scheduleNewSigns,
  useProgress,
} from "@/lib/progress";

export type SessionMode = "lesson" | "practice" | "review";

const COMPLETE_HEADINGS: Record<SessionMode, string> = {
  lesson: "Lesson complete!",
  practice: "Practice complete!",
  review: "Review complete!",
};

const XP_PER_FIRST_TRY = 5;
const XP_FOR_FINISHING = 10;

// A step in the session: a new-sign card, or an exercise (a retry of a missed one, or a quick
// review of an earlier sign).
type QueueItem =
  | { kind: "intro"; sign: Sign; index: number }
  | { kind: "exercise"; exercise: Exercise; retry: boolean; review: boolean };

function toQueue(exercises: Exercise[]): QueueItem[] {
  return exercises.map((exercise) => ({ kind: "exercise", exercise, retry: false, review: false }));
}

function fromSteps(steps: LessonStep[]): QueueItem[] {
  return steps.map((step) =>
    step.kind === "intro"
      ? step
      : { kind: "exercise", exercise: step.exercise, retry: false, review: step.review ?? false },
  );
}

function xpFor(firstTryCorrect: number) {
  return firstTryCorrect * XP_PER_FIRST_TRY + XP_FOR_FINISHING;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="h-4 flex-1 overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-label="Lesson progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <div
        className="h-full rounded-full bg-bluebell transition-all duration-500"
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
    <div className={`rounded-3xl px-2 py-4 text-center ${className}`}>
      <p className="text-sm font-semibold text-ink/70">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-ink">{value}</p>
      {note && <p className="text-xs font-bold text-muted">{note}</p>}
    </div>
  );
}

// Runs a lesson (each new sign is taught, then practiced, then everything is mixed with quick
// reviews), or a practice/review session of known signs. Random parts are built on the first
// click, never during render, so the server and browser always render the same first screen.
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
  const isLesson = mode === "lesson";
  const progressData = useProgress();
  const [queue, setQueue] = useState<QueueItem[]>(() =>
    isLesson ? [{ kind: "intro", sign: signs[0], index: 0 }] : toQueue(buildExercises(signs)),
  );
  const [built, setBuilt] = useState(!isLesson);
  const [position, setPosition] = useState(0);
  const [done, setDone] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [missedThisSession, setMissedThisSession] = useState<string[]>([]);
  const [clearedCount, setClearedCount] = useState(0);
  const router = useRouter();
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [streak, setStreak] = useState<{ count: number; note?: string }>({ count: 0 });

  // Earlier signs to top up a short lesson: due reviews first, then any other learned sign.
  function pickReviewSigns(): Sign[] {
    const count = Math.min(MAX_REVIEWS, Math.max(0, TARGET_QUESTIONS - questionCount(signs)));
    if (count === 0) return [];
    const lessonIds = signs.map((sign) => sign.id);
    const learned = getLearnedSignIds(progressData.completedLessons).filter(
      (id) => !lessonIds.includes(id),
    );
    const due = dueSignIds(progressData.reviews, learned);
    const others = shuffle(learned.filter((id) => !due.includes(id)));
    return [...due, ...others]
      .slice(0, count)
      .map((id) => getSign(id))
      .filter((sign): sign is Sign => sign !== undefined);
  }

  function finishSession(firstTryTotal: number, missed: string[]) {
    const xpEarned = xpFor(firstTryTotal);
    const result = recordLessonComplete(isLesson ? (lessonId ?? null) : null, xpEarned);
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
    setDone(true);
  }

  function advance(nextQueue: QueueItem[], firstTryTotal: number, missed: string[]) {
    if (position + 1 < nextQueue.length) setPosition(position + 1);
    else finishSession(firstTryTotal, missed);
  }

  function continueFromIntro() {
    setCompleted((count) => count + 1);
    let nextQueue = queue;
    if (!built) {
      // The first card is already showing; the full plan starts with that same card.
      nextQueue = fromSteps(buildLessonSteps(signs, pickReviewSigns()));
      setQueue(nextQueue);
      setBuilt(true);
    }
    advance(nextQueue, firstTryCorrect, missedThisSession);
  }

  function finishExercise(correct: boolean, missedSignIds: string[]) {
    const item = queue[position];
    if (item.kind !== "exercise") return;
    const firstTry = correct && !item.retry;
    const firstTryTotal = firstTryCorrect + (firstTry ? 1 : 0);
    if (firstTry) setFirstTryCorrect(firstTryTotal);

    // Saved straight away, so mistakes count even if the learner quits mid-lesson.
    recordMistakes(missedSignIds);
    const missed = [...missedThisSession, ...missedSignIds];
    setMissedThisSession(missed);

    // Missed multiple-choice questions come back at the end until answered correctly.
    // Match pairs is already finished once every pair is matched.
    const comesBack = !correct && item.exercise.type !== "match";
    const nextQueue: QueueItem[] = comesBack
      ? [
          ...queue,
          { kind: "exercise", exercise: reshuffleExercise(item.exercise), retry: true, review: item.review },
        ]
      : queue;
    if (!comesBack) setCompleted((count) => count + 1);
    setQueue(nextQueue);
    advance(nextQueue, firstTryTotal, missed);
  }

  const current = queue[position];
  useEnterKey(
    done ? () => router.push("/") : current?.kind === "intro" ? continueFromIntro : undefined,
  );

  // Before the plan is built, count the steps it will have so the bar doesn't jump.
  const plannedSteps = built
    ? queue.filter((item) => item.kind === "intro" || !item.retry).length
    : signs.length + questionCount(signs);
  const questions = queue.filter((item) => item.kind === "exercise" && !item.retry).length;
  const progress = done ? 1 : plannedSteps > 0 ? completed / plannedSteps : 0;
  const xp = xpFor(firstTryCorrect);
  const accuracy = questions > 0 ? Math.round((firstTryCorrect / questions) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-md px-5 pt-6 pb-40">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          aria-label="Quit lesson"
          className="rounded-full p-1 text-muted transition hover:bg-line hover:text-ink"
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

      <div className="mt-6">
        {!done && current?.kind === "intro" && (
          <>
            <p className="mb-3 text-sm font-semibold text-muted">
              {title} · new sign {current.index + 1} of {signs.length}
            </p>
            <SignCard key={current.sign.id} sign={current.sign} />
            <BottomBar>
              <button
                type="button"
                data-primary
                onClick={continueFromIntro}
                className={`ml-auto ${PRIMARY_BUTTON}`}
              >
                Continue
              </button>
            </BottomBar>
          </>
        )}

        {!done && current?.kind === "exercise" && (
          <>
            {current.retry ? (
              <p className="mb-3 inline-block rounded-full bg-coral-soft px-3 py-1 text-sm font-semibold text-ink">
                Earlier mistake · try again
              </p>
            ) : current.review ? (
              <p className="mb-3 inline-block rounded-full bg-bluebell px-3 py-1 text-sm font-semibold text-ink">
                Quick review
              </p>
            ) : null}
            <ExerciseView key={position} exercise={current.exercise} onDone={finishExercise} />
          </>
        )}

        {done && (
          <div className="flex flex-col items-center pt-6 text-center">
            <span className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-charcoal bg-honey">
              <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" aria-hidden="true">
                <path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  stroke="#252c26"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h1 className="mt-8 font-display text-4xl font-bold text-ink">
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
              <Stat label="XP earned" value={`+${xp}`} className="bg-honey" />
              <Stat label="First try" value={`${accuracy}%`} className="bg-bluebell" />
              <Stat
                label="Streak"
                value={`${streak.count} ${streak.count === 1 ? "day" : "days"}`}
                note={streak.note}
                className="bg-fern-soft"
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
