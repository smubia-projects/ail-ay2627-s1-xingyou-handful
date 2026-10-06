// End-to-end walkthrough of Handful in headless Chrome, with no packages: it talks to Chrome
// over the DevTools Protocol. It plays lessons like a learner and checks what gets saved.
//
// Run with the app already running:
//   node tests/e2e.mjs                         (tests http://localhost:3000)
//   node tests/e2e.mjs http://localhost:3100   (tests another copy, e.g. `npx next start -p 3100`)
// Screenshots go to a temporary folder printed at the end.
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] ?? "http://localhost:3000";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Each run starts a fresh test browser, whose profile folder is about 150 MB. Delete the folders of
// earlier runs now, and this run's browser profile when it ends, so runs never pile up on the disk.
for (const name of readdirSync(tmpdir())) {
  if (name.startsWith("handful-e2e-")) rmSync(join(tmpdir(), name), { recursive: true, force: true });
}
const OUT = mkdtempSync(join(tmpdir(), "handful-e2e-"));
process.on("exit", () => rmSync(join(OUT, "profile"), { recursive: true, force: true }));
const SIGNS = JSON.parse(readFileSync(join(ROOT, "data/signs.json"), "utf8"));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9340 + Math.floor(Math.random() * 200);

const chrome = spawn(
  CHROME,
  ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(OUT, "profile")}`, "about:blank"],
  { stdio: "ignore" },
);
// However the run ends (a failure, a time-out, Ctrl-C), the test browser must not be left running: a
// stale one can burn the CPU for hours and slow every later run.
process.on("exit", () => chrome.kill());
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let targets;
for (let i = 0; i < 60; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    break;
  } catch {
    await sleep(200);
  }
}
const ws = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));
let nextId = 0;
const pending = new Map();
const consoleProblems = [];
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
  if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params.type)) {
    // MediaPipe's tracker reports routine progress through console.error and warnings. Not problems.
    const line = message.params.args.map((a) => a.value ?? a.description).join(" ");
    if (!/XNNPACK|NORM_RECT|gl_context|Graph successfully|Source Location|third_party|landmark_projection/.test(line)) {
      consoleProblems.push(`${message.params.type}: ${line.slice(0, 300)}`);
    }
  }
  if (message.method === "Runtime.exceptionThrown") {
    consoleProblems.push(`exception: ${message.params.exceptionDetails.exception?.description?.slice(0, 300)}`);
  }
});
// A hung browser must fail the run, not freeze it: every request has a time limit, and the whole run too.
const REQUEST_TIMEOUT_MS = 60_000;
const RUN_LIMIT_MS = 25 * 60_000;
setTimeout(() => {
  console.log(`TIMEOUT: the run took longer than ${RUN_LIMIT_MS / 60_000} minutes, so it was stopped.`);
  process.exit(2);
}, RUN_LIMIT_MS);
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`the browser did not answer ${method} within ${REQUEST_TIMEOUT_MS / 1000}s: ${JSON.stringify(params).slice(0, 160)}`));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
const ev = async (expression) => {
  const reply = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (reply.result?.exceptionDetails) {
    throw new Error("page eval failed: " + reply.result.exceptionDetails.exception?.description);
  }
  return reply.result?.result?.value;
};
await send("Page.enable");
await send("Runtime.enable");
await send("DOM.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

let passed = 0;
let failed = 0;
const startedAt = Date.now();
const check = (name, ok, detail = "") => {
  if (ok) passed++;
  else failed++;
  const seconds = String(Math.round((Date.now() - startedAt) / 1000)).padStart(4);
  console.log(`${ok ? "PASS" : "FAIL"} ${seconds}s  ${name}${detail ? "  — " + detail : ""}`);
};
const shot = async (name) => {
  const reply = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(reply.result.data, "base64"));
};
const go = async (path) => {
  await send("Page.navigate", { url: BASE + path });
  await sleep(1800);
};
// innerText follows CSS (e.g. uppercase), so compare case-insensitively where wording matters.
const text = () => ev("document.body.innerText");
const lower = async () => (await text()).toLowerCase();
const progress = async () => JSON.parse((await ev("localStorage.getItem('signpath:progress')")) ?? "null");
const patchProgress = (js) =>
  ev(`(() => { const p = JSON.parse(localStorage.getItem('signpath:progress')); ${js}; localStorage.setItem('signpath:progress', JSON.stringify(p)); })()`);
const clickText = (label) =>
  ev(`(() => { const b=[...document.querySelectorAll('button,a')].find(e=>e.innerText.trim().toLowerCase()===${JSON.stringify(label.toLowerCase())} && !e.disabled); if(!b) return false; b.click(); return true; })()`);
const pressKey = async (key, code) => {
  for (const type of ["keyDown", "keyUp"]) {
    await send("Input.dispatchKeyEvent", { type, key, code: key, windowsVirtualKeyCode: code, text: type === "keyDown" && key === "Enter" ? "\r" : undefined });
  }
  await sleep(450);
};
const currentTab = () => ev(`document.querySelector('nav[aria-label="Main"] a[aria-current="page"]')?.innerText.trim().toLowerCase()`);
const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const daysFromNow = (n) => {
  const date = new Date();
  date.setDate(date.getDate() + n);
  return dayKey(date);
};

// Helpers injected into the page to solve whatever exercise is showing.
// wrong=true answers incorrectly on purpose. Returns "<kind>:<sign or word>".
const PAGE_HELPERS = `
  window.__SIGNS = ${JSON.stringify(SIGNS)};
  window.__LABELS = {forehead:"forehead",mouth:"mouth",chin:"chin",chest:"chest",space:"in front of the body"};
  window.__sleep = (ms) => new Promise(r => setTimeout(r, ms));
  window.__heading = () => document.querySelector('h1')?.innerText.trim() ?? '';
  window.__byWord = (w) => __SIGNS.find(s => s.word === w);
  window.__signLabel = (s) => s.handshape + ', ' + __LABELS[s.location];
  window.__click = (label) => { const b=[...document.querySelectorAll('button')].find(e=>e.innerText.trim().toLowerCase()===label && !e.disabled); if (b) b.click(); return !!b; };
  window.__solve = async (wrong) => {
    const h = __heading();
    if (h === 'What does this sign mean?') {
      const sign = __SIGNS.find(s => s.id === document.querySelector('[data-sign]').dataset.sign);
      const opts = [...document.querySelectorAll('.grid button')];
      opts.find(b => wrong ? b.innerText.trim() !== sign.word : b.innerText.trim() === sign.word).click();
      await __sleep(100);
      return 'meaning:' + sign.id;
    }
    if (h.startsWith('Which is the sign for')) {
      const sign = __byWord(h.match(/“(.+)”/)[1]);
      const opts = [...document.querySelectorAll('.grid button')];
      // Choices must all be videos or all be drawings; a mix gives the answer away.
      const withVideo = opts.filter(b => b.querySelector('video')).length;
      if (withVideo !== 0 && withVideo !== opts.length) window.__mixedMedia = true;
      opts.find(b => { const hit = b.getAttribute('aria-label').endsWith(__signLabel(sign)); return wrong ? !hit : hit; }).click();
      await __sleep(100);
      return 'pick:' + sign.id;
    }
    if (h === 'What word is being fingerspelled?') {
      const word = [...document.querySelectorAll('[data-spelled-word] img')]
        .map(img => __SIGNS.find(s => s.id.startsWith('letter-') && 'Handshape: ' + s.handshape === img.alt).word).join('');
      const opts = [...document.querySelectorAll('.grid button')];
      opts.find(b => { const hit = b.innerText.trim().toUpperCase() === word; return wrong ? !hit : hit; }).click();
      await __sleep(100);
      return 'spell:' + word;
    }
    if (h.startsWith('Sign “')) {
      const word = h.match(/“(.+)”/)[1];
      __click('show the sign'); await __sleep(350);
      __click(wrong ? 'not yet' : 'got it'); await __sleep(350);
      return 'signit:' + word;
    }
    if (h === 'Match the pairs') {
      let wrongDone = !wrong;
      for (let round = 0; round < 14; round++) {
        const words = [...document.querySelectorAll('.grid > div:first-child button')].filter(b => !b.disabled);
        if (!words.length) break;
        const sign = __byWord(words[0].innerText.trim());
        const signBtns = [...document.querySelectorAll('.grid > div:last-child button')].filter(b => !b.disabled);
        let target = signBtns.find(b => b.getAttribute('aria-label').endsWith(__signLabel(sign)));
        if (!wrongDone) { target = signBtns.find(b => b !== target) ?? target; wrongDone = true; }
        words[0].click(); await __sleep(150); target.click(); await __sleep(700);
      }
      return 'match';
    }
    return 'unknown:' + h;
  };`;

const photographed = new Set();

// Plays a session: new-sign cards (mixed in with exercises) and every exercise.
// wrongPlan holds indexes of exercises (not cards) to answer wrong; stopAfter stops early.
async function play(wrongPlan = new Set(), stopAfter = Infinity) {
  await ev(PAGE_HELPERS);
  const result = { cards: 0, log: [], order: [], retries: 0, reviews: 0 };
  let exercise = 0;
  for (let guard = 0; guard < 120; guard++) {
    if (/complete!|passed!|ahead!|Not this time/.test(await ev("__heading()"))) break;
    const screen = await lower();
    if (/· new sign \d+ of \d+/.test(screen)) {
      result.cards++;
      result.order.push("card");
      await clickText("Continue");
      await sleep(450);
      continue;
    }
    if (exercise >= stopAfter) break;
    if (screen.includes("earlier mistake")) result.retries++;
    if (screen.includes("quick review")) result.reviews++;
    // First time each kind of exercise appears, keep a screenshot of it.
    const heading = (await ev("__heading()")).replace(/“.+”/, "").replace(/[^a-z]+/gi, "-").toLowerCase();
    if (!photographed.has(heading)) {
      photographed.add(heading);
      await shot(`exercise-${heading}`);
    }
    const wrong = wrongPlan.has(exercise);
    const kind = await ev(`__solve(${wrong})`);
    result.log.push(kind + (wrong ? "(wrong)" : ""));
    result.order.push(kind.split(":")[0]);
    exercise++;
    if (kind.startsWith("unknown")) break;
    if (!kind.startsWith("signit")) {
      await sleep(200);
      await clickText("Check");
      await sleep(300);
      if (!(await clickText("Continue"))) {
        result.log.push("NO CONTINUE");
        break;
      }
    }
    await sleep(500);
  }
  result.firstPass = result.log.length - result.retries;
  return result;
}
const count = (list, kind) => list.filter((item) => item === kind).length;

let t;
let p;
let r;

// ---------- W. First-time welcome ----------
await go("/");
const welcomeText = () => ev(`document.querySelector('[role=dialog]')?.innerText ?? ''`);
check("W1 a new learner is welcomed, and told this is an early version", (await welcomeText()).includes("Welcome to Handful") && (await welcomeText()).includes("An early version"));
await clickText("Next");
await sleep(600);
check("W2 step 2 explains mirror view with a video", (await welcomeText()).includes("Copy what you see") && (await ev("!!document.querySelector('[role=dialog] video')")));
await ev(`[...document.querySelectorAll('[role=dialog] [role=radio]')].find(b=>b.innerText.includes('Left hand')).click()`);
await sleep(400);
check("W3 choosing Left hand saves and un-flips the video", (await progress()).leftHanded === true && (await ev("getComputedStyle(document.querySelector('[role=dialog] video')).transform")) === "none");
await ev(`[...document.querySelectorAll('[role=dialog] [role=radio]')].find(b=>b.innerText.includes('Right hand')).click()`);
await sleep(300);
await clickText("Next");
await sleep(400);
await ev(`[...document.querySelectorAll('[role=dialog] [role=radio]')].find(b=>b.innerText.includes('Regular')).click()`);
await sleep(300);
check("W4 step 3 saves the daily goal", (await welcomeText()).includes("Pick a daily goal") && (await progress()).dailyGoal === 2);
await ev(`[...document.querySelectorAll('[role=dialog] [role=radio]')].find(b=>b.innerText.includes('Casual')).click()`);
await sleep(300);
await clickText("Start learning");
await sleep(500);
check("W5 welcome closes and is remembered", !(await ev("!!document.querySelector('[role=dialog]')")) && (await progress()).onboarded === true && (await progress()).leftHanded === false);
await go("/");
check("W6 welcome does not come back", !(await ev("!!document.querySelector('[role=dialog]')")));

// ---------- A. Brand-new learner ----------
t = await text();
check("A1 home shows all 9 units", ["Greetings", "Basics", "Family", "Feelings", "Numbers", "Questions", "Food & drink", "Colors", "Fingerspelling"].every((unit) => t.includes(unit)));
check("A2 23 of 24 lessons locked", (t.match(/Locked/g) ?? []).length === 23, `found ${(t.match(/Locked/g) ?? []).length}`);
check("A3 daily goal 0 of 1, review not unlocked, no mistakes", t.includes("0 of 1 session today") && t.includes("Unlocks as you learn") && t.includes("None right now"));
check("A4 Learn tab is current, with 4 tabs", (await currentTab()) === "learn" && (await ev(`document.querySelectorAll('nav[aria-label="Main"] a').length`)) === 4);
check("A4b every later unit offers 'Skip to here'", (await ev(`[...document.querySelectorAll('a')].filter(a => a.innerText.trim() === 'Skip to here').length`)) === 8);
await go("/signs");
t = await text();
check("A5 My signs empty state", t.includes("0 of 72 signs learned") && t.includes("Your sign collection starts here") && (await ev("document.title")) === "My signs · Handful");

// ---------- B. A perfect first lesson ----------
await go("/lesson/greetings-1");
r = await play();
check("B1 teach then practice: card, meaning, card, meaning", r.order.slice(0, 4).join() === "card,meaning,card,meaning", r.order.join(","));
check("B2 two signs: 2 cards, 6 questions (2 each of meaning, pick, sign-it)", r.cards === 2 && r.log.length === 6 && count(r.order, "signit") === 2 && count(r.order, "pick") === 2, r.log.join(", "));
t = await text();
check("B3 complete screen: +40 XP, 100%, streak 1 day +1 today", t.includes("Lesson complete!") && t.includes("+40") && t.includes("100%") && t.includes("1 day") && t.includes("+1 today!"), t.replace(/\n/g, " | ").slice(0, 160));
check("B3b reaching the daily goal is celebrated with confetti", (await ev(`document.querySelector('[data-celebration]')?.innerText ?? ''`)).includes("Daily goal reached") && (await ev("document.querySelectorAll('.animate-confetti').length")) === 16);
await shot("B-complete");
p = await progress();
check("B4 saved: lesson, 40 XP, streak 1, 1 session today", p.completedLessons.join() === "greetings-1" && p.xp === 40 && p.streak.count === 1 && p.today.sessions === 1, JSON.stringify(p).slice(0, 200));
check("B5 new signs scheduled for review tomorrow", p.reviews.hello?.box === 1 && p.reviews.hello.due === daysFromNow(1) && p.reviews.goodbye?.box === 1);
await clickText("Continue");
await sleep(1500);
t = await text();
check("B6 home: goal reached, unit 1 at 1/2, all caught up", t.includes("Goal reached") && t.includes("1/2") && t.includes("All caught up") && /40\s*XP/.test(t));

// ---------- C. A lesson with mistakes ----------
await go("/lesson/greetings-2");
r = await play(new Set([0, 1]));
check("C1 three signs: 10 questions first time round, no top-up needed", r.firstPass === 10 && r.reviews === 0, `first pass ${r.firstPass}, reviews ${r.reviews}`);
check("C2 missed questions came back", r.retries >= 2, `retries ${r.retries}: ${r.log.join(", ")}`);
t = await text();
check("C3 finishes, under 100%, streak not double-counted", t.includes("Lesson complete!") && !t.includes("100%") && t.includes("1 day") && !t.includes("+1 today!"));
p = await progress();
check("C4 mistakes saved, lesson complete", p.mistakes.length >= 1 && p.completedLessons.includes("greetings-2"), JSON.stringify(p.mistakes));
const mistakeCount = p.mistakes.length;
await go("/");
t = await text();
check("C5 home: unit complete, mistakes counted", t.includes("Complete") && t.includes(`${mistakeCount} sign${mistakeCount === 1 ? "" : "s"} to practice`));

// ---------- D. Practice mistakes ----------
await go("/practice");
t = await text();
check("D1 practice lists the missed signs", p.mistakes.every((id) => t.includes(SIGNS.find((sign) => sign.id === id).word)));
await clickText("Start");
await sleep(600);
r = await play();
t = await text();
check("D2 practice complete, all cleared, includes sign-it", t.includes("Practice complete!") && t.includes(`${mistakeCount} of ${mistakeCount}`) && count(r.order, "signit") === mistakeCount, r.log.join(", "));
p = await progress();
check("D3 mistakes empty, no lesson added", p.mistakes.length === 0 && p.completedLessons.length === 2);

// ---------- E. Short lesson gets quick reviews; "Not yet" on sign-it ----------
await go("/lesson/basics-1");
await ev(PAGE_HELPERS);
r = await play();
check("E1 two-sign lesson topped up to 8 questions with quick reviews", r.firstPass === 8 && r.reviews === 2, `first pass ${r.firstPass}, reviews ${r.reviews}`);
await go("/lesson/basics-2");
r = await play(new Set([3, 4, 5, 6, 7, 8, 9]));
p = await progress();
const notYet = r.log.filter((entry) => entry.startsWith("signit") && entry.endsWith("(wrong)")).length;
check("E2 'Not yet' on sign-it comes back and is saved as a mistake", notYet >= 1 && r.retries >= notYet && p.mistakes.length >= 1, `not yet ${notYet}, retries ${r.retries}, mistakes ${JSON.stringify(p.mistakes)}`);

// ---------- F. Quitting half-way ----------
await patchProgress("p.mistakes = []");
await go("/lesson/family-1");
await play(new Set([0]), 1);
await ev(`document.querySelector('a[aria-label="Quit lesson"]').click()`);
await sleep(1500);
p = await progress();
check("F1 quit: back home, mistake kept, lesson not complete", (await ev("location.pathname")) === "/" && p.mistakes.length === 1 && !p.completedLessons.includes("family-1"), JSON.stringify(p.mistakes));

// ---------- G. Streak freeze ----------
await patchProgress(`p.streak = { count: 6, lastDay: '${daysFromNow(-2)}', freezes: 1 }`);
await go("/");
check("G1 missed day covered by a freeze: header still shows 6", /\b6\b/.test((await text()).split("\n").slice(0, 8).join(" ")));
await go("/lesson/family-1");
await play();
t = await text();
p = await progress();
check("G2 streak reaches 7 and earns a freeze back", t.includes("7 days") && t.includes("Earned a freeze!") && p.streak.count === 7 && p.streak.freezes === 1, JSON.stringify(p.streak));
check("G3 the 7-day milestone is called out, and best streak saved", t.includes("7-day streak!") && p.bestStreak === 7);
await shot("G-milestone");

// ---------- H. Spaced review ----------
await patchProgress(`for (const id of ['hello','goodbye']) p.reviews[id] = { box: 2, due: '${daysFromNow(-1)}' }`);
await go("/");
t = await text();
const dueBefore = Number(t.match(/(\d+) signs? due/)?.[1] ?? 0);
check("H1 overdue signs show on the Review card", dueBefore >= 2, `due ${dueBefore}`);
await go("/review");
await clickText("Start");
await sleep(600);
r = await play();
p = await progress();
t = await text();
check("H2 review complete; remembered signs move up a box", t.includes("Review complete!") && p.reviews.hello.box === 3 && p.reviews.hello.due === daysFromNow(7), JSON.stringify(p.reviews.hello));

// ---------- N. Right and wrong feedback ----------
await go("/lesson/feelings-2");
await ev(PAGE_HELPERS);
await clickText("Continue");
await sleep(500);
await ev("__solve(true)");
await clickText("Check");
await sleep(350);
const wrongFeedback = await ev(`(() => { const r=document.querySelector('[data-result]'); return { result: r?.dataset.result, text: r?.innerText, stamp: !!document.querySelector('.animate-burst'), confetti: document.querySelectorAll('.animate-confetti').length, badges: document.querySelectorAll('.grid button .absolute').length, shaking: document.querySelectorAll('.grid button[class*="animate-shake"]').length }; })()`);
check("N1 wrong answer: stamp without confetti, cross and check badges, shake, correct answer named, no XP", wrongFeedback.result === "wrong" && wrongFeedback.stamp && wrongFeedback.confetti === 0 && wrongFeedback.badges === 2 && wrongFeedback.shaking === 1 && wrongFeedback.text.includes("Correct answer:") && !wrongFeedback.text.includes("XP"), JSON.stringify(wrongFeedback));
await shot("N-wrong-feedback");
await clickText("Continue");
await sleep(500);
await clickText("Continue");
await sleep(500);
await ev("__solve(false)");
await clickText("Check");
await sleep(350);
await shot("N-right-feedback");
await clickText("Continue");
await sleep(500);
let runText = "";
for (let i = 0; i < 6 && !/in a row/.test(runText); i++) {
  const kind = await ev("__solve(false)");
  if (kind.startsWith("signit")) { await sleep(400); continue; }
  await clickText("Check");
  await sleep(350);
  runText = await ev("document.querySelector('[data-result]')?.innerText ?? ''");
  await clickText("Continue");
  await sleep(500);
}
check("N2 a run of first-try answers shows 'in a row'", /\d in a row!/.test(runText), runText.replace(/\n/g, " | "));

// ---------- I. My signs ----------
await go("/signs");
t = await text();
check("I1 lists learned signs with locked counts", /\d+ of 72 signs learned/.test(t) && t.includes("Hello") && t.includes("more signs to unlock in this unit"));
await ev(`(() => { const i=document.querySelector('input[type=search]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'hel'); i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
await sleep(400);
t = await text();
check("I2 search 'hel' finds Hello and Help only", t.includes("Hello") && t.includes("Help") && !t.includes("Goodbye"));
await ev(`[...document.querySelectorAll('button[aria-expanded]')].find(b=>b.innerText.includes('Hello')).click()`);
await sleep(400);
check("I3 tapping a sign opens its card", (await lower()).includes("your sign") && (await text()).includes("A friendly salute"));
check("I4 no sideways scrolling", !(await ev("document.documentElement.scrollWidth > innerWidth")));

// ---------- J. Fingerspelling ----------
await go("/lesson/alphabet-1");
t = await text();
check("J1 four letters per lesson", /new sign 1 of 4/i.test(t));
check("J2 sign card fits a phone screen", await ev(`(() => { const tip=[...document.querySelectorAll('p')].find(p=>p.innerText.includes('Memory tip')).parentElement; const bar=document.querySelector('[data-primary]').closest('.fixed'); return tip.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top + 2; })()`));
r = await play();
t = await text();
const spelled = r.log.filter((entry) => entry.startsWith("spell:")).map((entry) => entry.slice(6));
check("J3 letters lesson includes 2 fingerspelling-reading questions", spelled.length === 2 && spelled.every((word) => /^[ABCD]+$/.test(word)), spelled.join(", "));
check("J4 letters lesson completes", t.includes("Lesson complete!"), r.order.join(","));

// ---------- Q. Camera option in "Sign it yourself" ----------
// Plays a lesson until the "Sign it yourself" screen for one sign comes up.
async function reachSignIt() {
  await ev(PAGE_HELPERS);
  for (let i = 0; i < 80; i++) {
    const screen = await lower();
    if (/· new sign \d+ of \d+/.test(screen)) {
      await clickText("Continue");
      await sleep(450);
      continue;
    }
    if ((await ev("__heading()")).startsWith("Sign “")) return true;
    await ev("__solve(false)");
    await sleep(200);
    await clickText("Check");
    await sleep(300);
    await clickText("Continue");
    await sleep(500);
  }
  return false;
}
await go("/lesson/greetings-1");
check("Q1 a word sign's 'Sign it yourself' reached", await reachSignIt());
check("Q2 words the camera can't check (HELLO, GOODBYE) don't offer it", !(await lower()).includes("check with my camera"));
await go("/lesson/alphabet-1");
check("Q3 a letter's 'Sign it yourself' reached", await reachSignIt());
check("Q4 letters offer the camera", (await lower()).includes("check with my camera"));
await clickText("Check with my camera");
await sleep(600);
check(
  "Q5 choosing it opens the camera panel, switched off, with the privacy promise",
  (await ev("document.querySelector('[data-camera-status]')?.dataset.cameraStatus")) === "idle" && (await text()).includes("Start camera") && (await text()).includes("Nothing is recorded or sent anywhere"),
);
await shot("Q-camera-in-lesson");
check("Q5b the real camera panel offers to load a video file, like the live camera does", await ev("!!document.querySelector('input[type=file]')"));
await clickText("Show the sign");
await sleep(500);
check("Q6 'Show the sign' still works, and the camera panel closes", !(await ev("!!document.querySelector('[data-camera-status]')")) && (await text()).includes("Got it"));

// A camera match inside a lesson stays on the camera panel: it doesn't jump to the answer.
await go("/lesson/alphabet-1");
let stayed = false;
for (let attempt = 0; attempt < 5 && !stayed; attempt++) {
  if (!(await reachSignIt())) break;
  const heading = await ev("__heading()");
  const clip = { "Sign “B”": "blue", "Sign “A”": "sorry" }[heading];
  if (!clip) {
    await ev("__solve(false)"); // not a letter with a clip to play: do it and move on to the next one
    await sleep(500);
    continue;
  }
  await clickText("Check with my camera");
  await sleep(500);
  const doc = await send("DOM.getDocument", {});
  const input = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: "input[type=file]" });
  await send("DOM.setFileInputFiles", { nodeId: input.result.nodeId, files: [join(ROOT, "public/videos", `${clip}.mp4`)] });
  await sleep(1200);
  await ev(`(() => { const v = document.querySelector('video'); if (v) v.playbackRate = 0.3; })()`);
  let matchedText = "";
  for (let i = 0; i < 150 && !matchedText; i++) {
    await sleep(200);
    matchedText = await ev(`document.querySelector('[data-camera-success]')?.innerText ?? ''`);
  }
  await sleep(1500); // give a wrongly-eager version time to jump ahead
  check(
    "Q7 a camera match in a lesson stays on the camera panel (it doesn't jump to the answer)",
    matchedText !== "" && (await ev("__heading()")).startsWith("Sign “") && (await ev("!!document.querySelector('[data-camera-status]')")) && !(await lower()).includes("got it"),
    JSON.stringify({
      matchedText,
      heading: await ev("__heading()"),
      panelStillThere: await ev("!!document.querySelector('[data-camera-status]')"),
      buttons: await ev("[...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean).slice(-6)"),
    }),
  );
  await clickText("Show the sign");
  await sleep(500);
  check(
    "Q8 pressing 'Show the sign' then reveals the answer, with what the camera said",
    (await lower()).includes("got it") && (await ev("!!document.querySelector('[data-camera-agrees], [data-camera-unsure]')")),
  );
  stayed = true;
}
check("Q9 the camera-in-lesson check found a letter with a clip to test", stayed);

// One-handed words: YES is checked with the camera, NO (and BLUE and others that were left out) is not.
await go("/lesson/basics-1");
let wordTested = false;
let noChecked = false;
// The lesson's exercises come in no fixed order, so keep going until both YES and NO have been seen.
for (let attempt = 0; attempt < 14 && !(wordTested && noChecked); attempt++) {
  if (!(await reachSignIt())) break;
  const heading = (await ev("__heading()")).toLowerCase();
  if (heading !== "sign “yes”" || wordTested) {
    if (heading === "sign “no”" && !noChecked) {
      noChecked = true;
      check("R1 a word the camera can't check reliably (NO) doesn't offer it", !(await lower()).includes("check with my camera"));
    }
    await ev("__solve(false)");
    await sleep(500);
    continue;
  }
  check("R2 YES offers the camera", (await lower()).includes("check with my camera"));
  await clickText("Check with my camera");
  await sleep(600);
  check(
    "R3 the word panel starts switched off, with the privacy promise and the 'practice guide' note",
    (await ev("document.querySelector('[data-word-status]')?.dataset.wordStatus")) === "idle" &&
      (await text()).includes("Nothing is recorded or sent anywhere") &&
      (await ev("document.querySelector('[data-word-note]')?.innerText ?? ''")).includes("not a grade"),
  );
  await shot("R-word-camera");
  const play = async (clip) => {
    const doc = await send("DOM.getDocument", {});
    const input = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: "input[type=file]" });
    await send("DOM.setFileInputFiles", { nodeId: input.result.nodeId, files: [join(ROOT, "public/videos", `${clip}.mp4`)] });
    await sleep(1200);
    await ev(`(() => { const v = document.querySelector('video'); if (v) v.playbackRate = 0.3; })()`);
    let verdict = "";
    for (let i = 0; i < 400 && !verdict; i++) {
      await sleep(200);
      verdict = await ev(`document.querySelector('[data-word-result]')?.dataset.wordResult ?? ''`);
    }
    return { verdict, distance: await ev(`document.querySelector('[data-word-result]')?.dataset.wordDistance ?? ''`), closest: await ev(`document.querySelector('[data-word-result]')?.dataset.wordClosest ?? ''`) };
  };
  // HELLO, a wave, with YES as the target: not a match (this is the "I can just wave" case).
  const wave = await play("hello");
  check("R4 a HELLO wave is not accepted as YES", wave.verdict !== "" && wave.verdict !== "match", JSON.stringify(wave));
  await clickText("Stop");
  await sleep(500);
  // EIGHT's real video, with YES as the target: not a match, and it says what it looked like.
  const wrong = await play("eight");
  check("R5 EIGHT's video is not accepted as YES, and the verdict names the word it looked like and gives a hint", wrong.verdict !== "" && wrong.verdict !== "match" && wrong.closest === "eight" && /looked more like EIGHT/.test(await text()) && /Watch the video again/.test(await text()), JSON.stringify(wrong));
  await clickText("Stop");
  await sleep(500);
  const right = await play("yes");
  check("R6 YES's real video is accepted as YES", right.verdict === "match" && right.closest === "yes", JSON.stringify(right));
  await sleep(1500);
  // The clip loops, so a new try can start and clear the verdict. What matters is that a match never jumps to the answer.
  check(
    "R7 after a match the learner stays on the camera panel (it doesn't jump to the answer)",
    (await ev("__heading()")).startsWith("Sign “") && (await ev("!!document.querySelector('[data-word-status]')")) && !(await lower()).includes("got it"),
  );
  await clickText("Show the sign");
  await sleep(500);
  check("R8 'Show the sign' then reveals the answer, with 'the camera agrees'", (await lower()).includes("got it") && (await ev("!!document.querySelector('[data-camera-agrees]')")));
  wordTested = true;
}
check("R9 the word camera check found YES to test", wordTested);
check("R10 NO was reached and checked", noChecked);

// ---------- S. Spell it ----------
await go("/");
check("S1 the home page has a 'Spell it' card that links to /spell", await ev(`!![...document.querySelectorAll('a')].find(a => a.getAttribute('href') === '/spell' && a.innerText.includes('Spell it'))`));
await go("/spell");
check(
  "S2 the page opens empty, with example names to tap",
  (await ev("document.title")) === "Spell it · Handful" && (await ev("!!document.querySelector('[data-spell-empty]')")) && (await ev("document.querySelectorAll('[data-spell-empty] button').length")) === 3 && (await ev("!document.querySelector('[data-spell-result]')")),
);
const typeSpelling = async (value) => {
  await ev(`(() => { const i = document.getElementById('spell-text'); i.focus(); i.select(); })()`);
  await send("Input.insertText", { text: value });
  await sleep(500);
};
await typeSpelling("Anna Lee");
const spellShown = await ev(`(() => { const items = [...document.querySelectorAll('[data-spell-letter]')]; const imgs = items.map(li => li.querySelector('img')); return { letters: items.map(li => li.dataset.spellLetter).join(''), headings: [...document.querySelectorAll('[data-spell-result] h2')].map(h => h.innerText), loaded: imgs.every(img => img && img.complete && img.naturalWidth > 0), alts: imgs.every(img => img.alt.startsWith('Handshape:')), mirrored: imgs.every(img => img.className.includes('hand-mirror')) }; })()`);
check("S3 'Anna Lee' shows 7 letters in two words, each with its handshape drawing", spellShown.letters === "ANNALEE" && spellShown.headings.join() === "ANNA,LEE" && spellShown.loaded && spellShown.alts, JSON.stringify(spellShown));
check("S3b the drawings follow the signing-hand setting (mirror view)", spellShown.mirrored);
check("S3c the page just shows the letters: no Play button or speed controls", !(await ev("!!document.querySelector('[data-spell-play], [role=radiogroup]')")) && !(await text()).includes("Slow"));
check("S4 double letters (NN, EE) get the bounce tip, and a pause tip appears between words", (await ev("!!document.querySelector('[data-spell-tip=double]')")) && !(await ev("!!document.querySelector('[data-spell-tip=moving]')")) && (await text()).includes("Pause briefly between words"));
await shot("S-spell-it");
await typeSpelling("Jazz");
check("S5 'Jazz' shows J, A, Z, Z with both the moving-letter and double-letter tips", (await ev(`[...document.querySelectorAll('[data-spell-letter]')].map(li => li.dataset.spellLetter).join('')`)) === "JAZZ" && (await ev("!!document.querySelector('[data-spell-tip=moving]')")) && (await ev("!!document.querySelector('[data-spell-tip=double]')")));
await typeSpelling("R2-D2");
check("S6 digits are left out, and the page says so", (await ev(`[...document.querySelectorAll('[data-spell-letter]')].map(li => li.dataset.spellLetter).join('')`)) === "RD" && (await ev("document.querySelector('[data-spell-skipped]')?.innerText ?? ''")).includes("2"));
await typeSpelling("");
check("S7 clearing the text brings back the empty state", await ev("!!document.querySelector('[data-spell-empty]') && !document.querySelector('[data-spell-result]')"));
await clickText("Maya");
await sleep(400);
check("S8 tapping an example fills it in and spells it", (await ev(`[...document.querySelectorAll('[data-spell-letter]')].map(li => li.dataset.spellLetter).join('')`)) === "MAYA");

// ---------- X. Word camera practice ----------
await go("/camera");
check(
  "X1 Camera practice has a Letters | Words switch, and Words leads to /camera/words",
  (await ev("document.querySelector('[data-camera-tabs] [aria-current=page]')?.innerText")) === "Letters" &&
    (await ev("document.querySelector('[data-camera-tabs] a[href=\"/camera/words\"]')?.innerText")) === "Words",
);
await go("/camera/words");
const wordChoices = await ev(`[...document.querySelectorAll('[data-word-choice]')].map(b => b.dataset.wordChoice).join()`);
check("X2 the Words page lists exactly the 3 words the camera checks, alphabetically", wordChoices === "eight,why,yes", wordChoices);
check(
  "X3 EIGHT is chosen first, with its video, a description and a switched-off camera panel",
  (await ev("document.querySelector('[data-camera-tabs] [aria-current=page]')?.innerText")) === "Words" &&
    (await text()).includes("Make the sign for Eight") &&
    (await ev("document.querySelector('[data-word-practice=eight] video')?.getAttribute('src')")) === "/videos/eight.mp4" &&
    (await ev("document.querySelector('[data-word-status]')?.dataset.wordStatus")) === "idle",
);
await shot("X-word-practice");
const playWord = async (clip) => {
  const doc = await send("DOM.getDocument", {});
  const input = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: "input[type=file]" });
  await send("DOM.setFileInputFiles", { nodeId: input.result.nodeId, files: [join(ROOT, "public/videos", `${clip}.mp4`)] });
  await sleep(1200);
  await ev(`(() => { const vs = [...document.querySelectorAll('video')]; const v = vs.find(x => x.srcObject === null && x.src.startsWith('blob:')); if (v) v.playbackRate = 0.3; })()`);
  let verdict = "";
  for (let i = 0; i < 400 && !verdict; i++) {
    await sleep(200);
    verdict = await ev(`document.querySelector('[data-word-result]')?.dataset.wordResult ?? ''`);
  }
  return { verdict, distance: await ev(`document.querySelector('[data-word-result]')?.dataset.wordDistance ?? ''`), closest: await ev(`document.querySelector('[data-word-result]')?.dataset.wordClosest ?? ''`) };
};
const wrongWave = await playWord("hello");
check("X4 a HELLO wave is not accepted as EIGHT", wrongWave.verdict !== "" && wrongWave.verdict !== "match", JSON.stringify(wrongWave));
await clickText("Stop");
await sleep(500);
const wrongWord = await playWord("yes");
check("X5 YES's real video is not accepted as EIGHT, and it says what it looked like", wrongWord.verdict !== "" && wrongWord.verdict !== "match" && wrongWord.closest === "yes" && /looked more like YES/.test(await text()), JSON.stringify(wrongWord));
await clickText("Stop");
await sleep(500);
const rightWord = await playWord("eight");
check("X6 EIGHT's real video is accepted as EIGHT", rightWord.verdict === "match" && rightWord.closest === "eight", JSON.stringify(rightWord));
await ev(`document.querySelector('[data-word-choice=why]').click()`);
await sleep(600);
check(
  "X7 choosing another word starts fresh: its video and description, no leftover result, camera off",
  (await text()).includes("Make the sign for Why") &&
    (await ev("document.querySelector('[data-word-practice=why] video')?.getAttribute('src')")) === "/videos/why.mp4" &&
    (await ev("document.querySelector('[data-word-status]')?.dataset.wordStatus")) === "idle" &&
    (await ev("document.querySelector('[data-word-result]')?.dataset.wordResult ?? ''")) === "",
);
check("X8 the Letters tab leads back to /camera", await ev(`(() => { const a = document.querySelector('[data-camera-tabs] a[href="/camera"]'); a.click(); return true; })()`) && (await sleep(1500), (await ev("location.pathname")) === "/camera"));

// ---------- K. Face line ----------
await go("/lesson/questions-1");
t = await text();
check("K1 question signs show a Face line", t.includes("Face") && t.includes("Eyebrows down"));
await shot("K-face");

// ---------- T. Checkpoints and skipping ahead ----------
await go("/");
t = await text();
check("T1 a finished unit offers its checkpoint", t.includes("Take the checkpoint"));
await go("/checkpoint/basics");
await clickText("Start");
await sleep(600);
r = await play(new Set([0, 1, 2, 3, 4]));
t = await text();
p = await progress();
check("T2 failing a checkpoint (too many wrong) does not mark the unit", t.includes("Not this time") && t.includes("80%") && !p.checkpoints.includes("basics"), `${r.firstPass} questions, retries ${r.retries}`);
await go("/checkpoint/greetings");
await clickText("Start");
await sleep(600);
r = await play();
t = await text();
p = await progress();
check("T3 passing a checkpoint: 5 questions, no self-marked ones, unit mastered", t.includes("Checkpoint passed!") && r.log.length === 5 && count(r.order, "signit") === 0 && p.checkpoints.includes("greetings"), r.log.join(", "));
await go("/");
check("T4 home shows Mastered", (await text()).includes("Mastered"));
await go("/skip/numbers");
check("T5 skip page explains the test", (await text()).includes("Skip to Numbers") && (await ev("document.title")) === "Skip to Numbers · Handful");
await clickText("Start");
await sleep(600);
r = await play();
t = await text();
p = await progress();
check("T6 passing the skip test unlocks everything before Numbers", t.includes("You skipped ahead!") && r.log.length === 12 && ["family-2", "feelings-1", "feelings-2"].every((id) => p.completedLessons.includes(id)) && p.reviews.tired?.box === 1, r.log.length + " questions");
await go("/");
t = await text();
check("T7 the path now starts at Numbers", /4\/4|Complete/.test(t) && (await ev(`!!document.querySelector('a[href="/lesson/numbers-1"]')`)));
await go("/skip/greetings");
check("T8 the first unit cannot be skipped to", (await text()).includes("Page not found"));

// ---------- P. Progress page ----------
await go("/progress");
p = await progress();
t = await text();
check("P1 progress page, tab and title", (await currentTab()) === "progress" && (await ev("document.title")) === "Progress · Handful" && t.includes("XP earned") && t.includes(String(p.xp)));
const readout = await ev("document.querySelector('[data-week-readout]').innerText");
check("P2 chart readout shows today's sessions", readout.startsWith(`${p.today.sessions} session`), readout);
check("P3 chart has 7 day columns and a 7-row table", (await ev("document.querySelectorAll('figure button').length")) === 7 && (await ev("document.querySelectorAll('figure tbody tr').length")) === 7);
await ev("document.querySelectorAll('figure button')[0].click()");
await sleep(300);
check("P4 tapping another day updates the readout", (await ev("document.querySelector('[data-week-readout]').innerText")).startsWith("0 sessions"));
await patchProgress(`p.dailyGoal = 2; p.history = { ['${daysFromNow(0)}']: { sessions: 2, xp: 50 }, ['${daysFromNow(-1)}']: { sessions: 4, xp: 90 } }`);
await go("/progress");
await sleep(900); // let the bars finish growing
const geometry = await ev(`(() => { const plot=document.querySelector('figure .relative'); const line=plot.querySelector('div[aria-hidden]').getBoundingClientRect(); const bars=[...plot.querySelectorAll('button > span:last-child')].map(b=>b.getBoundingClientRect()); const today=bars[6], yesterday=bars[5]; return { lineTop: Math.round(line.top), todayTop: Math.round(today.top), ratio: +(yesterday.height / today.height).toFixed(2), width: Math.round(today.width) }; })()`);
check("P4b bar that meets the goal reaches the goal line; heights are proportional; bars are thin", Math.abs(geometry.lineTop - geometry.todayTop) <= 2 && Math.abs(geometry.ratio - 2) < 0.03 && geometry.width <= 24, JSON.stringify(geometry));
await shot("P-progress-chart");
check("P5 no sideways scrolling on Progress", !(await ev("document.documentElement.scrollWidth > innerWidth")));
await shot("P-progress");

// ---------- V. Sign videos ----------
await go("/lesson/greetings-1");
await sleep(800);
const video = await ev(`(() => { const v=document.querySelector('video'); const a=document.querySelector('figcaption a'); return v && { width: v.videoWidth, playing: !v.paused, muted: v.muted, loop: v.loop, controls: v.controls, credit: a?.innerText, href: a?.href, target: a?.target }; })()`);
check("V1 sign card plays a silent looping video", video?.width > 0 && video.playing && video.muted && video.loop && !video.controls, JSON.stringify(video));
check("V2 video credits ASL Signbank, linking to the entry in a new tab", video?.credit === "ASL Signbank" && /aslsignbank\.com\/dictionary\/gloss\/\d+/.test(video.href) && video.target === "_blank", video?.href);
const facing = await ev(`(() => { const arrow=document.querySelector('svg.hand-mirror path[marker-end]'); const cap=document.querySelector('figcaption'); const shown=(c)=>getComputedStyle(cap.querySelector(c)).display !== 'none'; return { d: arrow.getAttribute('d'), right: shown('.hand-right-only'), left: shown('.hand-left-only'), text: cap.innerText }; })()`);
check("V2b diagram is drawn the same way round as the video (they flip together)", /^M84 /.test(facing.d) && / 38 38$/.test(facing.d), facing.d);
check("V2c caption: mirror view, copy with the right hand", facing.right && !facing.left && facing.text.includes("Mirror view. Copy what you see with your right hand."), facing.text);
check("V2d right hand (default): video and drawings are mirrored", await ev(`[...document.querySelectorAll('.hand-mirror')].length >= 3 && [...document.querySelectorAll('.hand-mirror')].every(el => getComputedStyle(el).transform.startsWith('matrix(-1'))`));
await ev("document.querySelector('video').click()");
await sleep(300);
check("V3 tapping the video pauses it", await ev("document.querySelector('video').paused"));
check("V4 card with a video still fits a phone screen", await ev(`(() => { const tip=[...document.querySelectorAll('p')].find(p=>p.innerText.includes('Memory tip')).parentElement; const bar=document.querySelector('[data-primary]').closest('.fixed'); return tip.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top + 2; })()`));
await shot("V-video-card");
await clickText("Continue");
await sleep(600);
check("V5 quiz question shows the video credit as text, not a link to the answer", await ev(`!!document.querySelector('video') && !!document.querySelector('figcaption') && !document.querySelector('figcaption a')`));
await go("/lesson/greetings-1");
r = await play();
check("V6 lesson with videos completes, and answer choices never mix videos with drawings", (await text()).includes("Lesson complete!") && !(await ev("window.__mixedMedia === true")), r.order.join(","));

// ---------- L. Settings ----------
await go("/settings");
check("L1 settings page, tab and title", (await currentTab()) === "settings" && (await ev("document.title")) === "Settings · Handful");
check(
  "L1b About states the privacy promise and that this is an early version, and credits the camera sources",
  /never\s+recorded, saved or sent anywhere/.test(await ev("document.querySelector('[data-about-privacy]')?.innerText.replace(/\\s+/g, ' ') ?? ''")) &&
    (await ev("document.querySelector('[data-about-early]')?.innerText ?? ''")).includes("early version") &&
    (await text()).includes("MediaPipe") &&
    (await text()).includes("ASLNow!") &&
    (await text()).includes("ASL Signbank"),
);
check("L1c every page carries the 'Early version' label in the header", (await ev("document.querySelector('header [data-early-label]')?.innerText ?? ''")) === "Early version");
await ev(`[...document.querySelectorAll('[role=radio]')].find(b=>b.innerText.includes('Serious')).click()`);
await sleep(300);
check("L2 daily goal saved", (await progress()).dailyGoal === 3);
await ev(`[...document.querySelectorAll('[role=radio]')].find(b=>b.innerText.includes('Left hand')).click()`);
await sleep(400);
check("L3 left-handed saved and switched on", (await progress()).leftHanded === true && (await ev("document.documentElement.dataset.hand")) === "left");
await go("/lesson/greetings-1");
check("L4 left hand: video and drawings are shown unflipped (hand on the left)", await ev(`[...document.querySelectorAll('.hand-mirror')].length >= 3 && [...document.querySelectorAll('.hand-mirror')].every(el => getComputedStyle(el).transform === 'none')`));
check("L4b left hand: caption says left", await ev(`(() => { const cap=document.querySelector('figcaption'); const shown=(c)=>getComputedStyle(cap.querySelector(c)).display !== 'none'; return shown('.hand-left-only') && !shown('.hand-right-only'); })()`));
await shot("L-left-handed");
await go("/settings");
await ev(`[...document.querySelectorAll('[role=radio]')].find(b=>b.innerText.includes('Right hand')).click()`);
await sleep(300);
await ev(`(() => { window.__dl = null; URL.revokeObjectURL = () => {}; const orig = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__dl = { name: this.download, href: this.href }; return; } return orig.call(this); }; })()`);
await clickText("Download backup");
await sleep(300);
const download = await ev(`(async () => window.__dl && { name: window.__dl.name, body: await (await fetch(window.__dl.href)).text() })()`);
const beforeBackup = await progress();
check("L5 backup downloads with progress inside", download?.name === `handful-backup-${dayKey(new Date())}.json` && JSON.parse(download.body).progress.xp === beforeBackup.xp, download?.name);
writeFileSync(join(OUT, "backup.json"), download.body);
writeFileSync(join(OUT, "not-a-backup.json"), JSON.stringify({ hello: 1 }));
await clickText("Reset progress");
await sleep(300);
check("L6 reset asks first", (await text()).includes("Erase everything?") && (await progress()).xp === beforeBackup.xp);
await clickText("Yes, erase it");
await sleep(400);
check("L7 reset erases progress", (await progress()).xp === 0 && (await progress()).completedLessons.length === 0);
const setFile = async (file) => {
  const doc = await send("DOM.getDocument", {});
  const input = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: "input[type=file]" });
  await send("DOM.setFileInputFiles", { nodeId: input.result.nodeId, files: [file] });
  await sleep(600);
};
await setFile(join(OUT, "not-a-backup.json"));
check("L8 a non-backup file is rejected", (await text()).includes("isn't a Handful backup") && (await progress()).xp === 0);
await setFile(join(OUT, "backup.json"));
check("L9 restore compares and asks first", (await text()).includes("Replace your current progress?") && (await text()).includes(`Backup: ${beforeBackup.xp} XP`));
await clickText("Replace");
await sleep(400);
p = await progress();
check("L10 restore brings progress back", p.xp === beforeBackup.xp && p.completedLessons.join() === beforeBackup.completedLessons.join());

// ---------- M. Keyboard, install, other pages ----------
await go("/lesson/family-2");
check("M1 tab title shows the lesson", (await ev("document.title")) === "Your people · Handful");
await pressKey("Enter", 13);
await ev(PAGE_HELPERS);
check("M2 Enter continues past a new-sign card", (await ev("__heading()")) === "What does this sign mean?", await ev("__heading()"));
await ev("__solve(false)");
check("M3 selected answer is marked for screen readers", (await ev(`document.querySelectorAll('[aria-pressed="true"]').length`)) === 1);
await pressKey("Enter", 13);
const feedback = await ev(`(() => { const r=document.querySelector('[data-result]'); return r && { result: r.dataset.result, text: r.innerText, stamp: !!document.querySelector('.animate-burst'), confetti: document.querySelectorAll('.animate-confetti').length, badge: document.querySelectorAll('.grid button .absolute').length }; })()`);
check("M4 Enter presses Check; a right answer gets a stamp, confetti, a tile badge and +5 XP", feedback?.result === "correct" && feedback.stamp && feedback.confetti === 16 && feedback.badge === 1 && feedback.text.includes("+5 XP"), JSON.stringify(feedback));
await pressKey("Enter", 13);
check("M5 Enter presses Continue", !(await ev("!!document.querySelector('[data-result]')")));
await go("/lesson/nope");
check("M6 styled not-found page", (await text()).includes("Page not found") && (await lower()).includes("back home"));
await go("/");
check("M7 no sideways scrolling on home", !(await ev("document.documentElement.scrollWidth > innerWidth")));
await pressKey("Tab", 9);
const focus = await ev(`(() => { const s=getComputedStyle(document.activeElement); return s.outlineStyle + ' ' + s.outlineWidth; })()`);
check("M8 keyboard focus is visible", /solid 3px/.test(focus), focus);
const manifest = await ev(`fetch('/manifest.webmanifest').then(r => r.json())`);
const assets = await ev(`Promise.all(['/icons/icon-192.png','/icons/icon-512.png','/apple-icon.png','/icon.svg','/handshapes/letter-a.svg','/handshapes/number-5.jpg'].map(u => fetch(u).then(r => r.status)))`);
check("M9 install manifest, icons and handshape drawings load", manifest.name === "Handful" && manifest.display === "standalone" && assets.every((status) => status === 200), JSON.stringify(assets));

// The header must fit a phone even with a long streak and a lot of XP (the "Early version" label once pushed the XP off the edge).
await patchProgress("p.xp = 12500; p.streak = { count: 123, lastDay: '" + daysFromNow(0) + "', freezes: 2 }");
await go("/settings");
const headerFit = await ev(`(() => { const h = document.querySelector("header"); const tag = h.querySelector("[data-early-label]").getBoundingClientRect(); return { headerWidth: Math.round(h.getBoundingClientRect().width), scrollWidth: h.scrollWidth, pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, tagWrapped: tag.height > 14 }; })()`);
check("M10 the header fits at phone width with a 123-day streak and 12,500 XP, label not wrapped", !headerFit.pageOverflow && headerFit.scrollWidth <= headerFit.headerWidth && !headerFit.tagWrapped, JSON.stringify(headerFit));

console.log(`\n${passed} passed, ${failed} failed`);
console.log(consoleProblems.length ? "Console problems:\n  " + [...new Set(consoleProblems)].join("\n  ") : "No console errors or warnings");
console.log(`Screenshots: ${OUT}`);
ws.close();
chrome.kill();
process.exit(failed ? 1 : 0);
