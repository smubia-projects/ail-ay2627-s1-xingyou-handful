import Link from "next/link";
import HeaderStats from "@/components/HeaderStats";

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-sand bg-cream/85 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-2 px-5 py-4">
        <Link href="/" className="flex items-center gap-2 rounded-xl">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sage text-sm font-extrabold text-white shadow-[0_3px_0_0_var(--color-sage-dark)]">
            S
          </span>
          <span className="text-xl font-extrabold tracking-tight text-sage-dark">SignPath</span>
        </Link>
        <HeaderStats />
      </div>
    </header>
  );
}
