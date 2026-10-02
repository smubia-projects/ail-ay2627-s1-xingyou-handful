"use client";

import { createContext, useContext, useEffect, useState } from "react";
import CameraCheck from "@/components/CameraCheck";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/buttons";

export { PRIMARY_BUTTON };
import { BodyDiagram, HandshapeImage, LOCATION_LABELS, type Sign } from "@/components/SignCard";
import SignVideo from "@/components/SignVideo";

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
  correct: "border-charcoal bg-fern-soft motion-safe:animate-pop",
  wrong: "border-charcoal bg-peony motion-safe:animate-shake",
  done: "border-charcoal bg-cream opacity-40",
};

function choiceClass(state: ChoiceState, extra = "") {
  return `relative rounded-3xl border-2 p-3 font-semibold text-ink transition active:scale-[0.97] disabled:active:scale-100 ${CHOICE_STYLES[state]} ${extra}`;
}

function CheckMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" />
    </svg>
  );
}

// Small check or cross pinned to the corner of an answer tile once it has been marked.
function ChoiceBadge({ state }: { state: ChoiceState }) {
  if (state !== "correct" && state !== "wrong") return null;
  return (
    <span
      className={`absolute -top-2.5 -right-2.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-charcoal text-charcoal ${state === "correct" ? "bg-fern" : "bg-cream"}`}
    >
      {state === "correct" ? <CheckMark className="h-4 w-4" /> : <CrossMark className="h-4 w-4" />}
    </span>
  );
}

const PRAISE = ["Nice!", "Nailed it!", "Spot on!", "You got it!", "Yes!"];
const ENCOURAGEMENT = ["Not quite", "So close", "Almost"];
const pickOne = (words: string[]) => words[Math.floor(Math.random() * words.length)];

// What the session knows about the current question, for the feedback: how many first-try
// answers in a row came before it, and the XP a first-try answer earns (0 on a retry).
const FeedbackContext = createContext({ combo: 0, xp: 0 });

const CONFETTI_COLORS = ["bg-honey", "bg-bluebell", "bg-fern", "bg-peony", "bg-charcoal"];

// Confetti pieces that fly out from the centre of their (relative) parent, once.
// Hidden for people who have asked their device to reduce motion.
export function Confetti() {
  return (
    <span aria-hidden="true" className="motion-reduce:hidden">
      {Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const distance = i % 2 === 0 ? 150 : 105;
        const style = {
          "--dx": `${Math.round(Math.cos(angle) * distance)}px`,
          "--dy": `${Math.round(Math.sin(angle) * distance)}px`,
          "--spin": `${i % 2 === 0 ? 260 : -200}deg`,
          animationDelay: `${0.12 + (i % 4) * 0.03}s`,
        } as React.CSSProperties;
        return (
          <span
            key={i}
            style={style}
            className={`absolute top-1/2 left-1/2 h-3 w-3 animate-confetti opacity-0 ${i % 3 === 0 ? "rounded-full" : "rounded-sm"} ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`}
          />
        );
      })}
    </span>
  );
}

// The unmissable part: a big stamp in the middle of the screen, with confetti when it's right.
// It fades by itself and never blocks taps. Skipped entirely for reduced-motion users, who still
// get the colored bar, the tile badges and the message.
function ResultBurst({ correct }: { correct: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center motion-reduce:hidden"
    >
      <div className="relative animate-burst">
        {correct && <Confetti />}
        <span
          className={`relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-charcoal text-charcoal ${correct ? "bg-fern" : "bg-peony"}`}
        >
          {correct ? <CheckMark className="h-16 w-16" /> : <CrossMark className="h-16 w-16" />}
        </span>
      </div>
    </div>
  );
}

// A sign as a looping video if one exists, otherwise its diagram and handshape.
// video=false forces the drawing: answer choices must all look alike, or the one video among
// drawings gives the answer away. credit="text" is for questions (the link would name the answer).
// data-sign lets the automated tests tell which sign is showing; learners never see it.
function SignPicture({
  sign,
  size,
  video = true,
  credit = "none",
}: {
  sign: Sign;
  size: "large" | "small";
  video?: boolean;
  credit?: "link" | "text" | "none";
}) {
  if (sign.video && video) {
    return (
      <div data-sign={sign.id} className="w-full">
        <SignVideo sign={sign} label="Video of a sign" credit={credit} interactive={size === "large"} />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1" data-sign={sign.id}>
      <div className="flex items-end justify-center gap-2">
        <HandshapeImage sign={sign} className={size === "large" ? "h-36 w-24" : "h-16 w-12"} />
        <BodyDiagram
          location={sign.location}
          motion={sign.motion}
          className={size === "large" ? "h-36 w-36" : "h-16 w-16"}
        />
      </div>
      {/* The words are only needed for what the drawings can't show: a handshape with no
          drawing, or a movement (a still letter has neither to add). */}
      {!sign.handshapeImage && (
        <span
          className={
            size === "large"
              ? "text-center font-display text-xl font-bold text-ink"
              : "text-center text-xs font-semibold text-muted"
          }
        >
          {sign.handshape}
        </span>
      )}
      {size === "large" && (sign.motion || !sign.handshapeImage) && (
        <span className="text-center text-sm text-muted">{sign.movement}</span>
      )}
      {size === "large" && sign.face && (
        <span className="text-center text-sm font-semibold text-ink">Face: {sign.face}</span>
      )}
    </div>
  );
}

function Prompt({ children }: { children: React.ReactNode }) {
  return <h1 className="font-display text-3xl leading-tight font-bold text-ink">{children}</h1>;
}

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
  const { combo, xp } = useContext(FeedbackContext);
  if (status === "answering" && !onCheck) return null;

  const background =
    status === "correct" ? "bg-fern-soft" : status === "wrong" ? "bg-peony" : "bg-cream";
  const marked = status !== "answering";
  // This answer extends the run of first-try answers when it's right and not a retry.
  const run = status === "correct" && xp > 0 ? combo + 1 : 0;

  return (
    <BottomBar className={background}>
      {marked && <ResultBurst correct={status === "correct"} />}
      <div
        role="status"
        aria-live="polite"
        data-result={marked ? status : undefined}
        className="flex items-center gap-3"
      >
        {marked && (
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-charcoal text-charcoal ${status === "correct" ? "bg-fern" : "bg-cream"}`}
          >
            {status === "correct" ? <CheckMark className="h-6 w-6" /> : <CrossMark className="h-6 w-6" />}
          </span>
        )}
        <div>
          {title && <p className="font-display text-2xl font-bold text-ink">{title}</p>}
          {detail && <p className="text-sm font-semibold text-charcoal">{detail}</p>}
          {status === "correct" && (xp > 0 || run >= 2) && (
            <p className="mt-0.5 flex flex-wrap gap-1.5 text-xs font-bold text-charcoal">
              {xp > 0 && <span className="rounded-full bg-honey px-2 py-0.5">+{xp} XP</span>}
              {run >= 2 && <span className="rounded-full bg-bluebell px-2 py-0.5">{run} in a row!</span>}
            </p>
          )}
        </div>
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
  const [message, setMessage] = useState<string | undefined>(undefined);

  function stateOf(id: string): ChoiceState {
    if (status === "answering") return selected === id ? "selected" : "idle";
    if (id === answerId) return "correct";
    return id === selected ? "wrong" : "done";
  }

  function check() {
    const correct = selected === answerId;
    setStatus(correct ? "correct" : "wrong");
    setMessage(pickOne(correct ? PRAISE : ENCOURAGEMENT));
  }

  return { selected, setSelected, status, stateOf, check, message };
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
  const { selected, setSelected, status, stateOf, check, message } = useMultipleChoice(sign.id);

  return (
    <>
      <Prompt>What does this sign mean?</Prompt>
      <div className="mt-6 rounded-3xl bg-fennel p-5">
        <SignPicture sign={sign} size="large" credit="text" />
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
            <ChoiceBadge state={stateOf(option.id)} />
          </button>
        ))}
      </div>
      <CheckBar
        status={status}
        title={message}
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
  const { selected, setSelected, status, stateOf, check, message } = useMultipleChoice(sign.id);

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
            <SignPicture sign={option} size="small" video={options.every((o) => o.video)} />
            <ChoiceBadge state={stateOf(option.id)} />
          </button>
        ))}
      </div>
      <CheckBar
        status={status}
        title={message}
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
              <SignPicture sign={sign} size="small" video={signs.every((s) => s.video)} />
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
  const { selected, setSelected, status, stateOf, check, message } = useMultipleChoice(word);

  return (
    <>
      <Prompt>What word is being fingerspelled?</Prompt>
      <div
        className="mt-6 flex flex-wrap items-end justify-center gap-x-1 gap-y-3 rounded-3xl bg-fennel p-4"
        data-spelled-word
      >
        {letters.map((letter, index) => (
          <HandshapeImage key={index} sign={letter} className="h-24 w-14" mirror={false} />
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
            <ChoiceBadge state={stateOf(option)} />
          </button>
        ))}
      </div>
      <CheckBar
        status={status}
        title={message}
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
  // Letters can also be checked with the camera. It's optional and only gives feedback: the
  // learner still rates themselves, and a match just reveals the sign.
  const isLetter = sign.id.startsWith("letter-");
  const [camera, setCamera] = useState(false);
  // "sure" when the camera can tell this letter apart; "maybe" when it can't (like a fist letter).
  const [cameraMatched, setCameraMatched] = useState<"sure" | "maybe" | null>(null);
  useEnterKey(revealed || camera ? undefined : () => setRevealed(true));

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
          {cameraMatched === "sure" && (
            <p
              className="mb-3 rounded-2xl border-2 border-charcoal bg-fern px-4 py-2 font-display text-lg font-bold text-charcoal"
              data-camera-agrees
            >
              The camera agrees: that looked like {sign.word}!
            </p>
          )}
          {cameraMatched === "maybe" && (
            <p
              className="mb-3 rounded-2xl border-2 border-charcoal bg-honey px-4 py-2 font-display text-lg font-bold text-charcoal"
              data-camera-unsure
            >
              The finger shape fits {sign.word}, but the camera can&apos;t be sure. Compare it with the
              drawing.
            </p>
          )}
          <SignPicture sign={sign} size="large" credit="link" />
        </div>
      ) : camera ? (
        <div className="mt-6">
          <CameraCheck
            letter={sign.word}
            // A match is shown on the camera panel itself. The learner stays on it, to see the
            // checklist and compare, and reveals the sign when they choose.
            onMatch={({ certain }) => setCameraMatched(certain ? "sure" : "maybe")}
          />
        </div>
      ) : (
        <div className="mt-6 flex h-56 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-line-strong text-center">
          <p className="font-display text-3xl font-bold text-ink">Your turn</p>
          <p className="mt-1 text-sm text-muted">
            Use your <span className="hand-right-only">right</span>
            <span className="hand-left-only">left</span> hand. No peeking
          </p>
        </div>
      )}
      {isLetter && !revealed && !camera && (
        <button type="button" onClick={() => setCamera(true)} className={`mt-4 ${SECONDARY_BUTTON}`}>
          Check with my camera
        </button>
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
// combo and xp feed the feedback ("3 in a row!", "+5 XP").
export function ExerciseView({
  exercise,
  onDone,
  combo = 0,
  xp = 0,
}: {
  exercise: Exercise;
  onDone: OnDone;
  combo?: number;
  xp?: number;
}) {
  return (
    <FeedbackContext.Provider value={{ combo, xp }}>
      <ExerciseBody exercise={exercise} onDone={onDone} />
    </FeedbackContext.Provider>
  );
}

function ExerciseBody({ exercise, onDone }: { exercise: Exercise; onDone: OnDone }) {
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
