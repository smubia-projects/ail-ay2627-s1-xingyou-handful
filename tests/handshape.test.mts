// Checks the handshape logic (lib/handshape.ts) on synthetic 3D hands, built from exact finger
// bends, so the rules are tested without a camera. Real-camera behaviour is covered by
// tests/e2e.mjs, which runs the tracker on real signing videos.
// Run with:  node tests/handshape.test.mts
import { analyzeHand, checkLetter, describeReading, LETTER_SPECS, letterConfidence, letterMatches } from "../lib/handshape.ts";
import type { Finger, Point } from "../lib/handshape.ts";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  if (!ok) console.log(`FAIL  ${name}${detail ? `: ${detail}` : ""}`);
}

// "slight" is the soft curve of a real C hand, which the tracker reads as straight (measured on
// real signers). "gentle" curves more and reads as bent.
type Bend = "extended" | "slight" | "gentle" | "bent";
type Pose = {
  index: Bend;
  middle: Bend;
  ring: Bend;
  pinky: Bend;
  thumb: "out" | "tucked" | "middleJoint" | Finger; // a finger name means the thumb tip touches that fingertip
  apart?: boolean; // index and middle spread
  wide?: boolean; // ring spread too (W)
  crossed?: boolean; // index fingertip crossed over the middle one (R)
  facing?: "up" | "side" | "down"; // which way the hand points (default up)
};

// Joint bends in degrees at the knuckle, middle joint and tip joint.
const BENDS: Record<Bend, [number, number, number]> = {
  extended: [0, 0, 0],
  slight: [20, 25, 15],
  gentle: [45, 55, 35],
  bent: [85, 100, 60],
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
    index: pose.crossed ? 20 : pose.apart ? -14 : 0,
    middle: pose.crossed ? -5 : pose.apart ? 10 : 0,
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
  } else if (pose.thumb === "middleJoint") {
    const joint = points[10];
    points[1] = { x: 0.03, y: 0.02, z: 0 };
    points[2] = { x: 0.025, y: 0.05, z: -0.01 };
    points[3] = { x: joint.x + 0.004, y: joint.y - 0.02, z: joint.z - 0.01 };
    points[4] = { x: joint.x, y: joint.y, z: joint.z - 0.004 };
  } else {
    const tip = points[FINGER_START[pose.thumb] + 3];
    points[1] = { x: 0.03, y: 0.02, z: 0 };
    points[2] = { x: 0.04, y: 0.04, z: -0.005 };
    points[3] = { x: (0.04 + tip.x) / 2, y: (0.04 + tip.y) / 2, z: (tip.z - 0.005) / 2 - 0.005 };
    points[4] = { x: tip.x + 0.004, y: tip.y, z: tip.z - 0.003 };
  }
  // Camera coordinates: y points down, so up is negative. Then turn the hand about the wrist to
  // point it up (as built), sideways or down.
  const turn = rad({ up: 0, side: 90, down: 180 }[pose.facing ?? "up"]);
  return points.map((point) => {
    const x = point.x;
    const y = -point.y;
    return { x: x * Math.cos(turn) - y * Math.sin(turn), y: x * Math.sin(turn) + y * Math.cos(turn), z: point.z };
  });
}

const read = (pose: Pose) => analyzeHand(buildHand(pose));
const fist = (thumb: Pose["thumb"] = "tucked"): Pose => ({ index: "bent", middle: "bent", ring: "bent", pinky: "bent", thumb });
const passes = (letter: string, pose: Pose) => letterMatches(checkLetter(letter, read(pose)));
const lettersMatching = (pose: Pose) => Object.keys(LETTER_SPECS).filter((letter) => passes(letter, pose));

// ---- What the camera sees ----
const open = read({ index: "extended", middle: "extended", ring: "extended", pinky: "extended", thumb: "out" });
check("open hand: all four fingers straight, thumb out", Object.values(open.fingers).every((state) => state === "extended") && open.thumb === "out");
check("open hand: nothing touching", open.touching === null);
const closed = read(fist());
check("fist: all four fingers bent", Object.values(closed.fingers).every((state) => state === "bent"), JSON.stringify(closed.fingers));
check("fist with the thumb tucked in", closed.thumb === "tucked");
const gentle = read({ index: "gentle", middle: "gentle", ring: "gentle", pinky: "gentle", thumb: "out" });
check("a gentle curve reads as bent, not straight", Object.values(gentle.fingers).every((state) => state === "bent"), JSON.stringify(gentle.fingers));
const slight = read({ index: "slight", middle: "slight", ring: "slight", pinky: "slight", thumb: "out" });
check("a slight curve (a real C) reads as straight, as measured", Object.values(slight.fingers).every((state) => state === "extended"), JSON.stringify(slight.fingers));
check("C needs all four fingers alike (an L-shaped hand is not a C)", !passes("C", { index: "extended", middle: "bent", ring: "bent", pinky: "bent", thumb: "out" }));
check("thumb tip on the index tip reads as touching the index", read({ ...fist(), index: "gentle", thumb: "index" }).touching === "index");
check("thumb tip on the little finger tip reads as touching the little finger", read({ ...fist(), pinky: "gentle", thumb: "pinky" }).touching === "pinky");
check("together vs apart", !read({ ...fist(), index: "extended", middle: "extended" }).indexMiddleApart && read({ ...fist(), index: "extended", middle: "extended", apart: true }).indexMiddleApart);
check("describeReading lists the thumb and four fingers", describeReading(open).length === 5 && describeReading(open)[1] === "Index finger straight");
// Left hands are a mirror image: the same shape must read the same.
const mirrored = (pose: Pose) => buildHand(pose).map((point) => ({ ...point, x: -point.x }));
check("a left hand reads the same as a right hand", JSON.stringify(analyzeHand(mirrored({ ...fist(), index: "extended", thumb: "out" }))) === JSON.stringify(read({ ...fist(), index: "extended", thumb: "out" })));

// ---- Which way the hand points ----
check("an upright hand reads as pointing up", read({ ...fist(), index: "extended" }).facing === "up");
check("a sideways hand reads as pointing sideways", read({ ...fist(), index: "extended", facing: "side" }).facing === "side");
check("a hand pointing down reads as down", read({ ...fist(), index: "extended", facing: "down" }).facing === "down");
check("pointing left or right is the same: sideways", analyzeHand(buildHand({ ...fist(), index: "extended", facing: "side" }).map((point) => ({ ...point, x: -point.x }))).facing === "side");
check("crossed fingers read as crossed, uncrossed ones do not", read({ ...fist(), index: "extended", middle: "extended", crossed: true }).crossed && !read({ ...fist(), index: "extended", middle: "extended" }).crossed && !read({ ...fist(), index: "extended", middle: "extended", apart: true }).crossed);
check("a thumb on the middle joint reads as resting there", read({ ...fist(), index: "extended", middle: "extended", thumb: "middleJoint" }).thumbOnMiddle && !read({ ...fist(), index: "extended", middle: "extended" }).thumbOnMiddle);

// ---- Each reliable letter, as a hand actually makes it ----
const POSES: Record<string, Pose> = {
  B: { index: "extended", middle: "extended", ring: "extended", pinky: "extended", thumb: "tucked" },
  C: { index: "slight", middle: "slight", ring: "slight", pinky: "slight", thumb: "out" },
  D: { index: "extended", middle: "bent", ring: "bent", pinky: "bent", thumb: "middle" },
  F: { index: "gentle", middle: "extended", ring: "extended", pinky: "extended", thumb: "index" },
  I: { index: "bent", middle: "bent", ring: "bent", pinky: "extended", thumb: "tucked" },
  L: { index: "extended", middle: "bent", ring: "bent", pinky: "bent", thumb: "out" },
  O: { index: "gentle", middle: "gentle", ring: "gentle", pinky: "gentle", thumb: "index" },
  U: { index: "extended", middle: "extended", ring: "bent", pinky: "bent", thumb: "tucked" },
  V: { index: "extended", middle: "extended", ring: "bent", pinky: "bent", thumb: "tucked", apart: true },
  W: { index: "extended", middle: "extended", ring: "extended", pinky: "gentle", thumb: "pinky", apart: true, wide: true },
  Y: { index: "bent", middle: "bent", ring: "bent", pinky: "extended", thumb: "out" },
  // Letters told apart by which way the hand points, and by the thumb and crossed fingers.
  G: { index: "extended", middle: "bent", ring: "bent", pinky: "bent", thumb: "out", facing: "side" },
  H: { index: "extended", middle: "extended", ring: "bent", pinky: "bent", thumb: "tucked", facing: "side" },
  Q: { index: "extended", middle: "bent", ring: "bent", pinky: "bent", thumb: "out", facing: "down" },
  K: { index: "extended", middle: "extended", ring: "bent", pinky: "bent", thumb: "middleJoint", apart: true },
  P: { index: "extended", middle: "extended", ring: "bent", pinky: "bent", thumb: "middleJoint", apart: true, facing: "down" },
  R: { index: "extended", middle: "extended", ring: "bent", pinky: "bent", thumb: "tucked", crossed: true },
};
for (const [letter, pose] of Object.entries(POSES)) {
  check(`${letter} is recognised from a ${letter} hand`, passes(letter, pose), checkLetter(letter, read(pose)).filter((c) => !c.ok).map((c) => c.label).join(", "));
}

// ---- Telling letters apart ----
// Letters whose finger shape another letter shares can't be told apart by fingers alone. This
// lists them honestly: a hand making the first letter is also accepted for the ones in its list.
const TWINS: Record<string, string[]> = {
  I: ["J"],
  D: ["Z"],
  // A K or P hand also fits a V, which asks nothing about the thumb on the middle finger.
  K: ["V"],
  P: ["V"],
  // Crossed fingers also fit a U, which doesn't mind them being crossed.
  R: ["U"],
  // The camera can't see the curve of C or O, so they match looser shapes. Both are flagged.
  C: [],
  O: ["A", "E", "M", "N", "S", "T", "X"],
};
for (const letter of Object.keys(POSES)) {
  const others = lettersMatching(POSES[letter]).filter((other) => other !== letter && !(TWINS[letter] ?? []).includes(other));
  check(`${letter}: no unrelated letter is mistaken for it`, others.length === 0, `also matched ${others.join(", ")}`);
}
check("the fist letters really can't be told apart (honest about it)", ["A", "M", "N", "S", "T"].every((letter) => passes(letter, fist())));
const confidence = (level: string) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter((letter) => letterConfidence(letter) === level).join("");
check("the letters the camera can't separate are flagged tricky", confidence("tricky") === "ACDEKMNOPRSTXZ", confidence("tricky"));
check("the letters with sound rules but no real-hand check yet are flagged unconfirmed", confidence("unconfirmed") === "GHIJLQU", confidence("unconfirmed"));
check("only letters confirmed on real signers are called verified", confidence("verified") === "BFVWY", confidence("verified"));
// Direction now separates letters that used to be twins.
check("an upright L is no longer accepted as a G or a Q", !passes("G", POSES.L) && !passes("Q", POSES.L));
check("an upright U is no longer accepted as an H", !passes("H", POSES.U));
check("a sideways H is no longer accepted as a U", !passes("U", POSES.H));
check("a V is no longer accepted as a K or a P", !passes("K", POSES.V) && !passes("P", POSES.V));
check("an uncrossed U is not accepted as an R", !passes("R", POSES.U));

// ---- Advice when it's wrong ----
const tips = (letter: string, pose: Pose) => checkLetter(letter, read(pose)).filter((c) => !c.ok).map((c) => c.tip);
check("V with the ring finger up: told to fold the ring finger", tips("V", { ...POSES.V, ring: "extended" }).includes("Fold your ring finger down"), tips("V", { ...POSES.V, ring: "extended" }).join("; "));
check("V with the fingers together: told to spread them", tips("V", { ...POSES.V, apart: false }).includes("Spread your index and middle fingers apart"));
check("U with the fingers apart: told to press them together", tips("U", { ...POSES.U, apart: true }).includes("Press your index and middle fingers together"));
check("L with the index folded: told to straighten it", tips("L", { ...POSES.L, index: "bent" }).includes("Straighten your index finger"));
check("L with the thumb tucked: told to stick it out", tips("L", { ...POSES.L, thumb: "tucked" }).includes("Stick your thumb out"));
check("B with the thumb out: told to tuck it in", tips("B", { ...POSES.B, thumb: "out" }).includes("Tuck your thumb in against your palm"));
check("B with the thumb on the little finger (a W, not a B): told to keep a gap", tips("B", { ...POSES.B, pinky: "gentle", thumb: "pinky" }).includes("Keep a gap between your thumb and fingers"));
check("W with the thumb away: told to touch the little finger", tips("W", { ...POSES.W, thumb: "out" }).includes("Touch your thumb tip to your little finger tip"));
check("O with the thumb away: told to touch the index tip", tips("O", { ...POSES.O, thumb: "out" }).includes("Touch your thumb tip to your index finger tip"));
check("G held upright: told to turn it sideways", tips("G", { ...POSES.G, facing: "up" }).includes("Turn your hand so it points sideways"));
check("Q held up: told to point it down", tips("Q", { ...POSES.Q, facing: "up" }).includes("Turn your hand so it points down"));
check("R without crossing: told to cross the fingers", tips("R", { ...POSES.R, crossed: false }).includes("Cross your middle finger over your index finger"));
check("K without the thumb on the middle finger: told where to put it", tips("K", { ...POSES.K, thumb: "tucked" }).includes("Rest your thumb tip on the middle of your middle finger"));
check("a correct hand has no advice", tips("Y", POSES.Y).length === 0);
check("an unknown letter gives no checks", checkLetter("1", open).length === 0);
check("every letter A-Z has a spec", "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").every((letter) => LETTER_SPECS[letter]));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
