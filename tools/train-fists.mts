// Makes data/fist-model.json: a small logistic-regression model that tells the fist letters apart
// from hand landmarks. Run:  node tools/train-fists.mts <folder>
// where <folder> holds the ASLNow! landmark set (sid220/asl-now-fingerspelling on Hugging Face, MIT):
// one folder per letter (A/, B/, ...), each with .json files of 21 {x, y, z} points.
// It also prints how well the model does on hands from sessions it was not trained on.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { analyzeHand, FINGERS } from "../lib/handshape.ts";
import { FIST_LETTERS, fistFeatures, NOT_A_FIST, type FistModel } from "../lib/fist.ts";

const folder = process.argv[2];
if (!folder) throw new Error("Usage: node tools/train-fists.mts <folder with A/ B/ ... letter folders>");
const ASPECT = 1.5; // the data's picture shape isn't recorded; webcams are 4:3 to 16:9

type Point = { x: number; y: number; z: number };
const samples: { letter: string; points: Point[] }[] = [];
for (const letter of readdirSync(folder).filter((name) => /^[A-Z]$/.test(name))) {
  for (const file of readdirSync(`${folder}/${letter}`).filter((name) => name.endsWith(".json"))) {
    try {
      const points = JSON.parse(readFileSync(`${folder}/${letter}/${file}`, "utf8"));
      if (Array.isArray(points) && points.length === 21) samples.push({ letter, points });
    } catch {
      // a half-downloaded file: skip it
    }
  }
}

// Fist letters, plus any other letter's hands that also have all four fingers folded.
const kept = samples.filter((s) => {
  if ((FIST_LETTERS as readonly string[]).includes(s.letter)) return true;
  const stretched = s.points.map((p) => ({ x: p.x * ASPECT, y: p.y, z: p.z * ASPECT }));
  return FINGERS.every((f) => analyzeHand(stretched).fingers[f] === "bent");
});

// Stand-in for "same person, same session": people sit at their own distance and spot in the
// picture, so clustering by hand size and position groups the samples roughly by session.
function sessions(list: Point[][], k = 6): number[] {
  const feat = list.map((p) => [Math.hypot(p[5].x - p[17].x, p[5].y - p[17].y) * 10, p[0].x * 2, p[0].y * 2]);
  let seed = 3;
  const random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let centers = Array.from({ length: k }, () => feat[Math.floor(random() * feat.length)].slice());
  let group = feat.map(() => 0);
  for (let round = 0; round < 30; round++) {
    group = feat.map((f) => centers.map((c, i) => ({ i, d: f.reduce((a, v, t) => a + (v - c[t]) ** 2, 0) })).sort((a, b) => a.d - b.d)[0].i);
    centers = centers.map((c, i) => {
      const mine = feat.filter((_, j) => group[j] === i);
      return mine.length ? c.map((_, t) => mine.reduce((a, f) => a + f[t], 0) / mine.length) : c;
    });
  }
  return group;
}
const groups = sessions(kept.map((s) => s.points));
const rows = kept.map((s, i) => ({
  label: (FIST_LETTERS as readonly string[]).includes(s.letter) ? s.letter : NOT_A_FIST,
  x: fistFeatures(s.points, ASPECT),
  group: groups[i],
}));

const classes = [...FIST_LETTERS, NOT_A_FIST];
function train(subset: typeof rows): FistModel {
  const d = subset[0].x.length, n = subset.length;
  const mean = subset[0].x.map((_, j) => subset.reduce((a, r) => a + r.x[j], 0) / n);
  const sd = subset[0].x.map((_, j) => Math.sqrt(subset.reduce((a, r) => a + (r.x[j] - mean[j]) ** 2, 0) / n) || 1);
  const z = subset.map((r) => r.x.map((v, j) => (v - mean[j]) / sd[j]));
  const y = subset.map((r) => classes.indexOf(r.label));
  const weights = classes.map(() => new Array(d).fill(0));
  const bias = classes.map(() => 0);
  for (let step = 0; step < 400; step++) {
    const gW = classes.map(() => new Array(d).fill(0));
    const gB = classes.map(() => 0);
    for (let i = 0; i < n; i++) {
      const s = classes.map((_, c) => bias[c] + weights[c].reduce((a, w, j) => a + w * z[i][j], 0));
      const top = Math.max(...s);
      const e = s.map((v) => Math.exp(v - top));
      const total = e.reduce((a, b) => a + b);
      for (let c = 0; c < classes.length; c++) {
        const g = e[c] / total - (y[i] === c ? 1 : 0);
        gB[c] += g;
        for (let j = 0; j < d; j++) gW[c][j] += g * z[i][j];
      }
    }
    for (let c = 0; c < classes.length; c++) {
      bias[c] -= (0.3 * gB[c]) / n;
      for (let j = 0; j < d; j++) weights[c][j] -= 0.3 * (gW[c][j] / n + 0.02 * weights[c][j]);
    }
  }
  return { classes, mean, sd, weights, bias };
}
function guess(m: FistModel, x: number[]) {
  const z = x.map((v, j) => (v - m.mean[j]) / m.sd[j]);
  const s = m.classes.map((_, c) => m.bias[c] + m.weights[c].reduce((a, w, j) => a + w * z[j], 0));
  const top = Math.max(...s);
  const e = s.map((v) => Math.exp(v - top));
  const total = e.reduce((a, b) => a + b);
  const best = e.indexOf(Math.max(...e));
  return { letter: m.classes[best], share: e[best] / total };
}

console.log(`${rows.length} hands:`, Object.fromEntries(classes.map((c) => [c, rows.filter((r) => r.label === c).length])));
const held = rows.map(() => ({ letter: "", share: 0 }));
for (let g = 0; g < 6; g++) {
  const m = train(rows.filter((r) => r.group !== g));
  rows.forEach((r, i) => { if (r.group === g) held[i] = guess(m, r.x); });
}
console.log("\nOn sessions the model had not seen, for each true letter: right / how often it said that letter with share >= 0.5, >= 0.75; wrong letters it also said yes to at >= 0.75");
for (const c of classes) {
  const mine = rows.map((r, i) => ({ r, h: held[i] })).filter((x) => x.r.label === c);
  const right = mine.filter((x) => x.h.letter === c).length;
  const sure = mine.filter((x) => x.h.letter === c && x.h.share >= 0.75).length;
  const half = mine.filter((x) => x.h.letter === c && x.h.share >= 0.5).length;
  const falseYes = rows.map((r, i) => ({ r, h: held[i] })).filter((x) => x.r.label !== c && x.h.letter === c && x.h.share >= 0.75).length;
  console.log(`${c.padEnd(5)} n=${String(mine.length).padStart(3)}  top guess right ${Math.round((100 * right) / mine.length)}%  share>=.5 ${Math.round((100 * half) / mine.length)}%  share>=.75 ${Math.round((100 * sure) / mine.length)}%   others wrongly called ${c} (>=.75): ${falseYes}`);
}
console.log(`overall right: ${Math.round((100 * rows.filter((r, i) => held[i].letter === r.label).length) / rows.length)}%`);

const final = train(rows);
const round = (n: number) => Math.round(n * 10000) / 10000;
writeFileSync(
  new URL("../data/fist-model.json", import.meta.url),
  JSON.stringify({ classes: final.classes, mean: final.mean.map(round), sd: final.sd.map(round), weights: final.weights.map((w) => w.map(round)), bias: final.bias.map(round) }) + "\n",
);
console.log("\nwrote data/fist-model.json");
