// Checks the word-sign matching (lib/wordsign.ts) against the shipped reference data
// (data/word-refs.json), using recorded Signbank hand points: tests/word-samples.json holds the three
// offered words, tests/word-others.json 15 other gestures (including the HELLO and GOODBYE waves).
// No camera needed.
// Run with:  node tests/wordsign.test.mts
import { readFileSync } from "node:fs";
import { compare, describeAttempt, judgeAttempt, motionAmount, STEPS, type Sample, type WordRefs } from "../lib/wordsign.ts";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  if (!ok) console.log(`FAIL  ${name}${detail ? `: ${detail}` : ""}`);
}

const here = (file: string) => new URL(file, import.meta.url);
const refs: WordRefs = JSON.parse(readFileSync(here("../data/word-refs.json"), "utf8"));
type Raw = Record<string, { t: number; world: number[][] }[]>;
const raw: Raw = JSON.parse(readFileSync(here("./word-samples.json"), "utf8"));
const rawOthers: Raw = JSON.parse(readFileSync(here("./word-others.json"), "utf8"));
const toSamples = (list: Raw[string]): Sample[] => list.map((s) => ({ t: s.t, world: s.world.map(([x, y, z]) => ({ x, y, z })) }));
const samples = (name: string) => toSamples(raw[name]);
const signs = Object.keys(refs.signs);

// ---- The data ----
const VERIFIED = ["eight", "why", "yes"];
check("the camera checks exactly EIGHT, WHY and YES", signs.length === VERIFIED.length && VERIFIED.every((id) => signs.includes(id)), signs.join(", "));
check(
  "words that failed or had too little room (BLUE, YELLOW, SORRY, MILK, WHERE, NO, PLEASE, TWO) are not offered",
  !["blue", "yellow", "sorry", "milk", "where", "no", "please", "two"].some((id) => signs.includes(id)),
);
check("words that depend on where the hand is (MOTHER, BLACK) or a wave (GOODBYE) are not offered", !["mother", "black", "goodbye"].some((id) => signs.includes(id)));
check("every word has 30 steps of 24 numbers and its own limit", signs.every((id) => refs.signs[id].length === STEPS && refs.signs[id].every((row) => row.length === 24) && refs.limits?.[id] > 0.1 && refs.limits![id] < 0.5) && refs.std.length === 24 && refs.std.every((v) => v > 0));
check("the signs that move have a movement floor, and EIGHT (a still handshape) does not", refs.minMotion?.why > 0 && refs.minMotion?.yes > 0 && refs.minMotion?.eight === undefined);
check("each moving sign's own reference clears its movement floor with room to spare", signs.every((id) => !refs.minMotion?.[id] || motionAmount(refs.signs[id], refs.std) >= refs.minMotion[id] * 1.2));
let nearest = Infinity;
let nearestPair = "";
for (const a of signs) for (const b of signs) if (a < b) {
  const d = compare(refs.signs[a], refs.signs[b], refs.std).distance;
  if (d < nearest) [nearest, nearestPair] = [d, `${a}~${b}`];
}
check("no two offered words have hand shapes closer than 0.40 (that is how they were chosen)", nearest >= 0.4, `${nearestPair} ${nearest.toFixed(2)}`);

// ---- A real recording is judged correctly ----
for (const id of signs) {
  const own = judgeAttempt(samples(id), id, refs)!;
  check(`${id}: its own Signbank video matches`, own.verdict === "match" && own.closest === id, `${own.verdict} ${own.distance.toFixed(2)} closest ${own.closest}`);
  const wrong = signs.filter((other) => other !== id).filter((other) => judgeAttempt(samples(id), other, refs)!.verdict !== "not-yet");
  check(`${id}: not accepted, not even as close, for any other offered word`, wrong.length === 0, `accepted as ${wrong.join(", ")}`);
  const mirrored = samples(id).map((s) => ({ t: s.t, world: s.world.map((p) => ({ x: -p.x, y: p.y, z: p.z })) }));
  check(`${id}: a left hand (mirror image) matches too`, judgeAttempt(mirrored, id, refs)!.verdict === "match");
  const slow = samples(id).map((s) => ({ ...s, t: s.t * 2 }));
  const fast = samples(id).map((s) => ({ ...s, t: s.t / 2 }));
  check(`${id}: twice as slow or twice as fast still matches`, judgeAttempt(slow, id, refs)!.verdict === "match" && judgeAttempt(fast, id, refs)!.verdict === "match");
  const gappy = samples(id).filter((_, i) => i % 3 !== 1);
  check(`${id}: a third of the frames missing still matches`, judgeAttempt(gappy, id, refs)!.verdict === "match");
  const offset = samples(id).map((s) => ({ ...s, t: s.t + 123456 }));
  check(`${id}: the clock's starting point doesn't matter`, judgeAttempt(offset, id, refs)!.verdict === "match");
}

// ---- Other gestures must not be accepted: this is the false-positive test ----
const rejected: string[] = [];
let comparisons = 0;
for (const [name, list] of Object.entries(rawOthers)) {
  for (const target of signs) {
    comparisons++;
    const j = judgeAttempt(toSamples(list), target, refs)!;
    if (j.verdict !== "not-yet") rejected.push(`${name} as ${target} (${j.verdict} ${j.distance.toFixed(2)})`);
  }
}
check(`${Object.keys(rawOthers).length} other gestures (incl. the HELLO and GOODBYE waves) are never accepted, or called close, for any offered word (${comparisons} comparisons)`, rejected.length === 0, rejected.join("; "));
for (const wave of ["hello", "goodbye"]) {
  check(`a ${wave.toUpperCase()} wave is not a match for any offered word`, signs.every((t) => judgeAttempt(toSamples(rawOthers[wave]), t, refs)!.verdict !== "match"));
}

// ---- A hand held still ----
// Frozen in the sign's pose, with the small shake a real tracker gives a still hand (fixed seed, so the test is repeatable).
let seed = 7;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296 - 0.5;
};
const heldStill = (id: string, shake: number): Sample[] => {
  const middle = samples(id)[Math.floor(samples(id).length / 2)].world;
  return samples(id).map((s) => ({ t: s.t, world: middle.map((p) => ({ x: p.x + noise() * shake, y: p.y + noise() * shake, z: p.z + noise() * shake })) }));
};
for (const id of ["why", "yes"]) {
  const results = [0.002, 0.004, 0.006].map((shake) => judgeAttempt(heldStill(id, shake), id, refs)!);
  check(`${id}: a hand held still in its pose (with ordinary tracker shake) is not a match`, results.every((r) => r.verdict !== "match"), results.map((r) => `${r.verdict} ${r.distance.toFixed(2)}`).join(", "));
  check(`${id}: a still hand is told to keep moving`, results.some((r) => r.hint === "movement"));
}
check("eight: a still hand IS a match, because EIGHT is a still handshape", judgeAttempt(heldStill("eight", 0.002), "eight", refs)!.verdict === "match");

// ---- Wrong signs and bad input ----
const yesAsEight = judgeAttempt(samples("yes"), "eight", refs)!;
check("a YES attempt aimed at EIGHT is not yet, and says it looked more like YES", yesAsEight.verdict === "not-yet" && yesAsEight.closest === "yes", `${yesAsEight.verdict} closest ${yesAsEight.closest}`);
check("a not-yet gives one of the hints", ["fingers", "positions", "direction", "movement"].includes(yesAsEight.hint));
check("too few samples can't be judged", judgeAttempt(samples("yes").slice(0, 3), "yes", refs) === null && describeAttempt([], false) === null);
check("a sign the camera doesn't check can't be judged", judgeAttempt(samples("yes"), "hello", refs) === null);
const oneMoment = samples("yes").map((s) => ({ ...s, t: 1000 }));
check("samples all at one moment can't be judged", judgeAttempt(oneMoment, "yes", refs) === null);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
