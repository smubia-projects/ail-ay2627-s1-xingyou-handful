"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CTA_EVENT } from "@/lib/cta";

const LINKS = [
  { label: "Join AI Lodge", href: "https://www.smubia.com/ailodge", primary: true },
  { label: "Explore other projects", href: "https://www.smubia.com/Projects" },
  { label: "View on GitHub", href: "https://github.com/smubia-projects/ail-ay2627-s1-xingyou-handful" },
];

// Listens for the invitation event (see lib/cta.ts) and shows it once. It never blocks:
// "Maybe later", Escape or a click outside closes it, and the app carries on.
export default function CtaModal() {
  const [count, setCount] = useState<number | null>(null);
  const dismiss = useCallback(() => setCount(null), []);

  useEffect(() => {
    const onInvite = (event: Event) => setCount((event as CustomEvent<{ count: number }>).detail.count);
    window.addEventListener(CTA_EVENT, onInvite);
    return () => window.removeEventListener(CTA_EVENT, onInvite);
  }, []);

  if (count === null) return null;
  return <CtaDialog count={count} onDismiss={dismiss} />;
}

function CtaDialog({ count, onDismiss }: { count: number; onDismiss: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Keeps focus inside the card while it's open, and gives it back on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onDismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = cardRef.current?.querySelectorAll<HTMLElement>("a[href], button");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [onDismiss]);

  return (
    <div
      onClick={onDismiss}
      className="fixed inset-0 z-[1000] flex animate-fade-in items-center justify-center bg-charcoal/40 p-4 backdrop-blur-sm"
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cta-headline"
        aria-describedby="cta-description"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md animate-pop overflow-hidden rounded-[28px] border-2 border-charcoal bg-cream shadow-xl"
      >
        <div className="relative overflow-hidden border-b-2 border-charcoal bg-fennel px-7 pt-7 pb-6">
          <span className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-honey/60" aria-hidden="true" />
          <span className="absolute top-10 right-14 h-12 w-12 rounded-full bg-bluebell/70" aria-hidden="true" />
          <p className="relative text-xs font-bold tracking-[0.14em] text-fern-dark uppercase">Handful · AI Lodge</p>
          <h2 id="cta-headline" className="relative mt-2 font-display text-3xl font-bold leading-tight text-ink">
            You&apos;re getting the hang of it <span aria-hidden="true">🤟</span>
          </h2>
          <p id="cta-description" className="relative mt-2 text-sm leading-relaxed text-muted">
            {count} lessons and camera checks done. Handful tracks your hand right in the browser with MediaPipe and a
            small model trained to tell the fist letters apart. It was built by a student in SMU BIA&apos;s AI Lodge. Want
            to build something like it?
          </p>
        </div>

        <div className="flex flex-col gap-2.5 px-7 pt-5 pb-6">
          {LINKS.map(({ label, href, primary }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`relative flex items-center justify-center rounded-full border-2 border-charcoal px-6 py-3 font-bold text-charcoal transition active:scale-[0.97] ${
                primary ? "bg-fern hover:bg-fern-dark" : "bg-cream hover:bg-white"
              }`}
            >
              {label}
              <span className="absolute right-[18px] opacity-70" aria-hidden="true">
                →
              </span>
            </a>
          ))}
          <button
            ref={closeRef}
            type="button"
            onClick={onDismiss}
            className="mt-1 rounded-full px-4 py-2 text-sm font-semibold text-muted transition hover:text-charcoal"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
