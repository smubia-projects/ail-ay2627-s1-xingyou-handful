// Turns the 21 hand points from MediaPipe hand tracking into "what is this hand doing?" and
// checks that against what a fingerspelled letter needs. Pure logic with no camera, so it can be
// tested on its own (tests/handshape.test.mts).
//
// The points are MediaPipe "world landmarks": real-world 3D positions, so angles and distances
// don't depend on the video's shape or on which way the hand faces.
//   0 wrist | thumb 1-4 | index 5-8 | middle 9-12 | ring 13-16 | pinky 17-20
// Each finger runs knuckle (MCP), middle joint, tip-side joint, tip.

export type Point = { x: number; y: number; z: number };

export const FINGERS = ["index", "middle", "ring", "pinky"] as const;
export type Finger = (typeof FINGERS)[number];
export type FingerState = "extended" | "curved" | "curled";
export type ThumbState = "out" | "tucked";

const JOINTS: Record<Finger, [number, number, number, number]> = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};
const TIP: Record<Finger, number> = { index: 8, middle: 12, ring: 16, pinky: 20 };

// How far a finger's tip is from its knuckle, compared with the finger's length laid flat.
// Straight is about 1, a tight fist well under 0.6.
const EXTENDED_FROM = 0.9;
const CURVED_FROM = 0.62;
// Thumb tip to a fingertip, in palm widths, counts as touching.
const TOUCH_WITHIN = 0.42;
// Index to middle fingertip, in palm widths, counts as spread apart.
const APART_FROM = 0.5;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export type HandReading = {
  fingers: Record<Finger, FingerState>;
  thumb: ThumbState;
  // Which fingertip the thumb tip is touching, if any.
  touching: Finger | null;
  // True when the index and middle fingertips are spread apart.
  indexMiddleApart: boolean;
};

export function analyzeHand(points: Point[]): HandReading {
  const palmWidth = distance(points[5], points[17]) || 1;

  const fingers = {} as Record<Finger, FingerState>;
  for (const finger of FINGERS) {
    const [mcp, pip, dip, tip] = JOINTS[finger];
    const flat = distance(points[mcp], points[pip]) + distance(points[pip], points[dip]) + distance(points[dip], points[tip]);
    const ratio = distance(points[mcp], points[tip]) / flat;
    fingers[finger] = ratio >= EXTENDED_FROM ? "extended" : ratio >= CURVED_FROM ? "curved" : "curled";
  }

  // The thumb is "out" when it's straight and well away from the base of the index finger.
  const thumbFlat = distance(points[2], points[3]) + distance(points[3], points[4]);
  const thumbStraight = distance(points[2], points[4]) / thumbFlat >= 0.85;
  const thumbAway = distance(points[4], points[5]) / palmWidth >= 0.75;
  const thumb: ThumbState = thumbStraight && thumbAway ? "out" : "tucked";

  let touching: Finger | null = null;
  let closest = TOUCH_WITHIN;
  for (const finger of FINGERS) {
    const gap = distance(points[4], points[TIP[finger]]) / palmWidth;
    if (gap < closest) {
      closest = gap;
      touching = finger;
    }
  }

  const indexMiddleApart = distance(points[8], points[12]) / palmWidth >= APART_FROM;

  return { fingers, thumb, touching, indexMiddleApart };
}

type Want = FingerState | FingerState[];

export type LetterSpec = {
  fingers: Partial<Record<Finger, Want>>;
  thumb?: ThumbState;
  // The thumb tip must touch this fingertip; "none" means it must not touch any.
  touch?: Finger | "none";
  // Index and middle must be spread apart (true) or together (false).
  apart?: boolean;
  // Set for letters the camera tends to get wrong, with the reason.
  tricky?: string;
};

const FIST = "A, E, M, N, S and T are all fists. The camera sees a fist, not where the thumb is tucked.";
const SIDEWAYS = "This letter is the same finger shape as another letter, turned sideways or down. The camera checks fingers, not which way the hand faces.";
const CROSSED = "The crossed fingers are hard for the camera to see.";
const POINTING = "D and Z (and the number 1) share a finger shape: the index points up and the thumb rests on the other fingers.";
const HOOK = "A hooked finger sits between straight and curled, so it is easy to misread.";

const ALL_CURLED: Partial<Record<Finger, Want>> = { index: "curled", middle: "curled", ring: "curled", pinky: "curled" };

// What each letter needs, as far as finger positions go. The drawings show the full detail.
export const LETTER_SPECS: Record<string, LetterSpec> = {
  A: { fingers: ALL_CURLED, tricky: FIST },
  B: { fingers: { index: "extended", middle: "extended", ring: "extended", pinky: "extended" }, thumb: "tucked", apart: false },
  C: { fingers: { index: "curved", middle: "curved", ring: "curved", pinky: "curved" }, touch: "none" },
  D: { fingers: { index: "extended", middle: ["curved", "curled"], ring: ["curved", "curled"], pinky: ["curved", "curled"] }, touch: "middle", tricky: POINTING },
  E: { fingers: { index: ["curved", "curled"], middle: ["curved", "curled"], ring: ["curved", "curled"], pinky: ["curved", "curled"] }, thumb: "tucked", tricky: FIST },
  F: { fingers: { middle: "extended", ring: "extended", pinky: "extended" }, touch: "index" },
  G: { fingers: { index: "extended", middle: "curled", ring: "curled", pinky: "curled" }, thumb: "out", tricky: SIDEWAYS },
  H: { fingers: { index: "extended", middle: "extended", ring: "curled", pinky: "curled" }, apart: false, tricky: SIDEWAYS },
  I: { fingers: { index: "curled", middle: "curled", ring: "curled", pinky: "extended" }, thumb: "tucked" },
  J: { fingers: { index: "curled", middle: "curled", ring: "curled", pinky: "extended" }, thumb: "tucked" },
  K: { fingers: { index: "extended", middle: "extended", ring: "curled", pinky: "curled" }, apart: true, tricky: SIDEWAYS },
  L: { fingers: { index: "extended", middle: "curled", ring: "curled", pinky: "curled" }, thumb: "out" },
  M: { fingers: ALL_CURLED, tricky: FIST },
  N: { fingers: ALL_CURLED, tricky: FIST },
  O: { fingers: { middle: ["curved", "curled"], ring: ["curved", "curled"], pinky: ["curved", "curled"] }, touch: "index" },
  P: { fingers: { index: "extended", middle: "extended", ring: "curled", pinky: "curled" }, apart: true, tricky: SIDEWAYS },
  Q: { fingers: { index: "extended", middle: "curled", ring: "curled", pinky: "curled" }, thumb: "out", tricky: SIDEWAYS },
  R: { fingers: { index: "extended", middle: "extended", ring: "curled", pinky: "curled" }, apart: false, tricky: CROSSED },
  S: { fingers: ALL_CURLED, tricky: FIST },
  T: { fingers: ALL_CURLED, tricky: FIST },
  U: { fingers: { index: "extended", middle: "extended", ring: "curled", pinky: "curled" }, thumb: "tucked", apart: false },
  V: { fingers: { index: "extended", middle: "extended", ring: "curled", pinky: "curled" }, thumb: "tucked", apart: true },
  W: { fingers: { index: "extended", middle: "extended", ring: "extended", pinky: "curled" }, apart: true },
  X: { fingers: { index: "curved", middle: "curled", ring: "curled", pinky: "curled" }, tricky: HOOK },
  Y: { fingers: { index: "curled", middle: "curled", ring: "curled", pinky: "extended" }, thumb: "out" },
  Z: { fingers: { index: "extended", middle: "curled", ring: "curled", pinky: "curled" }, thumb: "tucked", tricky: POINTING },
};

export type Check = { label: string; ok: boolean; tip: string };

const NAMES: Record<Finger, string> = { index: "Index finger", middle: "Middle finger", ring: "Ring finger", pinky: "Little finger" };

const allowed = (want: Want): FingerState[] => (Array.isArray(want) ? want : [want]);

function fingerTip(finger: Finger, state: FingerState, want: Want): string {
  const wanted = allowed(want);
  const name = NAMES[finger].toLowerCase();
  if (wanted.includes("extended")) return `Straighten your ${name}`;
  if (wanted.length === 1 && wanted[0] === "curved") {
    return state === "extended" ? `Bend your ${name} into a curve` : `Open your ${name} out a little`;
  }
  return `Fold your ${name} down`;
}

// Compares a reading with a letter and lists each thing that has to be right, with what to fix.
export function checkLetter(letter: string, reading: HandReading): Check[] {
  const spec = LETTER_SPECS[letter.toUpperCase()];
  if (!spec) return [];
  const checks: Check[] = [];

  for (const finger of FINGERS) {
    const want = spec.fingers[finger];
    if (!want) continue;
    const state = reading.fingers[finger];
    const wanted = allowed(want);
    checks.push({
      label: `${NAMES[finger]} ${wanted.includes("extended") ? "straight" : wanted.includes("curved") && wanted.length === 1 ? "curved" : "folded"}`,
      ok: wanted.includes(state),
      tip: fingerTip(finger, state, want),
    });
  }
  if (spec.thumb) {
    checks.push({
      label: spec.thumb === "out" ? "Thumb out" : "Thumb tucked in",
      ok: reading.thumb === spec.thumb,
      tip: spec.thumb === "out" ? "Stick your thumb out" : "Tuck your thumb in against your palm",
    });
  }
  if (spec.touch === "none") {
    checks.push({ label: "Thumb not touching a finger", ok: reading.touching === null, tip: "Keep a gap between your thumb and fingers" });
  } else if (spec.touch) {
    checks.push({
      label: `Thumb touching your ${NAMES[spec.touch].toLowerCase()}`,
      ok: reading.touching === spec.touch,
      tip: `Touch your thumb tip to your ${NAMES[spec.touch].toLowerCase()} tip`,
    });
  }
  if (spec.apart !== undefined) {
    checks.push({
      label: spec.apart ? "Index and middle apart" : "Index and middle together",
      ok: reading.indexMiddleApart === spec.apart,
      tip: spec.apart ? "Spread your index and middle fingers apart" : "Press your index and middle fingers together",
    });
  }
  return checks;
}

export const letterMatches = (checks: Check[]) => checks.length > 0 && checks.every((check) => check.ok);

// Plain words for what the camera currently sees, for showing the learner.
export function describeReading(reading: HandReading): string[] {
  const word: Record<FingerState, string> = { extended: "straight", curved: "curved", curled: "folded" };
  return [
    `Thumb ${reading.thumb === "out" ? "out" : "tucked"}`,
    ...FINGERS.map((finger) => `${NAMES[finger]} ${word[reading.fingers[finger]]}`),
  ];
}
