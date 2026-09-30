@AGENTS.md


   # SignPath: ASL learning app (Duolingo-style)
   Goal: learners learn ASL signs in short lessons, all in one place.
   Camera / live correction is OUT of scope for now.

   ## Rules
   - Next.js (App Router) + TypeScript + Tailwind. No backend, no database, no login.
   - Progress is saved in the browser's localStorage.
   - Sign and lesson content lives in JSON files in a data/ folder at the project root.
   - Do not add any new package without asking me first.
   - Small changes. One feature at a time. Fewest files possible.
   - Before saying "done", run `npm run lint` and `npm run build` and show me the output.