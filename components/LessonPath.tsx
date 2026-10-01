"use client";

import Link from "next/link";
import { getLearnedSignIds, getLessonSigns, getSign, getUnits, type Lesson } from "@/lib/content";
import { dueSignIds, sessionsToday, useProgress, useProgressLoaded } from "@/lib/progress";

type LessonState = "completed" | "current" | "locked";

// Each unit gets its own soft accent, cycling if there are more units than colors.
type UnitTheme = { banner: string; circle: string; ring: string; dot: string; label: string };
const UNIT_THEMES: UnitTheme[] = [
  {
    banner: "bg-sage-light",
    circle: "bg-sage shadow-[0_6px_0_0_var(--color-sage-dark)]",
    ring: "ring-sage-light",
    dot: "bg-sage",
    label: "text-sage-dark",
  },
  {
    banner: "bg-clay-light",
    circle: "bg-clay shadow-[0_6px_0_0_var(--color-clay-dark)]",
    ring: "ring-clay-light",
    dot: "bg-clay",
    label: "text-clay-dark",
  },
  {
    banner: "bg-lavender-light",
    circle: "bg-lavender shadow-[0_6px_0_0_var(--color-lavender-dark)]",
    ring: "ring-lavender-light",
    dot: "bg-lavender",
    label: "text-lavender-dark",
  },
  {
    banner: "bg-ice-light",
    circle: "bg-ice shadow-[0_6px_0_0_var(--color-ice-dark)]",
    ring: "ring-ice-light",
    dot: "bg-ice",
    label: "text-ice-dark",
  },
];

// Gentle zigzag so the lessons read as a winding path.
const PATH_OFFSETS = ["translate-x-0", "translate-x-14", "translate-x-0", "-translate-x-14"];
// Moves the connecting dots (relative to the lesson above them) halfway to the next lesson.
const CONNECTOR_OFFSETS = ["translate-x-7", "-translate-x-7", "-translate-x-7", "translate-x-7"];

function circleStyle(state: LessonState, theme: UnitTheme) {
  if (state === "locked") {
    return "h-20 w-20 bg-sand text-muted shadow-[0_6px_0_0_var(--color-sand-dark)] ring-transparent";
  }
  const size = state === "current" ? "h-24 w-24 ring-peach-light" : `h-20 w-20 ${theme.ring}`;
  return `${size} ${theme.circle} text-white`;
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
        <span
          className={`mb-4 rounded-xl bg-white px-3 py-1.5 text-sm font-extrabold uppercase tracking-wide shadow-sm ring-2 ring-sand motion-safe:animate-bob ${theme.label}`}
        >
          Start
        </span>
      )}
        <span
          className={`flex items-center justify-center rounded-full text-2xl font-extrabold ring-8 transition ${circleStyle(state, theme)} ${
            state === "locked" ? "" : "group-hover:brightness-105 group-active:translate-y-1 group-active:shadow-none"
          }`}
        >
        {state === "completed" ? <CheckIcon /> : state === "locked" ? <LockIcon /> : number}
      </span>
      <h2 className={`mt-4 font-extrabold ${state === "locked" ? "text-muted" : "text-ink"}`}>
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

// Ring that fills toward today's goal, with a link to change the goal.
function DailyGoal({ done, goal }: { done: number; goal: number }) {
  const reached = done >= goal;
  const circumference = 2 * Math.PI * 18;
  const filled = Math.min(done / goal, 1) * circumference;
  return (
    <div className="flex items-center gap-4 rounded-3xl bg-white p-4 ring-1 ring-sand">
      <svg viewBox="0 0 44 44" className="h-12 w-12 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r="18" fill="none" strokeWidth="6" className="stroke-sand" />
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          className={`transition-all duration-500 ${reached ? "stroke-peach-dark" : "stroke-sage"}`}
        />
      </svg>
      <div className="flex-1">
        <p className="font-extrabold text-ink">{reached ? "Daily goal reached!" : "Daily goal"}</p>
        <p className="text-sm text-muted">
          {Math.min(done, goal)} of {goal} {goal === 1 ? "session" : "sessions"} today
        </p>
      </div>
      <Link
        href="/settings"
        className="rounded-xl px-2 py-1 text-sm font-extrabold text-sage-dark hover:bg-sage-light"
      >
        Change
      </Link>
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
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${count > 0 ? iconStyle : "bg-sand text-muted"}`}
      >
        {icon}
      </span>
      <span className="mt-3 block font-extrabold text-ink">{title}</span>
      <span className="block text-sm text-muted">{subtitle}</span>
    </>
  );
  const card = "rounded-3xl bg-white p-4 ring-1 ring-sand";
  if (count === 0) return <div className={card}>{content}</div>;
  return (
    <Link
      href={href}
      className={`${card} shadow-[0_4px_0_0_var(--color-sand)] transition hover:bg-cream active:translate-y-1 active:shadow-none`}
    >
      {content}
    </Link>
  );
}

export default function LessonPath() {
  const units = getUnits();
  const progress = useProgress();
  const { completedLessons, mistakes, reviews } = progress;
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
    <div className={`flex flex-col gap-12 ${loaded ? "motion-safe:animate-fade-in" : "invisible"}`}>
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
            iconStyle="bg-lavender-light text-lavender-dark"
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
            iconStyle="bg-peach-light text-peach-dark"
          />
        </div>
      </div>
      {units.map((unit, unitIndex) => {
        const theme = UNIT_THEMES[unitIndex % UNIT_THEMES.length];
        const done = unit.lessons.filter((lesson) => completedLessons.includes(lesson.id)).length;
        return (
          <section key={unit.id}>
            <div className={`rounded-3xl px-6 py-5 ${theme.banner}`}>
              <p className="text-xs font-extrabold uppercase tracking-widest text-ink">
                Unit {unitIndex + 1}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-ink">{unit.title}</h1>
              <p className="mt-1 text-sm text-muted">
                {unit.lessons.length} lessons ·{" "}
                {unit.lessons.reduce((total, lesson) => total + lesson.signIds.length, 0)} signs
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/80">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${theme.dot}`}
                    style={{ width: `${(done / unit.lessons.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-extrabold text-ink">
                  {done === unit.lessons.length ? "Complete" : `${done}/${unit.lessons.length}`}
                </span>
              </div>
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
                            className={`h-2.5 w-2.5 rounded-full ${state === "completed" ? theme.dot : "bg-sand-dark"}`}
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
