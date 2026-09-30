# SignPath video guidelines

Every sign video in SignPath follows these rules, so learners always see signs at the same size, framing and quality.

## Signers

- **Four signers in total.** That's enough to show that people look different when signing, and few enough that learners get to know each signer.
- Signers should be Deaf or fluent ASL users. Deaf signers are strongly preferred.
- Aim for a mix of gender, age and skin tone.
- **At least one signer is left-handed**, so learners see signs made with either dominant hand.
- Each signer has a fixed ID: `signer-a`, `signer-b`, `signer-c`, `signer-d`.
- **One signer per lesson.** Every sign in a lesson uses the same signer. Different lessons rotate between signers, so learners meet all four over time.
- Each signer signs in writing to allow their videos to be used in the app before filming.

## Size and format

| | |
|---|---|
| Shape | Widescreen 16:9 (landscape) |
| Resolution | 1920 × 1080 |
| Frame rate | 30 fps (60 fps is fine for fast signs) |
| Length | 2–6 seconds per sign |
| File type | MP4 (H.264), **no audio track** |
| File size | Under 3 MB. Compress if it is bigger. |

## Framing

- Keep the camera at the signer's chest height, straight on and not tilted.
- The frame shows from just above the head to the waist.
- Leave enough room at the sides that the hands **never leave the frame**, even at full arm reach.
- Center the signer, facing the camera.
- Keep the same camera distance and zoom for every signer and every video.
- Lock the camera on a tripod. No handheld shots, zooming or camera moves.

## Look

- Use a plain, solid, light neutral background (warm grey or beige), the same for every video.
- Light the signer evenly from the front, with no harsh shadows on the face or hands.
- Signers wear solid, darker clothing with no patterns, logos or text, and long or short sleeves in a color that contrasts with their skin.
- No rings, watches, bracelets or long nails that distract from the hands.
- Hair is kept away from the face. Facial expressions are part of ASL and must be visible.

## Clarity: no sloppy signs

- Start and end every video with the hands resting at the waist. Hold the resting position about half a second before and after the sign.
- Sign at a **clear, natural pace**: not rushed and not unnaturally slow.
- **Show the sign twice** in each video, with a short pause between the two.
- Handshape, location, movement and palm direction must match the sign's entry in `data/signs.json`.
- Every handshape is fully formed. No half-closed fingers or blurred, cut-short movements.
- Include the facial expression that belongs to the sign.
- Trim the video tightly. No dead time, no talking and no looking away.

## Review

A video is added to the app only after **a Deaf ASL signer has reviewed and approved it**. If the sign is unclear, sloppy or wrong, film it again. Do not fix it by editing.

Checklist for each video:
- [ ] Correct sign, matching `signs.json`
- [ ] Hands in frame the whole time
- [ ] Clean handshapes and a steady pace, shown twice
- [ ] Standard framing, background and lighting
- [ ] 1920 × 1080, 16:9, MP4, no audio, under 3 MB
- [ ] Approved by a Deaf reviewer

## Files and naming

- Put videos in `public/videos/`.
- Name each file after the sign's ID: `public/videos/hello.mp4`.
- In `data/signs.json`, add the video path and signer to the sign:
  ```json
  { "id": "hello", "video": "/videos/hello.mp4", "signer": "signer-a", ... }
  ```
- A sign without a `video` field shows the "Video coming soon" box.
