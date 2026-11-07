"use client";

import Link from "next/link";
import { useState } from "react";
import CameraCheck from "@/components/CameraCheck";
import { HandshapeImage } from "@/components/SignCard";
import { getSign } from "@/lib/content";
import { countPractice } from "@/lib/cta";
import { letterConfidence } from "@/lib/handshape";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// The switch between the letters page and the words page.
export function CameraTabs({ current }: { current: "letters" | "words" }) {
  const tab = (key: "letters" | "words", href: string, label: string) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={`flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold transition ${
        current === key ? "bg-charcoal text-cream" : "text-muted hover:text-charcoal"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Camera practice" className="mb-5 flex gap-1 rounded-full bg-fennel p-1" data-camera-tabs>
      {tab("letters", "/camera", "Letters")}
      {tab("words", "/camera/words", "Words")}
    </nav>
  );
}

export default function CameraPractice() {
  const [letter, setLetter] = useState("A");
  const sign = getSign(`letter-${letter.toLowerCase()}`);
  const moves = letter === "J" || letter === "Z";

  return (
    <div>
      <CameraTabs current="letters" />
      <h1 className="font-display text-4xl font-bold text-ink">Camera practice</h1>
      <p className="mt-2 text-muted">
        Practise fingerspelling with your camera. Handful looks at where your fingers are and tells you
        what to fix, like a practice partner. It can&apos;t judge signing the way a Deaf teacher can, so
        use it to practise, not as a grade.
      </p>

      <h2 className="mt-8 font-display text-2xl font-bold text-ink">Pick a letter</h2>
      <div className="mt-3 grid grid-cols-7 gap-2" role="radiogroup" aria-label="Letter to practise">
        {LETTERS.map((candidate) => {
          const selected = candidate === letter;
          const confidence = letterConfidence(candidate);
          return (
            <button
              key={candidate}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${candidate}${confidence === "tricky" ? ", tricky for the camera" : confidence === "unconfirmed" ? ", not yet checked against real hands" : confidence === "learned" ? ", checked on a public set of real hands" : ""}`}
              onClick={() => setLetter(candidate)}
              className={`relative flex aspect-square items-center justify-center rounded-2xl border-2 font-display text-xl font-bold text-ink transition ${
                selected ? "border-charcoal bg-bluebell" : "border-charcoal/25 bg-cream hover:border-charcoal"
              }`}
            >
              {candidate}
              <span
                className={`absolute right-1 bottom-1 h-2 w-2 rounded-full ${
                  confidence === "tricky"
                    ? "bg-honey ring-1 ring-charcoal"
                    : confidence === "unconfirmed"
                      ? "border border-charcoal bg-cream"
                      : confidence === "learned"
                        ? "bg-bluebell ring-1 ring-charcoal"
                        : "bg-fern"
                }`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-fern" aria-hidden="true" /> Checked on real signers
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-bluebell ring-1 ring-charcoal" aria-hidden="true" /> Checked on a public set of real hands
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-charcoal bg-cream" aria-hidden="true" /> Not checked on real hands yet
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-honey ring-1 ring-charcoal" aria-hidden="true" /> Tricky: the camera can&apos;t be sure
        </span>
      </p>

      <div className="mt-6 flex items-center gap-4 rounded-[28px] bg-white p-4 ring-1 ring-line-strong">
        {sign && <HandshapeImage sign={sign} className="h-28 w-20 shrink-0" />}
        <div>
          <p className="font-display text-3xl font-bold text-ink">Make the letter {letter}</p>
          <p className="mt-1 text-sm text-muted">{sign?.handshape}.</p>
          {moves && <p className="mt-1 text-sm text-muted">This letter also moves, which the camera doesn&apos;t check.</p>}
        </div>
      </div>

      <div className="mt-4">
        <CameraCheck letter={letter} onMatch={countPractice} />
      </div>
    </div>
  );
}
