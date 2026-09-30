import HeaderStats from "@/components/HeaderStats";
import LessonPath from "@/components/LessonPath";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-sand bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sage text-sm font-extrabold text-white shadow-[0_3px_0_0_var(--color-sage-dark)]">
            S
          </span>
          <span className="text-xl font-extrabold tracking-tight text-sage-dark">SignPath</span>
          <HeaderStats />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col gap-12 px-5 py-8 pb-16">
        <LessonPath />
      </main>
    </div>
  );
}
