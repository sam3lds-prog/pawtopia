# Pawtopia Cloud Functions (leaderboard)

Four callable functions (2nd gen, Node 22). They are thin: every rule lives in the shared, unit-tested code in
`../src/leaderboard` (`check.ts` rebuilds and replays each solved board; `server.ts` awards Paw Points once per award
id, rate-limits, validates names, handles reports and deletion). `npm run fb:build` (repo root) bundles
`functions/src/index.ts` together with that code into `functions/lib/index.js`.

| Function | Input | What it does |
| --- | --- | --- |
| `lbProfile` | `{ nickname, avatar }` | Joins, or changes the name / picture. Name rules: `src/leaderboard/nickname.ts`. |
| `lbSubmit` | `{ solves: [{ mode, spec, events }] }` (≤ 10) | Replays each board; awards `L12`, `clean:L12`, `nohint:L12` or `D2026-10-29` once each; updates `scores/{uid}`. 60 solves an hour, 250 a day. |
| `lbReport` | `{ uid }` | Three different reporters replace a name with "Player ####". |
| `lbDelete` | `{}` | Deletes `players/{uid}` (and its awards), `scores/{uid}`, `reports/{uid}`, then the auth user. |

Data and rules: see `firestore.rules` (clients read `scores` when signed in and their own `players/{uid}`; nobody
writes anything directly) and `firestore.indexes.json` (`scores`: weekKey + week, both directions, for the weekly table and weekly rank).

```
npm --prefix functions install     # once
npm run fb:build                   # bundle
npm run fb:emulators               # local auth + firestore + functions (set VITE_FIREBASE_EMULATORS=1 in .env.local)
npm run fb:test                    # security-rules tests against the emulator
npm run fb:deploy                  # build + deploy functions, rules and indexes
```

`functions/.env` (optional, git-ignored): `ENFORCE_APP_CHECK=true` once App Attest is set up; `FUNCTIONS_REGION` if
not `us-central1`.
