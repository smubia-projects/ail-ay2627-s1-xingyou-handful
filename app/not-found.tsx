import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sand text-3xl font-extrabold text-muted shadow-[0_6px_0_0_var(--color-sand-dark)]">
        ?
      </span>
      <h1 className="mt-8 text-3xl font-extrabold text-ink">Page not found</h1>
      <p className="mt-2 text-muted">This page doesn’t exist. Let’s get you back to your lessons.</p>
      <Link
        href="/"
        className="mt-8 rounded-2xl bg-sage px-8 py-3 font-extrabold uppercase tracking-wide text-white shadow-[0_4px_0_0_var(--color-sage-dark)] transition active:translate-y-1 active:shadow-none"
      >
        Back home
      </Link>
    </main>
  );
}
