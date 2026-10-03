// Checks a one-handed word sign (BLUE, WHERE and so on) against its Signbank video, by hand shape
// and by which way the hand turns, over the whole sign. Pure logic with no camera, so it can be
// tested on its own (tests/wordsign.test.mts) and used by tools/build-word-refs.mjs.
//
// It does not see where the hand is on the body or how it travels. On a real learner's attempts
// (docs/WORD_SIGN_FEASIBILITY.md) the hand's path added nothing for signs that twist, shake or
// squeeze, and measured wrongly when the hand rose into view, so it is left out.
import type { Point } from "./handshape";

// A hand seen at one moment: its 21 world landmarks and the time in milliseconds.
export type Sample = { t: number; world: Point[] };

// Every sign is squeezed to this many steps in time, so a slow attempt and a fast one line up.
export const STEPS = 30;
// How far the time-stretching match may bend the timing, in steps (about a quarter of the sign).
const BAND = 8;

// Distance limits, measured on a real learner's attempts at five signs against 45 other signs: at 0.35
// 14 in 15 right attempts were accepted and 2.7 in 100 wrong signs; at 0.40, 15 in 15 and 8.4 in 100.
export const MATCH_WITHIN = 0.35;
export const CLOSE_WITHIN = 0.45;

export type WordRefs = {
  // How much each of the 24 measures varies across all 46 Signbank signs, for putting them on one scale.
  std: number[];
  // The signs the camera can check, each as STEPS rows of 24 numbers.
  signs: Record<string, number[][]>;
};

type V3 = [number, number, number];
const vec = (p: Point): V3 => [p.x, p.y, p.z];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a: V3) => Math.hypot(a[0], a[1], a[2]) || 1;
const unit = (a: V3): V3 => {
  const l = length(a);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// The 24 numbers for one moment: how straight each finger is (4), where each fingertip is in the
// hand's own frame, in palm widths (15), and which way the hand points and faces (5).
export function frameFeatures(world: Point[], mirrored = false): number[] {
  const w = world.map((p) => vec(mirrored ? { x: -p.x, y: p.y, z: p.z } : p));
  const palm = length(sub(w[5], w[17]));
  const straight = [5, 9, 13, 17].map(
    (k) => length(sub(w[k + 3], w[k])) / (length(sub(w[k + 1], w[k])) + length(sub(w[k + 2], w[k + 1])) + length(sub(w[k + 3], w[k + 2]))),
  );
  const up = unit(sub(w[9], w[0]));
  const across = sub(w[5], w[17]);
  const side = unit(sub(across, [up[0] * dot(across, up), up[1] * dot(across, up), up[2] * dot(across, up)]));
  const face = cross(up, side);
  const tips = [4, 8, 12, 16, 20].flatMap((k) => {
    const d = sub(w[k], w[0]);
    return [dot(d, up) / palm, dot(d, side) / palm, dot(d, face) / palm];
  });
  return [...straight, ...tips, up[0], up[1], face[0], face[1], face[2]];
}

// An attempt as STEPS rows in time: the hand's measures at evenly spaced moments from the first
// sample to the last, filled in between samples (so a dropped frame or an uneven frame rate is fine).
export function describeAttempt(samples: Sample[], mirrored = false): number[][] | null {
  if (samples.length < 4) return null;
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const rows = sorted.map((s) => frameFeatures(s.world, mirrored));
  const start = sorted[0].t;
  const span = sorted[sorted.length - 1].t - start;
  if (span <= 0) return null;
  const out: number[][] = [];
  let i = 0;
  for (let step = 0; step < STEPS; step++) {
    const t = start + (span * step) / (STEPS - 1);
    while (i < sorted.length - 2 && sorted[i + 1].t < t) i++;
    const gap = sorted[i + 1].t - sorted[i].t || 1;
    const mix = Math.min(1, Math.max(0, (t - sorted[i].t) / gap));
    out.push(rows[i].map((v, k) => v + (rows[i + 1][k] - v) * mix));
  }
  return out;
}

// Which kind of difference to point the learner at.
export type Hint = "fingers" | "positions" | "direction";
const GROUPS: [Hint, number, number][] = [
  ["fingers", 0, 4],
  ["positions", 4, 19],
  ["direction", 19, 24],
];
export const HINT_TEXT: Record<Hint, string> = {
  fingers: "Check which of your fingers are straight and which are bent",
  positions: "Check where your fingers and thumb go",
  direction: "Turn your hand so it faces the way it does in the video",
};

// How far apart two descriptions are: a time-stretching match (so timing can differ), on measures put
// on one scale, summed along the best alignment. Also says which kind of difference was biggest.
export function compare(a: number[][], b: number[][], std: number[]): { distance: number; hint: Hint } {
  const cost = (i: number, j: number) => {
    let s = 0;
    for (let k = 0; k < std.length; k++) s += ((a[i][k] - b[j][k]) / std[k]) ** 2;
    return Math.sqrt(s / std.length);
  };
  const D: number[][] = Array.from({ length: STEPS }, () => new Array(STEPS).fill(Infinity));
  for (let i = 0; i < STEPS; i++) {
    for (let j = Math.max(0, i - BAND); j <= Math.min(STEPS - 1, i + BAND); j++) {
      const before = i === 0 && j === 0 ? 0 : Math.min(i > 0 ? D[i - 1][j] : Infinity, j > 0 ? D[i][j - 1] : Infinity, i > 0 && j > 0 ? D[i - 1][j - 1] : Infinity);
      D[i][j] = cost(i, j) + before;
    }
  }
  // Walk back along the best alignment, adding up how much each group of measures differs.
  const spent: Record<Hint, number> = { fingers: 0, positions: 0, direction: 0 };
  let i = STEPS - 1;
  let j = STEPS - 1;
  for (;;) {
    for (const [name, from, to] of GROUPS) {
      let s = 0;
      for (let k = from; k < to; k++) s += ((a[i][k] - b[j][k]) / std[k]) ** 2;
      spent[name] += s / (to - from);
    }
    if (i === 0 && j === 0) break;
    const options = [
      [i - 1, j - 1],
      [i - 1, j],
      [i, j - 1],
    ].filter(([x, y]) => x >= 0 && y >= 0 && D[x][y] < Infinity);
    [i, j] = options.sort((p, q) => D[p[0]][p[1]] - D[q[0]][q[1]])[0];
  }
  const hint = (Object.keys(spent) as Hint[]).sort((p, q) => spent[q] - spent[p])[0];
  return { distance: D[STEPS - 1][STEPS - 1] / (2 * STEPS), hint };
}

export type Verdict = "match" | "close" | "not-yet";
export type Judgement = {
  verdict: Verdict;
  // How far the attempt is from the target sign: smaller is closer.
  distance: number;
  // The checkable sign the attempt was closest to (the target, if nothing else was closer).
  closest: string;
  hint: Hint;
};

// Judges one attempt against the target sign. A left hand is tried as well, as its mirror image.
export function judgeAttempt(samples: Sample[], target: string, refs: WordRefs): Judgement | null {
  const plain = describeAttempt(samples);
  const flipped = describeAttempt(samples, true);
  if (!plain || !flipped || !refs.signs[target]) return null;
  const scores = Object.entries(refs.signs).map(([id, ref]) => {
    const a = compare(ref, plain, refs.std);
    const b = compare(ref, flipped, refs.std);
    return { id, ...(a.distance <= b.distance ? a : b) };
  });
  const mine = scores.find((s) => s.id === target)!;
  const closest = scores.reduce((best, s) => (s.distance < best.distance ? s : best)).id;
  const verdict: Verdict = mine.distance <= MATCH_WITHIN && closest === target ? "match" : mine.distance <= CLOSE_WITHIN ? "close" : "not-yet";
  return { verdict, distance: mine.distance, closest, hint: mine.hint };
}
