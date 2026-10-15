// Checks the word-sign matching (lib/wordsign.ts) against the shipped reference data
// (data/word-refs.json), using recorded Signbank hand points: tests/word-samples.json holds the three
// offered words, tests/word-others.json 15 other gestures (including the HELLO and GOODBYE waves).
// No camera needed.
// Run with:  node tests/wordsign.test.mts
import { readFileSync } from "node:fs";
import { compare, describeAttempt, judgeAttempt, motionAmount, STEPS, thumbOutShare, type Sample, type WordRefs } from "../lib/wordsign.ts";

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

// ---- A thumbs up is not YES ----
// A thumbs up is a fist with the thumb out, and looked like a nodding YES (distance 0.38 against a limit of 0.39 on the
// learner's own clip). The thumb is what tells them apart. Simulated here from the Signbank YES hand with the thumb stuck up
// beside the index finger, so no one's own hand recordings are kept in the project.
const thumbsUp = (list: Sample[]): Sample[] =>
  list.map((sample) => {
    const w = sample.world;
    const palm = Math.hypot(w[5].x - w[17].x, w[5].y - w[17].y, w[5].z - w[17].z);
    const side = { x: w[5].x - w[17].x, y: w[5].y - w[17].y, z: w[5].z - w[17].z };
    const up = { x: w[5].x - w[0].x, y: w[5].y - w[0].y, z: w[5].z - w[0].z };
    const sl = Math.hypot(side.x, side.y, side.z);
    const ul = Math.hypot(up.x, up.y, up.z);
    const tip = {
      x: w[5].x + (side.x / sl) * palm * 0.6 + (up.x / ul) * palm * 0.5,
      y: w[5].y + (side.y / sl) * palm * 0.6 + (up.y / ul) * palm * 0.5,
      z: w[5].z + (side.z / sl) * palm * 0.6 + (up.z / ul) * palm * 0.5,
    };
    return { t: sample.t, world: w.map((p, i) => (i === 4 ? tip : p)) };
  });
check("YES has a limit on how often the thumb may stick out; EIGHT and WHY (which use the thumb) have none", (refs.maxThumbOut?.yes ?? 1) <= 0.6 && refs.maxThumbOut?.eight === undefined && refs.maxThumbOut?.why === undefined);
check("the Signbank YES video keeps its thumb tucked (sticks out in few frames)", thumbOutShare(samples("yes")) <= 0.3, `${Math.round(thumbOutShare(samples("yes")) * 100)}%`);
check("a simulated thumbs up has its thumb out in nearly every frame", thumbOutShare(thumbsUp(samples("yes"))) >= 0.9, `${Math.round(thumbOutShare(thumbsUp(samples("yes"))) * 100)}%`);
const upAsYes = judgeAttempt(thumbsUp(samples("yes")), "yes", refs)!;
check("a thumbs up is NOT accepted as YES, nor called close, and the learner is told to tuck the thumb in", upAsYes.verdict === "not-yet" && upAsYes.hint === "thumb", `${upAsYes.verdict} ${upAsYes.distance.toFixed(2)} hint ${upAsYes.hint}`);
check("the thumb rule is only for YES: moving the thumb out doesn't stop EIGHT or WHY matching their own video", ["eight", "why"].every((id) => judgeAttempt(samples(id), id, refs)!.verdict === "match"));

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
