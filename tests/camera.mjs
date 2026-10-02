// Tests the camera check in headless Chrome, using real signing videos (the ASL Signbank clips in
// public/videos) as stand-ins for a learner's hand, plus Chrome's built-in fake camera.
//
// Run with the app already running:
//   node tests/camera.mjs                         (tests http://localhost:3000)
//   node tests/camera.mjs http://localhost:3100   (a production copy)
//
// The tracker needs WebGL, which headless Chrome only has with software rendering, so it is
// switched on here. Detection is slow in that mode (about 0.15-0.3 s a frame), so each video is
// sampled for several seconds and judged on the share of frames that matched.
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] ?? "http://localhost:3000";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A hung browser must fail the run, not freeze it: every request has a timeout, and the whole run
// has a time limit.
const REQUEST_TIMEOUT_MS = 30_000;
// Software WebGL tracks only about 5 frames a second, where a real phone manages around 30. Playing
// the test videos slower gives the tracker the same number of frames per movement a real device
// would get.
const SLOW_MOTION = 0.3;
const RUN_LIMIT_MS = 22 * 60_000;
setTimeout(() => {
  console.log(`TIMEOUT: the run took longer than ${RUN_LIMIT_MS / 60_000} minutes, so it was stopped.`);
  process.exit(2);
}, RUN_LIMIT_MS);

// Each test browser has a profile folder of about 70 MB. Clear any left by earlier runs now, and
// delete this run's when it ends, so runs never pile up on the disk.
for (const name of readdirSync(tmpdir())) {
  if (name.startsWith("handful-cam-")) rmSync(join(tmpdir(), name), { recursive: true, force: true });
}
const profileFolders = [];
process.on("exit", () => profileFolders.forEach((folder) => rmSync(folder, { recursive: true, force: true })));

async function launch({ graphics }) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = mkdtempSync(join(tmpdir(), "handful-cam-"));
  profileFolders.push(profile);
  const flags = graphics
    ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
    : ["--disable-gpu", "--disable-software-rasterizer"];
  const chrome = spawn(
    CHROME,
    ["--headless=new", ...flags, "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"],
    { stdio: "ignore" },
  );
  let targets;
  for (let i = 0; i < 60; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      break;
    } catch {
      await sleep(200);
    }
  }
  const ws = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve));
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`the browser did not answer ${method} within ${REQUEST_TIMEOUT_MS / 1000}s`));
      }, REQUEST_TIMEOUT_MS);
      pending.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  await send("Page.enable");
  await send("Runtime.enable");
  await send("DOM.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  return {
    send,
    ev,
    close: () => {
      ws.close();
      chrome.kill();
    },
    async go(path) {
      await send("Page.navigate", { url: BASE + path });
      await sleep(2500);
    },
    async chooseFile(path) {
      const doc = await send("DOM.getDocument", {});
      const input = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: "input[type=file]" });
      await send("DOM.setFileInputFiles", { nodeId: input.result.nodeId, files: [path] });
      for (let i = 0; i < 20; i++) {
        await sleep(150);
        if (await ev(`(() => { const v = document.querySelector('video'); if (!v || !v.src) return false; v.playbackRate = ${SLOW_MOTION}; return true; })()`)) break;
      }
    },
    clickText: (label) => ev(`(() => { const b=[...document.querySelectorAll('button')].find(e=>e.innerText.trim().toLowerCase()===${JSON.stringify(label.toLowerCase())} && !e.disabled); if(!b) return false; b.click(); return true; })()`),
    pickLetter: (letter) => ev(`[...document.querySelectorAll('[role=radio]')].find(b=>b.innerText.trim().startsWith(${JSON.stringify(letter)}))?.click()`),
    box: () => ev(`(() => { const c=document.querySelector('[data-camera-status]'); return c && { status: c.dataset.cameraStatus, hand: c.dataset.cameraHand, pass: c.dataset.cameraPass, matched: c.dataset.cameraMatched, message: c.querySelector('[role=status]')?.innerText ?? '' }; })()`),
  };
}

let passed = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

// ---------- With graphics (software WebGL) ----------
const page = await launch({ graphics: true });
await page.go("/camera");
check("C1 the practice page lists all 26 letters, with the privacy promise", (await page.ev(`document.querySelectorAll('[role=radio]').length`)) === 26 && (await page.ev("document.body.innerText")).includes("Nothing is recorded or sent anywhere"));
check(
  "C2 letters are marked: 11 tricky, 6 checked on a public set of real hands, 1 not yet checked (J)",
  (await page.ev(`[...document.querySelectorAll('[role=radio]')].filter(b => b.getAttribute('aria-label').includes('tricky')).length`)) === 11 &&
    (await page.ev(`[...document.querySelectorAll('[role=radio]')].filter(b => b.getAttribute('aria-label').includes('public set')).length`)) === 6 &&
    (await page.ev(`[...document.querySelectorAll('[role=radio]')].filter(b => b.getAttribute('aria-label').includes('not yet checked')).length`)) === 1,
);

// Share of sampled frames, over a few seconds, in which the tracker found a hand and the hand passed.
async function sampleVideo(video, letter) {
  await page.clickText("Stop");
  await sleep(300);
  await page.pickLetter(letter);
  await sleep(200);
  await page.chooseFile(join(ROOT, "public/videos", `${video}.mp4`));
  let frames = 0;
  let passes = 0;
  let sawHand = false;
  let last = "";
  const started = Date.now();
  while (Date.now() - started < 12000) {
    await sleep(120);
    const box = await page.box();
    if (box?.status === "error") return { error: box.message };
    if (box?.status === "running" && box.pass !== undefined && box.pass !== last + "x") {
      if (box.hand === "true") {
        sawHand = true;
        frames++;
        if (box.pass === "true") passes++;
      }
    }
  }
  return { frames, passes, share: frames ? passes / frames : 0, sawHand };
}

// Each real clip, the letter it should be accepted as, and letters it must not be accepted as.
const CASES = [
  { video: "blue", accept: "B", reject: ["L", "V", "Y"] },
  { video: "yellow", accept: "Y", reject: ["L", "V", "B"] },
  { video: "water", accept: "W", reject: ["V", "B"] },
  { video: "six", accept: "W", reject: ["V", "B"] },
  { video: "two", accept: "V", reject: ["W", "L", "Y", "K", "H"] },
  // The sign for 9 is an F hand: thumb and index touching, other fingers straight.
  { video: "nine", accept: "F", reject: ["B", "W", "V"] },
  // G and Q aren't told apart from a pointing finger any more (people sign them upright to a camera).
  { video: "one", accept: "Z", reject: ["L", "V", "B"] },
  // Real fists from Signbank signers who are not in the model's training data (YES is an S hand,
  // SORRY an A hand). Before the fist model, every fist letter accepted both 100% of the time.
  { video: "yes", accept: "S", reject: ["B", "V", "Y", "T", "E", "M", "N"] },
  { video: "sorry", accept: "A", reject: ["B", "V", "W", "S", "T", "M", "N"] },
  { video: "five", accept: null, reject: ["B", "L", "V"] },
  { video: "please", accept: null, reject: ["B", "V", "Y"] },
];
// Detection is slow and patchy in headless Chrome, so a window with almost no frames is retried.
async function sample(video, letter) {
  let result = await sampleVideo(video, letter);
  for (let attempt = 0; attempt < 2 && !result.error && result.frames < 3; attempt++) {
    result = await sampleVideo(video, letter);
  }
  return result;
}
const results = [];
// QUICK=1 skips the long video-by-video sampling, for fast checks while developing.
for (const test of process.env.QUICK ? [] : CASES) {
  if (test.accept) {
    const result = await sample(test.video, test.accept);
    results.push([test.video, test.accept, result]);
    check(
      `R: the ${test.video} video is accepted as ${test.accept}`,
      !result.error && result.sawHand && result.share >= 0.3,
      result.error ?? `${result.passes} of ${result.frames} frames matched (${Math.round(result.share * 100)}%)`,
    );
  }
  for (const letter of test.reject) {
    const result = await sample(test.video, letter);
    check(
      `R: the ${test.video} video is not accepted as ${letter}`,
      !result.error && result.sawHand && result.share <= 0.2,
      result.error ?? `${result.passes} of ${result.frames} frames matched (${Math.round(result.share * 100)}%)`,
    );
  }
}

// A letter accepted for long enough is announced once.
await page.clickText("Stop");
await page.pickLetter("Y");
await page.chooseFile(join(ROOT, "public/videos/yellow.mp4"));
// Switch away and back, so a stale "matched" from an earlier session would show up here.
await page.pickLetter("B");
await page.pickLetter("Y");
check("C3a a new session starts without a leftover match", (await page.box())?.matched === "false");
let announced = false;
const timeline = [];
for (let i = 0; i < 90 && !announced; i++) {
  await sleep(200);
  const now = await page.box();
  announced = now?.matched === "true";
  if (i % 5 === 0) timeline.push(`${now?.status}/${now?.hand}/${now?.pass}`);
}
const announcedBox = await page.box();
check(
  "C3 holding a Y long enough is announced as a match",
  announced && (await page.ev("document.body.innerText")).includes("That looks like Y!"),
  JSON.stringify(announcedBox) + " timeline: " + timeline.join(" "),
);

// A fist held up for S (the YES sign) is announced for S, but not for T, and the practice page explains
// how the fist letters are told apart.
await page.clickText("Stop");
await page.pickLetter("S");
await page.chooseFile(join(ROOT, "public/videos/yes.mp4"));
let fistBox = null;
for (let i = 0; i < 90; i++) {
  await sleep(200);
  fistBox = await page.ev(`(() => { const b = document.querySelector('[data-camera-success]'); return b && { text: b.innerText, confidence: b.dataset.cameraConfidence }; })()`);
  if (fistBox) break;
}
check(
  "C3b a fist held up for S (the YES sign) is announced as S, sure or not",
  /\bS\b/.test(fistBox?.text ?? "") && ["unsure", "learned"].includes(fistBox?.confidence),
  JSON.stringify(fistBox),
);
check(
  "C3b2 the fist letters show a note about how they are told apart",
  (await page.ev(`document.querySelector('[data-camera-note=learned]')?.innerText ?? ''`)).includes("close cousins"),
);
check(
  "C3c letters with unconfirmed rules show a note",
  await (async () => {
    await page.clickText("Stop");
    await page.pickLetter("J");
    return (await page.ev(`document.querySelector('[data-camera-note=unconfirmed]')?.innerText ?? ''`)).includes("Not yet checked against real hands");
  })(),
);

// The fake camera (a test pattern, no hands): the camera path starts, runs and stops cleanly.
await page.clickText("Stop");
await page.go("/camera");
check("C4 Start camera starts the camera and tracker", await page.clickText("Start camera"));
let box = null;
for (let i = 0; i < 80; i++) {
  await sleep(250);
  box = await page.box();
  if (box?.status === "running") break;
}
check("C5 the camera runs, and tells you when no hand is in view", box?.status === "running" && (await page.ev("document.body.innerText")).includes("Show your hand to the camera"), JSON.stringify(box));
check(
  "C6 the camera video is mirrored like a mirror",
  await page.ev(`(() => { const style = getComputedStyle(document.querySelector('video').parentElement); return style.transform.startsWith('matrix(-1') || style.scale.startsWith('-1'); })()`),
);
await page.clickText("Stop");
await sleep(500);
check("C7 Stop switches the camera off", (await page.ev(`document.querySelector('video').srcObject === null`)) && (await page.box())?.status === "idle");
page.close();

// ---------- Without graphics: a clear message, not a hang ----------
const bare = await launch({ graphics: false });
await bare.go("/camera");
await bare.chooseFile(join(ROOT, "public/videos/yellow.mp4"));
let bareBox = null;
for (let i = 0; i < 40; i++) {
  await sleep(300);
  bareBox = await bare.box();
  if (bareBox?.status === "error") break;
}
check("C8 with no graphics support, it says so clearly", bareBox?.status === "error" && bareBox.message.includes("graphics"), JSON.stringify(bareBox));
bare.close();

console.log(`\n${passed} passed, ${failed} failed`);
console.log("Share of frames matched per accepted case:", results.map(([video, letter, r]) => `${video}→${letter} ${Math.round((r.share ?? 0) * 100)}%`).join(", "));
process.exit(failed ? 1 : 0);
