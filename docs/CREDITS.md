# Credits

## Hand tracking (`public/mediapipe/`)

The camera check uses **Google MediaPipe** hand tracking: the `@mediapipe/tasks-vision` package (1.0.1)
and its `hand_landmarker.task` model, both under the **Apache License 2.0**, used unmodified.
See `public/mediapipe/NOTICE.txt`. Tracking runs in the learner's browser; the video never leaves
their device.

## Sign videos (`public/videos/`)

Sign videos are from **ASL Signbank** (ASL Signbank, 2026). The files are unaltered. The app
**displays them mirrored** for right-handed learners ("mirror view") and as filmed for left-handed
learners; Settings → About says so, as the license asks when a work is changed.

> Hochgesang, J. A., Crasborn, O., & Lillo-Martin, D. (2026 (2017-2026)). ASL Signbank.
> https://aslsignbank.com. https://doi.org/10.6084/m9.figshare.9741788

Licensed under **CC BY-NC-SA 4.0** (https://creativecommons.org/licenses/by-nc-sa/4.0/).
What that means for Handful:
- **Non-commercial only.** While Handful uses these videos it must not make money: no ads, no
  paid version, no selling access.
- **Credit and a direct link.** Each video in the app links to its ASL Signbank entry (the
  `videoCredit` field in `data/signs.json`), and Settings → About shows the full reference.
- **Share-alike.** If a video is ever edited, the edited version must stay under the same license.

Conditions of use: https://aslsignbank.com/about/conditions/

## Handshape drawings (`public/handshapes/`)

**Letters A–Z** (`letter-a.svg` … `letter-z.svg`)
"Sign language A.svg" to "Sign language Z.svg" by wpclipart.com, from Wikimedia Commons.
Released into the **public domain** by the author. No conditions apply.
Source: https://commons.wikimedia.org/wiki/Category:ASL_letters

**Numbers 1–9** (`number-1.jpg` … `number-9.jpg`)
"Sign language 1.jpg" to "Sign language 9.jpg" by **Snailsmakemehappy**, from Wikimedia Commons.
Licensed under **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/).
Used unaltered apart from being resized to 400px wide.
Source: https://commons.wikimedia.org/wiki/File:Sign_language_1.jpg (and 2–9)

CC BY-SA 4.0 requires crediting the author and linking the license, which Settings → About in the
app does. If these drawings are ever edited, the edited versions must also be shared under CC BY-SA 4.0.
