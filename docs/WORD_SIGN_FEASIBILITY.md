# Word-sign checking: feasibility test (2026-10-03)

**Question:** can the camera tell that a learner made a word sign (hand shape plus movement), the way it
now checks fingerspelled letters?

**Short answer:** probably yes for a good share of the 46 signs, but it is not proven. With the amount of
difference we measured between real signers it accepts about 75 in 100 right attempts while accepting
5 in 100 wrong signs, and 20 of the 46 signs would be unreliable. With half that difference it is
99 in 100 and 1 sign is unreliable. The real answer sits between, and only real attempts by a learner
can settle it.

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

## What would settle it
A few real attempts. About 5 to 10 words, each signed 3 times by one learner (hands only, the face can
be out of frame), kept on the owner's computer and not added to the project, would show how far a real
beginner is from the Signbank signer. That replaces the simulation with the real number.

## If we build it
Start with the single-hand signs the test handled best, tell the learner "close" or "not yet" and
what to fix (hand shape, movement size, speed) rather than a grade, and keep the existing
"practice, not a grade" wording. Don't offer the camera for signs it can't check reliably (as already
done for word signs now).
