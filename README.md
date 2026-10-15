# Handful

**Learn American Sign Language, a small handful of signs a day. Free, in your browser, no account.**

Live app: **https://handful-asl.vercel.app**
Demo video: [EDIT: paste your demo video link here]

Handful is an early version. It teaches signs in short lessons, helps you practise and repeat them, and uses your camera to give practice feedback on your fingerspelling and a few signs. The camera runs on your own device, and your video never leaves it.

## 1. Problem Statement

I wanted to learn ASL but I ran into the same two problems everywhere I looked.

- **Most apps and platforms that teach ASL are paid.** I didn't want to pay a subscription just to start.
- **The free route is scattered.** On YouTube I had to click through lots of separate videos, with no
  order, no way to check what I'd actually remembered, and nothing that brought a sign back before I
  forgot it.

On top of that, I was not satisfied with practising alone. Whenever I copy a sign, nobody tells me whether I am doing it right.

This affects anyone teaching themselves a sign language: students, families and friends of deaf people,
and anyone who can't or doesn't want to pay for classes. It's worth solving because the barrier to
getting started should be low. Handful is my attempt at lowering it!

## 2. Solution Overview

Handful puts everything in one place and keeps it free. You learn a few signs at a time from real signer
videos, then practise them with quizzes, reviews that bring them back on a schedule, and a "sign it
yourself" step. Where the camera can give reliable feedback, it watches your hand and tells you what to
fix. Where it can't, it says so instead of guessing.

There is no backend, no account and no database. Progress is saved in your own browser.

## 3. Key Features

- **72 signs in 24 lessons across 9 units:** 46 everyday words (greetings, family, feelings, numbers,
  questions, food, colors) and the 26 fingerspelling letters. Each sign has a real signer video, a
  handshape drawing, the movement, and a memory tip.
- **Practice and repetition:** multiple choice, match the pairs, reading fingerspelled words, "sign it
  yourself", a mistakes list, and spaced review that brings signs back just before you'd forget them.
- **Streaks, XP, a daily goal, unit checkpoints** and skip-ahead tests, plus a progress page.
- **Camera practice for letters:** all 26 letters, with a checklist of what's right and what to fix.
- **Camera practice for words:** three words (EIGHT, WHY, YES), the ones that could be verified reliably on real attempts.
- **Spell it:** type a name or word and see each letter's handshape, one after another.
- **Mirror view and a left-hand option.** You can add it to your phone's home screen so it opens like an app
  (it needs an internet connection; there is no offline mode).
- **Private by design:** hand tracking runs in the browser. Nothing is recorded or sent anywhere.

## 4. AI Integration

There is no chatbot or large language model in Handful. The AI is computer vision and a small trained
model, all running **in your browser**.

1. **Hand tracking (pretrained model).** Google's MediaPipe Hand Landmarker finds 21 points on your hand
   in every camera frame. This is the part that "sees" your hand.
2. **A small model, trained by Claude Code.** The letters A, E, M, N, S and T are all fists, so simple
   finger rules can't tell them apart. At my request, Claude Code trained a small logistic-regression model on
   a public set of about 2,100 real hand recordings (see below) to tell them apart by where the thumb sits.
   On recordings from sessions it had never seen, it picks the right letter about 92 times in 100. Training
   script: `tools/train-fists.mts`.
3. **Matching logic, written by Claude Code.** For letters, the app measures finger straightness, thumb
   position and which way the hand points, and compares them with what each letter needs. For words, it
   measures the hand over the whole sign (shape, direction and, for moving signs, how much it moves) and
   compares it with the same measurements taken from the ASL Signbank video, allowing for different speeds
   and for left hands. The limits are set per word from real attempts. Build script:
   `tools/build-word-refs.mjs`.

**Built with AI assistance.** I built Handful together with Claude Code (Anthropic's AI coding assistant). Claude Code wrote the code, the tests, the model-training and data-building scripts, and ran the measurements. My part was the idea and the reasons for it, deciding what to build and what to keep or cut, testing it on my own hands, filming my own signing attempts so it could be tested on a real person, and finding problems for it to fix, such as the waving bug and the B thumb problem described below.

## 5. External Tools & Datasets

| What | Used for | Licence |
|---|---|---|
| [ASL Signbank](https://aslsignbank.com) videos | All word-sign videos, and the reference for the word check | CC BY-NC-SA 4.0 (so Handful must stay non-commercial) |
| [Google MediaPipe](https://ai.google.dev/edge/mediapipe) Tasks Vision 1.0.1 and its hand landmarker model | Finding the 21 hand points | Apache 2.0 |
| [ASLNow! hand-landmark dataset](https://huggingface.co/datasets/sid220/asl-now-fingerspelling) (about 2,100 samples) | Training and testing the fist-letter model, and calibrating letter rules | MIT |
| Handshape drawings by wpclipart.com, and numbers by Snailsmakemehappy (Wikimedia Commons) | The letter and number pictures | Public domain / CC BY-SA 4.0 |
| Next.js 16, React 19, TypeScript, Tailwind CSS | The app | Open source |
| Vercel | Hosting | n/a |
| Claude Code | AI coding assistant used while building | n/a |

Full credits and conditions: [`docs/CREDITS.md`](docs/CREDITS.md). No API keys or paid services are used.

## 6. Installation & Setup

You need [Node.js](https://nodejs.org) 20 or newer (I used 24).

```bash
git clone https://github.com/xingyou07/handful.git
cd handful
npm install
npm run dev        # then open http://localhost:3000
```

There are no API keys or environment variables to set up. The camera works on `localhost` and on any
`https` address (browsers block the camera on plain `http`). To try the production build:

```bash
npm run build
npm start
```

**Checks.** The unit tests need nothing running. The browser tests need the app running and Google Chrome
on macOS:

```bash
npm run lint
npm run build
node tests/progress.test.mts        # saved-progress rules
node tests/handshape.test.mts       # letter hand-shape rules
node tests/wordsign.test.mts        # word matching, waves and other gestures
node tests/camera-messages.test.mts # camera error messages
node tests/spell.test.mts           # Spell it
node tests/e2e.mjs                  # plays through the whole app in headless Chrome
node tests/camera.mjs               # real signing videos through the hand tracker (about 15 minutes)
```

## 7. AI Safety & Limitations

**Risks identified, and what was done about them**

- **Telling a learner they're right when they're wrong (false positives).** This was the biggest one: I
  waved a hand in front of the camera and it was accepted as the sign for BLUE. The first round of testing,
  done by Claude Code, had only used other signs and never random movement. We then measured it properly:
  running the other 45 Signbank signs (which include waves) against each word gave 10 wrong full matches in
  360 comparisons. Fixes, built by Claude Code: each word got its own strict limit, set between real right
  attempts and the closest wrong gesture; signs that move must actually move, so a hand held still doesn't
  match; and the camera was switched **off** for 5 words that couldn't be protected from wrong gestures and
  3 more that failed my real attempts, leaving 3 words. The final version accepts none of 16 other gestures
  (including both waves), none of 90 wrong-word comparisons from my real clips, and a still hand.
- **My own gestures fooling it.** After that I filmed 8 things that are not signs: waving, waving with a
  twisted wrist, a fist held still, a fist moving, a thumbs up, a pointing finger, fidgeting, and an open
  hand held still. A **thumbs up was accepted as YES** (a fist with the thumb out looks like a nodding fist
  to the hand-shape measures). Claude Code added a thumb check for YES, based on how often the thumb sticks
  out in my clips (about 91 in 100 frames for a thumbs up, 17 in 100 for my YES). Now none of the 8 is
  accepted, or called close, for any of the three words.
- **Letter B passing with the wrong thumb.** Testing it on my own hand, I noticed B passed with the thumb
  held beside the fingers. B now requires the thumb folded across the palm, with the cutoff set on real hands.
- **Overclaiming.** Letters have confidence levels. Where the camera genuinely can't tell signs apart (for
  example G/Q, C/O) it says "the finger shape fits, but the camera can't be sure" instead of "That looks
  like…". The app says plainly that it's practice feedback, not a grade.
- **Privacy.** The camera and the tracker run in your browser. No video is recorded, stored or sent, and
  there are no accounts or analytics.
- **Teaching something wrong.** The written sign descriptions were drafted by a non-signer and have **not**
  been reviewed by a Deaf ASL signer. The app says so in Settings → About and on the welcome screen. The
  videos from ASL Signbank, made by real signers, are the reliable part.

**Testing done**

- Over 200 automated unit checks, about 130 end-to-end checks that play through the whole app in a real
  browser, and a 61-check test that runs real signing videos through the hand tracker.
- Real attempts: I filmed 11 signs, 3 tries each (33 tries). Claude Code used them to decide which words the
  camera offers and to set each word's limit. Words are only offered if all 3 tries matched.
- Failure tests: waves and other gestures (16 from the Signbank videos plus 8 I filmed myself), a hand held
  still, mirrored (left) hands, different speeds, dropped frames, and the camera being blocked or missing.

**Limitations**

- The word check is tested on **one learner** and covers **three words**. The letter check is weakest on a
  few letters (such as W, K, P, R) and can't separate C from O.
- It follows **one hand** and can't see where your hand is on your body or your facial expression, so many
  signs (two-handed signs, signs at the face) have no camera check at all.
- Hand tracking depends on light and camera quality, and I haven't tested it across a wide range of
  hands, skin tones or lighting.
- It's an early version. It's practice, not a replacement for a Deaf teacher.

## Where things are

| Folder | What's in it |
|---|---|
| `data/` | All content as JSON (`signs.json`, `lessons.json`), plus the fist-letter model and the word reference data. |
| `app/`, `components/`, `lib/` | Next.js pages, the UI, and the logic (progress, lessons, letter and word checks). |
| `public/` | Sign videos, handshape drawings, and the hand-tracking engine and model. |
| `tools/` | Scripts that build the fist-letter model and the word reference data. |
| `tests/` | The tests above. |
| `docs/` | Credits, the word-sign feasibility report, the review checklist, and notes. |

## Credits and licence

Sign videos are from [ASL Signbank](https://aslsignbank.com) (Hochgesang, Crasborn & Lillo-Martin) under
CC BY-NC-SA 4.0, so **Handful must stay non-commercial: no ads and no paid version.** Credits for
everything else are in [`docs/CREDITS.md`](docs/CREDITS.md).

*Originally called SignPath. The saved-progress key keeps that name so nobody's progress is lost.*
