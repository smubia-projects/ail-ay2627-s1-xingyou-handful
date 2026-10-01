"use client";

import { useRef, useState } from "react";
import { getLearnedSignIds } from "@/lib/content";
import {
  DAILY_GOALS,
  dayKey,
  exportProgress,
  readBackup,
  resetProgress,
  restoreProgress,
  setDailyGoal,
  useProgress,
  useProgressLoaded,
  type Progress,
} from "@/lib/progress";

const GOAL_LABELS: Record<number, string> = { 1: "Casual", 2: "Regular", 3: "Serious", 5: "Intense" };

const BUTTON =
  "rounded-2xl px-5 py-3 font-extrabold uppercase tracking-wide transition active:translate-y-1 active:shadow-none";
const SECONDARY = `${BUTTON} bg-white text-ink ring-2 ring-sand shadow-[0_4px_0_0_var(--color-sand)] hover:bg-cream`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-extrabold uppercase tracking-widest text-muted">{title}</h2>
      <div className="mt-3 rounded-3xl bg-white p-5 ring-1 ring-sand">{children}</div>
    </section>
  );
}

function summary(progress: Progress) {
  const signs = getLearnedSignIds(progress.completedLessons).length;
  return `${progress.xp} XP · ${progress.completedLessons.length} lessons · ${signs} signs`;
}

export default function SettingsPanel() {
  const progress = useProgress();
  const loaded = useProgressLoaded();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingRestore, setPendingRestore] = useState<Progress | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  function downloadBackup() {
    const blob = new Blob([exportProgress()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `signpath-backup-${dayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage({ tone: "good", text: "Backup downloaded. Keep the file somewhere safe." });
  }

  async function chooseBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const backup = readBackup(await file.text());
    if (!backup) {
      setMessage({ tone: "bad", text: "That file isn't a SignPath backup, so nothing was changed." });
      return;
    }
    setMessage(null);
    setConfirmingReset(false);
    setPendingRestore(backup);
  }

  return (
    <div className={loaded ? "motion-safe:animate-fade-in" : "invisible"}>
      <h1 className="text-3xl font-extrabold text-ink">Settings</h1>

      <Section title="Daily goal">
        <p className="text-sm text-muted">How many lessons, reviews or practice rounds a day?</p>
        <div className="mt-4 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Daily goal">
          {DAILY_GOALS.map((goal) => {
            const selected = progress.dailyGoal === goal;
            return (
              <button
                key={goal}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setDailyGoal(goal)}
                className={`rounded-2xl border-2 p-3 text-left transition ${
                  selected
                    ? "border-sage bg-sage-light shadow-[0_4px_0_0_var(--color-sage)]"
                    : "border-sand bg-white shadow-[0_4px_0_0_var(--color-sand)] hover:bg-cream"
                }`}
              >
                <span className="block font-extrabold text-ink">{GOAL_LABELS[goal]}</span>
                <span className="block text-sm text-muted">
                  {goal} {goal === 1 ? "session" : "sessions"} a day
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Your progress">
        <p className="font-bold text-ink">{summary(progress)}</p>
        <p className="mt-1 text-sm text-muted">
          Progress is saved in this browser only. Download a backup to keep it safe, or to move it
          to another browser or device.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={downloadBackup} className={SECONDARY}>
            Download backup
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} className={SECONDARY}>
            Restore backup
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={chooseBackup}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>

        {pendingRestore && (
          <div className="mt-4 rounded-2xl bg-peach-light p-4" role="alertdialog" aria-label="Confirm restore">
            <p className="font-extrabold text-ink">Replace your current progress?</p>
            <p className="mt-1 text-sm text-ink">
              Now: {summary(progress)}
              <br />
              Backup: {summary(pendingRestore)}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  restoreProgress(pendingRestore);
                  setPendingRestore(null);
                  setMessage({ tone: "good", text: "Backup restored." });
                }}
                className={`${BUTTON} bg-sage text-white shadow-[0_4px_0_0_var(--color-sage-dark)]`}
              >
                Replace
              </button>
              <button type="button" onClick={() => setPendingRestore(null)} className={SECONDARY}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section title="Start over">
        <p className="text-sm text-muted">
          Erase all lessons, XP, streak, reviews and mistakes in this browser. This can’t be undone
          unless you have a backup.
        </p>
        {confirmingReset ? (
          <div className="mt-4 rounded-2xl bg-peach-light p-4" role="alertdialog" aria-label="Confirm reset">
            <p className="font-extrabold text-ink">Erase everything?</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  resetProgress();
                  setConfirmingReset(false);
                  setMessage({ tone: "good", text: "Progress reset. Fresh start!" });
                }}
                className={`${BUTTON} bg-peach text-ink shadow-[0_4px_0_0_var(--color-peach-dark)]`}
              >
                Yes, erase it
              </button>
              <button type="button" onClick={() => setConfirmingReset(false)} className={SECONDARY}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPendingRestore(null);
              setMessage(null);
              setConfirmingReset(true);
            }}
            className={`mt-4 ${SECONDARY}`}
          >
            Reset progress
          </button>
        )}
      </Section>

      <p role="status" aria-live="polite" className="mt-6 min-h-6 text-center text-sm font-bold">
        {message && (
          <span className={message.tone === "good" ? "text-sage-dark" : "text-ink"}>
            {message.text}
          </span>
        )}
      </p>

      <Section title="About">
        <p className="text-sm text-muted">
          SignPath teaches American Sign Language (ASL). The sign descriptions are drafts that still
          need to be checked by a Deaf ASL signer. Sign videos are coming.
        </p>
      </Section>
    </div>
  );
}
