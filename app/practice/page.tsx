"use client";

import SessionStart from "@/components/SessionStart";
import type { Sign } from "@/components/SignCard";
import { getSign } from "@/lib/content";
import { useProgress, useProgressLoaded } from "@/lib/progress";

const MAX_PRACTICE_SIGNS = 5;

export default function PracticePage() {
  const { mistakes } = useProgress();
  const loaded = useProgressLoaded();

  const signs = mistakes
    .map((id) => getSign(id))
    .filter((sign): sign is Sign => sign !== undefined)
    .slice(0, MAX_PRACTICE_SIGNS);

  return (
    <SessionStart
      mode="practice"
      title="Practice mistakes"
      description={`A quick round on ${signs.length === 1 ? "the sign" : `the ${signs.length} signs`} you missed most recently. A sign leaves your list once you get all its questions right the first time.`}
      emptyText="No mistakes to review. Nice work!"
      loaded={loaded}
      signs={signs}
      icon={
        <span className="mt-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-peach-light text-peach-dark">
          <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" aria-hidden="true">
            <path
              d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      }
    />
  );
}
