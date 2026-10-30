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
          app/ (context, gameFlow, events, rewarded, leaderboardSync)
                     │
   ┌─────────────────┼──────────────────────┬──────────────────┬─────────────────────┐
 game/ (session,  meta/ (progression,     competitions/      leaderboard/        services/
 modes, puzzles,  rewards, ledger, items, (scoring, verify,  (check, server,     (storage+migration,
 specs, grading,  points, world, feeding, leagueRules, cup,  nickname, queue —   kv guard, ads, iap,
 persistence)     missions, achievements, localCup)          shared with the     leaderboard, analytics,
                  sanctuary, catalogs)                       Cloud Functions)    audio, haptics)
 engine/ (solver, deduce, generator, levels, rng)  ← unchanged from v1
 data/ (levelPack: frozen levels 1–60; journeyPack2: frozen levels 61–150)
 functions/ (Firebase callable functions: a thin Firestore/Auth adapter around leaderboard/server.ts)
```

## Key flows

**Starting a board.** `gameFlow.startGame(mode)` → `puzzles.currentSpec(mode)` → `puzzles.puzzleFor(mode, spec)`
(frozen packs for levels 1–150; spec 2 picks boards by measured difficulty via `specs.pickBoard`; spec 1 uses the
original generator ladder) → `new Session({ maxHearts })` → router shows `screens/game`. Paw Cup boards first open an attempt
(`localCup.startAttempt`), which fails when both attempts are used.

**Playing.** Board input → `Session.apply/tap/place` → `MoveResult` → feedback (sound, haptic, tile overlay, face
reaction) → `paint()` updates only changed cells → `app.saveActive()` snapshots the board (also on background /
pagehide) → `session.claimOutcome()` returns win/loss exactly once.

**Winning.** `progression.recordWin` (journey, daily streak, stats, best times per spec) → `rewards.rewardsForWin`
(coin ledger grants, Paw Points, first-clear treats and tickets, pet and companion unlocks, chapter gifts) → `localCup.finishAttempt` (Paw Cup: replay-verified practice score) → `events.afterSolve`
(missions, badges) → persist → face celebration (≤1.5 s) → win sheet → only after the player taps through, an
interstitial *may* be considered by `shouldShowInterstitial` (never in release today: no ad network).

**Startup.** `storage.loadSave` (v2, or migrate v1 with backup + round-trip check) → `rewards.reconcileRewards`
(idempotent catch-up for v1 progress and back-dated Paw Points) → `items.grantStarterItems` (once) →
`world.reconcileWorld` (regional friends whose stage was reached) → `catchUpAchievements` → gem purchase reconcile and
leaderboard sync in the background → route to Welcome (fresh install) or Home.

**Growing a sanctuary.** On a win (not Paw Cup, not the guided board) `world.growOnSolve` adds one to the regional
sanctuary being built; stages, arrivals and the completion gift are derived from that count, so re-running is safe.
The win sheet shows the growth; "Visit" opens `screens/region` with the new stage growing in. D28.

**Leaderboard.** If the player joined, the win also queues `{mode, spec, move log}` (`leaderboard/queue.ts`) and
`leaderboardSync` sends batches to `lbSubmit`, which rebuilds the board, replays the log (`leaderboard/check.ts` →
`competitions/verify.ts`) and awards Paw Points once per award id (`leaderboard/server.ts`). The League's table reads
`scores` from Firestore. D30.

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

## Difficulty and specs

`game/grading.ts` measures a board by replaying the deduction engine (breakthroughs, chain length, neighbor logic,
openings, givens) and gives the label players see. `game/specs.ts` decides which board a Journey level or Daily date
gets, by spec version; saved boards remember theirs. See `docs/DIFFICULTY.md` and D22.

## Pantry and points

`meta/items.ts` keeps treats, hint tickets and Paw Points on an append-only, idempotent item ledger (like coins).
Hearts stay in the `Session`; hint costs are decided by `Session.hintCost` and recorded with `commitHint`. D23.

## Sanctuary life

`ui/animation/ambientDirector.ts` (DOM-free, fake-clock tested) schedules small actions on sanctuary figures and
decorations, at most three at once; `ui/components/sceneLife.ts` gives each figure and lively part its repertoire and
plays arrival greetings; `styles/sanctuary-life.css` holds all sanctuary motion, scoped to the live scene. Wildlife
friends (`meta/catalogs/companions.ts`, `ui/art/companions.ts`) are separate from the cat/dog residents. Regional
scenes (`ui/art/regions.ts`) are built from stage features, regional decor and their three animals. D24, D28, D29.

**Play.** Special and premium decorations have activities (`ui/art/activities.ts` for the rider and props,
`ui/components/activities.ts` → `ActivityRunner` for when and who): a copy of an animal rides the balloon or naps in
the hammock while its own figure steps away. Tricks (`meta/catalogs/tricks.ts`, `meta/tricks.ts` for owning and
buying, `ui/art/tricks.ts` for emotes and props, `ui/components/tricks.ts` for the tray under the scene, the trick card
and `performTrick`) play on the tapped figure itself. Their motion lives in `styles/sanctuary-play.css` (≤ 6.5 s, no
loops, reduced motion = still), checked by `test/unit/play.test.ts` and `test/unit/tricks.test.ts`. D32, D33.

## 3D toys (D34)

`src/three/` is loaded on demand (`ui/components/scene3d.ts` → `import('../../three/stage')`). `species.ts` describes
the 20 animals as data; `toy.ts` builds each from rounded parts with a rig; `face.ts` paints eyes and mouths per
expression onto canvas textures; `pose.ts`/`clips.ts` are pure, tested pose channels and clips (everyday moves,
tricks, emotes, decoration rides); `actor.ts` layers clips over idle motion; `effects.ts` adds props and the emote
bubble; `stage.ts` overlays a WebGL canvas on a sanctuary figure (or a card's preview stage), stands each toy on its
drawn figure's `data-gx/gy/gh`, and mirrors the drawn figures' state (`is-<action>`, `data-trick`, `is-away`, the
`.sp-act` rider) with a MutationObserver, so nothing upstream knows the toys exist. `toys.html` (dev only) is a
gallery of every toy: `?clip=backflip&t=0.5`, `?face=love`. In dev, `window.__stage3d.freezeAt(ms)` steps a clip.

## World map

`ui/art/worldMap.data.ts` is generated once by `scripts/build-world-map.ts` (Natural Earth via world-atlas, Natural
Earth I projection); `ui/art/worldMap.ts` places pins with the same formula at runtime (tested against d3). D28.

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
| `test/unit/hearts.test.ts` | five casual hearts, Cup's three, wrong Cat/Dog semantics, legacy save upgrade |
| `test/unit/difficulty.test.ts` | grading, pack 2 frozen and reproducible, spec routing, old 9×9 saves resume |
| `test/unit/pantry.test.ts` | item ledger caps/overflow, earning rules, hint-ticket costs, treats, Paw Rank |
| `test/unit/sanctuaryLife.test.ts` | ambient budget, reduced motion, CSS scope, companions, pats, small talk |
| `test/unit/feel.test.ts` | mistake strike is fade-only, remembered tool |
| `test/unit/flow.test.ts` | next level advances, resume digests, ad cadence, IAP stubs, dates/DST/UTC weeks |
| `test/unit/progression.test.ts` | stars, replays, streaks + Cozy Day, chapters, onboarding |
| `test/unit/levelPack.test.ts` | 60 shipped boards verified and identical to the generator |
| `test/unit/faces.test.ts` | mood machine, scheduler (caps, stagger, cancel, reduced motion), facial-only CSS, no answer leaks |
| `test/unit/economy.test.ts` | ledger idempotency, rewards, v1 reconcile, decor purchase, scene |
| `test/unit/competition.test.ts` | score fixtures, tie-breaks, league settlement, replay verifier tamper cases |
| `test/unit/meta.test.ts` | missions, badges, v1 stats, local cup attempt limits |
| `test/unit/world.test.ts` | projection, regions opening, growth/stages/arrivals/gift once, switching, reconcile, regional decor, scenes |
| `test/unit/leaderboard.test.ts` | solve replay (mistakes, hints, extra lives), rejections, awards once, weekly rollover, rate limits, names, reports, deletion, queue |
| `test/firebase/rules.test.ts` | Firestore rules against the emulator (`npm run fb:test`; not part of `npm test`) |
| `test/e2e/smoke.mjs` | first run, next level, resume, purchase once, sanctuary life, world map growth, leaderboard join → solve → leave, scoped reset |
