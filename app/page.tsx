import SignCard from "@/components/SignCard";
import { getLessonSigns, getSign, getUnits } from "@/lib/content";

// Gentle zigzag so the lessons read as a winding path.
const PATH_OFFSETS = ["translate-x-0", "translate-x-14", "translate-x-0", "-translate-x-14"];

export default function Home() {
  const units = getUnits();
  const hello = getSign("hello")!;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-sand bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sage text-sm font-extrabold text-white shadow-[0_3px_0_0_var(--color-sage-dark)]">
            S
          </span>
          <span className="text-xl font-extrabold tracking-tight text-sage-dark">SignPath</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col gap-12 px-5 py-8">
        {units.map((unit, unitIndex) => (
          <section key={unit.id}>
            <div className="rounded-3xl bg-sage-light px-6 py-5">
              <p className="text-xs font-extrabold uppercase tracking-widest text-sage-dark">
                Unit {unitIndex + 1}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-ink">{unit.title}</h1>
              <p className="mt-1 text-sm text-muted">
                {unit.lessons.length} lessons ·{" "}
                {unit.lessons.reduce((total, lesson) => total + lesson.signIds.length, 0)} signs
              </p>
            </div>

            <ol className="mt-10 flex flex-col items-center gap-10">
              {unit.lessons.map((lesson, lessonIndex) => (
                <li
                  key={lesson.id}
                  className={`flex flex-col items-center text-center ${PATH_OFFSETS[lessonIndex % PATH_OFFSETS.length]}`}
                >
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sage text-2xl font-extrabold text-white shadow-[0_6px_0_0_var(--color-sage-dark)] ring-8 ring-sage-light">
                    {lessonIndex + 1}
                  </span>
                  <h2 className="mt-4 font-extrabold text-ink">{lesson.title}</h2>
                  <p className="text-sm text-muted">
                    {getLessonSigns(lesson)
                      .map((sign) => sign.word)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ))}

        <section>
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-widest text-muted">
            Sign spotlight
          </h2>
          <SignCard sign={hello} />
        </section>
      </main>
    </div>
  );
}
