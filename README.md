# Handful

Learn American Sign Language, a small handful of signs a day.

A Duolingo-style ASL learning app that runs entirely in the browser: no accounts, no backend. Progress
is saved on the learner's own device.

## What it does

- **Short lessons** that teach each new sign (real signer video, handshape drawing, movement arrow,
  memory tip) and practise it straight away.
- **Practice and review:** multiple choice, match pairs, "sign it yourself", reading fingerspelling, a
  mistakes list, and spaced review that brings signs back before they're forgotten.
- **Streaks, XP, a daily goal, unit checkpoints**, skip-ahead tests and a progress page.
- **Camera practice** for fingerspelled letters: hand tracking runs in the browser and the video never
  leaves the device. It checks finger positions only, so it is practice feedback, not a grade.
- Mirror view and a left-hand option, installable on a phone's home screen.

## Run it

```bash
npm install
npm run dev        # then open http://localhost:3000
```

Checks (the app must be running for the browser tests):

```bash
npm run lint
npm run build
node tests/progress.test.mts     # saved-progress rules
node tests/handshape.test.mts    # hand-shape rules
node tests/e2e.mjs               # plays through the whole app in headless Chrome
node tests/camera.mjs            # real signing videos through the hand tracker (about 10 minutes)
```

The browser tests drive Google Chrome (macOS path) with no extra packages.

## Where things are

| Folder | What's in it |
|---|---|
| `data/` | All content as JSON: `signs.json`, `lessons.json`, `spelling-words.json`. Add a sign here and it appears in the app. |
| `app/`, `components/`, `lib/` | Next.js (App Router) pages, UI, and the logic (progress, lessons, hand shapes). |
| `public/` | Sign videos, handshape drawings, and the hand-tracking engine and model. |
| `docs/` | `PRD.md`, `CREDITS.md`, `SIGN_REVIEW.md` (checklist for a Deaf ASL reviewer), video guidelines. |
| `tests/` | The tests above. |

## Important notes

- **The sign descriptions are drafts** and still need review by a Deaf ASL signer before release. Use
  `docs/SIGN_REVIEW.md`.
- **It must stay non-commercial** (no ads, no paid version) while it uses ASL Signbank videos, which are
  licensed CC BY-NC-SA 4.0. Credits and conditions are in `docs/CREDITS.md`.
- Project rules for contributors (and for Claude Code) are in `CLAUDE.md`.

## Credits

- Sign videos: [ASL Signbank](https://aslsignbank.com) (Hochgesang, Crasborn & Lillo-Martin), CC BY-NC-SA 4.0.
- Handshape drawings: wpclipart.com (public domain) and Snailsmakemehappy (CC BY-SA 4.0), via Wikimedia Commons.
- Hand tracking: [Google MediaPipe](https://ai.google.dev/edge/mediapipe), Apache 2.0.

Full details: `docs/CREDITS.md`.

Built with Next.js, React, TypeScript and Tailwind CSS. (Originally called SignPath. The saved-progress
key keeps that name so nobody's progress is lost.)
