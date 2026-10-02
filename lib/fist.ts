// Tells the fist letters apart (A, E, M, N, S, T). They all have four folded fingers, so the finger
// rules can't separate them: the difference is where the thumb sits. This looks at the whole hand
// shape instead, with a small learned model (data/fist-model.json, made by tools/train-fists.mts
// from the public ASLNow! hand-landmark set, MIT licensed, see docs/CREDITS.md).
//
// It reads the tracker's picture landmarks (not the world ones the finger rules use), because that
// is what the training data is. Every point is first described relative to the hand itself, in
// palm widths, so it doesn't matter where the hand is, how big it is, or which hand it is.
import type { Point } from "./handshape";

export const FIST_LETTERS = ["A", "E", "M", "N", "S", "T"] as const;
// Other hands that also have four folded fingers (X, O and so on), so they aren't forced into a fist letter.
export const NOT_A_FIST = "other";

export type FistModel = {
  classes: string[];
  mean: number[];
  sd: number[];
  weights: number[][];
  bias: number[];
};

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (a: Point) => Math.hypot(a.x, a.y, a.z) || 1;
const unit = (a: Point): Point => {
  const l = length(a);
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const cross = (a: Point, b: Point): Point => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

// The 21 landmarks, normalized by picture width and height, are stretched back to the picture's real
// proportions (z is on the same scale as x), then measured in the hand's own frame: u runs from the
// wrist to the middle knuckle, v across the palm toward the thumb side, w out of the palm.
export function fistFeatures(landmarks: Point[], aspect: number): number[] {
  const p = landmarks.map((point) => ({ x: point.x * aspect, y: point.y, z: point.z * aspect }));
  const palm = length(sub(p[5], p[17]));
  const u = unit(sub(p[9], p[0]));
  const across = sub(p[5], p[17]);
  const flat = unit({
    x: across.x - dot(across, u) * u.x,
    y: across.y - dot(across, u) * u.y,
    z: across.z - dot(across, u) * u.z,
  });
  const w = cross(u, flat);
  const side = dot(sub(p[2], p[17]), flat) >= 0 ? 1 : -1;
  const q = p.map((point) => {
    const d = sub(point, p[0]);
    return { u: dot(d, u) / palm, v: (dot(d, flat) * side) / palm, w: (dot(d, w) * side) / palm };
  });
  const gap = (a: number, b: number) => Math.hypot(q[a].u - q[b].u, q[a].v - q[b].v, q[a].w - q[b].w);

  const out: number[] = [];
  for (const i of [3, 4]) out.push(q[i].u, q[i].v, q[i].w);
  for (const knuckle of [5, 9, 13, 17]) {
    out.push(
      q[knuckle + 3].u - q[knuckle].u,
      Math.hypot(q[knuckle + 3].u, q[knuckle + 3].v),
      gap(knuckle + 3, knuckle),
      q[knuckle + 1].u,
      gap(4, knuckle + 3),
      gap(4, knuckle + 1),
      gap(4, knuckle),
      q[knuckle + 3].w,
    );
  }
  out.push(gap(4, 2), gap(3, 5));
  return out;
}

export type FistGuess = { letter: string; share: number };

// The model's best guess among the fist letters and "other", and how much of its weight it puts there.
export function guessFist(landmarks: Point[], aspect: number, m: FistModel): FistGuess {
  const x = fistFeatures(landmarks, aspect).map((value, j) => (value - m.mean[j]) / m.sd[j]);
  const scores = m.classes.map((_, c) => m.bias[c] + m.weights[c].reduce((sum, weight, j) => sum + weight * x[j], 0));
  const top = Math.max(...scores);
  const e = scores.map((s) => Math.exp(s - top));
  const total = e.reduce((a, b) => a + b);
  const best = e.indexOf(Math.max(...e));
  return { letter: m.classes[best], share: e[best] / total };
}
