# Handful PRD

## Problem
Learning ASL means hopping between YouTube videos with no structure, no repetition, and no way to check progress.

## Goal
One place to learn ASL in short Duolingo-style lessons.

## Not in scope for now
Accounts, backend, leaderboards, full ASL grammar.

## Camera check (added 2026-10-01)
Learners can sign to their camera, or pick a video file, and get practice feedback. It runs entirely in the browser with hand tracking; the video never leaves the device. It is feedback to practise with, not an authoritative grade: it never blocks progress, and self-rating ("Got it" / "Not yet") always remains available. Starts with fingerspelled letters (still handshapes), then word signs.

## Screens
1. Path: a vertical skill map of units and lessons. Lessons unlock in order; states are locked, current, completed.
2. Lesson: a progress bar, then intro cards for new signs, then exercises.
3. Sign card: a diagram of the sign showing handshape, location (a dot on a body outline) and movement (an arrow), plus a one-line memory tip. A placeholder box marks where a video will go.
4. Lesson complete: XP earned, first-try accuracy, day streak.
5. Practice mistakes: a lesson built from signs the learner got wrong.

## Exercise types
- Sign shown, pick the meaning (multiple choice).
- Word shown, pick the correct sign (multiple choice with diagrams).
- Match pairs: words to signs.
Wrong answers come back at the end of the lesson.

## Gamification
XP (5 per first-try correct answer, +10 for finishing a lesson) and a daily streak. No hearts, no leaderboards.

## Content
All content lives in JSON files in data/. One sign looks like:
`{ "id": "hello", "word": "Hello", "handshape": "Flat hand", "location": "forehead", "movement": "Touch fingertips to the side of the forehead, then move outward", "tip": "A friendly salute" }`
Locations: forehead, chin, chest, mouth, space.
Sign descriptions must be reviewed by a Deaf ASL signer before release.

## Tech
Next.js (App Router), TypeScript, Tailwind. No backend or database. Progress saved in localStorage.

## Build order
1. Sign data and sign card
2. Units and lessons data
3. The three exercise types
4. Lesson runner (queue, retries, progress bar)
5. Path screen
6. Saved progress (XP, streak, completed lessons)
7. Practice mistakes