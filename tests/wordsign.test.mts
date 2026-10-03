// Checks the word-sign matching (lib/wordsign.ts) against the shipped reference data
// (data/word-refs.json), using recorded Signbank hand points for BLUE, WHERE and MILK
// (tests/word-samples.json). No camera needed.
// Run with:  node tests/wordsign.test.mts
import { readFileSync } from "node:fs";
import { compare, describeAttempt, judgeAttempt, STEPS, type Sample, type WordRefs } from "../lib/wordsign.ts";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  if (!ok) console.log(`FAIL  ${name}${detail ? `: ${detail}` : ""}`);
}

const refs: WordRefs = JSON.parse(readFileSync(new URL("../data/word-refs.json", import.meta.url), "utf8"));
const raw: Record<string, { t: number; world: number[][] }[]> = JSON.parse(readFileSync(new URL("./word-samples.json", import.meta.url), "utf8"));
const samples = (name: string): Sample[] => raw[name].map((s) => ({ t: s.t, world: s.world.map(([x, y, z]) => ({ x, y, z })) }));
const signs = Object.keys(refs.signs);

// ---- The data ----
check("the camera checks 11 words", signs.length === 11, signs.join(", "));
check("every word has 30 steps of 24 numbers", signs.every((id) => refs.signs[id].length === STEPS && refs.signs[id].every((row) => row.length === 24)) && refs.std.length === 24 && refs.std.every((v) => v > 0));
check("the words tested on a real learner are included", ["blue", "yellow", "where", "sorry", "milk"].every((id) => signs.includes(id)));
check("words that depend on where the hand is (MOTHER, BLACK) or a wave (GOODBYE) are not offered", !["mother", "black", "goodbye"].some((id) => signs.includes(id)));
let nearest = Infinity;
let nearestPair = "";
for (const a of signs) for (const b of signs) if (a < b) {
  const d = compare(refs.signs[a], refs.signs[b], refs.std).distance;
  if (d < nearest) [nearest, nearestPair] = [d, `${a}~${b}`];
}
check("no two offered words have hand shapes closer than 0.40 (that is how they were chosen)", nearest >= 0.4, `${nearestPair} ${nearest.toFixed(2)}`);

// ---- A real recording is judged correctly ----
for (const id of Object.keys(raw)) {
  const own = judgeAttempt(samples(id), id, refs)!;
  check(`${id}: its own Signbank video matches`, own.verdict === "match" && own.closest === id, `${own.verdict} ${own.distance.toFixed(2)} closest ${own.closest}`);
  const wrong = signs.filter((other) => other !== id).filter((other) => judgeAttempt(samples(id), other, refs)!.verdict === "match");
  check(`${id}: not accepted as any other word`, wrong.length === 0, `accepted as ${wrong.join(", ")}`);
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

// ---- Wrong signs and bad input ----
const blueAsWhere = judgeAttempt(samples("blue"), "where", refs)!;
check("a BLUE attempt aimed at WHERE is not yet, and says it looked more like BLUE", blueAsWhere.verdict === "not-yet" && blueAsWhere.closest === "blue", `${blueAsWhere.verdict} closest ${blueAsWhere.closest}`);
check("a not-yet gives one of the three hints", ["fingers", "positions", "direction"].includes(blueAsWhere.hint));
check("too few samples can't be judged", judgeAttempt(samples("blue").slice(0, 3), "blue", refs) === null && describeAttempt([], false) === null);
check("a sign the camera doesn't check can't be judged", judgeAttempt(samples("blue"), "hello", refs) === null);
const still = samples("blue").map((s) => ({ ...s, t: 1000 }));
check("samples all at one moment can't be judged", judgeAttempt(still, "blue", refs) === null);
// A hand held in one pose is not the moving sign.
const first = samples("blue")[0].world;
const frozen = samples("blue").map((s) => ({ t: s.t, world: first }));
const held = judgeAttempt(frozen, "blue", refs)!;
check("holding one pose is not accepted as BLUE (the hand has to twist)", held.verdict !== "match", `${held.verdict} ${held.distance.toFixed(2)}`);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
