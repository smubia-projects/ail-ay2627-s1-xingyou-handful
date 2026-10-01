"use client";

import Link from "next/link";
import { getLearnedSignIds, getLessonSigns, getSign, getUnits, type Lesson } from "@/lib/content";
import { dueSignIds, sessionsToday, useProgress, useProgressLoaded } from "@/lib/progress";

type LessonState = "completed" | "current" | "locked";

// Each unit gets its own bold color, cycling if there are more units than colors.
// All take charcoal text.
type UnitTheme = { block: string; ring: string; dot: string };
const UNIT_THEMES: UnitTheme[] = [
  { block: "bg-fern", ring: "ring-fern/30", dot: "bg-fern" },
  { block: "bg-bluebell", ring: "ring-bluebell/40", dot: "bg-bluebell" },
  { block: "bg-honey", ring: "ring-honey/40", dot: "bg-honey" },
  { block: "bg-fennel", ring: "ring-fennel/60", dot: "bg-line-strong" },
];

const BANNER_BUTTON =
  "mt-3 inline-block rounded-full border-2 border-charcoal bg-cream px-4 py-1.5 text-sm font-bold text-charcoal transition hover:bg-white active:scale-[0.97]";

// Gentle zigzag so the lessons read as a winding path.
const PATH_OFFSETS = ["translate-x-0", "translate-x-14", "translate-x-0", "-translate-x-14"];
// Moves the connecting dots (relative to the lesson above them) halfway to the next lesson.
const CONNECTOR_OFFSETS = ["translate-x-7", "-translate-x-7", "-translate-x-7", "translate-x-7"];

function circleStyle(state: LessonState, theme: UnitTheme) {
  if (state === "locked") {
    return "h-20 w-20 bg-surface text-line-strong ring-transparent";
  }
  const size = state === "current" ? "h-24 w-24 ring-honey" : `h-20 w-20 ${theme.ring}`;
  return `${size} ${theme.block} text-charcoal`;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth={2.5} />
    </svg>
  );
}

function LessonNode({
  lesson,
  number,
  state,
  theme,
}: {
  lesson: Lesson;
  number: number;
  state: LessonState;
  theme: UnitTheme;
}) {
  const words = getLessonSigns(lesson)
    .map((sign) => sign.word)
    .join(" · ");

  const content = (
    <>
      {state === "current" && (
        <span className="mb-4 rounded-full bg-charcoal px-3.5 py-1.5 text-sm font-bold text-cream motion-safe:animate-bob">
          Start
        </span>
      )}
      <span
        className={`flex items-center justify-center rounded-full font-display text-3xl font-bold ring-8 transition ${circleStyle(state, theme)} ${
          state === "locked" ? "" : "group-hover:brightness-110 group-active:scale-95"
        }`}
      >
        {state === "completed" ? <CheckIcon /> : state === "locked" ? <LockIcon /> : number}
      </span>
      <h2
        className={`mt-4 font-display text-lg font-bold ${state === "locked" ? "text-muted" : "text-ink"}`}
      >
        {lesson.title}
      </h2>
      <p className="text-sm text-muted">{words}</p>
      <span className="sr-only">
        {state === "completed" ? "Completed" : state === "current" ? "Next lesson" : "Locked"}
      </span>
    </>
  );

  if (state === "locked") {
    return <div className="flex flex-col items-center text-center">{content}</div>;
  }
  return (
    <Link href={`/lesson/${lesson.id}`} className="group flex flex-col items-center rounded-3xl text-center">
      {content}
    </Link>
  );
}

const REVIEW_ICON = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
    <rect x="4" y="5" width="16" height="15" rx="3" stroke="currentColor" strokeWidth={2.5} />
    <path d="M4 10h16M9 3v4M15 3v4" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
  </svg>
);

const PRACTICE_ICON = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
    <path
      d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Bold panel with a ring that fills toward today's goal, and a link to change the goal.
function DailyGoal({ done, goal }: { done: number; goal: number }) {
  const reached = done >= goal;
  const left = goal - done;
  const circumference = 2 * Math.PI * 26;
  const filled = Math.min(done / goal, 1) * circumference;
  return (
    <div className="flex items-center gap-5 rounded-[28px] bg-honey p-5 text-charcoal">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-charcoal/80">Today</p>
        <p className="mt-0.5 font-display text-3xl leading-tight font-bold">
          {reached ? "Goal reached" : `${left} ${left === 1 ? "session" : "sessions"} to go`}
        </p>
        <Link
          href="/settings"
          className="mt-2 inline-block rounded-full text-sm font-semibold text-charcoal/80 underline-offset-4 hover:text-charcoal hover:underline"
        >
          Daily goal: {goal} · Change
        </Link>
      </div>
      <div className="relative h-20 w-20 shrink-0">
        <svg viewBox="0 0 64 64" className="h-20 w-20 -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r="26" fill="none" strokeWidth="8" className="stroke-charcoal/15" />
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            className="stroke-fern-dark transition-all duration-500"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold">
          {Math.min(done, goal)}/{goal}
        </span>
        <span className="sr-only">
          {Math.min(done, goal)} of {goal} {goal === 1 ? "session" : "sessions"} today
        </span>
      </div>
    </div>
  );
}

// A compact card linking to a review or practice session; muted and not clickable when empty.
function SessionCard({
  href,
  title,
  subtitle,
  count,
  icon,
  iconStyle,
}: {
  href: string;
  title: string;
  subtitle: string;
  count: number;
  icon: React.ReactNode;
  iconStyle: string;
}) {
  const content = (
    <>
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-2xl ${count > 0 ? iconStyle : "bg-cream text-line-strong"}`}
      >
        {icon}
      </span>
      <span className="mt-4 block font-display text-xl font-bold text-ink">{title}</span>
      <span className="block text-sm text-muted">{subtitle}</span>
    </>
  );
  const card = "rounded-[28px] bg-surface p-4";
  if (count === 0) return <div className={card}>{content}</div>;
  return (
    <Link
      href={href}
      className={`${card} transition hover:bg-line/70 active:scale-[0.97]`}
    >
      {content}
    </Link>
  );
}

export default function LessonPath() {
  const units = getUnits();
  const progress = useProgress();
  const { completedLessons, mistakes, reviews, checkpoints } = progress;
  const loaded = useProgressLoaded();
  // Ignore saved mistakes for signs that have since been removed from data/signs.json.
  const mistakeCount = mistakes.filter((id) => getSign(id) !== undefined).length;
  const learnedCount = getLearnedSignIds(completedLessons).length;
  const dueCount = dueSignIds(reviews, getLearnedSignIds(completedLessons)).length;

  // Lessons unlock in order across all units: the first unfinished one is current.
  const currentId = units
    .flatMap((unit) => unit.lessons)
    .find((lesson) => !completedLessons.includes(lesson.id))?.id;

  function stateOf(lessonId: string): LessonState {
    if (completedLessons.includes(lessonId)) return "completed";
    return lessonId === currentId ? "current" : "locked";
  }

  return (
    <div className={`flex flex-col gap-10 ${loaded ? "motion-safe:animate-fade-in" : "invisible"}`}>
      <div className="flex flex-col gap-3">
        <DailyGoal done={sessionsToday(progress)} goal={progress.dailyGoal} />
        <div className="grid grid-cols-2 gap-3">
          <SessionCard
            href="/review"
            title="Review"
            subtitle={
              dueCount > 0
                ? `${dueCount} ${dueCount === 1 ? "sign" : "signs"} due`
                : learnedCount > 0
                  ? "All caught up"
                  : "Unlocks as you learn"
            }
            count={dueCount}
            icon={REVIEW_ICON}
            iconStyle="bg-fern text-charcoal"
          />
          <SessionCard
            href="/practice"
            title="Mistakes"
            subtitle={
              mistakeCount > 0
                ? `${mistakeCount} ${mistakeCount === 1 ? "sign" : "signs"} to practice`
                : "None right now"
            }
            count={mistakeCount}
            icon={PRACTICE_ICON}
            iconStyle="bg-peony text-charcoal"
          />
        </div>
      </div>
      {units.map((unit, unitIndex) => {
        const theme = UNIT_THEMES[unitIndex % UNIT_THEMES.length];
        const done = unit.lessons.filter((lesson) => completedLessons.includes(lesson.id)).length;
        const complete = done === unit.lessons.length;
        // A unit that hasn't been started and isn't next up can be skipped to with a test.
        const canSkipTo =
          unitIndex > 0 && done === 0 && !unit.lessons.some((lesson) => lesson.id === currentId);
        return (
          <section key={unit.id}>
            <div className={`rounded-[28px] px-6 py-5 text-charcoal ${theme.block}`}>
              <p className="text-sm font-semibold">
                Unit {unitIndex + 1} · {unit.lessons.length} lessons ·{" "}
                {unit.lessons.reduce((total, lesson) => total + lesson.signIds.length, 0)} signs
              </p>
              <h1 className="mt-1 font-display text-4xl leading-none font-bold">{unit.title}</h1>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-charcoal/15">
                  <div
                    className="h-full rounded-full bg-charcoal transition-all duration-500"
                    style={{ width: `${(done / unit.lessons.length) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold">
                  {complete ? "Complete" : `${done}/${unit.lessons.length}`}
                </span>
              </div>
              {complete && checkpoints.includes(unit.id) && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-charcoal px-3 py-1 text-sm font-bold text-cream">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-honey" aria-hidden="true">
                    <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z" />
                  </svg>
                  Mastered
                </p>
              )}
              {complete && !checkpoints.includes(unit.id) && (
                <Link href={`/checkpoint/${unit.id}`} className={BANNER_BUTTON}>
                  Take the checkpoint
                </Link>
              )}
              {canSkipTo && (
                <Link href={`/skip/${unit.id}`} className={BANNER_BUTTON}>
                  Skip to here
                </Link>
              )}
            </div>

            <ol className="mt-10 flex flex-col items-center gap-5">
              {unit.lessons.map((lesson, lessonIndex) => {
                const state = stateOf(lesson.id);
                const isLast = lessonIndex === unit.lessons.length - 1;
                return (
                  <li
                    key={lesson.id}
                    className={`flex flex-col items-center ${PATH_OFFSETS[lessonIndex % PATH_OFFSETS.length]}`}
                  >
                    <LessonNode
                      lesson={lesson}
                      number={lessonIndex + 1}
                      state={state}
                      theme={theme}
                    />
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className={`mt-5 flex flex-col gap-2 ${CONNECTOR_OFFSETS[lessonIndex % CONNECTOR_OFFSETS.length]}`}
                      >
                        {[0, 1, 2].map((dot) => (
                          <span
                            key={dot}
                            className={`h-2.5 w-2.5 rounded-full ${state === "completed" ? theme.dot : "bg-line-strong"}`}
                          />
                        ))}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
