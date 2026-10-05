@AGENTS.md


   # Handful: ASL learning app (Duolingo-style)
   (Formerly SignPath. The repo folder and the localStorage key still use the old name on purpose.)
   Goal: learners learn ASL signs in short lessons, all in one place.
   Camera sign-checking is in scope (decided 2026-10-01): it runs in the learner's browser,
   the video never leaves their device, and it gives practice feedback, not a grade.

   ## Rules
   - Next.js (App Router) + TypeScript + Tailwind. No backend, no database, no login.
   - Progress is saved in the browser's localStorage.
   - Sign and lesson content lives in JSON files in a data/ folder at the project root.
   - Do not add any new package without asking me first. Approved so far: `@mediapipe/tasks-vision`
     (hand tracking for the camera check; its model and wasm files live in public/mediapipe/).
   - Sign videos come from ASL Signbank (CC BY-NC-SA 4.0), so the app must stay non-commercial
     (no ads, no paid version) and keep the credits described in docs/CREDITS.md. Use Signbank
     as the main source for signs; a sign it doesn't have is replaced with one it does.
   - Work in batches: one short plan, one "go", then build everything, test it yourself,
     and give one combined summary. Commit each part separately so any part can be undone.
     Only stop mid-batch for real decisions (new packages, scope changes). Fewest files possible.
   - Before saying "done", run `npm run lint` and `npm run build` and show me the output.
   - Tests live in tests/ (no packages needed). With the app running: `node tests/progress.test.mts`
     checks the saved-progress rules, `node tests/handshape.test.mts` the hand-shape rules,
     `node tests/wordsign.test.mts` the word-sign matching, `node tests/camera-messages.test.mts` the
     camera error messages, `node tests/spell.test.mts` the Spell it text rules, and
     `node tests/e2e.mjs` plays through the app in headless Chrome. `node tests/camera.mjs` runs real signing
     videos through the hand tracker (about 10 minutes; use `QUICK=1` for the short version).
     Both browser tests stop their Chrome when they end; if one is ever killed, check for a leftover
     `--headless` Chrome (`pgrep -f -- --headless`) and stop it, since a stale one slows every later run.