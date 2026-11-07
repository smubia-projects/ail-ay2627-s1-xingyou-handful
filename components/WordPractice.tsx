"use client";

import { useState } from "react";
import { CameraTabs } from "@/components/CameraPractice";
import SignVideo from "@/components/SignVideo";
import WordCameraCheck, { checkableWordIds } from "@/components/WordCameraCheck";
import { getSign } from "@/lib/content";
import { countPractice } from "@/lib/cta";

// The words the camera can check, in alphabetical order, each with its Signbank video.
const WORDS = checkableWordIds()
  .map((id) => getSign(id))
  .filter((sign): sign is NonNullable<typeof sign> => Boolean(sign))
  .sort((a, b) => a.word.localeCompare(b.word));

export default function WordPractice() {
  const [signId, setSignId] = useState(WORDS[0]?.id ?? "");
  const sign = WORDS.find((word) => word.id === signId);

  return (
    <div>
      <CameraTabs current="words" />
      <h1 className="font-display text-4xl font-bold text-ink">Camera practice: words</h1>
      <p className="mt-2 text-muted">
        Practise a word with your camera. Watch the video, then sign it once and lower your hand. Handful checks your hand
        shape and which way your hand turns, and tells you what to fix. It&apos;s a practice partner, not a grade.
      </p>

      <h2 className="mt-8 font-display text-2xl font-bold text-ink">Pick a word</h2>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Word to practise">
        {WORDS.map((word) => (
          <button
            key={word.id}
            type="button"
            role="radio"
            aria-checked={word.id === signId}
            onClick={() => setSignId(word.id)}
            data-word-choice={word.id}
            className={`rounded-full border-2 px-4 py-2 font-display text-lg font-bold text-ink transition ${
              word.id === signId ? "border-charcoal bg-bluebell" : "border-charcoal/25 bg-cream hover:border-charcoal"
            }`}
          >
            {word.word}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        These are the only words the camera can check reliably. Each was tried on a real learner and tested against other
        gestures, including waves. Other words don&apos;t have camera practice, because the check follows one hand and can&apos;t
        see where your hand is on your body or tell small movements from a still hand.
      </p>

      {sign && (
        <>
          <div className="mt-6" data-word-practice={sign.id}>
            <p className="font-display text-3xl font-bold text-ink">Make the sign for {sign.word}</p>
            <p className="mt-1 text-sm text-muted">
              {sign.handshape}. {sign.movement}.
            </p>
            <SignVideo sign={sign} label={`Video of the sign for ${sign.word}`} credit="link" className="mt-3" />
          </div>
          <div className="mt-4">
            {/* Starting over for each word, so the last result never carries across. */}
            <WordCameraCheck key={sign.id} signId={sign.id} word={sign.word} onMatch={countPractice} />
          </div>
        </>
      )}
    </div>
  );
}
