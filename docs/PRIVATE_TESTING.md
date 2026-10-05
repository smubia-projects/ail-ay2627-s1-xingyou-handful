# Private testing: how to let a few people try Handful

Written for the app's owner. Nothing here publishes the app for the public. Handful has no server
side: no accounts, no database, no video leaves a device. Each person's progress lives only in their
own browser. So "private" only has to mean: who can open the address.

## Why a normal home-wifi link doesn't work on a phone
The camera only works on a **secure web address (https)**, or on the same computer the app runs on.
`http://192.168.x.x:3000` from a phone will show "The camera only works on a secure connection". So
phone testing needs one of the two options below.

## Option A: a temporary private link to your own computer (least setup)
Anyone who has the link can open the app, but only while your computer is on and you've started it.
The link is a long random address and stops working when you stop it. It has **no password**, so don't post it.

I haven't run these steps on this computer, so expect the first try to take a few minutes.

1. Install the free tunnel tool once (needs Homebrew, which is installed here):
   `brew install cloudflared`
2. In the project folder, build and start the real (not development) version on its own port:
   `npm run build` then `npm run start -- -p 3100`
   (Use this, not `npm run dev`. The development server refuses visitors from other addresses.)
3. In a second Terminal window: `cloudflared tunnel --url http://localhost:3100`
   After a few seconds it prints an address ending in `.trycloudflare.com`. That's the link.
4. Open the link on your own phone first and try the camera before sending it to anyone.
5. To stop: press Ctrl+C in both Terminal windows. The link dies immediately.

## Option B: a password-protected online copy
Put the project on a hosting service that can require a login or password for every visitor (Vercel
and similar services have this, but which protections are free changes, so check the service's
current options before relying on it). It stays online without your computer, which is better for
people in other time zones. It needs an account in your name, and every visitor needs the password.
Don't put the password in a public place.

## Option C: only on your own computer
Nobody else can test it, but there's nothing to set up.

## What to ask testers
Keep it to 10 minutes. Ask them to:
1. Open the link, go through the welcome, and do one lesson.
2. Open Camera practice and try letters A, B, L, S and T.
3. In a lesson, find a word with "Check with my camera" (BLUE, YELLOW, WHERE, SORRY, MILK, EIGHT, WHY or YES) and try it two or three times.
4. Tell you: Did it find your hand? Did the answer feel fair? Was anything confusing?
5. If they sign ASL, which signs or descriptions looked wrong?

Ask before they send screenshots or recordings of themselves. You never need a video of anyone's face.

## What to look for in the answers
- Does "That matches" appear for a correct attempt, and "Not yet" for a wrong one?
- Any letter or word that almost never works for them (note their lighting, phone or laptop, and hand).
- Anything people didn't understand without being told.
- For an ASL signer: wrong or unnatural sign descriptions (see docs/SIGN_REVIEW.md).

## Before sending the link
- `npm run lint`, `npm run build` and the tests pass.
- Settings → About shows the early-version note, the privacy note and all credits.
- You're happy for these specific people to see it, and you've told them it's an early test.
