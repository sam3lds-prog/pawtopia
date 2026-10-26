# Pawtopia — Architecture

Framework-free TypeScript on Vite, wrapped by Capacitor for iOS. Pure logic is separated from the DOM so that the
engine, economy, scoring and verification are unit-testable in Node and the scoring/verifier can move to a server
unchanged.

```
             ┌──────────────── ui/ (DOM) ────────────────┐
 main.ts ──▶ │ router (Scope lifecycle) → screens/*      │
             │ components/ (board, sheet, nav, petSheet) │
             │ art/ (pet rigs, sanctuary)  animation/    │
             └───────┬──────────────┬────────────────────┘
                     │              │
          app/ (context, gameFlow, events)
                     │
   ┌─────────────────┼──────────────────────┬─────────────────────┐
 game/ (session,  meta/ (progression,     competitions/        services/
 modes, puzzles,  rewards, ledger,        (scoring, verify,    (storage+migration,
 persistence)     missions, achievements, leagueRules, cup,    kv guard, ads, iap,
   │              sanctuary, catalogs)    localCup)            analytics, audio, haptics)
 engine/ (solver, deduce, generator, levels, rng)  ← unchanged from v1
 data/ (levelPack: frozen, verified levels 1–60)
```

## Key flows

**Starting a board.** `gameFlow.startGame(mode)` → `puzzles.puzzleFor(mode)` (pack for levels 1–60, deterministic
generator otherwise) → `new Session` → router shows `screens/game`. Paw Cup boards first open an attempt
(`localCup.startAttempt`), which fails when both attempts are used.

**Playing.** Board input → `Session.apply/tap/place` → `MoveResult` → feedback (sound, haptic, tile overlay, face
reaction) → `paint()` updates only changed cells → `app.saveActive()` snapshots the board (also on background /
pagehide) → `session.claimOutcome()` returns win/loss exactly once.

**Winning.** `progression.recordWin` (journey, daily streak, stats) → `rewards.rewardsForWin` (ledger grants, pet
unlocks, chapter gifts) → `localCup.finishAttempt` (Paw Cup: replay-verified practice score) → `events.afterSolve`
(missions, badges) → persist → face celebration (≤1.5 s) → win sheet → only after the player taps through, an
interstitial *may* be considered by `shouldShowInterstitial` (never in release today: no ad network).

**Startup.** `storage.loadSave` (v2, or migrate v1 with backup + round-trip check) → `rewards.reconcileRewards`
(idempotent catch-up for v1 progress) → `catchUpAchievements` → route to Welcome (fresh install) or Home.

## Screen lifecycle

`ui/router.ts` mounts one screen at a time. Each mount gets a `Scope` that owns its timers, listeners
(AbortController), child scopes (sheets) and async continuations (`scope.alive` checks after every `await`).
Navigating disposes the scope, so nothing from a left screen can fire into the next. The face director is disposed
with its screen and clears every timer it set.

## Persistence

`services/kv.ts` guards every storage call (private mode, quota, throws) with an in-memory fallback.
`services/storage.ts` holds the versioned save (`pawtopia.save.v2`), normalization of every field on load, the
one-way, non-destructive v1 migration, and the scoped reset that removes only `pawtopia.*` / `cvd.*` keys and keeps
purchases and settings. See `docs/DECISIONS.md` D3–D4.

## Determinism

Puzzles are a pure function of (size, seed). `GENERATOR_VERSION` is stored with saved boards and competitive events;
a saved board resumes only if the regenerated layout digest matches. Levels 1–60 are frozen in `data/levelPack.ts`
and the test suite regenerates them to prove the generator still agrees.

## Faces

`ui/art/pets.ts` builds layered SVG rigs; `ui/animation/faceMachine.ts` is the per-pet state machine;
`ui/animation/faceDirector.ts` schedules reactions and blinks per board. Both are DOM-free and tested with a fake
clock. `styles/pets.css` maps poses to transforms on pupils, lids and brows only (enforced by a test).

## Feature flags

`config/featureFlags.ts`: `onlineLeagues` (off), `friends` (off), `devGallery` (dev builds only). Anything needing a
backend or a store stays off until integrated, tested and approved.

## Tests

| Suite | What it guards |
| --- | --- |
| `test/engine.test.ts` | v1 engine: unique, valid, logic-only puzzles |
| `test/unit/session.test.ts` | outcome claimed once, tools, undo/redo, zen, clock, hints, snapshots |
| `test/unit/storage.test.ts` | v1 → v2 migration, backups, corruption, scoped reset, storage that throws |
| `test/unit/flow.test.ts` | next level advances, resume digests, ad cadence, IAP stubs, dates/DST/UTC weeks |
| `test/unit/progression.test.ts` | stars, replays, streaks + Cozy Day, chapters, onboarding |
| `test/unit/levelPack.test.ts` | 60 shipped boards verified and identical to the generator |
| `test/unit/faces.test.ts` | mood machine, scheduler (caps, stagger, cancel, reduced motion), facial-only CSS, no answer leaks |
| `test/unit/economy.test.ts` | ledger idempotency, rewards, v1 reconcile, decor purchase, scene |
| `test/unit/competition.test.ts` | score fixtures, tie-breaks, league settlement, replay verifier tamper cases |
| `test/unit/meta.test.ts` | missions, badges, v1 stats, local cup attempt limits |
| `test/e2e/smoke.mjs` | first run, next level, resume, purchase once, scoped reset, facial-only in a browser |
