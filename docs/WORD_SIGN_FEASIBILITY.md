# Word-sign checking: feasibility test (2026-10-03)

**Question:** can the camera tell that a learner made a word sign (hand shape plus movement), the way it
now checks fingerspelled letters?

**Short answer:** yes for single-hand signs, on the evidence so far. A simulation with the difference we
measured between real signers gave 75 in 100 right attempts accepted (99 with half the difference). Then
a real learner filmed 5 words 3 times each (see "Real attempts" below): hand shape alone gave 14 to 15
of 15 right attempts accepted while accepting 3 to 8 wrong signs in 100. That is one person and five
words chosen because they had tested well, so it is encouraging, not proof.

## What was done
1. All 46 Signbank word videos were run through the hand tracker, 15 frames a second.
2. Each sign was described by its hand shape and direction over time (24 numbers a frame), and the path
   the hand travels (relative to the hand's size, so camera distance doesn't matter), squeezed to 30
   steps in time and compared with a time-stretching match (DTW). Left-handers are covered by also
   trying the mirror image.
3. Each sign was then re-performed 6 times by a simulated "other person": a steady difference in finger
   positions and hand angle, a different camera angle, a different speed and movement size, shaky
   tracking and dropped frames. The size of the finger difference is real: it is how far 2,122 real
   hands from several signers (ASLNow! set) drift from each other for the same letter, in the hand's own
   frame (about 0.5 to 0.8 palm widths at the fingertips). That figure also contains tracker noise, so
   x1 is pessimistic. The accept limit was set so a wrong sign is accepted 5 times in 100.

## Findings
- **The tracker follows signing well.** Inside each sign the hand is found in 96% of frames, with gaps
  of 2 frames at most (0.13 s). The hand is missing only when it rests out of the picture at the start
  and end of the clip. Lowering the tracker's confidence limit, or tracking at 30 frames a second, made
  no difference.
- **A sign matches its own recording perfectly** even when slowed, sped up, mirrored, shaken or missing
  30% of frames. This only shows the matching works. It says nothing about other people.
- **Against a different-signer simulation** (right attempts accepted / closest-of-46 correct):

  | Difference between signers | Shape only | Movement only | Shape + movement |
  |---|---|---|---|
  | half the measured amount | 86% / 90% | 83% / 78% | **99% / 99%** |
  | the measured amount | 46% / 50% | 57% / 54% | **75% / 72%** |
  | 1.5 times it | 26% / 26% | 44% / 43% | 54% / 55% |

  Shape and movement together are far better than either alone, so word signs need both.
- **Signs that confuse each other** (at the measured amount): the number signs (SEVEN, SIX, NINE, FOUR,
  FIVE) with YES, and WHO with YELLOW. They share hand shapes and similar short movements.
- **Signs that struggled even with moderate differences:** BLACK, COOKIE, EAT, EIGHT, FAMILY, FIVE, FOUR,
  FRIEND, GOODBYE, HELLO, HELP, HOW, MORE, MOTHER, PLEASE, SEVEN, TIRED, WATER, WHO, YES.

## What this test cannot show
- Only **one reference video per sign**, so we have never seen a second real signer do any of these
  words. The simulated other person is a stand-in.
- Only the **main hand** is used. Two-handed signs (MORE, HELP, FAMILY, FRIEND, LOVE, NAME, SAD, WHAT,
  TIRED, WHITE and others) lose half their information, and the tracker finds the second hand in only
  about a quarter to a half of frames.
- **Where the hand is on the face or body** is not checked, because the hand tracker doesn't see the
  face. Signs that differ only by location (MOTHER and FATHER differ by chin versus forehead) need an
  extra face or body tracking model. That means a new model file from the already approved
  `@mediapipe/tasks-vision` package, which needs the owner's OK.

## Real attempts (2026-10-03)
One learner (not fluent in ASL, right-handed) filmed BLUE, YELLOW, WHERE, SORRY and MILK, 3 times each,
hands only, on a phone at 1080p, with no special background or clothes. The clips were kept outside the
project and are not in the repo. The tracker found the hand continuously through every repeat.
- **Hand shape and direction over time alone** found the right sign closest of 46 in 11 of 15 repeats,
  and in the top 3 in 15 of 15. With the accept limit at 0.35 to 0.4 it accepted 14 to 15 of 15 right
  attempts and 2.7% to 8.4% of wrong signs.
- **Movement as first measured was a flaw.** The hand's path was measured from where it started, so the
  hand rising into view counted as movement and BLUE, YELLOW and WHERE came out far from their
  references. Measuring around the hand's average spot fixed most of it (combined result 6 to 11 of 15
  right), but it still adds nothing here: BLUE and YELLOW are twists, WHERE is a finger shake and MILK a
  squeeze, where the hand's centre barely moves. The twist is already in the direction of the hand.
- **Mix-ups on real attempts:** YELLOW with HOW, SORRY with LOVE (both fists, the fist model isn't used
  for words yet), BLUE with FOUR and SIX, WHERE with WHO, MILK with TEN.
- **Not yet tested:** movement-heavy signs (MORE, GOODBYE, THANK-YOU), other learners, and left-handers on
  a real hand.

## What would settle it
More real attempts, especially from other learners and for movement-heavy words. The five-word test above
is the first; a few more people signing the same words would show how much one person's result carries over.

## If we build it
Start with single-hand signs where hand shape and direction carry the sign, check hand shape first, tell the learner "close" or "not yet" and
what to fix (hand shape, movement size, speed) rather than a grade, and keep the existing
"practice, not a grade" wording. Don't offer the camera for signs it can't check reliably (as already
done for word signs now).

## Second round of real attempts (2026-10-05)
The same learner filmed six more words, 3 tries each: PLEASE, NO, YES, TWO, EIGHT and WHY. These had been
chosen by rule from the Signbank videos only, and a tester had already seen PLEASE and NO fail in the app.
- **Matched all 3 tries:** EIGHT (distance 0.19 to 0.21), WHY (0.28 to 0.32) and YES (0.33 to 0.35, close to the
  0.35 limit, so a slightly different signer may get "Close" instead of "That matches").
- **NO:** close every time (0.40 to 0.42, closest word WHERE), never a match.
- **PLEASE:** not yet every time (0.50 to 0.61). **TWO:** not yet every time (0.57 to 0.62, closest word SORRY).
  Why was not investigated. PLEASE is a flat hand circling on the chest, where the tracker has to read a hand
  over the body.
- Across all 11 words (33 tries): a wrong word was accepted as a full match 0 times in 330 comparisons, and as
  "close" 25 times. Run it again with `node tools/build-word-refs.mjs --check <folder of clips>`.

## False positives found, and the fix (2026-10-06)
The learner reported that **waving a hand anywhere in front of the camera was accepted as BLUE.** The earlier
"0 wrong matches in 330" only tested other *signs from the learner's clips*, never random gestures or a wave.
A wider test (the other 45 Signbank signs, which include the HELLO and GOODBYE waves, run against each word)
showed it: 10 wrong full matches and 40 wrong "close" results in 360 comparisons. BLUE was matched by HELLO, SIX,
FOUR and DRINK; WHERE by WHO and GREEN; SORRY by LOVE and RED; EIGHT by SEVEN and NINE.

The room between a right attempt and the closest wrong gesture, per word (smaller is closer; one shared limit of
0.35 was too generous):

| Word | Learner's right tries | Closest wrong gesture | Room |
|---|---|---|---|
| BLUE | 0.21 to 0.24 | SIX and HELLO, 0.30 | 0.06, too little |
| YELLOW | 0.29 to 0.32 | WHY, 0.36 | 0.04, too little |
| SORRY | 0.29 to 0.31 | RED, 0.32 | 0.02, too little |
| MILK | 0.30 to 0.34 | TEN, 0.36 | 0.02, too little |
| WHERE | 0.18 to 0.22 | WHO, 0.32 | 0.10 |
| EIGHT | 0.19 to 0.21 | SEVEN and NINE, 0.33 | 0.12 |
| WHY | 0.28 to 0.32 | THANK-YOU, 0.40 | 0.08 |
| YES | 0.33 to 0.35 | LOVE, 0.43 | 0.08 |

A second false-positive path: a hand **held still** in the middle pose of WHERE, WHY or YES was accepted. A
movement measure (`motionAmount`) separates a still hand from a real try for WHY (tries 5.0 to 7.1, still hand with
ordinary tracker shake 2.3 to 2.5) and YES (4.5 to 6.1 against 2.7 to 3.2), but not for WHERE (2.3 to 3.8 against
2.7 to 3.2), whose finger wag barely changes the hand.

**What changed:** each word now has its own accept limit, set halfway between the worst right try and the closest
wrong gesture, and "Close" is only 0.03 beyond it. BLUE, YELLOW, SORRY and MILK were switched off (too little
room). WHERE was switched off (a still finger matches). WHY and YES need movement above a floor of 3.7. EIGHT is a
still handshape and needs none. Result for the **three words EIGHT, WHY and YES**: all 9 of the learner's tries
match; 0 of 90 wrong-word comparisons are accepted or called close; none of 15 other gestures (including both
waves) is accepted or called close against any of the three words (45 comparisons); a still hand is not a match
for WHY or YES.

**What this does not prove:** only one learner's tries, and the 15 other gestures are one Signbank signer. A
learner's own random waving, thumbs up or fist wasn't filmed. To test that, film those gestures and run
`node tools/build-word-refs.mjs --check <folder>`, then anything accepted as a word is a false positive.

## Built (2026-10-06)
The camera checks **3 words** in "Sign it yourself" and on the Words practice page: **EIGHT, WHY and YES**. Each
was matched on all 3 of a real learner's tries, has room between its right tries and the closest wrong gesture, and
(for WHY and YES) needs movement. The check uses hand shape, which way the hand turns, and (for moving signs) how
much it moves. It says "That matches", "Close" or "Not yet" with one hint, and names the word an attempt looked
more like. To add a word: have someone film it 3 times and film gestures that must NOT match, run the tool with
`--check`, and add it to `tools/build-word-refs.mjs` only if the room is at least 0.08.

## The learner's own "not a sign" gestures (2026-10-15)
The learner filmed 8 gestures that are not signs, one clip each: a hello wave, a wave with a twisted wrist, a fist held
still, a fist moving, a thumbs up, a pointing finger moving, fidgeting, and an open hand held still. Run against EIGHT,
WHY and YES with `node tools/build-word-refs.mjs --check <folder>`:
- **A thumbs up was accepted as YES** (distance 0.38 against YES's limit of 0.39). Everything else was rejected: the
  nearest others were an open hand held still against EIGHT (0.34 against a limit of 0.27), a hello wave against EIGHT
  (0.38) and a wave with a twist against EIGHT (0.41).
- **The thumb tells them apart.** The thumb sticks out sideways in 91 in 100 frames of the thumbs up, 17 in 100 of the
  learner's YES, and 1 in 100 of a plain fist. YES now needs the thumb tucked in for most frames (`maxThumbOut` 0.5),
  and a thumb that sticks out gives "Not yet" with the hint to tuck it in.
- **After the fix:** the learner's 9 tries at the three words still match, 0 of 90 wrong-word comparisons are accepted,
  and 0 of 24 comparisons of the gesture clips are accepted or called close.
- **Room:** YES now has about 0.03 between its worst right try (0.35) and the thumbs up (0.38) on distance alone, below the
  0.08 rule for new words, and relies on the thumb check to keep them apart. If more people use it, this is the first word to
  re-test.
