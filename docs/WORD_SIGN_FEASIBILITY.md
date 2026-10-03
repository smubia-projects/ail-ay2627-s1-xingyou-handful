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

## Built (2026-10-04)
The camera now checks 11 one-handed words in "Sign it yourself": BLUE, YELLOW, WHERE, SORRY, MILK, NO, YES,
TWO, EIGHT, PLEASE and WHY. `tools/build-word-refs.mjs` picks them by rule (one hand; not defined by
location or a wave; hand shapes at least 0.40 apart) from its own measurements, so GREEN, THREE and others
dropped out when they were too close to another word. The check uses hand shape and direction only. It says
"That matches", "Close" or "Not yet" with one hint, and names the word an attempt looked more like.
On the learner's 15 real attempts through the shipped code: 14 matched, 1 was close, and a wrong word was
accepted as a full match 0 times in 150 (14 times as "close"). The limits were tuned on those same attempts,
so expect slightly worse with other people.
