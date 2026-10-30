# Pawtopia Cloud Functions (leaderboard)

Four callable functions (2nd gen, Node 22). They are thin: every rule lives in the shared, unit-tested code in
`../src/leaderboard` (`check.ts` rebuilds and replays each solved board; `server.ts` awards Paw Points once per award
id, rate-limits, validates names, handles reports and deletion). `npm run fb:build` (repo root) bundles
`functions/src/index.ts` together with that code into `functions/lib/index.js`.

| Function | Input | What it does |
| --- | --- | --- |
| `lbProfile` | `{ nickname, avatar }` | Joins, or changes the name / picture. Name rules: `src/leaderboard/nickname.ts`. |
| `lbSubmit` | `{ solves: [{ mode, spec, events }] }` (≤ 10) | Checks the caller is joined and within 30 solves an hour / 80 a day *before* rebuilding anything, then replays each board (on the spec it is issued under today); awards `L12`, `clean:L12`, `nohint:L12` or `D2026-10-29` once each; updates `scores/{uid}`. |
| `lbReport` | `{ uid }` | Players with a counted solve can report a name; three different reporters replace it with "Player ####". |
| `lbDelete` | `{}` | Deletes `players/{uid}` (and its awards), `scores/{uid}`, `reports/{uid}`, its id in reports it made, then the auth user. |
| `lbCleanup` | daily (scheduled) | Removes accounts with no leaderboard activity for 365 days (lost phones, reinstalls). |

Data and rules: see `firestore.rules` (clients read `scores` when signed in and their own `players/{uid}`; nobody
writes anything directly) and `firestore.indexes.json` (`scores`: weekKey + week, both directions, for the weekly table and weekly rank).

```
npm --prefix functions install     # once
npm run fb:build                   # bundle
npm run fb:emulators               # local auth + firestore + functions (set VITE_FIREBASE_EMULATORS=1 in .env.local)
npm run fb:test                    # security-rules tests against the emulator
npm run fb:deploy                  # build + deploy functions, rules and indexes
```

**Deploy order when a board spec changes** (like D31's spec 3): deploy the functions *before* the app update ships.
An older server rejects solves on a spec it doesn't know, and the app drops rejected solves (only "rate-limited" is
retried), so an app that reaches players first loses their leaderboard points until the server catches up. Solves
queued offline on a retired spec are rejected by design (`bad-spec`): the server counts a board only on the spec it
is issued under today.

D35 is such a change: spec 4 (one-animal Journey levels 1–20, levels from 21 replaying the board of level L − 20, and
the one-animal Daily sent as `{ kind: 'daily', dateKey, rule: 'solo' }`). Deploy the functions built from this
version (`npm run fb:deploy`) before the app update. Both Dailies of a date
award the same `D<date>` id, so a day still counts once.

`functions/.env` (optional, git-ignored): `FUNCTIONS_REGION` if not `us-central1`. `ENFORCE_APP_CHECK=true` only
after the app sends App Check tokens (a native App Attest provider; not wired up yet), otherwise every call fails.
