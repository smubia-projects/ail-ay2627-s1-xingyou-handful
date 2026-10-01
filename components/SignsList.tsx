"use client";

import Link from "next/link";
import { useState } from "react";
import SignCard, { BodyDiagram, type Sign } from "@/components/SignCard";
import { getLearnedSignIds, getLessonSigns, getSign, getUnits } from "@/lib/content";
import { dayKey, useProgress, useProgressLoaded, type Review } from "@/lib/progress";

const STRENGTH_LABELS = ["New", "Learning", "Learning", "Getting there", "Getting there", "Strong"];

// Five bars that fill as a sign moves up the review boxes.
function Strength({ review }: { review: Review | undefined }) {
  const box = review?.box ?? 0;
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((level) => (
          <span
            key={level}
            className={`h-3 w-1.5 rounded-full ${level <= box ? "bg-brand" : "bg-line-strong/60"}`}
          />
        ))}
      </span>
      <span className="text-xs font-semibold text-muted">{STRENGTH_LABELS[box]}</span>
    </span>
  );
}

function SignRow({
  sign,
  review,
  open,
  onToggle,
}: {
  sign: Sign;
  review: Review | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const due = !review || review.due <= dayKey();
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-3xl bg-surface p-3 text-left transition hover:bg-line/70 ${open ? "ring-2 ring-brand" : ""}`}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white">
          <BodyDiagram location={sign.location} className="h-10 w-10" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-display text-lg font-bold text-ink">{sign.word}</span>
            {due && (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                Review due
              </span>
            )}
          </span>
          <span className="block truncate text-sm text-muted">{sign.handshape}</span>
        </span>
        <Strength review={review} />
      </button>
      {open && (
        <div className="mt-2">
          <SignCard sign={sign} label="Your sign" />
        </div>
      )}
    </li>
  );
}

export default function SignsList() {
  const { completedLessons, reviews } = useProgress();
  const loaded = useProgressLoaded();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const learned = new Set(getLearnedSignIds(completedLessons));
  const total = getUnits().reduce(
    (sum, unit) => sum + unit.lessons.reduce((n, lesson) => n + lesson.signIds.length, 0),
    0,
  );
  const search = query.trim().toLowerCase();
  const noMatches =
    search !== "" &&
    ![...learned].some((id) => getSign(id)?.word.toLowerCase().includes(search));

  return (
    <div className={loaded ? "motion-safe:animate-fade-in" : "invisible"}>
      <h1 className="font-display text-4xl font-bold text-ink">My signs</h1>
      <p className="mt-1 text-muted">
        {learned.size} of {total} signs learned
      </p>

      {learned.size === 0 ? (
        <div className="mt-8 rounded-[28px] bg-surface p-6 text-center">
          <p className="font-display text-xl font-bold text-ink">Your sign collection starts here</p>
          <p className="mt-1 text-sm text-muted">
            Finish your first lesson and its signs will appear on this page.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full bg-brand px-6 py-3 font-bold text-white transition hover:bg-brand-dark active:scale-[0.97]"
          >
            Start learning
          </Link>
        </div>
      ) : (
        <>
          <label className="mt-6 block">
            <span className="sr-only">Search your signs</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your signs"
              className="w-full rounded-full border-0 bg-surface px-5 py-3.5 font-medium text-ink placeholder:text-muted focus:bg-white focus:ring-2 focus:ring-brand"
            />
          </label>

          {getUnits().map((unit) => {
            const unitSigns = unit.lessons.flatMap((lesson) => getLessonSigns(lesson));
            const learnedHere = unitSigns.filter((sign) => learned.has(sign.id));
            const shown = learnedHere.filter((sign) => sign.word.toLowerCase().includes(search));
            const lockedHere = unitSigns.length - learnedHere.length;
            if (search && shown.length === 0) return null;
            return (
              <section key={unit.id} className="mt-8">
                <h2 className="flex items-baseline justify-between font-display text-xl font-bold text-ink">
                  {unit.title}
                  <span className="font-sans text-sm font-semibold text-muted">
                    {learnedHere.length}/{unitSigns.length}
                  </span>
                </h2>
                {shown.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {shown.map((sign) => (
                      <SignRow
                        key={sign.id}
                        sign={sign}
                        review={reviews[sign.id]}
                        open={openId === sign.id}
                        onToggle={() => setOpenId(openId === sign.id ? null : sign.id)}
                      />
                    ))}
                  </ul>
                )}
                {!search && lockedHere > 0 && (
                  <p className="mt-2 rounded-3xl border-2 border-dashed border-line px-4 py-3 text-sm font-medium text-muted">
                    {lockedHere} more {lockedHere === 1 ? "sign" : "signs"} to unlock in this unit
                  </p>
                )}
              </section>
            );
          })}

          {noMatches && (
            <p className="mt-8 text-center text-muted">No learned signs match “{query.trim()}”.</p>
          )}
        </>
      )}
    </div>
  );
}
