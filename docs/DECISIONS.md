# Pawtopia — Decision log

Short, dated records of choices that shape the code. Newest last.

## 2026-10-25 · D1 — Upgrade in place, keep the engine untouched
The puzzle engine (`src/engine/*`) and its tests are the product's core asset. Pawtopia builds around it:
no file under `src/engine/` changes behavior, every existing test still passes unmodified, and
`npm run gen:check` still verifies 1,000 boards. New behavior (tool input, hint tiers, snapshots) lives in
`src/game/session.ts` (API-compatible superset) and new modules.

## 2026-10-25 · D2 — Keep Vite + TypeScript + Capacitor, no UI framework
The app is a handful of screens and one interactive board. A framework adds weight and a migration without
solving a real problem. We use small typed DOM modules with an explicit screen lifecycle (`ui/router.ts`)
that owns timers, listeners and async continuations, which is what fixes the stale-callback class of bugs.

## 2026-10-25 · D3 — Save schema v2 with additive normalization
`pawtopia.save.v2` replaces `cvd.progress.v1`. Migration is one-way, idempotent and non-destructive:
the raw v1 value is copied to `pawtopia.backup.cvd.progress.v1`, v2 is written and read back, and the v1 key
is left alone (only an explicit player reset removes it). Every field is normalized on load, so future
optional fields don't need a version bump, and corrupted data degrades to defaults instead of crashing.

Levels a v1 player had already cleared are recorded as cleared during migration, so replaying them can
never mint first-clear coins a second time.

## 2026-10-25 · D4 — Reset removes only app-owned keys
`resetProgress` deletes keys prefixed `pawtopia.` or `cvd.` and nothing else, then writes a fresh save that
keeps purchase entitlements and settings. `localStorage.clear()` is gone.

## 2026-10-25 · D5 — One outcome per transition
`Session.claimOutcome()` returns a win or loss exactly once. The UI processes results only through it, so
double taps, a hint landing on the winning cell, or a re-render can't award twice or show two sheets.

## 2026-10-25 · D6 — Celebration before ads; stubs are dev-only
The win sheet always shows first. An interstitial can appear only after the player taps through, and only
when `shouldShowInterstitial` allows it (no onboarding, no Paw Cup, never after a loss, ≥4 boards and
≥8 minutes apart, ≤3/day). Release builds use `UnavailableAdService` / `UnavailableIapService` until real SDKs
are integrated: nothing can be bought, no ad is faked, and dev-stub entitlements (`source: 'dev'`) are
ignored outside development builds. Hints are free while no rewarded network is live.

The v1 `removeAds` flag is carried over as `source: 'legacy-v1'` and honored, but flagged unverified: v1 only
ever had a stub store, so a real restore must confirm it once StoreKit is wired.

## 2026-10-25 · D7 — Deterministic boards + digest-checked resume
A `ModeRef` (`level`, `daily`, `zen`, `cup`) fully identifies a board because generation is deterministic.
The in-progress board is saved as (mode, layout digest, generator version, snapshot). Resume regenerates the
board and refuses if the digest or `GENERATOR_VERSION` differs, so a generator change can never graft an old
snapshot onto a different puzzle.

## 2026-10-25 · D8 — Local dates for Daily, UTC for competition
The Daily Cozy Puzzle keeps v1's local-date keys so existing records and streaks remain valid. Paw Cup weeks
use ISO weeks in UTC (Monday 00:00 UTC) so every competitor shares one boundary. Date math uses calendar
fields, never fixed 24-hour offsets, so DST can't skip or repeat a day.

## 2026-10-25 · D9 — Rename the app, keep the bundle id
The display name becomes **Pawtopia** (`capacitor.config.ts` `appName`, page title, icon). The iOS bundle id stays
`com.sam3lds.catsvsdogs`: changing it would make Pawtopia a different App Store app, so existing players would not
receive it as an update and their on-device save (which the v2 migration carries forward) would be stranded.
The App Store listing name is set in App Store Connect and can say Pawtopia without touching the bundle id.

## 2026-10-25 · D10 — Screens own a lifecycle scope; the board is the hero
`ui/router.ts` mounts one screen at a time with a `Scope` that owns its timers, listeners, sheets and async
continuations. The game screen groups the board with its one-line coach in a flexible zone, so on tall phones the
spare height is shared above and below instead of separating the board from its feedback. Cells are sized from the
zone (max 76px, min 26px; 9×9 fits a 320px phone at ~31px cells). "Large board" keeps cells ≥46px and scrolls.

## 2026-10-25 · D11 — Faces are pose data on fixed SVG layers; the head never moves
Each pet is one 64×64 SVG with fixed layers: `head-static` (never transformed), `cheeks`, `eyes` (pupils glance
inside the eye; closed "smiling" arcs crossfade in), `lids` (fur-colored eyelids lowering from the top), `brows`
and `mouth` (discrete shapes that crossfade). An expression is a small `Pose` (eye state, lid coverage, pupil
offset, brow lift/tilt, mouth shape, blush) written as CSS custom properties and two data attributes, so a
reaction never touches layout and the tile's size and hit area never change. A test parses `pets.css` and fails if
any `transform` targets something other than pupils, lids or brows, and checks that board pets have no transform or
animation (the mistake ghost only fades).

Reactions come only from explicit session events: correct placement → happy; line/region complete → proud (the new
pet and its partner, two faces at most); a mistake → the faint ghost of the attempted pet looks puzzled (no placed
pet ever reacts to a mistake); hint → pets already in the highlighted line look attentive; picking the Cat/Dog
tool → one pet of that species glances down at the toolbar; marking a tile → one neighbor glances at it; win → a
staggered smile/wink wave that ends within 1.5 s. A tile's pet identity depends only on its region, the board seed
and the player's roster, never the solution. Glance direction depends only on tile positions.

`FaceDirector` (DOM-free, fake-clock tested) caps concurrent reactions at three, staggers idle blinks with a seeded
random per tile (4–9 s), lets pets doze after 20 s without input, pauses ambient life when the board is paused or
hidden, stops blinks in reduced-motion mode (reactions then switch instantly), and clears every timer when a pet
leaves its tile or the screen unmounts. Outside the board (tool buttons, win sheet, collection) pets are static.
