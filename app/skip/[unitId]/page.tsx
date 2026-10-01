import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SessionStart from "@/components/SessionStart";
import {
  getUnit,
  getUnits,
  getUnitsBefore,
  getUnitSigns,
  TEST_PASS_MARK,
  TEST_QUESTIONS,
} from "@/lib/content";

export const dynamicParams = false;

// The first unit has nothing before it to skip.
export function generateStaticParams() {
  return getUnits()
    .slice(1)
    .map((unit) => ({ unitId: unit.id }));
}

export async function generateMetadata({ params }: PageProps<"/skip/[unitId]">): Promise<Metadata> {
  const { unitId } = await params;
  return { title: `Skip to ${getUnit(unitId)?.title ?? "unit"} · Handful` };
}

// A test on everything before a unit. Passing marks those lessons done, so learners who already
// know some ASL can start further along the path.
export default async function SkipPage({ params }: PageProps<"/skip/[unitId]">) {
  const { unitId } = await params;
  const unit = getUnit(unitId);
  const earlier = getUnitsBefore(unitId);
  if (!unit || earlier.length === 0) notFound();
  const signs = earlier.flatMap((earlierUnit) => getUnitSigns(earlierUnit));

  return (
    <SessionStart
      mode="skip"
      unitId={unit.id}
      title={`Skip to ${unit.title}`}
      description={`Already know some ASL? Answer ${TEST_QUESTIONS} questions on the units before ${unit.title}. Get ${Math.round(TEST_PASS_MARK * 100)}% right on the first try and those lessons are marked as done.`}
      emptyText="There is nothing to skip."
      loaded
      listSigns={false}
      signs={signs}
      icon={
        <span
          key="icon"
          className="mt-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-bluebell text-charcoal"
        >
          <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" aria-hidden="true">
            <path
              d="M5 6l7 6-7 6M13 6l7 6-7 6"
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
