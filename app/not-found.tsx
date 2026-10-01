import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <span className="font-display text-8xl font-bold text-fern-dark">404</span>
      <h1 className="mt-4 font-display text-4xl font-bold text-ink">Page not found</h1>
      <p className="mt-2 text-muted">This page doesn’t exist. Let’s get you back to your lessons.</p>
      <Link
        href="/"
        className="mt-8 rounded-full border-2 border-charcoal bg-fern px-8 py-3 text-[1.2rem] font-bold text-charcoal transition hover:bg-fern-dark active:scale-[0.97]"
      >
        Back home
      </Link>
    </main>
  );
}
