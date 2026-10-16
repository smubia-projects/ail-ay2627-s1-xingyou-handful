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
  setLeftHanded,
  useProgress,
  useProgressLoaded,
  type Progress,
} from "@/lib/progress";

const GOAL_LABELS: Record<number, string> = { 1: "Casual", 2: "Regular", 3: "Serious", 5: "Intense" };

const BUTTON =
  "rounded-full px-5 py-3 font-bold transition active:scale-[0.97]";
const SECONDARY = `${BUTTON} border-2 border-charcoal bg-cream text-charcoal hover:bg-white`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
      <div className="mt-3 rounded-[28px] bg-surface p-5">{children}</div>
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
    link.download = `handful-backup-${dayKey()}.json`;
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
      setMessage({ tone: "bad", text: "That file isn't a Handful backup, so nothing was changed." });
      return;
    }
    setMessage(null);
    setConfirmingReset(false);
    setPendingRestore(backup);
  }

  return (
    <div className={loaded ? "motion-safe:animate-fade-in" : "invisible"}>
      <h1 className="font-display text-4xl font-bold text-ink">Settings</h1>

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
                className={`rounded-3xl border-2 p-3 text-left transition ${
                  selected
                    ? "border-charcoal bg-bluebell"
                    : "border-charcoal/25 bg-cream hover:border-charcoal"
                }`}
              >
                <span className="block font-display text-lg font-bold text-ink">{GOAL_LABELS[goal]}</span>
                <span className="block text-sm text-muted">
                  {goal} {goal === 1 ? "session" : "sessions"} a day
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Signing hand">
        <p className="text-sm text-muted">
          Videos, drawings and arrows are shown like a mirror: copy exactly what you see. Pick the
          hand you write with, and the signing hand appears on that side of the screen.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Signing hand">
          {[
            { label: "Right hand", value: false },
            { label: "Left hand", value: true },
          ].map((hand) => {
            const selected = progress.leftHanded === hand.value;
            return (
              <button
                key={hand.label}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setLeftHanded(hand.value)}
                className={`rounded-3xl border-2 p-3 text-left transition ${
                  selected
                    ? "border-charcoal bg-bluebell"
                    : "border-charcoal/25 bg-cream hover:border-charcoal"
                }`}
              >
                <span className="block font-display text-lg font-bold text-ink">{hand.label}</span>
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
          <div className="mt-4 rounded-3xl bg-cream p-4 ring-2 ring-peony-dark" role="alertdialog" aria-label="Confirm restore">
            <p className="font-display text-lg font-bold text-ink">Replace your current progress?</p>
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
                className={`${BUTTON} border-2 border-charcoal bg-fern text-charcoal hover:bg-fern-dark`}
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
          <div className="mt-4 rounded-3xl bg-cream p-4 ring-2 ring-peony-dark" role="alertdialog" aria-label="Confirm reset">
            <p className="font-display text-lg font-bold text-ink">Erase everything?</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  resetProgress();
                  setConfirmingReset(false);
                  setMessage({ tone: "good", text: "Progress reset. Fresh start!" });
                }}
                className={`${BUTTON} border-2 border-charcoal bg-peony text-charcoal`}
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
          <span className={message.tone === "good" ? "text-fern-dark" : "text-charcoal"}>
            {message.text}
          </span>
        )}
      </p>

      <Section title="About">
        <p className="text-sm text-muted">
          Handful teaches American Sign Language (ASL), a small handful of signs a day. The sign descriptions are drafts that still
          need to be checked by a Deaf ASL signer. Some signs have videos, with more to come.
        </p>
        <p className="mt-3 text-sm text-muted" data-about-early>
          <span className="font-semibold text-charcoal">This is an early version.</span> Things may change, and the camera is a
          practice guide, not a grade. It can&apos;t judge signing the way a Deaf teacher can.
        </p>
        <p className="mt-3 text-sm text-muted" data-about-privacy>
          <span className="font-semibold text-charcoal">Your privacy:</span> the camera check runs on your own device. Video is never
          recorded, saved or sent anywhere, and there are no accounts. Your progress is saved only in this browser.
        </p>
        <p className="mt-3 text-sm text-muted">
          Sign videos, and the hand-shape data the camera uses to check word signs: (ASL Signbank, 2026), videos shown mirrored in right-hand view, used with thanks under{" "}
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-charcoal underline underline-offset-2"
          >
            CC BY-NC-SA 4.0
          </a>
          . Hochgesang, J. A., Crasborn, O., &amp; Lillo-Martin, D. (2026 (2017-2026)). ASL Signbank.{" "}
          <a
            href="https://aslsignbank.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-charcoal underline underline-offset-2"
          >
            aslsignbank.com
          </a>
          .
        </p>
        <p className="mt-3 text-sm text-muted">
          Handshape drawings: letters by wpclipart.com (public domain); numbers 1–9 by{" "}
          <a
            href="https://commons.wikimedia.org/wiki/File:Sign_language_1.jpg"
            className="font-semibold text-charcoal underline underline-offset-2"
          >
            Snailsmakemehappy
          </a>
          , licensed{" "}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            className="font-semibold text-charcoal underline underline-offset-2"
          >
            CC BY-SA 4.0
          </a>
          , via Wikimedia Commons.
        </p>
        <p className="mt-3 text-sm text-muted">
          Camera check: hand tracking by Google MediaPipe (Apache 2.0). The fist-letter model (A, E, M, N, S, T) was trained on the
          ASLNow! hand-landmark set (MIT license),{" "}
          <a
            href="https://huggingface.co/datasets/sid220/asl-now-fingerspelling"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-charcoal underline underline-offset-2"
          >
            sid220/asl-now-fingerspelling
          </a>
          . Your video never leaves your device.
        </p>
        <p className="mt-3 text-sm text-muted" data-about-source>
          Handful is open source. Source code:{" "}
          <a
            href="https://github.com/xingyou07/handful"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-charcoal underline underline-offset-2"
          >
            github.com/xingyou07/handful
          </a>
        </p>
      </Section>
    </div>
  );
}
