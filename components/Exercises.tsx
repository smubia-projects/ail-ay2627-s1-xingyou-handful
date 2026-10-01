"use client";

import { useEffect, useState } from "react";
import { BodyDiagram, HandshapeImage, LOCATION_LABELS, type Sign } from "@/components/SignCard";

export type Exercise =
  | { type: "meaning"; sign: Sign; options: Sign[] }
  | { type: "pick-sign"; sign: Sign; options: Sign[] }
  | { type: "match"; signs: Sign[]; words: Sign[] }
  | { type: "sign-it"; sign: Sign }
  // letters are the letter signs that spell the word; options are words to choose from.
  | { type: "spell"; word: string; letters: Sign[]; options: string[] };

type Status = "answering" | "correct" | "wrong";
// Reports whether the exercise was right first time, and which signs the learner got wrong.
export type OnDone = (correct: boolean, missedSignIds: string[]) => void;
type ChoiceState = "idle" | "selected" | "correct" | "wrong" | "done";

const CHOICE_STYLES: Record<ChoiceState, string> = {
  idle: "border-charcoal bg-cream hover:bg-white",
  selected: "border-charcoal bg-bluebell",
  correct: "border-charcoal bg-fern-soft",
  wrong: "border-charcoal bg-peony",
  done: "border-charcoal bg-cream opacity-40",
};

function choiceClass(state: ChoiceState, extra = "") {
  return `rounded-3xl border-2 p-3 font-semibold text-ink transition active:scale-[0.97] disabled:active:scale-100 ${CHOICE_STYLES[state]} ${extra}`;
}

// A sign as a looping video if one exists, otherwise its diagram and handshape.
function SignPicture({ sign, size }: { sign: Sign; size: "large" | "small" }) {
  if (sign.video) {
    return (
      <video
        src={sign.video}
        className="aspect-video w-full rounded-xl bg-surface object-contain"
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
      <div className="flex items-end justify-center gap-2">
        <HandshapeImage sign={sign} className={size === "large" ? "h-36 w-24" : "h-16 w-12"} />
        <BodyDiagram
          location={sign.location}
          motion={sign.motion}
          className={size === "large" ? "h-36 w-36" : "h-16 w-16"}
        />
      </div>
      <span
        className={
          size === "large"
            ? "text-center font-display text-xl font-bold text-ink"
            : "text-center text-xs font-semibold text-muted"
        }
      >
        {sign.handshape}
      </span>
      {size === "large" && <span className="text-center text-sm text-muted">{sign.movement}</span>}
    </div>
  );
}

function Prompt({ children }: { children: React.ReactNode }) {
  return <h1 className="font-display text-3xl leading-tight font-bold text-ink">{children}</h1>;
}

// Main action button. Give it a data-primary attribute so useEnterKey doesn't press it twice.
export const PRIMARY_BUTTON =
  "rounded-full border-2 border-charcoal bg-fern px-8 py-3 text-[1.2rem] font-bold text-charcoal transition hover:bg-fern-dark active:scale-[0.97]";

const SECONDARY_BUTTON =
  "rounded-full border-2 border-charcoal bg-cream px-6 py-3 text-[1.2rem] font-bold text-charcoal transition hover:bg-white active:scale-[0.97]";

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
      className={`fixed inset-x-0 bottom-0 border-t border-line px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${className}`}
    >
      <div className="mx-auto flex max-w-md flex-wrap items-center justify-between gap-3">
        {children}
      </div>
    </div>
  );
}

// Enter presses the screen's main button (Check / Continue), like Duolingo. A focused link, or the
// main button itself, already handles Enter, so those are left alone.
export function useEnterKey(onEnter: (() => void) | undefined) {
  useEffect(() => {
    if (!onEnter) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.repeat) return;
      const focused = document.activeElement;
      if (focused instanceof HTMLAnchorElement) return;
      if (focused instanceof HTMLElement && focused.dataset.primary !== undefined) return;
      event.preventDefault();
      onEnter?.();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onEnter]);
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
  useEnterKey(status === "answering" ? (canCheck ? onCheck : undefined) : onContinue);
  if (status === "answering" && !onCheck) return null;

  const background =
    status === "correct" ? "bg-fern-soft" : status === "wrong" ? "bg-peony" : "bg-cream";

  return (
    <BottomBar className={background}>
      <div role="status" aria-live="polite">
        {title && <p className="font-display text-2xl font-bold text-ink">{title}</p>}
        {detail && <p className="text-sm font-semibold text-charcoal">{detail}</p>}
      </div>
      <button
        type="button"
        data-primary
        disabled={status === "answering" && !canCheck}
        onClick={status === "answering" ? onCheck : onContinue}
        className={`ml-auto ${PRIMARY_BUTTON} disabled:border-line-strong disabled:bg-line disabled:text-muted disabled:active:scale-100`}
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
  onDone: OnDone;
}) {
  const { selected, setSelected, status, stateOf, check } = useMultipleChoice(sign.id);

  return (
    <>
      <Prompt>What does this sign mean?</Prompt>
      <div className="mt-6 rounded-3xl bg-fennel p-5">
        <SignPicture sign={sign} size="large" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={status !== "answering"}
            onClick={() => setSelected(option.id)}
            aria-pressed={stateOf(option.id) === "selected"}
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
        onContinue={() => onDone(status === "correct", status === "correct" ? [] : [sign.id])}
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
  onDone: OnDone;
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
            aria-pressed={stateOf(option.id) === "selected"}
            aria-label={`Option ${index + 1}: ${option.handshape}, ${LOCATION_LABELS[option.location].toLowerCase()}`}
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
        onContinue={() => onDone(status === "correct", status === "correct" ? [] : [sign.id])}
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
  onDone: OnDone;
}) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedSign, setSelectedSign] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrongPair, setWrongPair] = useState<{ word: string; sign: string } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);

  const done = matched.length === signs.length;

  function tryPair(wordId: string, signId: string) {
    setSelectedWord(null);
    setSelectedSign(null);
    if (wordId === signId) {
      setMatched((ids) => [...ids, wordId]);
    } else {
      setMistakes((count) => count + 1);
      // The sign whose word was paired wrongly is the one the learner doesn't know yet.
      setMissed((ids) => (ids.includes(wordId) ? ids : [...ids, wordId]));
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
              aria-pressed={selectedWord === word.id}
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
              aria-pressed={selectedSign === sign.id}
              aria-label={`Sign ${index + 1}: ${sign.handshape}, ${LOCATION_LABELS[sign.location].toLowerCase()}`}
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
        onContinue={() => onDone(mistakes === 0, missed)}
      />
    </>
  );
}

// "CAB" -> "Cab", for showing spelling words as choices.
function titleCase(word: string) {
  return word.charAt(0) + word.slice(1).toLowerCase();
}

// Reading fingerspelling: a row of letter handshapes, pick the word they spell.
function SpellExercise({
  word,
  letters,
  options,
  onDone,
}: {
  word: string;
  letters: Sign[];
  options: string[];
  onDone: OnDone;
}) {
  const { selected, setSelected, status, stateOf, check } = useMultipleChoice(word);

  return (
    <>
      <Prompt>What word is being fingerspelled?</Prompt>
      <div
        className="mt-6 flex flex-wrap items-end justify-center gap-x-1 gap-y-3 rounded-3xl bg-fennel p-4"
        data-spelled-word
      >
        {letters.map((letter, index) => (
          <HandshapeImage key={index} sign={letter} className="h-24 w-14" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={status !== "answering"}
            onClick={() => setSelected(option)}
            aria-pressed={stateOf(option) === "selected"}
            className={choiceClass(stateOf(option), "py-4 text-lg")}
          >
            {titleCase(option)}
          </button>
        ))}
      </div>
      <CheckBar
        status={status}
        title={status === "correct" ? "Nice!" : status === "wrong" ? "Not quite" : undefined}
        detail={status === "wrong" ? `Correct answer: ${titleCase(word)}` : undefined}
        canCheck={selected !== null}
        onCheck={check}
        // A misread word isn't pinned on any one letter, so no sign is marked as missed.
        onContinue={() => onDone(status === "correct", [])}
      />
    </>
  );
}

// The learner makes the sign themselves, reveals the answer, and rates how they did.
// There's no camera: this is honest self-checking, which is what makes producing signs stick.
function SignItExercise({ sign, onDone }: { sign: Sign; onDone: OnDone }) {
  const [revealed, setRevealed] = useState(false);
  useEnterKey(revealed ? undefined : () => setRevealed(true));

  return (
    <>
      <Prompt>Sign “{sign.word}”</Prompt>
      <p className="mt-2 text-muted">
        {revealed
          ? "Did your sign match? Be honest, it helps you learn."
          : "Make the sign yourself, then check how you did."}
      </p>
      {revealed ? (
        <div className="mt-6 rounded-3xl bg-fennel p-5">
          <SignPicture sign={sign} size="large" />
        </div>
      ) : (
        <div className="mt-6 flex h-56 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-line-strong text-center">
          <p className="font-display text-3xl font-bold text-ink">Your turn</p>
          <p className="mt-1 text-sm text-muted">Sign it now, no peeking</p>
        </div>
      )}
      <BottomBar className={revealed ? "bg-bluebell" : "bg-cream"}>
        {revealed ? (
          <>
            <button type="button" onClick={() => onDone(false, [sign.id])} className={SECONDARY_BUTTON}>
              Not yet
            </button>
            <button type="button" data-primary onClick={() => onDone(true, [])} className={PRIMARY_BUTTON}>
              Got it
            </button>
          </>
        ) : (
          <button
            type="button"
            data-primary
            onClick={() => setRevealed(true)}
            className={`ml-auto ${PRIMARY_BUTTON}`}
          >
            Show the sign
          </button>
        )}
      </BottomBar>
    </>
  );
}

// Shows one exercise of any type. onDone reports whether it was answered correctly.
export function ExerciseView({
  exercise,
  onDone,
}: {
  exercise: Exercise;
  onDone: OnDone;
}) {
  if (exercise.type === "meaning") {
    return <MeaningExercise sign={exercise.sign} options={exercise.options} onDone={onDone} />;
  }
  if (exercise.type === "pick-sign") {
    return <PickSignExercise sign={exercise.sign} options={exercise.options} onDone={onDone} />;
  }
  if (exercise.type === "sign-it") {
    return <SignItExercise sign={exercise.sign} onDone={onDone} />;
  }
  if (exercise.type === "spell") {
    return (
      <SpellExercise
        word={exercise.word}
        letters={exercise.letters}
        options={exercise.options}
        onDone={onDone}
      />
    );
  }
  return <MatchExercise signs={exercise.signs} words={exercise.words} onDone={onDone} />;
}
