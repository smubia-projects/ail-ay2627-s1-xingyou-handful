// Makes data/word-refs.json, which the camera uses to check one-handed word signs.
// Run with the app NOT needed, from the project folder:  node tools/build-word-refs.mjs
// Optionally:  node tools/build-word-refs.mjs --raw <folder>   also saves each video's hand points there.
//
// It opens each Signbank video in public/videos in headless Chrome, steps through it 15 times a
// second with the same hand tracker the app uses (one hand, same settings), and turns the hand
// points into the description lib/wordsign.ts compares against. The Signbank videos are
// CC BY-NC-SA 4.0 and this data is derived from them, so it stays non-commercial (docs/CREDITS.md).
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compare, describeAttempt, STEPS } from "../lib/wordsign.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 3300;
const FPS = 15;

// Which signs the camera checks is decided by rule, from the numbers this tool measures:
//  1. One hand only (the check sees one hand), and the sign is not defined by where the hand is on the body
//     (MOTHER, BLACK, FATHER) or by a wave (GOODBYE), which this check can't see.
//  2. Hand shapes at least MIN_GAP apart. The sign closest to another is dropped, one at a time, until all are.
//     Signs tested on a real learner (docs/WORD_SIGN_FEASIBILITY.md) are kept in preference to untested ones.
const CANDIDATES = [
  "blue", "yellow", "green", "where", "sorry", "milk", "drink", "eat", "no", "yes", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "please", "thank-you", "water", "who", "why", "red", "hello",
];
const TESTED = new Set(["blue", "yellow", "where", "sorry", "milk"]);
const MIN_GAP = 0.4;

const rawFolder = process.argv.includes("--raw") ? process.argv[process.argv.indexOf("--raw") + 1] : null;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const names = readdirSync(join(ROOT, "public/videos")).filter((f) => f.endsWith(".mp4")).map((f) => f.replace(".mp4", "")).sort();

const PAGE = `<!doctype html><meta charset="utf-8"><video id="v" muted playsinline></video>
<script type="module">
import { FilesetResolver, HandLandmarker } from "/lib/vision_bundle.mjs";
const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
const tracker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: "/mediapipe/hand_landmarker.task", delegate: "CPU" },
  runningMode: "VIDEO", numHands: 1,
});
const v = document.getElementById("v");
window.__results = {};
let stamp = 0;
for (const name of ${JSON.stringify(names)}) {
  window.__progress = name;
  v.src = "/videos/" + name + ".mp4";
  await new Promise((r) => v.addEventListener("loadeddata", r, { once: true }));
  const samples = [];
  for (let t = 0; t < v.duration - 0.02; t += 1 / ${FPS}) {
    v.currentTime = t;
    await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
    stamp += 100;
    const res = tracker.detectForVideo(v, stamp);
    if (res.worldLandmarks.length) samples.push({ t: Math.round(t * 1000), world: res.worldLandmarks[0].map((p) => ({ x: p.x, y: p.y, z: p.z })) });
  }
  window.__results[name] = samples;
}
window.__progress = "DONE";
</script>`;

const types = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".wasm": "application/wasm", ".task": "application/octet-stream", ".mp4": "video/mp4" };
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/") {
    res.setHeader("content-type", "text/html");
    res.end(PAGE);
    return;
  }
  const file =
    url === "/lib/vision_bundle.mjs"
      ? join(ROOT, "node_modules/@mediapipe/tasks-vision/vision_bundle.mjs")
      : url.startsWith("/mediapipe/") || url.startsWith("/videos/")
        ? join(ROOT, "public", url)
        : null;
  if (!file || !existsSync(file)) {
    res.statusCode = 404;
    res.end("not found");
    return;
  }
  const data = readFileSync(file);
  res.setHeader("content-type", types[file.slice(file.lastIndexOf("."))] ?? "application/octet-stream");
  res.setHeader("accept-ranges", "bytes");
  const range = req.headers.range;
  if (range) {
    const [from, to] = range.replace("bytes=", "").split("-");
    const start = Number(from);
    const end = to ? Number(to) : data.length - 1;
    res.statusCode = 206;
    res.setHeader("content-range", `bytes ${start}-${end}/${data.length}`);
    res.end(data.subarray(start, end + 1));
  } else {
    res.end(data);
  }
});
await new Promise((resolve) => server.listen(PORT, resolve));

// The tracker needs WebGL, which headless Chrome only has with software rendering.
const profile = mkdtempSync(join(tmpdir(), "handful-cam-"));
const port = 9800 + Math.floor(Math.random() * 100);
const chrome = spawn(
  CHROME,
  ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `http://localhost:${PORT}/`],
  { stdio: "ignore" },
);
const cleanUp = () => {
  chrome.kill();
  server.close();
  rmSync(profile, { recursive: true, force: true });
};
process.on("exit", cleanUp);

let targets;
for (let i = 0; i < 60 && !targets; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  } catch {
    await sleep(200);
  }
}
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));
let nextId = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) pending.get(message.id)(message);
});
const evaluate = (expression) =>
  new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, (m) => resolve(m.result?.result?.value));
    ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
  });

let last = "";
for (let waited = 0; waited < 30 * 60_000; waited += 3000) {
  await sleep(3000);
  const progress = await evaluate("window.__progress");
  if (progress !== last) console.log(progress);
  last = progress;
  if (progress === "DONE") break;
}
if (last !== "DONE") throw new Error("The hand tracker did not finish all the videos.");
const results = JSON.parse(await evaluate("JSON.stringify(window.__results)"));

if (rawFolder) {
  mkdirSync(rawFolder, { recursive: true });
  for (const [name, samples] of Object.entries(results)) writeFileSync(join(rawFolder, `${name}.json`), JSON.stringify(samples));
}

// Put the 24 measures on one scale: how much each varies across every sign's every step.
const all = Object.fromEntries(names.map((n) => [n, describeAttempt(results[n])]));
const rows = Object.values(all).flatMap((d) => d ?? []);
const dims = rows[0].length;
const mean = Array.from({ length: dims }, (_, k) => rows.reduce((a, r) => a + r[k], 0) / rows.length);
const std = Array.from({ length: dims }, (_, k) => Math.sqrt(rows.reduce((a, r) => a + (r[k] - mean[k]) ** 2, 0) / rows.length) || 1);

const round = (n) => Math.round(n * 1000) / 1000;
for (const id of CANDIDATES) if (!all[id]) throw new Error(`No hand found in the ${id} video.`);
const gap = (a, b) => compare(all[a], all[b], std).distance;
const nearest = (id, among) => among.filter((x) => x !== id).map((x) => ({ x, d: gap(id, x) })).sort((p, q) => p.d - q.d)[0];
let offered = [...CANDIDATES];
for (;;) {
  const closest = offered.map((id) => ({ id, ...nearest(id, offered) })).sort((p, q) => p.d - q.d)[0];
  if (closest.d >= MIN_GAP) break;
  const { id: a, x: b } = closest;
  const drop = TESTED.has(a) && !TESTED.has(b) ? b : TESTED.has(b) && !TESTED.has(a) ? a : nearest(a, offered.filter((x) => x !== b)).d < nearest(b, offered.filter((x) => x !== a)).d ? a : b;
  console.log(`dropped ${drop}: ${a} and ${b} are only ${closest.d.toFixed(2)} apart`);
  offered = offered.filter((x) => x !== drop);
}
const out = { std: std.map(round), signs: {} };
for (const id of offered) out.signs[id] = all[id].map((row) => row.map(round));
writeFileSync(join(ROOT, "data/word-refs.json"), JSON.stringify(out) + "\n");
console.log(`wrote data/word-refs.json: ${offered.length} signs (${offered.join(" ")}), ${STEPS} steps each`);
process.exit(0);
