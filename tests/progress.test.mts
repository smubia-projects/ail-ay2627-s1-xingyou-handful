// Checks the saved-progress rules (streak, freezes, reviews, mistakes, goal, backup) on their own.
// Run with:  node tests/progress.test.mts
const store = new Map<string, string>();
// A stand-in for the browser's localStorage, so the rules can run outside a browser.
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  },
});
const p = await import("../lib/progress.ts");
const KEY = "signpath:progress";
const saved = () => JSON.parse(store.get(KEY) ?? "{}");
const seed = (value: unknown) => store.set(KEY, JSON.stringify(value));
let passed = 0;
let failed = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) passed++;
  else failed++;
  if (!ok) console.log(`FAIL  ${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
}
const s = (count: number, lastDay: string | null, freezes = 0) => ({ count, lastDay, freezes });
const T = "2026-10-01";

// Streak and freezes
check("first lesson ever", p.nextStreak(s(0, null), T).streak, s(1, T));
check("same day unchanged", p.nextStreak(s(3, T), T).streak, s(3, T));
check("next day +1", p.nextStreak(s(3, "2026-09-30"), T).streak, s(4, T));
check("missed day, no freeze", p.nextStreak(s(3, "2026-09-29"), T).streak, s(1, T));
check("year end", p.nextStreak(s(5, "2026-12-31"), "2027-01-01").streak, s(6, "2027-01-01"));
check("clock-change day", p.nextStreak(s(2, "2026-03-08"), "2026-03-09").streak, s(3, "2026-03-09"));
check("day 7 earns a freeze", p.nextStreak(s(6, "2026-09-30"), T), { streak: s(7, T, 1), usedFreezes: 0, earnedFreeze: true });
check("max 2 freezes", p.nextStreak(s(20, "2026-09-30", 2), T).streak, s(21, T, 2));
check("freeze covers one missed day", p.nextStreak(s(9, "2026-09-29", 1), T), { streak: s(10, T, 0), usedFreezes: 1, earnedFreeze: false });
check("two missed days, one freeze: broken", p.nextStreak(s(9, "2026-09-28", 1), T).streak, s(1, T, 1));
check("shown: covered by freeze", p.currentStreak(s(5, "2026-09-29", 1), T), { count: 5, freezes: 0 });
check("shown: broken", p.currentStreak(s(5, "2026-09-29", 0), T), { count: 0, freezes: 0 });

// Spaced review
check("addDays across month", p.addDays("2026-10-30", 3), "2026-11-02");
check("addDays leap day", p.addDays("2028-02-28", 1), "2028-02-29");
check("new sign: box 1, tomorrow", p.nextReview(undefined, true, T), { box: 1, due: "2026-10-02" });
check("box 2 -> 3, 7 days", p.nextReview({ box: 2, due: T }, true, T), { box: 3, due: "2026-10-08" });
check("box 5 stays", p.nextReview({ box: 5, due: T }, true, T), { box: 5, due: "2026-10-31" });
check("wrong -> box 1", p.nextReview({ box: 4, due: T }, false, T), { box: 1, due: "2026-10-02" });
check(
  "due: unscheduled first, then most overdue",
  p.dueSignIds({ a: { box: 2, due: "2026-09-29" }, b: { box: 1, due: "2026-10-05" }, c: { box: 3, due: T } }, ["a", "b", "c", "d"], T),
  ["d", "a", "c"],
);

// Stored flows
seed({ completedLessons: ["greetings-1"], xp: 30 });
p.scheduleNewSigns(["hello", "goodbye"], T);
check("old save upgrades and schedules", [saved().xp, saved().reviews.hello], [30, { box: 1, due: "2026-10-02" }]);
p.recordReviewResults(["hello", "goodbye"], ["goodbye"], "2026-10-02");
check("review: right one moves up", [saved().reviews.hello.box, saved().reviews.goodbye.box], [2, 1]);
p.recordMistakes(["hello", "sorry"], "2026-10-05");
check("mistake: back to box 1, on list, unscheduled sign stays unscheduled", [saved().reviews.hello, saved().mistakes, saved().reviews.sorry], [{ box: 1, due: "2026-10-06" }, ["hello", "sorry"], undefined]);
p.recordMistakes(["sorry"]);
check("repeat mistake moves to front", saved().mistakes, ["sorry", "hello"]);
p.clearMistakes(["hello"]);
check("clearing removes only that sign", saved().mistakes, ["sorry"]);
const result = p.recordLessonComplete("greetings-2", 20);
check("lesson complete: saved, XP, session counted", [saved().completedLessons, saved().xp, saved().today.sessions, result.increasedToday], [["greetings-1", "greetings-2"], 50, 1, true]);
p.recordLessonComplete(null, 15);
check("practice: XP and session, no lesson added", [saved().completedLessons.length, saved().xp, saved().today.sessions], [2, 65, 2]);
check("yesterday's sessions don't carry over", p.sessionsToday({ ...saved(), today: { day: "2020-01-01", sessions: 4 } }), 0);

// Preferences, backup, reset
p.setDailyGoal(3);
p.setDailyGoal(4);
check("goal: valid kept, invalid ignored", saved().dailyGoal, 3);
p.setLeftHanded(true);
check("left-handed saved", saved().leftHanded, true);
const backup = p.exportProgress();
check("backup marker", JSON.parse(backup).app, "handful");
check("backup accepted", p.readBackup(backup)?.xp, 65);
check("old SignPath backup accepted", p.readBackup(JSON.stringify({ app: "signpath", progress: { xp: 42 } }))?.xp, 42);
check("other JSON rejected", p.readBackup(JSON.stringify({ xp: 999 })), null);
check("non-JSON rejected", p.readBackup("hello"), null);
p.resetProgress();
check("reset empties everything", [saved().xp, saved().completedLessons, saved().reviews, saved().leftHanded], [0, [], {}, false]);
p.restoreProgress(p.readBackup(backup)!);
check("restore brings it back", [saved().xp, saved().dailyGoal, saved().leftHanded], [65, 3, true]);
seed({ streak: { count: 3, lastDay: T, freezes: 99 }, reviews: { x: { box: 9, due: T }, y: null }, mistakes: ["a", 5], xp: -4, dailyGoal: 7 });
p.recordMistakes(["z"]);
check("damaged save is cleaned", [saved().streak.freezes, saved().reviews, saved().mistakes, saved().xp, saved().dailyGoal], [2, { x: { box: 5, due: T } }, ["z", "a"], 0, 1]);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
