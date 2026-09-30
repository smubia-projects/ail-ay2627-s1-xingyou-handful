"use client";

import { useState } from "react";
import { BodyDiagram, type Sign } from "@/components/SignCard";

export type Exercise =
  | { type: "meaning"; sign: Sign; options: Sign[] }
  | { type: "pick-sign"; sign: Sign; options: Sign[] }
  | { type: "match"; signs: Sign[]; words: Sign[] };

type Status = "answering" | "correct" | "wrong";
type ChoiceState = "idle" | "selected" | "correct" | "wrong" | "done";

const CHOICE_STYLES: Record<ChoiceState, string> = {
  idle: "border-sand bg-white shadow-[0_4px_0_0_var(--color-sand)] hover:bg-cream",
  selected: "border-sage bg-sage-light shadow-[0_4px_0_0_var(--color-sage)]",
  correct: "border-sage bg-sage-light shadow-[0_4px_0_0_var(--color-sage)]",
  wrong: "border-peach-dark bg-peach-light shadow-[0_4px_0_0_var(--color-peach-dark)]",
  done: "border-sand bg-white opacity-40",
};

function choiceClass(state: ChoiceState, extra = "") {
  return `rounded-2xl border-2 p-3 font-bold text-ink transition active:translate-y-0.5 disabled:active:translate-y-0 ${CHOICE_STYLES[state]} ${extra}`;
}

// A sign as a looping video if one exists, otherwise its diagram and handshape.
function SignPicture({ sign, size }: { sign: Sign; size: "large" | "small" }) {
  if (sign.video) {
    return (
      <video
        src={sign.video}
        className="aspect-video w-full rounded-xl bg-cream object-contain"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      />
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <BodyDiagram
        location={sign.location}
        className={size === "large" ? "h-40 w-40" : "h-20 w-20"}
      />
      <span className={size === "large" ? "font-bold text-ink" : "text-xs font-semibold text-muted"}>
        {sign.handshape}
      </span>
      {size === "large" && <span className="text-center text-sm text-muted">{sign.movement}</span>}
    </div>
  );
}

function Prompt({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl font-extrabold text-ink">{children}</h1>;
}

export const PRIMARY_BUTTON =
  "rounded-2xl bg-sage px-8 py-3 font-extrabold uppercase tracking-wide text-white shadow-[0_4px_0_0_var(--color-sage-dark)] transition active:translate-y-1 active:shadow-none";

// Bar fixed to the bottom of the screen, holding feedback and the main button.
export function BottomBar({
  className = "bg-cream",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 border-t-2 border-sand px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${className}`}
    >
      <div className="mx-auto flex max-w-md flex-wrap items-center justify-between gap-3">
        {children}
      </div>
    </div>
  );
}

// Duolingo-style bar: Check while answering, then feedback and Continue.
function CheckBar({
  status,
  title,
  detail,
  canCheck = false,
  onCheck,
  onContinue,
}: {
  status: Status;
  title?: string;
  detail?: string;
  canCheck?: boolean;
  onCheck?: () => void;
  onContinue: () => void;
}) {
  if (status === "answering" && !onCheck) return null;

  const background =
    status === "correct" ? "bg-sage-light" : status === "wrong" ? "bg-peach-light" : "bg-cream";
  const button =
    status === "wrong"
      ? "bg-peach text-ink shadow-[0_4px_0_0_var(--color-peach-dark)]"
      : "";

  return (
    <BottomBar className={background}>
      <div role="status" aria-live="polite">
        {title && <p className="text-lg font-extrabold text-ink">{title}</p>}
        {detail && <p className="text-sm font-semibold text-muted">{detail}</p>}
      </div>
      <button
        type="button"
        disabled={status === "answering" && !canCheck}
        onClick={status === "answering" ? onCheck : onContinue}
        className={`${PRIMARY_BUTTON} disabled:bg-sand disabled:text-muted disabled:shadow-none disabled:active:translate-y-0 ${button}`}
      >
        {status === "answering" ? "Check" : "Continue"}
      </button>
    </BottomBar>
  );
}

// Shared logic for the two multiple-choice exercises.
function useMultipleChoice(answerId: string) {
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("answering");

  function stateOf(id: string): ChoiceState {
    if (status === "answering") return selected === id ? "selected" : "idle";
    if (id === answerId) return "correct";
    return id === selected ? "wrong" : "done";
  }

  function check() {
    setStatus(selected === answerId ? "correct" : "wrong");
  }

  return { selected, setSelected, status, stateOf, check };
}

function MeaningExercise({
  sign,
  options,
  onDone,
}: {
  sign: Sign;
  options: Sign[];
  onDone: (correct: boolean) => void;
}) {
  const { selected, setSelected, status, stateOf, check } = useMultipleChoice(sign.id);

  return (
    <>
      <Prompt>What does this sign mean?</Prompt>
      <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-sand">
        <SignPicture sign={sign} size="large" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={status !== "answering"}
            onClick={() => setSelected(option.id)}
            className={choiceClass(stateOf(option.id), "py-4 text-lg")}
          >
            {option.word}
          </button>
        ))}
      </div>
      <CheckBar
        status={status}
        title={status === "correct" ? "Nice!" : status === "wrong" ? "Not quite" : undefined}
        detail={status === "wrong" ? `Correct answer: ${sign.word}` : undefined}
        canCheck={selected !== null}
        onCheck={check}
        onContinue={() => onDone(status === "correct")}
      />
    </>
  );
}

function PickSignExercise({
  sign,
  options,
  onDone,
}: {
  sign: Sign;
  options: Sign[];
  onDone: (correct: boolean) => void;
}) {
  const { selected, setSelected, status, stateOf, check } = useMultipleChoice(sign.id);

  return (
    <>
      <Prompt>Which is the sign for “{sign.word}”?</Prompt>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            disabled={status !== "answering"}
            onClick={() => setSelected(option.id)}
            aria-label={`Option ${index + 1}: ${option.handshape} at the ${option.location}`}
            className={choiceClass(stateOf(option.id))}
          >
            <SignPicture sign={option} size="small" />
          </button>
        ))}
      </div>
      <CheckBar
        status={status}
        title={status === "correct" ? "Nice!" : status === "wrong" ? "Not quite" : undefined}
        detail={status === "wrong" ? "The correct sign is highlighted in green" : undefined}
        canCheck={selected !== null}
        onCheck={check}
        onContinue={() => onDone(status === "correct")}
      />
    </>
  );
}

function MatchExercise({
  signs,
  words,
  onDone,
}: {
  signs: Sign[];
  words: Sign[];
  onDone: (correct: boolean) => void;
}) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedSign, setSelectedSign] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrongPair, setWrongPair] = useState<{ word: string; sign: string } | null>(null);
  const [mistakes, setMistakes] = useState(0);

  const done = matched.length === signs.length;

  function tryPair(wordId: string, signId: string) {
    setSelectedWord(null);
    setSelectedSign(null);
    if (wordId === signId) {
      setMatched((ids) => [...ids, wordId]);
    } else {
      setMistakes((count) => count + 1);
      setWrongPair({ word: wordId, sign: signId });
      setTimeout(() => setWrongPair(null), 500);
    }
  }

  function pickWord(id: string) {
    if (selectedSign) tryPair(id, selectedSign);
    else setSelectedWord(selectedWord === id ? null : id);
  }

  function pickSign(id: string) {
    if (selectedWord) tryPair(selectedWord, id);
    else setSelectedSign(selectedSign === id ? null : id);
  }

  function stateOf(id: string, selectedId: string | null, wrongId: string | undefined): ChoiceState {
    if (matched.includes(id)) return "done";
    if (wrongId === id) return "wrong";
    return selectedId === id ? "selected" : "idle";
  }

  return (
    <>
      <Prompt>Match the pairs</Prompt>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          {words.map((word) => (
            <button
              key={word.id}
              type="button"
              disabled={matched.includes(word.id) || wrongPair !== null}
              onClick={() => pickWord(word.id)}
              className={choiceClass(
                stateOf(word.id, selectedWord, wrongPair?.word),
                `flex-1 text-lg ${wrongPair?.word === word.id ? "motion-safe:animate-shake" : ""}`,
              )}
            >
              {word.word}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {signs.map((sign, index) => (
            <button
              key={sign.id}
              type="button"
              disabled={matched.includes(sign.id) || wrongPair !== null}
              onClick={() => pickSign(sign.id)}
              aria-label={`Sign ${index + 1}: ${sign.handshape} at the ${sign.location}`}
              className={choiceClass(
                stateOf(sign.id, selectedSign, wrongPair?.sign),
                wrongPair?.sign === sign.id ? "motion-safe:animate-shake" : "",
              )}
            >
              <SignPicture sign={sign} size="small" />
            </button>
          ))}
        </div>
      </div>
      <CheckBar
        status={done ? "correct" : "answering"}
        title={done ? (mistakes === 0 ? "Perfect!" : "All matched!") : undefined}
        detail={
          done && mistakes > 0 ? `${mistakes} wrong ${mistakes === 1 ? "try" : "tries"}` : undefined
        }
        onContinue={() => onDone(mistakes === 0)}
      />
    </>
  );
}

// Shows one exercise of any type. onDone reports whether it was answered correctly.
export function ExerciseView({
  exercise,
  onDone,
}: {
  exercise: Exercise;
  onDone: (correct: boolean) => void;
}) {
  if (exercise.type === "meaning") {
    return <MeaningExercise sign={exercise.sign} options={exercise.options} onDone={onDone} />;
  }
  if (exercise.type === "pick-sign") {
    return <PickSignExercise sign={exercise.sign} options={exercise.options} onDone={onDone} />;
  }
  return <MatchExercise signs={exercise.signs} words={exercise.words} onDone={onDone} />;
}
