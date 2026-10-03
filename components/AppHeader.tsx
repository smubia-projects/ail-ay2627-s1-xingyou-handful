import Link from "next/link";
import HeaderStats from "@/components/HeaderStats";

// The app mark: a tiny version of the lesson path (same as the app icon).
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <rect width="512" height="512" rx="128" className="fill-fern" />
      <path
        d="M196 380 C 300 350, 330 300, 316 256 C 302 212, 190 190, 196 132"
        fill="none"
        strokeWidth="22"
        strokeLinecap="round"
        strokeDasharray="0 44"
        className="stroke-cream/70"
      />
      <circle cx="196" cy="380" r="50" className="fill-cream" />
      <circle cx="316" cy="256" r="50" className="fill-cream" />
      <circle cx="196" cy="132" r="50" className="fill-honey" />
    </svg>
  );
}

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center gap-2 px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2 rounded-xl" aria-label="Handful home">
          <LogoMark />
          <span className="flex flex-col">
            <span className="font-display text-2xl leading-none font-bold text-ink">handful</span>
            <span
              className="mt-0.5 text-[10px] leading-none font-semibold text-muted"
              data-early-label
              title="Early version: sign descriptions are drafts awaiting review by a Deaf ASL signer"
            >
              Early version
            </span>
          </span>
        </Link>
        <HeaderStats />
      </div>
    </header>
  );
}
