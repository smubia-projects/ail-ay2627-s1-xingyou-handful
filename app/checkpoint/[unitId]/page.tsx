import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SessionStart from "@/components/SessionStart";
import { getUnit, getUnits, getUnitSigns, TEST_PASS_MARK, TEST_QUESTIONS } from "@/lib/content";

export const dynamicParams = false;

export function generateStaticParams() {
  return getUnits().map((unit) => ({ unitId: unit.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/checkpoint/[unitId]">): Promise<Metadata> {
  const { unitId } = await params;
  return { title: `${getUnit(unitId)?.title ?? "Unit"} checkpoint · Handful` };
}

// An optional test of a whole unit. Passing marks the unit as mastered.
export default async function CheckpointPage({ params }: PageProps<"/checkpoint/[unitId]">) {
  const { unitId } = await params;
  const unit = getUnit(unitId);
  if (!unit) notFound();
  const signs = getUnitSigns(unit);

  return (
    <SessionStart
      mode="checkpoint"
      unitId={unit.id}
      title={`${unit.title} checkpoint`}
      description={`${Math.min(TEST_QUESTIONS, signs.length)} questions on the signs in this unit. Get ${Math.round(TEST_PASS_MARK * 100)}% right on the first try to mark it as mastered.`}
      emptyText="This unit has no signs yet."
      loaded
      listSigns={false}
      signs={signs}
      icon={
        <span
          key="icon"
          className="mt-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-honey text-charcoal"
        >
          <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" aria-hidden="true">
            <path
              d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
          </svg>
        </span>
      }
    />
  );
}
