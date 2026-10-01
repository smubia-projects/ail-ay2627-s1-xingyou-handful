// End-to-end walkthrough of Handful in headless Chrome, with no packages: it talks to Chrome
// over the DevTools Protocol. It plays lessons like a learner and checks what gets saved.
//
// Run with the app already running:
//   node tests/e2e.mjs                         (tests http://localhost:3000)
//   node tests/e2e.mjs http://localhost:3100   (tests another copy, e.g. `npx next start -p 3100`)
// Screenshots go to a temporary folder printed at the end.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] ?? "http://localhost:3000";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = mkdtempSync(join(tmpdir(), "handful-e2e-"));
const SIGNS = JSON.parse(readFileSync(join(ROOT, "data/signs.json"), "utf8"));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9340 + Math.floor(Math.random() * 200);

const chrome = spawn(
  CHROME,
  ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(OUT, "profile")}`, "about:blank"],
  { stdio: "ignore" },
);
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
    consoleProblems.push(`${message.params.type}: ${message.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300)}`);
  }
  if (message.method === "Runtime.exceptionThrown") {
    consoleProblems.push(`exception: ${message.params.exceptionDetails.exception?.description?.slice(0, 300)}`);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
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
const check = (name, ok, detail = "") => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
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
    if (/complete!/.test(await ev("__heading()"))) break;
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

// ---------- A. Brand-new learner ----------
await go("/");
t = await text();
check("A1 home shows all 9 units", ["Greetings", "Basics", "Family", "Feelings", "Numbers", "Questions", "Food & drink", "Colors", "Fingerspelling"].every((unit) => t.includes(unit)));
check("A2 23 of 24 lessons locked", (t.match(/Locked/g) ?? []).length === 23, `found ${(t.match(/Locked/g) ?? []).length}`);
check("A3 daily goal 0 of 1, review not unlocked, no mistakes", t.includes("0 of 1 session today") && t.includes("Unlocks as you learn") && t.includes("None right now"));
check("A4 Learn tab is current", (await currentTab()) === "learn");
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

// ---------- K. Face line ----------
await go("/lesson/questions-1");
t = await text();
check("K1 question signs show a Face line", t.includes("Face") && t.includes("Eyebrows down"));
await shot("K-face");

// ---------- V. Sign videos ----------
await go("/lesson/greetings-1");
await sleep(800);
const video = await ev(`(() => { const v=document.querySelector('video'); const a=document.querySelector('figcaption a'); return v && { width: v.videoWidth, playing: !v.paused, muted: v.muted, loop: v.loop, controls: v.controls, credit: a?.innerText, href: a?.href, target: a?.target }; })()`);
check("V1 sign card plays a silent looping video", video?.width > 0 && video.playing && video.muted && video.loop && !video.controls, JSON.stringify(video));
check("V2 video credits ASL Signbank, linking to the entry in a new tab", video?.credit === "ASL Signbank" && /aslsignbank\.com\/dictionary\/gloss\/\d+/.test(video.href) && video.target === "_blank", video?.href);
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
await ev(`[...document.querySelectorAll('[role=radio]')].find(b=>b.innerText.includes('Serious')).click()`);
await sleep(300);
check("L2 daily goal saved", (await progress()).dailyGoal === 3);
await ev(`[...document.querySelectorAll('[role=radio]')].find(b=>b.innerText.includes('Left hand')).click()`);
await sleep(400);
check("L3 left-handed saved and switched on", (await progress()).leftHanded === true && (await ev("document.documentElement.dataset.hand")) === "left");
await go("/lesson/greetings-1");
check("L4 left-handed: drawings and diagram are mirrored", await ev(`[...document.querySelectorAll('.hand-mirror')].length >= 2 && [...document.querySelectorAll('.hand-mirror')].every(el => getComputedStyle(el).transform.startsWith('matrix(-1'))`));
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
check("M4 Enter presses Check", (await text()).includes("Nice!"));
await pressKey("Enter", 13);
check("M5 Enter presses Continue", !(await text()).includes("Nice!"));
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

console.log(`\n${passed} passed, ${failed} failed`);
console.log(consoleProblems.length ? "Console problems:\n  " + [...new Set(consoleProblems)].join("\n  ") : "No console errors or warnings");
console.log(`Screenshots: ${OUT}`);
ws.close();
chrome.kill();
process.exit(failed ? 1 : 0);
