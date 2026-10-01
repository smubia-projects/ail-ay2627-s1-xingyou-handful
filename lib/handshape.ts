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
// Straight, or bent in any way. The tracker can tell these apart reliably, but it can't tell a
// tight fist from a gentle curve (a curved C-hand reads as straight), so there are only two.
export type FingerState = "extended" | "bent";
export type ThumbState = "out" | "tucked";

const JOINTS: Record<Finger, [number, number, number, number]> = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};
const TIP: Record<Finger, number> = { index: 8, middle: 12, ring: 16, pinky: 20 };

// How far a finger's tip is from its knuckle, compared with the finger's length laid flat.
// Measured on real signers: straight fingers read 0.93 or more, bent ones 0.87 or less.
const EXTENDED_FROM = 0.9;
// How far the thumb tip sticks out sideways past the index knuckle, in palm widths. Measured:
// thumbs held out read 0.29 to 1.1, tucked thumbs 0.10 or less.
const THUMB_OUT_FROM = 0.25;
// Thumb tip to a fingertip, in palm widths, counts as touching (touching pairs read 0.27 to 0.41).
const TOUCH_WITHIN = 0.45;
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

// The raw numbers behind a reading, for tuning the thresholds against real hands.
export function measureHand(points: Point[]) {
  const palmWidth = distance(points[5], points[17]) || 1;
  const finger: Record<string, number> = {};
  for (const name of FINGERS) {
    const [mcp, pip, dip, tip] = JOINTS[name];
    const flat = distance(points[mcp], points[pip]) + distance(points[pip], points[dip]) + distance(points[dip], points[tip]);
    finger[name] = round(distance(points[mcp], points[tip]) / flat);
  }
  return {
    finger,
    thumbLateral: round(thumbLateral(points, palmWidth)),
    thumbTo: Object.fromEntries(FINGERS.map((f) => [f, round(distance(points[4], points[TIP[f]]) / palmWidth)])),
    indexMiddleGap: round(distance(points[8], points[12]) / palmWidth),
  };
}

const round = (n: number) => Math.round(n * 100) / 100;
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y + a.z * b.z;
const unit = (a: Point): Point => {
  const length = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / length, y: a.y / length, z: a.z / length };
};

// How far the thumb tip sticks out sideways past the index knuckle, in palm widths. Positive is
// away from the palm. This works for either hand and any way the hand faces.
function thumbLateral(points: Point[], palmWidth: number): number {
  const across = unit(sub(points[5], points[17]));
  return dot(sub(points[4], points[5]), across) / palmWidth;
}

export function analyzeHand(points: Point[]): HandReading {
  const palmWidth = distance(points[5], points[17]) || 1;

  const fingers = {} as Record<Finger, FingerState>;
  for (const finger of FINGERS) {
    const [mcp, pip, dip, tip] = JOINTS[finger];
    const flat = distance(points[mcp], points[pip]) + distance(points[pip], points[dip]) + distance(points[dip], points[tip]);
    const ratio = distance(points[mcp], points[tip]) / flat;
    fingers[finger] = ratio >= EXTENDED_FROM ? "extended" : "bent";
  }

  const thumb: ThumbState = thumbLateral(points, palmWidth) >= THUMB_OUT_FROM ? "out" : "tucked";

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

export type LetterSpec = {
  fingers: Partial<Record<Finger, FingerState>>;
  thumb?: ThumbState;
  // The thumb tip must touch this fingertip; "none" means it must not touch any.
  touch?: Finger | "none";
  // Index and middle must be spread apart (true) or together (false).
  apart?: boolean;
  // All four fingers must be in the same state (all straight or all bent), as in a C.
  alike?: boolean;
  // Set for letters the camera tends to get wrong, with the reason.
  tricky?: string;
};

const FIST = "A, E, M, N, S and T are all fists. The camera sees a fist, not where the thumb is tucked.";
const SIDEWAYS = "This letter is the same finger shape as another letter, turned sideways or down. The camera checks fingers, not which way the hand faces.";
const CROSSED = "The crossed fingers are hard for the camera to see.";
const HOOK = "A hooked finger is hard for the camera to tell from a straight one.";
const CURVED = "Curved fingers look almost straight to the camera, so it can't check the curve itself.";
const POINTING = "D and Z (and the number 1) share a finger shape: the index points up and the thumb rests on the other fingers.";

const BENT: Partial<Record<Finger, FingerState>> = { index: "bent", middle: "bent", ring: "bent", pinky: "bent" };

// What each letter needs, as far as finger positions go. The drawings show the full detail.
export const LETTER_SPECS: Record<string, LetterSpec> = {
  A: { fingers: BENT, tricky: FIST },
  B: { fingers: { index: "extended", middle: "extended", ring: "extended", pinky: "extended" }, thumb: "tucked", touch: "none", apart: false },
  C: { fingers: {}, thumb: "out", touch: "none", alike: true, tricky: CURVED },
  D: { fingers: { index: "extended", middle: "bent", ring: "bent", pinky: "bent" }, touch: "middle", tricky: POINTING },
  E: { fingers: BENT, thumb: "tucked", tricky: FIST },
  F: { fingers: { middle: "extended", ring: "extended", pinky: "extended" }, touch: "index" },
  G: { fingers: { index: "extended", middle: "bent", ring: "bent", pinky: "bent" }, thumb: "out", tricky: SIDEWAYS },
  H: { fingers: { index: "extended", middle: "extended", ring: "bent", pinky: "bent" }, apart: false, tricky: SIDEWAYS },
  I: { fingers: { index: "bent", middle: "bent", ring: "bent", pinky: "extended" }, thumb: "tucked" },
  J: { fingers: { index: "bent", middle: "bent", ring: "bent", pinky: "extended" }, thumb: "tucked" },
  K: { fingers: { index: "extended", middle: "extended", ring: "bent", pinky: "bent" }, apart: true, tricky: SIDEWAYS },
  L: { fingers: { index: "extended", middle: "bent", ring: "bent", pinky: "bent" }, thumb: "out" },
  M: { fingers: BENT, tricky: FIST },
  N: { fingers: BENT, tricky: FIST },
  O: { fingers: { middle: "bent", ring: "bent", pinky: "bent" }, touch: "index", tricky: CURVED },
  P: { fingers: { index: "extended", middle: "extended", ring: "bent", pinky: "bent" }, apart: true, tricky: SIDEWAYS },
  Q: { fingers: { index: "extended", middle: "bent", ring: "bent", pinky: "bent" }, thumb: "out", tricky: SIDEWAYS },
  R: { fingers: { index: "extended", middle: "extended", ring: "bent", pinky: "bent" }, apart: false, tricky: CROSSED },
  S: { fingers: BENT, tricky: FIST },
  T: { fingers: BENT, tricky: FIST },
  U: { fingers: { index: "extended", middle: "extended", ring: "bent", pinky: "bent" }, thumb: "tucked", apart: false },
  V: { fingers: { index: "extended", middle: "extended", ring: "bent", pinky: "bent" }, thumb: "tucked", apart: true },
  // The thumb touches the little finger: the same shape as the number 6.
  W: { fingers: { index: "extended", middle: "extended", ring: "extended" }, touch: "pinky", apart: true },
  X: { fingers: BENT, tricky: HOOK },
  Y: { fingers: { index: "bent", middle: "bent", ring: "bent", pinky: "extended" }, thumb: "out" },
  Z: { fingers: { index: "extended", middle: "bent", ring: "bent", pinky: "bent" }, thumb: "tucked", tricky: POINTING },
};

export type Check = { label: string; ok: boolean; tip: string };

const NAMES: Record<Finger, string> = { index: "Index finger", middle: "Middle finger", ring: "Ring finger", pinky: "Little finger" };

// Compares a reading with a letter and lists each thing that has to be right, with what to fix.
export function checkLetter(letter: string, reading: HandReading): Check[] {
  const spec = LETTER_SPECS[letter.toUpperCase()];
  if (!spec) return [];
  const checks: Check[] = [];

  for (const finger of FINGERS) {
    const want = spec.fingers[finger];
    if (!want) continue;
    checks.push({
      label: `${NAMES[finger]} ${want === "extended" ? "straight" : "bent"}`,
      ok: reading.fingers[finger] === want,
      tip: want === "extended" ? `Straighten your ${NAMES[finger].toLowerCase()}` : `Fold your ${NAMES[finger].toLowerCase()} down`,
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
  if (spec.alike) {
    const states = FINGERS.map((finger) => reading.fingers[finger]);
    checks.push({
      label: "All four fingers curved the same way",
      ok: states.every((state) => state === states[0]),
      tip: "Make all four fingers curve the same way",
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
  const word: Record<FingerState, string> = { extended: "straight", bent: "bent" };
  return [
    `Thumb ${reading.thumb === "out" ? "out" : "tucked"}`,
    ...FINGERS.map((finger) => `${NAMES[finger]} ${word[reading.fingers[finger]]}`),
  ];
}
