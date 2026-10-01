"use client";

import { useState } from "react";
import { getLearnedSignIds, getUnits } from "@/lib/content";
import {
  currentStreak,
  recentDays,
  useProgress,
  useProgressLoaded,
  type Progress,
} from "@/lib/progress";

const PLOT_HEIGHT = 128;
// Bars and the goal line share this scale; the rest of the plot height is room for value labels.
const BAR_AREA = PLOT_HEIGHT - 24;

function Stat({ value, label, className }: { value: string; label: string; className: string }) {
  return (
    <div className={`rounded-3xl p-4 ${className}`}>
      <p className="font-display text-4xl leading-none font-bold text-ink">{value}</p>
      <p className="mt-1 text-sm font-semibold text-ink/70">{label}</p>
    </div>
  );
}

// "2026-10-01" as a local date, for weekday and day-month labels.
function toDate(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Sessions per day for the last 7 days: one series, so one color and no legend. Thin columns
// grow from a baseline, with the daily goal as a dashed reference line. The selected day's
// numbers are written out above the chart (tap, hover or focus a column), and the same data
// is available as a table.
function WeekChart({ progress }: { progress: Progress }) {
  const days = recentDays(progress.history, 7);
  const [selected, setSelected] = useState(days.length - 1);
  const goal = progress.dailyGoal;
  const top = Math.max(goal, ...days.map((day) => day.sessions), 1);
  const picked = days[selected];
  const weekday = (day: string) => toDate(day).toLocaleDateString(undefined, { weekday: "short" });

  return (
    <figure className="mt-3 rounded-[28px] p-5 ring-1 ring-line-strong">
      <figcaption className="font-display text-xl font-bold text-ink">Sessions per day</figcaption>
      <p className="mt-1 text-sm text-muted" aria-live="polite" data-week-readout>
        <span className="font-semibold text-ink">{plural(picked.sessions, "session")}</span> ·{" "}
        {picked.xp} XP ·{" "}
        {toDate(picked.day).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
      </p>
      <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-muted">
        <span className="inline-block w-6 border-t-2 border-dashed border-line-strong" aria-hidden="true" />
        Daily goal: {plural(goal, "session")}
      </p>

      <div className="relative mt-5" style={{ height: PLOT_HEIGHT }}>
        {/* Daily goal reference line */}
        <div
          className="absolute inset-x-0 border-t-2 border-dashed border-line-strong"
          style={{ bottom: (goal / top) * BAR_AREA }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 flex items-end border-b-2 border-charcoal">
          {days.map((day, index) => (
            <button
              key={day.day}
              type="button"
              onClick={() => setSelected(index)}
              onPointerEnter={() => setSelected(index)}
              onFocus={() => setSelected(index)}
              aria-label={`${weekday(day.day)}: ${plural(day.sessions, "session")}, ${day.xp} XP`}
              aria-pressed={index === selected}
              className="group flex h-full flex-1 flex-col items-center justify-end"
            >
              {day.sessions > 0 && (
                <span className="mb-1 text-xs font-bold text-ink">{day.sessions}</span>
              )}
              <span
                className={`w-6 shrink-0 rounded-t bg-fern-dark transition-all duration-500 ${index === selected ? "" : "opacity-70 group-hover:opacity-100"}`}
                style={{ height: (day.sessions / top) * BAR_AREA }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex" aria-hidden="true">
        {days.map((day, index) => (
          <span
            key={day.day}
            className={`flex-1 text-center text-xs ${index === days.length - 1 ? "font-bold text-ink" : "font-semibold text-muted"}`}
          >
            {index === days.length - 1 ? "Today" : weekday(day.day)}
          </span>
        ))}
      </div>

      <details className="mt-4 text-sm text-muted">
        <summary className="cursor-pointer font-semibold">View as a table</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-ink">
              <th className="py-1 font-semibold">Day</th>
              <th className="py-1 font-semibold">Sessions</th>
              <th className="py-1 font-semibold">XP</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.day} className="border-t border-line">
                <td className="py-1">
                  {toDate(day.day).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                </td>
                <td className="py-1">{day.sessions}</td>
                <td className="py-1">{day.xp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export default function ProgressPanel() {
  const progress = useProgress();
  const loaded = useProgressLoaded();

  // Dates depend on the learner's own clock, so nothing date-based renders on the server.
  if (!loaded) return <div className="invisible h-96" />;

  const units = getUnits();
  const totalLessons = units.reduce((sum, unit) => sum + unit.lessons.length, 0);
  const totalSigns = units.reduce(
    (sum, unit) => sum + unit.lessons.reduce((count, lesson) => count + lesson.signIds.length, 0),
    0,
  );
  const learned = getLearnedSignIds(progress.completedLessons);
  const strong = learned.filter((id) => (progress.reviews[id]?.box ?? 0) >= 4).length;
  const streak = currentStreak(progress.streak).count;

  return (
    <div className="motion-safe:animate-fade-in">
      <h1 className="font-display text-4xl font-bold text-ink">Progress</h1>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Stat value={String(streak)} label={`day streak · best ${progress.bestStreak}`} className="bg-honey" />
        <Stat value={String(progress.xp)} label="XP earned" className="bg-bluebell" />
        <Stat value={`${learned.length}/${totalSigns}`} label="signs learned" className="bg-fennel" />
        <Stat
          value={`${progress.completedLessons.length}/${totalLessons}`}
          label="lessons finished"
          className="bg-fennel"
        />
        <Stat value={String(strong)} label="signs you know well" className="bg-fern-soft" />
        <Stat
          value={`${progress.checkpoints.length}/${units.length}`}
          label="units mastered"
          className="bg-fern-soft"
        />
      </div>

      <h2 className="mt-10 font-display text-2xl font-bold text-ink">This week</h2>
      <WeekChart progress={progress} />
    </div>
  );
}
