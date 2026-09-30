"use client";

import Link from "next/link";
import { getLessonSigns, getUnits, type Lesson } from "@/lib/content";
import { useProgress } from "@/lib/progress";

type LessonState = "completed" | "current" | "locked";

// Gentle zigzag so the lessons read as a winding path.
const PATH_OFFSETS = ["translate-x-0", "translate-x-14", "translate-x-0", "-translate-x-14"];
// Moves the connecting dots (relative to the lesson above them) halfway to the next lesson.
const CONNECTOR_OFFSETS = ["translate-x-7", "-translate-x-7", "-translate-x-7", "translate-x-7"];

const CIRCLE_STYLES: Record<LessonState, string> = {
  completed: "h-20 w-20 bg-sage text-white shadow-[0_6px_0_0_var(--color-sage-dark)] ring-sage-light",
  current: "h-24 w-24 bg-sage text-white shadow-[0_6px_0_0_var(--color-sage-dark)] ring-peach-light",
  locked: "h-20 w-20 bg-sand text-muted shadow-[0_6px_0_0_var(--color-sand-dark)] ring-transparent",
};

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

function LessonNode({ lesson, number, state }: { lesson: Lesson; number: number; state: LessonState }) {
  const words = getLessonSigns(lesson)
    .map((sign) => sign.word)
    .join(" · ");

  const content = (
    <>
      <span className="relative">
        {state === "current" && (
          <span className="absolute -top-12 left-1/2 -translate-x-1/2 motion-safe:animate-bob">
            <span className="block rounded-xl bg-white px-3 py-1.5 text-sm font-extrabold uppercase tracking-wide text-sage-dark shadow-sm ring-2 ring-sand">
              Start
            </span>
          </span>
        )}
        <span
          className={`flex items-center justify-center rounded-full text-2xl font-extrabold ring-8 transition ${CIRCLE_STYLES[state]} ${
            state === "locked" ? "" : "group-hover:brightness-105 group-active:translate-y-1 group-active:shadow-none"
          }`}
        >
          {state === "completed" ? <CheckIcon /> : state === "locked" ? <LockIcon /> : number}
        </span>
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

export default function LessonPath() {
  const units = getUnits();
  const { completedLessons } = useProgress();

  // Lessons unlock in order across all units: the first unfinished one is current.
  const currentId = units
    .flatMap((unit) => unit.lessons)
    .find((lesson) => !completedLessons.includes(lesson.id))?.id;

  function stateOf(lessonId: string): LessonState {
    if (completedLessons.includes(lessonId)) return "completed";
    return lessonId === currentId ? "current" : "locked";
  }

  return (
    <>
      {units.map((unit, unitIndex) => (
        <section key={unit.id}>
          <div className="rounded-3xl bg-sage-light px-6 py-5">
            <p className="text-xs font-extrabold uppercase tracking-widest text-sage-dark">
              Unit {unitIndex + 1}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-ink">{unit.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {unit.lessons.length} lessons ·{" "}
              {unit.lessons.reduce((total, lesson) => total + lesson.signIds.length, 0)} signs
            </p>
          </div>

          <ol className="mt-16 flex flex-col items-center gap-5">
            {unit.lessons.map((lesson, lessonIndex) => {
              const state = stateOf(lesson.id);
              const isLast = lessonIndex === unit.lessons.length - 1;
              return (
                <li
                  key={lesson.id}
                  className={`flex flex-col items-center ${PATH_OFFSETS[lessonIndex % PATH_OFFSETS.length]}`}
                >
                  <LessonNode lesson={lesson} number={lessonIndex + 1} state={state} />
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className={`mt-5 flex flex-col gap-2 ${CONNECTOR_OFFSETS[lessonIndex % CONNECTOR_OFFSETS.length]}`}
                    >
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className={`h-2.5 w-2.5 rounded-full ${state === "completed" ? "bg-sage" : "bg-sand-dark"}`}
                        />
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </>
  );
}
