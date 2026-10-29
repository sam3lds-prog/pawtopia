# Pawtopia — Online backend

## Built: the Paw Points leaderboard (Sprint J, D30)

Firebase: anonymous Auth, Firestore, four callable Cloud Functions (`functions/`, logic in `src/leaderboard/`). Players
opt in with a nickname; each Journey level or Daily solved after joining is sent with its move log, rebuilt and
replayed on the server, and awarded Paw Points once per award id. Weekly (UTC) and all-time tables. Setup:
`docs/native-setup.md` §3, `functions/README.md`. Privacy: `docs/privacy-security.md`.

Go-live gate for the leaderboard: rules tests pass on the emulator (`npm run fb:test`), privacy label updated, a
real-device join → solve → table → leave run on TestFlight. Strongly recommended before a wide launch: a native App
Check provider (App Attest) so `ENFORCE_APP_CHECK` can be turned on.

## Not built: online Paw Cup leagues (Phase 6)

Status: **design only.** `featureFlags.onlineLeagues` stays `false` until every item in "Go-live gate" passes.
The pure pieces a server needs already exist and are tested: `competitions/scoring.ts`, `competitions/verify.ts`,
`competitions/leagueRules.ts`, `competitions/cup.ts` (board specs), `engine/*` (board generation).

## Proposed stack

Firebase Auth (anonymous → optional Sign in with Apple), Firestore, Cloud Functions (callable, Node 20, TypeScript),
App Check (DeviceCheck/App Attest on iOS), Cloud Scheduler for UTC settlement. Alternatives are fine if they meet the
same constraints; compare cost first (expected: well inside free/low tiers below ~10k weekly players).

## Collections

| Collection | Writable by | Contents |
| --- | --- | --- |
| `players/{uid}` | owner (allow-listed fields only) | displayName, avatarPetId, hideRank, tier, provisionalUntil |
| `boardManifests/{boardId}` | server | public board: size, regions, givens, parSeconds, generatorVersion, digest. **No solution.** |
| `boardSecrets/{boardId}` | server only (no client read) | solution |
| `seasons/{weekKey}` | server | startsAt/endsAt (UTC), boardIds[5], scoringVersion |
| `rankedAttempts/{attemptId}` | server | uid, boardId, weekKey, startedAt, finishedAt, status, events, result, flags |
| `leagues/{weekKey_tier_cohort}` | server | member uids (real players only), settled results |
| `leaderboardResults/{weekKey_uid}` | server | per-board best, totals, verified=true |
| `economyTransactions/{txnId}` | server | idempotent reward grants (mirrors the local ledger ids) |
| `reports/{id}` | create by signed-in users | suspicious-score reports |

## Callable functions

- `startRankedAttempt({weekKey, index})` — checks auth + App Check, week window, attempts used (< 2), app version;
  creates `rankedAttempts/{id}` with server `startedAt` and a nonce; returns the public manifest + attempt token.
- `submitRankedAttempt({attemptId, nonce, events})` — idempotent; rejects reused nonce / finished attempt; loads the
  board + secret solution; runs `verifyAttempt({ranked: true, serverElapsedMs: now - startedAt})`; in one
  transaction writes the attempt result and updates `leaderboardResults` with `betterBest`.
- `getLeagueStandings({weekKey})` — the caller's cohort, neighbors around them, real members only.
- `setProfilePreferences`, `requestAccountDeletion`, `claimSeasonRewards` (idempotent by `weekKey_uid`).
- Scheduled `settleWeek` (Mondays 00:05 UTC) — `settleCohort` per cohort, writes movements and reward grants.

## Draft security rules (must be emulator-tested before use)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /{document=**} { allow read, write: if false; }              // deny by default
    match /players/{uid} {
      allow read: if request.auth != null;
      allow create, update: if request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['displayName', 'avatarPetId', 'hideRank'])
        && request.resource.data.displayName is string && request.resource.data.displayName.size() <= 20;
    }
    match /boardManifests/{id} { allow read: if request.auth != null; }
    match /seasons/{id} { allow read: if request.auth != null; }
    match /leaderboardResults/{id} { allow read: if request.auth != null; }   // writes: functions only
    match /leagues/{id} { allow read: if request.auth != null; }
    match /reports/{id} { allow create: if request.auth != null; }
  }
}
```

## Go-live gate

1. Emulator tests: direct score/attempt writes denied; profile writes limited to allow-listed fields; secrets unreadable.
2. Function tests: duplicate submit, replayed nonce, third attempt, tampered events, impossible duration, clock ahead
   of server, concurrent submits (transaction), UTC boundary, sparse cohort, settlement idempotency.
3. App Check enforced in production; rate limits on start/submit.
4. Account deletion path live in-app; privacy label and policy updated.
5. Load and cost check; monitoring + an abuse review queue.
6. Explicit approval from the product owner to flip `onlineLeagues`.

## Needs from you

A Firebase project (Blaze plan for Functions + Scheduler), the iOS app registered in it, App Check (App Attest)
enabled, and an Apple Developer account for Sign in with Apple. Share the project id; no service-account keys in git.
