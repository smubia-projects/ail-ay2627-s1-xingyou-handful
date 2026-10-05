"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/buttons";
import { HandshapeImage } from "@/components/SignCard";
import { getSign } from "@/lib/content";
import { hasDoubleLetter, hasMovingLetter, spellOut } from "@/lib/spell";

// How long each letter is held while playing, and the extra pause between words.
const SPEEDS = { Slow: 1400, Normal: 900 } as const;
type Speed = keyof typeof SPEEDS;
const WORD_PAUSE = 1.6;
const EXAMPLES = ["Anna", "Sam", "Maya"];

export default function SpellIt() {
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState<Speed>("Normal");
  // The position (across all words) of the letter being shown while playing, or -1 when not playing.
  const [at, setAt] = useState(-1);

  const spelling = useMemo(() => spellOut(text), [text]);
  const letters = useMemo(
    () => spelling.words.flatMap((word, wordIndex) => word.map((letter, i) => ({ letter, wordIndex, first: i === 0 }))),
    [spelling],
  );
  const playing = at >= 0;

  // Playing steps through the letters, pausing a little longer when a new word starts.
  useEffect(() => {
    if (!playing) return;
    if (at >= letters.length - 1) {
      const done = setTimeout(() => setAt(-1), SPEEDS[speed]);
      return () => clearTimeout(done);
    }
    const next = letters[at + 1];
    const wait = SPEEDS[speed] * (next.first ? WORD_PAUSE : 1);
    const timer = setTimeout(() => setAt(at + 1), wait);
    return () => clearTimeout(timer);
  }, [at, playing, letters, speed]);

  let index = 0;
  const current = playing ? letters[at] : null;

  return (
    <div>
      <h1 className="font-display text-4xl font-bold text-ink">Spell it</h1>
      <p className="mt-2 text-muted">
        Type a name or a word and see how to fingerspell it, one letter at a time. Fingerspelling is how ASL spells out
        names and words that don&apos;t have a sign of their own.
      </p>

      <label htmlFor="spell-text" className="mt-6 block font-display text-xl font-bold text-ink">
        What do you want to spell?
      </label>
      <input
        id="spell-text"
        type="text"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setAt(-1);
        }}
        maxLength={60}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="For example: Anna"
        className="mt-2 w-full rounded-2xl border-2 border-charcoal bg-white px-4 py-3 text-lg text-ink placeholder:text-muted focus:outline-none focus-visible:ring-4 focus-visible:ring-bluebell"
      />

      {letters.length === 0 ? (
        <div className="mt-4" data-spell-empty>
          <p className="text-sm text-muted">Not sure what to type? Tap one to try it:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button key={example} type="button" onClick={() => setText(example)} className={SECONDARY_BUTTON}>
                {example}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setAt(playing ? -1 : 0)}
              className={PRIMARY_BUTTON}
              data-spell-play
            >
              {playing ? "Stop" : "Play"}
            </button>
            <div role="radiogroup" aria-label="Speed" className="flex gap-2">
              {(Object.keys(SPEEDS) as Speed[]).map((name) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={speed === name}
                  onClick={() => setSpeed(name)}
                  className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${
                    speed === name ? "border-charcoal bg-bluebell text-ink" : "border-charcoal/25 bg-cream text-muted hover:border-charcoal"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-5" data-spell-result>
            {spelling.words.map((word, wordIndex) => (
              <section key={wordIndex} aria-label={`Word ${wordIndex + 1}: ${word.join("")}`}>
                {spelling.words.length > 1 && (
                  <h2 className="mb-2 font-display text-lg font-bold text-ink">{word.join("")}</h2>
                )}
                <ol className="grid grid-cols-4 gap-2">
                  {word.map((letter) => {
                    const position = index++;
                    const sign = getSign(`letter-${letter.toLowerCase()}`);
                    const active = position === at;
                    return (
                      <li
                        key={position}
                        data-spell-letter={letter}
                        data-spell-current={active ? "true" : undefined}
                        className={`flex flex-col items-center rounded-2xl p-2 ring-2 transition ${
                          active ? "bg-bluebell ring-charcoal" : "bg-white ring-line-strong"
                        }`}
                      >
                        {sign && <HandshapeImage sign={sign} className="h-24 w-16" />}
                        <span className="mt-1 font-display text-xl font-bold text-ink">{letter}</span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>

          <p className="sr-only" aria-live="polite">
            {current ? `Letter ${current.letter}` : ""}
          </p>

          <div className="mt-5 space-y-2 rounded-2xl bg-fennel px-4 py-3 text-sm text-charcoal" data-spell-tips>
            <p>
              Use your main hand and keep it in one place near your shoulder. Change shape from letter to letter without
              moving your hand around.
            </p>
            {hasDoubleLetter(spelling.words) && (
              <p data-spell-tip="double">
                <span className="font-bold">Double letters:</span> sign the letter again with a small bounce of your hand, so
                the two are clearly separate.
              </p>
            )}
            {hasMovingLetter(spelling.words) && (
              <p data-spell-tip="moving">
                <span className="font-bold">J and Z move:</span> they are traced in the air. The picture shows the shape you
                start with.
              </p>
            )}
            {spelling.words.length > 1 && <p>Pause briefly between words.</p>}
          </div>
        </>
      )}

      {spelling.skipped.length > 0 && (
        <p className="mt-3 text-sm text-muted" data-spell-skipped>
          Left out, because only the letters A to Z can be spelled: {spelling.skipped.join(" ")}
        </p>
      )}
      {spelling.truncated && (
        <p className="mt-3 text-sm text-muted" data-spell-truncated>
          That was a long one, so only the first 30 letters are shown.
        </p>
      )}

      <p className="mt-8 text-sm text-muted">
        The pictures show your hand as you copy them, like looking in a mirror, and follow your Left hand or Right hand
        setting.{" "}
        <Link href="/camera" className="font-semibold text-charcoal underline underline-offset-2">
          Check your letters with the camera
        </Link>
        .
      </p>
    </div>
  );
}
