// Checks the handshape logic (lib/handshape.ts) on synthetic 3D hands, built from exact finger
// bends, so the rules are tested without a camera. Real-camera behaviour is covered by
// tests/e2e.mjs, which runs the tracker on real signing videos.
// Run with:  node tests/handshape.test.mts
import { analyzeHand, checkLetter, describeReading, LETTER_SPECS, letterMatches } from "../lib/handshape.ts";
import type { Finger, Point } from "../lib/handshape.ts";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  if (!ok) console.log(`FAIL  ${name}${detail ? `: ${detail}` : ""}`);
}

type Bend = "extended" | "curved" | "curled";
type Pose = {
  index: Bend;
  middle: Bend;
  ring: Bend;
  pinky: Bend;
  thumb: "out" | "tucked" | Finger; // a finger name means the thumb tip touches that fingertip
  apart?: boolean; // index and middle spread
  wide?: boolean; // ring spread too (W)
};

// Joint bends in degrees at the knuckle, middle joint and tip joint.
const BENDS: Record<Bend, [number, number, number]> = {
  extended: [0, 0, 0],
  curved: [45, 55, 35],
  curled: [85, 100, 60],
};
// Knuckle positions (metres, palm facing the camera) and the three bone lengths of each finger.
const BASE: Record<Finger, { x: number; y: number; bones: [number, number, number] }> = {
  index: { x: 0.03, y: 0.09, bones: [0.04, 0.025, 0.02] },
  middle: { x: 0.01, y: 0.095, bones: [0.045, 0.028, 0.022] },
  ring: { x: -0.01, y: 0.09, bones: [0.04, 0.026, 0.02] },
  pinky: { x: -0.03, y: 0.08, bones: [0.032, 0.02, 0.018] },
};
const FINGER_START: Record<Finger, number> = { index: 5, middle: 9, ring: 13, pinky: 17 };
const rad = (degrees: number) => (degrees * Math.PI) / 180;

function buildHand(pose: Pose): Point[] {
  const points: Point[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  const splay: Record<Finger, number> = {
    index: pose.apart ? -14 : 0,
    middle: pose.apart ? 10 : 0,
    ring: pose.wide ? 22 : 0,
    pinky: 0,
  };
  for (const finger of ["index", "middle", "ring", "pinky"] as const) {
    const { x, y, bones } = BASE[finger];
    const [f1, f2, f3] = BENDS[pose[finger]];
    const angles = [f1, f1 + f2, f1 + f2 + f3];
    let along = 0;
    let depth = 0;
    const start = FINGER_START[finger];
    points[start] = { x, y, z: 0 };
    bones.forEach((length, index) => {
      along += length * Math.cos(rad(angles[index]));
      depth -= length * Math.sin(rad(angles[index]));
      // Splay turns the finger in the palm plane, around its knuckle.
      const turn = rad(splay[finger]);
      points[start + index + 1] = { x: x - along * Math.sin(turn), y: y + along * Math.cos(turn), z: depth };
    });
  }
  if (pose.thumb === "out") {
    points[1] = { x: 0.03, y: 0.02, z: 0 };
    points[2] = { x: 0.045, y: 0.04, z: 0 };
    points[3] = { x: 0.062, y: 0.058, z: 0 };
    points[4] = { x: 0.078, y: 0.076, z: 0 };
  } else if (pose.thumb === "tucked") {
    points[1] = { x: 0.03, y: 0.02, z: 0 };
    points[2] = { x: 0.04, y: 0.035, z: 0 };
    points[3] = { x: 0.03, y: 0.055, z: -0.012 };
    points[4] = { x: 0.015, y: 0.07, z: -0.02 };
  } else {
    const tip = points[FINGER_START[pose.thumb] + 3];
    points[1] = { x: 0.03, y: 0.02, z: 0 };
    points[2] = { x: 0.04, y: 0.04, z: -0.005 };
    points[3] = { x: (0.04 + tip.x) / 2, y: (0.04 + tip.y) / 2, z: (tip.z - 0.005) / 2 - 0.005 };
    points[4] = { x: tip.x + 0.004, y: tip.y, z: tip.z - 0.003 };
  }
  return points;
}

const read = (pose: Pose) => analyzeHand(buildHand(pose));
const fist = (thumb: Pose["thumb"] = "tucked"): Pose => ({ index: "curled", middle: "curled", ring: "curled", pinky: "curled", thumb });
const passes = (letter: string, pose: Pose) => letterMatches(checkLetter(letter, read(pose)));
const lettersMatching = (pose: Pose) => Object.keys(LETTER_SPECS).filter((letter) => passes(letter, pose));

// ---- What the camera sees ----
const open = read({ index: "extended", middle: "extended", ring: "extended", pinky: "extended", thumb: "out" });
check("open hand: all four fingers straight, thumb out", Object.values(open.fingers).every((s) => s === "extended") && open.thumb === "out");
check("open hand: nothing touching", open.touching === null);
const closed = read(fist());
check("fist: all four fingers folded", Object.values(closed.fingers).every((s) => s === "curled"), JSON.stringify(closed.fingers));
check("fist with thumb tucked in", closed.thumb === "tucked");
const curve = read({ index: "curved", middle: "curved", ring: "curved", pinky: "curved", thumb: "out" });
check("curved hand reads as curved, not straight or folded", Object.values(curve.fingers).every((s) => s === "curved"), JSON.stringify(curve.fingers));
check("thumb tip on the index tip reads as touching the index", read({ ...fist(), index: "curved", thumb: "index" }).touching === "index");
check("together vs apart", !read({ ...fist(), index: "extended", middle: "extended" }).indexMiddleApart && read({ ...fist(), index: "extended", middle: "extended", apart: true }).indexMiddleApart);
check("describeReading lists the thumb and four fingers", describeReading(open).length === 5 && describeReading(open)[1] === "Index finger straight");

// ---- Each reliable letter, as a hand actually makes it ----
const POSES: Record<string, Pose> = {
  B: { index: "extended", middle: "extended", ring: "extended", pinky: "extended", thumb: "tucked" },
  C: { index: "curved", middle: "curved", ring: "curved", pinky: "curved", thumb: "out" },
  D: { index: "extended", middle: "curled", ring: "curled", pinky: "curled", thumb: "middle" },
  F: { index: "curved", middle: "extended", ring: "extended", pinky: "extended", thumb: "index" },
  I: { index: "curled", middle: "curled", ring: "curled", pinky: "extended", thumb: "tucked" },
  L: { index: "extended", middle: "curled", ring: "curled", pinky: "curled", thumb: "out" },
  O: { index: "curved", middle: "curved", ring: "curved", pinky: "curved", thumb: "index" },
  U: { index: "extended", middle: "extended", ring: "curled", pinky: "curled", thumb: "tucked" },
  V: { index: "extended", middle: "extended", ring: "curled", pinky: "curled", thumb: "tucked", apart: true },
  W: { index: "extended", middle: "extended", ring: "extended", pinky: "curled", thumb: "tucked", apart: true, wide: true },
  Y: { index: "curled", middle: "curled", ring: "curled", pinky: "extended", thumb: "out" },
};
for (const [letter, pose] of Object.entries(POSES)) {
  check(`${letter} is recognised from a ${letter} hand`, passes(letter, pose), checkLetter(letter, read(pose)).filter((c) => !c.ok).map((c) => c.label).join(", "));
}

// ---- Telling letters apart ----
// Letters whose finger shape another letter shares can't be told apart by fingers alone.
const TWINS: Record<string, string[]> = { I: ["J"], U: ["H", "R"], L: ["G", "Q"], D: ["Z"], V: ["K", "P"] };
for (const letter of Object.keys(POSES)) {
  const others = lettersMatching(POSES[letter]).filter((other) => other !== letter && !(TWINS[letter] ?? []).includes(other));
  check(`${letter}: no unrelated letter is mistaken for it`, others.length === 0, `also matched ${others.join(", ")}`);
}
check("the fist letters really can't be told apart (honest about it)", ["A", "E", "M", "N", "S", "T"].every((letter) => passes(letter, fist())));
check("every fist-shape letter is flagged tricky", ["A", "E", "M", "N", "S", "T", "G", "H", "K", "P", "Q", "R", "X"].every((letter) => LETTER_SPECS[letter].tricky));
check("letters that are told apart well are not flagged tricky", ["B", "C", "F", "I", "L", "O", "U", "V", "W", "Y"].every((l) => !LETTER_SPECS[l].tricky));
check("letters that share a finger shape are flagged tricky", ["D", "Z", "G", "H", "K", "P", "Q", "R"].every((l) => LETTER_SPECS[l].tricky));

// ---- Advice when it's wrong ----
const tips = (letter: string, pose: Pose) => checkLetter(letter, read(pose)).filter((c) => !c.ok).map((c) => c.tip);
check("V with the ring finger up: told to fold the ring finger", tips("V", { ...POSES.V, ring: "extended" }).includes("Fold your ring finger down"), tips("V", { ...POSES.V, ring: "extended" }).join("; "));
check("V with the fingers together: told to spread them", tips("V", { ...POSES.V, apart: false }).includes("Spread your index and middle fingers apart"));
check("U with the fingers apart: told to press them together", tips("U", { ...POSES.U, apart: true }).includes("Press your index and middle fingers together"));
check("L with the index folded: told to straighten it", tips("L", { ...POSES.L, index: "curled" }).includes("Straighten your index finger"));
check("L with the thumb tucked: told to stick it out", tips("L", { ...POSES.L, thumb: "tucked" }).includes("Stick your thumb out"));
check("C held flat: told to curve the fingers", tips("C", { ...POSES.C, index: "extended" }).includes("Bend your index finger into a curve"));
check("O with the thumb away: told to touch the index tip", tips("O", { ...POSES.O, thumb: "out" }).includes("Touch your thumb tip to your index finger tip"));
check("a correct hand has no advice", tips("Y", POSES.Y).length === 0);
check("an unknown letter gives no checks", checkLetter("1", open).length === 0);
check("every letter A-Z has a spec", "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").every((letter) => LETTER_SPECS[letter]));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
