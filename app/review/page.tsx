"use client";

import SessionStart from "@/components/SessionStart";
import type { Sign } from "@/components/SignCard";
import { getLearnedSignIds, getSign } from "@/lib/content";
import { dueSignIds, useProgress, useProgressLoaded } from "@/lib/progress";

const MAX_REVIEW_SIGNS = 8;

export default function ReviewPage() {
  const { completedLessons, reviews } = useProgress();
  const loaded = useProgressLoaded();

  const signs = dueSignIds(reviews, getLearnedSignIds(completedLessons))
    .map((id) => getSign(id))
    .filter((sign): sign is Sign => sign !== undefined)
    .slice(0, MAX_REVIEW_SIGNS);

  return (
    <SessionStart
      mode="review"
      title="Review"
      description="Signs you learned a while ago, brought back before you forget them. Get one right and it waits longer before coming back."
      emptyText="Nothing to review right now. Signs come back here a few days after you learn them."
      loaded={loaded}
      signs={signs}
      icon={
        <span className="mt-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand text-white">
          <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" aria-hidden="true">
            <rect x="4" y="5" width="16" height="15" rx="3" stroke="currentColor" strokeWidth={2.5} />
            <path d="M4 10h16M9 3v4M15 3v4" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
          </svg>
        </span>
      }
    />
  );
}
