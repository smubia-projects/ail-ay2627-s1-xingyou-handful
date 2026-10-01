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
     checks the saved-progress rules, and `node tests/e2e.mjs` plays through the app in headless Chrome.