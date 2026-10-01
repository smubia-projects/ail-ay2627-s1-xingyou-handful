"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Learn",
    icon: (
      <path
        d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/signs",
    label: "My signs",
    icon: (
      <path
        d="M5 4.5h10.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10.5M9 8.5h5.5"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

// Tab bar for the main screens (not shown inside lessons, which have their own bottom bar).
export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-sand bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-extrabold uppercase tracking-wide transition ${
                  active ? "text-sage-dark" : "text-muted hover:text-ink"
                }`}
              >
                <span
                  className={`flex h-9 w-14 items-center justify-center rounded-2xl ${active ? "bg-sage-light" : ""}`}
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                    {tab.icon}
                  </svg>
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
