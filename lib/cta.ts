// Engagement invitation: after a few finished lessons or camera checks, the learner is invited once
// to AI Lodge, the club that hosts Handful. It is not a limit. The counter lives in this browser's
// localStorage, is best-effort, and the app keeps working the same whether or not the invitation shows.

const SLUG = "ail-ay2627-s1-xingyou-handful";
const COUNT_KEY = `${SLUG}:practice`;
const SHOWN_KEY = `${SLUG}:cta-shown`;

// Past the first try-it-out burst, so the invitation lands on someone who has kept going.
const CTA_AFTER = 3;

export const CTA_EVENT = "handful:cta";

// localStorage can throw (Safari private mode, blocked storage); a dead counter must never break practice.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Best-effort only.
  }
}

// Counts one finished lesson, practice, review or test, or one camera check that matched.
// Fires the invitation at most once per browser.
export function countPractice() {
  const next = (parseInt(read(COUNT_KEY) ?? "", 10) || 0) + 1;
  write(COUNT_KEY, String(next));
  if (next >= CTA_AFTER && !read(SHOWN_KEY)) {
    write(SHOWN_KEY, "1");
    window.dispatchEvent(new CustomEvent(CTA_EVENT, { detail: { count: next } }));
  }
}
