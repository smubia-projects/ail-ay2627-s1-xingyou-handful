"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SECONDARY_BUTTON } from "@/components/buttons";
import { HandshapeImage } from "@/components/SignCard";
import { getSign } from "@/lib/content";
import { hasDoubleLetter, hasMovingLetter, spellOut } from "@/lib/spell";

const EXAMPLES = ["Anna", "Sam", "Maya"];

export default function SpellIt() {
  const [text, setText] = useState("");
  const spelling = useMemo(() => spellOut(text), [text]);

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
        onChange={(event) => setText(event.target.value)}
        maxLength={60}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="For example: Anna"
        className="mt-2 w-full rounded-2xl border-2 border-charcoal bg-white px-4 py-3 text-lg text-ink placeholder:text-muted focus:outline-none focus-visible:ring-4 focus-visible:ring-bluebell"
      />

      {spelling.words.length === 0 ? (
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
          <div className="mt-5 space-y-5" data-spell-result>
            {spelling.words.map((word, wordIndex) => (
              <section key={wordIndex} aria-label={`Word ${wordIndex + 1}: ${word.join("")}`}>
                {spelling.words.length > 1 && (
                  <h2 className="mb-2 font-display text-lg font-bold text-ink">{word.join("")}</h2>
                )}
                <ol className="grid grid-cols-4 gap-2">
                  {word.map((letter, position) => {
                    const sign = getSign(`letter-${letter.toLowerCase()}`);
                    return (
                      <li
                        key={position}
                        data-spell-letter={letter}
                        className="flex flex-col items-center rounded-2xl bg-white p-2 ring-2 ring-line-strong"
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
