// Turns the 21 hand points from MediaPipe hand tracking into "what is this hand doing?" and
// checks that against what a fingerspelled letter needs. Pure logic with no camera, so it can be
// tested on its own (tests/handshape.test.mts).
//
// The points are MediaPipe "world landmarks": real-world 3D positions, so angles and distances
// don't depend on the video's shape or on which way the hand faces.
//   0 wrist | thumb 1-4 | index 5-8 | middle 9-12 | ring 13-16 | pinky 17-20
// Each finger runs knuckle (MCP), middle joint, tip-side joint, tip.

import type { FistGuess } from "./fist";

export type Point = { x: number; y: number; z: number };

export const FINGERS = ["index", "middle", "ring", "pinky"] as const;
export type Finger = (typeof FINGERS)[number];
// Straight, or bent in any way. The tracker can tell these apart reliably, but it can't tell a
// tight fist from a gentle curve (a curved C-hand reads as straight), so there are only two.
export type FingerState = "extended" | "bent";
export type ThumbState = "out" | "tucked";
// Which way the hand points, measured from the wrist to the middle knuckle: up (within 45 degrees
// of vertical), down (within 45 degrees of straight down), or sideways in between. Measured on
// real signers: upright hands read 4 to 37 degrees, sideways hands 59 to 91.
export type Facing = "up" | "side" | "down";

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
// thumbs held out read 0.29 to 1.1, tucked thumbs 0.10 or less. On about 2,000 real hands (the
// ASLNow! set), a cutoff of 0.35 accepts 96 in 100 tucked thumbs and calls an out thumb tucked 1 in 100.
const THUMB_OUT_FROM = 0.35;
// Thumb tip to a fingertip, in palm widths, counts as touching (touching pairs read 0.27 to 0.41 on
// signing videos; on the same real hands, 0.55 accepts 85 to 97 in 100 touching pairs).
const TOUCH_WITHIN = 0.55;
// How close the thumb tip is to the middle of the palm, in palm widths, for the thumb to count as folded
// across the palm (the B hand). "Not sticking out sideways" isn't enough: a thumb held up beside the
// fingers also isn't sticking out. Only the position across the palm's surface counts, not how far the thumb
// sits in front of it: the tracker's depth numbers are noisy, and a first version that included depth
// rejected a correct B on a learner's own camera (the thumb tip was plainly on the palm). Measured this way
// on real hands with the thumb folded across the palm, the tip sits 0.23 to 0.91 palm widths from the palm's
// middle (median 0.33). The same hands with the thumb moved up beside the index finger read a median of 1.11,
// and with the thumb half out to the side 0.89. At 0.7, 87 in 100 real frames are accepted, against 0 in 100
// with the thumb beside the index finger and 0 in 100 with it half out. At 0.9 a half-out thumb got through.
const THUMB_ON_PALM_WITHIN = 0.7;
// Index to middle fingertip, in palm widths, counts as spread apart.
const APART_FROM = 0.5;
// The thumb tip within this many palm widths of the middle finger's middle joint counts as resting
// on it (as in K).
const ON_MIDDLE_JOINT = 0.4;
// The index tip is no further out than the middle tip, by this many palm widths: crossed.
const CROSSED_WITHIN = 0.03;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export type HandReading = {
  fingers: Record<Finger, FingerState>;
  thumb: ThumbState;
  // Which fingertip the thumb tip is touching, if any.
  touching: Finger | null;
  // True when the index and middle fingertips are spread apart.
  indexMiddleApart: boolean;
  facing: Facing;
  // True when the thumb tip is resting on the middle finger's middle joint.
  thumbOnMiddle: boolean;
  // True when the thumb tip is close to the middle of the palm: folded across it.
  thumbOnPalm: boolean;
  // True when the index fingertip has crossed over (or sits level with) the middle fingertip.
  crossed: boolean;
  // Which fist letter the whole hand shape looks most like. Added by the caller, and only when all
  // four fingers are folded, because it needs the picture landmarks that analyzeHand doesn't get.
  fist?: FistGuess;
};

function handFacing(points: Point[]): Facing {
  const axis = sub(points[9], points[0]);
  const fromUp = (Math.atan2(Math.abs(axis.x), -axis.y) * 180) / Math.PI;
  return fromUp <= 45 ? "up" : fromUp >= 135 ? "down" : "side";
}

// Index tip minus middle tip along the knuckle line, in palm widths: positive when they are in their
// normal order, near zero or negative when crossed.
function tipOrder(points: Point[], palmWidth: number): number {
  const across = unit(sub(points[5], points[17]));
  return (dot(points[8], across) - dot(points[12], across)) / palmWidth;
}

// The raw numbers behind a reading, for tuning the thresholds against real hands.
export function measureHand(points: Point[]) {
  const palmWidth = distance(points[5], points[17]) || 1;
  const finger: Record<string, number> = {};
  for (const name of FINGERS) {
    const [mcp, pip, dip, tip] = JOINTS[name];
    const flat = distance(points[mcp], points[pip]) + distance(points[pip], points[dip]) + distance(points[dip], points[tip]);
    finger[name] = round(distance(points[mcp], points[tip]) / flat);
  }
  // Angle at a joint, in degrees: 180 is perfectly straight, smaller is more bent.
  const jointAngle = (a: number, b: number, c: number) => {
    const u = sub(points[a], points[b]);
    const v = sub(points[c], points[b]);
    const cosine = dot(u, v) / ((Math.hypot(u.x, u.y, u.z) * Math.hypot(v.x, v.y, v.z)) || 1);
    return Math.round((Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI);
  };
  const axis = sub(points[9], points[0]);
  return {
    finger,
    // Angle at the middle and tip joints of each finger.
    pipAngle: Object.fromEntries(FINGERS.map((f) => [f, jointAngle(JOINTS[f][0], JOINTS[f][1], JOINTS[f][2])])),
    dipAngle: Object.fromEntries(FINGERS.map((f) => [f, jointAngle(JOINTS[f][1], JOINTS[f][2], JOINTS[f][3])])),
    // Which way the hand points (wrist to the middle knuckle), as camera x (right) and y (down).
    axisX: round(axis.x / (Math.hypot(axis.x, axis.y, axis.z) || 1)),
    axisY: round(axis.y / (Math.hypot(axis.x, axis.y, axis.z) || 1)),
    thumbToMiddleJoint: round(distance(points[4], points[10]) / palmWidth),
    thumbLateral: round(thumbLateral(points, palmWidth)),
    thumbToPalmCentre: round(thumbToPalmCentre(points, palmWidth)),
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
// How far the thumb tip is from the middle of the palm (the average of the wrist and the four knuckles), in
// palm widths, measured along the palm's surface: up the hand and across it, ignoring how far in front of the
// palm the thumb is. Small when the thumb is folded across the palm.
function thumbToPalmCentre(points: Point[], palmWidth: number): number {
  const middle = [0, 5, 9, 13, 17].reduce((sum, k) => ({ x: sum.x + points[k].x / 5, y: sum.y + points[k].y / 5, z: sum.z + points[k].z / 5 }), { x: 0, y: 0, z: 0 });
  const up = unit(sub(points[9], points[0]));
  const knuckles = sub(points[5], points[17]);
  const along = dot(knuckles, up);
  const across = unit({ x: knuckles.x - up.x * along, y: knuckles.y - up.y * along, z: knuckles.z - up.z * along });
  const offset = sub(points[4], middle);
  return Math.hypot(dot(offset, up), dot(offset, across)) / palmWidth;
}

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

  return {
    fingers,
    thumb,
    touching,
    indexMiddleApart,
    facing: handFacing(points),
    thumbOnMiddle: distance(points[4], points[10]) / palmWidth < ON_MIDDLE_JOINT,
    thumbOnPalm: thumbToPalmCentre(points, palmWidth) <= THUMB_ON_PALM_WITHIN,
    crossed: tipOrder(points, palmWidth) < CROSSED_WITHIN,
  };
}

export type LetterSpec = {
  fingers: Partial<Record<Finger, FingerState>>;
  thumb?: ThumbState;
  // The thumb must be folded across the palm, not just tucked away (B).
  thumbAcrossPalm?: boolean;
  // The thumb tip must touch this fingertip; "none" means it must not touch any.
  touch?: Finger | "none";
  // Index and middle must be spread apart (true) or together (false).
  apart?: boolean;
  // All four fingers must be in the same state (all straight or all bent), as in a C.
  alike?: boolean;
  // Which way the hand must point. Letters that are the same finger shape turned sideways or down
  // (G and L, H and U, K and P) are told apart this way.
  facing?: Facing;
  // The thumb must rest on the middle finger's middle joint (K and P).
  thumbOnMiddle?: boolean;
  // Index and middle fingertips must be crossed (true) as in R.
  crossed?: boolean;
  // Set for letters the camera tends to get wrong, with the reason.
  tricky?: string;
  // The fist letters: the tip that says how to place the thumb. They are told apart by lib/fist.ts.
  fist?: string;
  // Set for letters whose rules are sound but haven't been confirmed on a real hand yet.
  unconfirmed?: boolean;
};

// How far to trust the camera for a letter: "verified" letters were confirmed on real signers (videos,
// and about 2,000 real hands for I, L and U), "unconfirmed" ones (only J, which moves) have sound
// rules that haven't been tried on a real hand, and "tricky" ones are
// shapes the camera can't reliably tell apart.
// "learned" ones (the fist letters) are told apart by a model trained on a public set of real hands,
// and tested on sessions it hadn't seen.
export type Confidence = "verified" | "learned" | "unconfirmed" | "tricky";

export function letterConfidence(letter: string): Confidence {
  const spec = LETTER_SPECS[letter.toUpperCase()];
  return spec?.tricky ? "tricky" : spec?.fist ? "learned" : spec?.unconfirmed ? "unconfirmed" : "verified";
}

// The model has to put at least this much weight on the letter for the camera to accept it, and this
// much for it to say "That looks like" rather than "fits, but can't be sure".
export const FIST_ACCEPT = 0.5;
export const FIST_SURE = 0.75;

// Whether a match for this letter is one the camera can stand behind.
export function matchIsSure(letter: string, reading: HandReading): boolean {
  return LETTER_SPECS[letter.toUpperCase()]?.fist
    ? (reading.fist?.share ?? 0) >= FIST_SURE
    : letterConfidence(letter) !== "tricky";
}
const DIRECTION = "G and Q have the same finger shape, and H is a U turned on its side. They differ by which way the hand points, but most people sign to a camera with the hand upright, so the camera can't tell them apart.";
const KMIDDLE = "K is a V with the thumb resting on the middle finger. The camera can't see that detail well yet.";
const CROSSED = "The crossed fingers are hard for the camera to see.";
const HOOK = "A hooked finger is hard for the camera to tell from a straight one.";
const CURVED = "Curved fingers look almost straight to the camera, so it can't check the curve itself.";
const POINTING = "D and Z (and the number 1) share a finger shape: the index points up and the thumb rests on the other fingers.";

const BENT: Partial<Record<Finger, FingerState>> = { index: "bent", middle: "bent", ring: "bent", pinky: "bent" };

// What each letter needs, as far as finger positions go. The drawings show the full detail.
export const LETTER_SPECS: Record<string, LetterSpec> = {
  A: { fingers: BENT, fist: "Make a fist with your thumb resting along the side of your index finger" },
  B: { fingers: { index: "extended", middle: "extended", ring: "extended", pinky: "extended" }, thumb: "tucked", thumbAcrossPalm: true, touch: "none", apart: false },
  C: { fingers: {}, thumb: "out", touch: "none", alike: true, tricky: CURVED },
  D: { fingers: { index: "extended", middle: "bent", ring: "bent", pinky: "bent" }, touch: "middle", tricky: POINTING },
  E: { fingers: BENT, fist: "Curl your fingertips down onto your thumb, with the thumb tucked under them" },
  F: { fingers: { middle: "extended", ring: "extended", pinky: "extended" }, touch: "index" },
  // G, H and Q are told apart from L, U and G by which way the hand points (sideways, or down for Q).
  // On about 2,000 real hands, 90 to 100 in 100 signers held them upright to the camera, so asking for
  // the textbook direction rejected nearly everyone. Direction is no longer checked, and they are
  // flagged tricky. The thumb lies right beside the index finger, which the camera can't call in or out.
  G: { fingers: { index: "extended", middle: "bent", ring: "bent", pinky: "bent" }, tricky: DIRECTION },
  H: { fingers: { index: "extended", middle: "extended", ring: "bent", pinky: "bent" }, apart: false, tricky: DIRECTION },
  I: { fingers: { index: "bent", middle: "bent", ring: "bent", pinky: "extended" }, thumb: "tucked" },
  // J is an I that moves; only the hand shape is checked.
  J: { fingers: { index: "bent", middle: "bent", ring: "bent", pinky: "extended" }, thumb: "tucked", unconfirmed: true },
  K: { fingers: { index: "extended", middle: "extended", ring: "bent", pinky: "bent" }, apart: true, facing: "up", thumbOnMiddle: true, tricky: KMIDDLE },
  L: { fingers: { index: "extended", middle: "bent", ring: "bent", pinky: "bent" }, thumb: "out", facing: "up" },
  M: { fingers: BENT, fist: "Tuck your thumb under your first three fingers" },
  N: { fingers: BENT, fist: "Tuck your thumb under your first two fingers" },
  O: { fingers: { middle: "bent", ring: "bent", pinky: "bent" }, touch: "index", tricky: CURVED },
  P: { fingers: { index: "extended", middle: "extended", ring: "bent", pinky: "bent" }, apart: true, thumbOnMiddle: true, tricky: KMIDDLE },
  Q: { fingers: { index: "extended", middle: "bent", ring: "bent", pinky: "bent" }, tricky: DIRECTION },
  R: { fingers: { index: "extended", middle: "extended", ring: "bent", pinky: "bent" }, apart: false, facing: "up", crossed: true, tricky: CROSSED },
  S: { fingers: BENT, fist: "Make a fist with your thumb wrapped across the front of your fingers" },
  T: { fingers: BENT, fist: "Tuck your thumb between your index and middle fingers" },
  U: { fingers: { index: "extended", middle: "extended", ring: "bent", pinky: "bent" }, thumb: "tucked", apart: false, facing: "up" },
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
  if (spec.fist) {
    const seen = reading.fist;
    const ok = seen?.letter === letter.toUpperCase() && seen.share >= FIST_ACCEPT;
    // The model's other guess is a letter, or "other" for hands that aren't one of the fist letters.
    const other = seen && !ok && seen.letter in LETTER_SPECS ? `That looks more like ${seen.letter}. ` : "";
    checks.push({ label: `Thumb and fist look like ${letter.toUpperCase()}`, ok, tip: other + spec.fist });
  }
  if (spec.thumbAcrossPalm) {
    checks.push({
      label: "Thumb folded across your palm",
      ok: reading.thumbOnPalm,
      tip: "Fold your thumb across your palm, not up beside your fingers",
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
  if (spec.facing) {
    const words: Record<Facing, string> = { up: "pointing up", side: "pointing sideways", down: "pointing down" };
    checks.push({
      label: `Hand ${words[spec.facing]}`,
      ok: reading.facing === spec.facing,
      tip: `Turn your hand so it points ${spec.facing === "side" ? "sideways" : spec.facing}`,
    });
  }
  if (spec.thumbOnMiddle) {
    checks.push({
      label: "Thumb resting on the middle finger",
      ok: reading.thumbOnMiddle,
      tip: "Rest your thumb tip on the middle of your middle finger",
    });
  }
  if (spec.crossed !== undefined) {
    checks.push({
      label: "Fingers crossed",
      ok: reading.crossed === spec.crossed,
      tip: spec.crossed ? "Cross your middle finger over your index finger" : "Uncross your fingers",
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
  const guess = reading.fist
    ? [reading.fist.letter in LETTER_SPECS ? `Looks most like ${reading.fist.letter}` : "Not one of the fist letters"]
    : [];
  return [
    `Thumb ${reading.thumb === "out" ? "out" : "tucked"}`,
    ...FINGERS.map((finger) => `${NAMES[finger]} ${word[reading.fingers[finger]]}`),
    ...guess,
  ];
}
