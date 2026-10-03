"use client";

import { useState } from "react";
import { LogoMark } from "@/components/AppHeader";
import { PRIMARY_BUTTON } from "@/components/Exercises";
import SignVideo from "@/components/SignVideo";
import { getSign } from "@/lib/content";
import {
  DAILY_GOALS,
  setDailyGoal,
  setLeftHanded,
  setOnboarded,
  useProgress,
  useProgressLoaded,
} from "@/lib/progress";

const GOAL_LABELS: Record<number, string> = { 1: "Casual", 2: "Regular", 3: "Serious", 5: "Intense" };
const STEPS = 3;

function Choice({
  selected,
  onClick,
  title,
  detail,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  detail?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`rounded-3xl border-2 p-3 text-left transition ${
        selected ? "border-charcoal bg-bluebell" : "border-charcoal/25 bg-cream hover:border-charcoal"
      }`}
    >
      <span className="block font-display text-lg font-bold text-ink">{title}</span>
      {detail && <span className="block text-sm text-muted">{detail}</span>}
    </button>
  );
}

// Shown once to a new learner, over the home page: what Handful is, how mirror view works
// (with the signing hand), and a daily goal. Everything chosen here can be changed in Settings.
export default function Welcome() {
  const progress = useProgress();
  const loaded = useProgressLoaded();
  const [step, setStep] = useState(0);
  const hello = getSign("hello");

  if (!loaded || progress.onboarded) return null;

  const last = step === STEPS - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Handful"
      className="fixed inset-0 z-30 overflow-y-auto bg-cream"
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pt-6 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, index) => (
              <span
                key={index}
                className={`h-2 rounded-full transition-all ${index === step ? "w-8 bg-charcoal" : "w-2 bg-line-strong"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={setOnboarded}
            className="rounded-full px-3 py-1 text-sm font-semibold text-muted hover:text-charcoal"
          >
            Skip
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-center py-8">
          {step === 0 && (
            <>
              <LogoMark className="h-16 w-16" />
              <h1 className="mt-6 font-display text-5xl leading-tight font-bold text-ink">
                Welcome to Handful
              </h1>
              <p className="mt-3 text-lg text-muted">Learn ASL, a small handful of signs a day.</p>
              <p className="mt-2 text-sm text-muted">
                An early version: the sign descriptions are drafts that a Deaf ASL signer hasn&apos;t checked yet.
              </p>
              <ul className="mt-8 space-y-3 text-ink">
                {[
                  "Short lessons with videos of real signers",
                  "Practice by recognising signs and making them yourself",
                  "Reviews that bring signs back before you forget them",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3 rounded-3xl bg-fennel px-4 py-3 font-semibold">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-fern" aria-hidden="true" />
                    {line}
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="font-display text-4xl leading-tight font-bold text-ink">
                Copy what you see
              </h1>
              <p className="mt-2 text-muted">
                Handful works like a mirror. Pick the hand you write with, and the signer’s hand shows
                on that side of the screen.
              </p>
              {hello && (
                <SignVideo
                  sign={hello}
                  label="Video of the sign for Hello"
                  credit="link"
                  className="mt-5"
                />
              )}
              <div className="mt-4 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Signing hand">
                <Choice
                  selected={!progress.leftHanded}
                  onClick={() => setLeftHanded(false)}
                  title="Right hand"
                />
                <Choice
                  selected={progress.leftHanded}
                  onClick={() => setLeftHanded(true)}
                  title="Left hand"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="font-display text-4xl leading-tight font-bold text-ink">
                Pick a daily goal
              </h1>
              <p className="mt-2 text-muted">
                A session is one lesson, review or practice round, a few minutes each. You can change
                this any time in Settings.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Daily goal">
                {DAILY_GOALS.map((goal) => (
                  <Choice
                    key={goal}
                    selected={progress.dailyGoal === goal}
                    onClick={() => setDailyGoal(goal)}
                    title={GOAL_LABELS[goal]}
                    detail={`${goal} ${goal === 1 ? "session" : "sessions"} a day`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="rounded-full px-4 py-3 font-bold text-muted hover:text-charcoal"
            >
              Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            data-primary
            onClick={last ? setOnboarded : () => setStep(step + 1)}
            className={PRIMARY_BUTTON}
          >
            {last ? "Start learning" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
