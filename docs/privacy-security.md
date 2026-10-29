# Pawtopia — Privacy & security

## What leaves the device

Pawtopia plays fully offline. Progress lives in WebView local storage under `pawtopia.*` keys (v1's `cvd.*` keys are
kept as a backup). Three optional services can talk to the network, each off until it is configured *and* the player
uses it:

| Service | When | What it gets |
| --- | --- | --- |
| **Google AdMob** (reward videos) | Only after the player taps "Watch a short video" (iOS app, `VITE_ADMOB_ENABLED=1`). Consent (UMP) and Apple's tracking prompt are asked on that first chosen video, never at launch. | What the Google Mobile Ads SDK collects for ads (device/advertising data per the player's consent). No interstitials, no banners. |
| **RevenueCat / App Store** (gems) | When the player opens the Gems tab or buys (iOS app with a RevenueCat key). | Purchase records tied to an anonymous RevenueCat app user id. |
| **Firebase** (leaderboard) | Only after the player taps **Join** in League → Leaderboard. | An anonymous Firebase user id, the chosen nickname and picture (one of their animals), and for each board solved after joining: which board, its spec and the move log (to check it). Stored: nickname, picture, Paw Points awarded (per award id), weekly and all-time totals, a per-hour/day solve counter, and reports of their name. |

Nothing else: no analytics leave the device (`services/analytics.ts` keeps a 200-event in-memory ring buffer with no
sink; identifier-looking keys are dropped), no email, no contacts, no location, no crash reporting.

## Leaderboard rules (server-enforced)

- **Opt-in, deletable.** Leaving deletes `players/{uid}` (with its awards), `scores/{uid}` and `reports/{uid}`, then the
  anonymous auth user (`lbDelete`). Settings → Leaderboard says what is stored and links to it.
- **Clients never write Firestore.** `firestore.rules` deny every write; reads: `scores` for signed-in users, a
  player's own `players/{uid}` and awards. Tests: `test/firebase/rules.test.ts` (`npm run fb:test`).
- **Points are computed by the server**, never sent: each solve's board is rebuilt from its mode and spec and its move
  log replayed (`src/leaderboard/check.ts`, which uses `competitions/verify.ts`); unfinished, malformed or impossibly
  fast logs don't count. Each award id pays once. 60 solves an hour, 250 a day; batches of ≤ 10.
- **Names**: 3–20 letters/numbers, no links or handles, a small blocked-word list (`src/leaderboard/nickname.ts`),
  checked on the device and again on the server; a suggested friendly name is the default. Three distinct reports
  replace a name with "Player ####". All names are escaped before rendering.
- **Only real players** are ever shown. Development builds and the tester preview use an on-device table that only
  contains the player.
- **App Check** (App Attest) should be enforced before inviting players (`ENFORCE_APP_CHECK=true`).
- No service-account keys in the repo. The Firebase web config is not a secret.

## App Store privacy label (when each service is on)

- Firebase leaderboard: **Identifiers → User ID** (anonymous Firebase id), **User Content → Gameplay Content** (solved
  boards, points) and **User Content → Other User Content** (nickname). Linked to the user (the anonymous id), not
  used for tracking, purpose: App Functionality.
- RevenueCat: **Purchases → Purchase History** (App Functionality), linked, not tracking.
- AdMob: follow Google's current guidance for the SDK version (Device ID / advertising data for Third-Party
  Advertising; tracking only with ATT consent).
- With none of them configured: "Data Not Collected".

## Other safeguards

- All dynamic text goes through `esc()` before `innerHTML`.
- Reset removes only app-owned keys and keeps purchase entitlements; unrelated origin data is never touched. (A
  player who resets while on the leaderboard keeps their online entry until they leave.)
- Audience: general (not Kids Category). Kids Category would require removing third-party ads and a separate review.
- Paw Cup (weekly competition) stays offline practice until its own verified backend exists (`docs/backend-plan.md`).
