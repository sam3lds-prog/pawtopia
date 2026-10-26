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

## 2026-10-25 · D12 — The 60-level launch pack is the v1 boards, frozen and verified
`src/data/levelPack.ts` holds levels 1–60 exactly as the deterministic generator produced them for v1 (same seeds),
so a returning player's level 14 is the same board, and a saved in-progress board still matches its digest. Freezing
them means a future generator change can never alter a shipped level. `npm run pack:check` and the test suite verify
every board: n connected regions, the solution obeys the rules, givens agree with it, the exact solver finds exactly
one solution, and the human deduction engine solves it without guessing. The test also regenerates all 60 and
compares digests, which is the "seed determinism across releases" guard. The curve: 5×5 (1–10, with the spacing
technique arriving at 7), 6×6 (11–26), 7×7 (27–40), 8×8 (41–60); levels beyond 60 are generated and verified on
device by the same generator.

## 2026-10-25 · D13 — Onboarding: one guided board, then one idea per level
Fresh installs see a welcome screen (two-sentence story, the founding pair in two tiles) and go straight into level 1.
Level 1 is forgiving (no hearts to lose, a "Practice" chip instead) and the deduction engine picks two forced
placements that are highlighted one at a time with the forcing line softly lit; then the player finishes alone.
Later levels show a single coaching sentence when a new idea first matters (rows/columns at 2, regions at 4, spacing at
7, hints at 12, "pointing" at 19). Returning v1 players skip all of this.

## 2026-10-25 · D14 — Free soft currency on an idempotent ledger; one reward path for wins and migration
Paw Coins are earned only by playing and spent only on cosmetic decor (`config/economy.ts`: 35 first clear, +10 first
clean solve, 15 (+10 clean) for a day's daily, 100 per finished chapter; Zen and Paw Cup pay nothing). Every grant and
spend is a ledger entry with a stable id (`clear:L12`, `clean:L12`, `daily:2026-10-25`, `chapter:1`,
`buy:decor:rug`) applied at most once, and the balance is the sum of the ledger, so replays, double taps and re-runs
can't mint or charge twice. The same `applyLevelRewards` runs at win time and, on startup, over every cleared level
(`reconcileRewards`): a v1 player at level 14 receives 13 × 35 coins and the residents for levels 1, 5 and 10, once,
with a "Welcome to Pawtopia" note. Pets arrive at fixed milestones (1: Mochi + Biscuit, 5: Pip, 10: Nori,
15: Clover, 20: Peanut); chapters gift Stone Fountain, Blossom Tree, Little Bridge. Nothing is random or purchasable.

## 2026-10-25 · D15 — Sanctuary decor has fixed homes
Each of the 15 decorations has one spot in the garden, so items can't overlap or form invalid combinations; players
customize by earning, buying, and showing / hiding. Residents sit on their favorite piece when it's out (Mochi on the
cushion, Biscuit in the basket, Pip on the perch, Clover on the blanket, Nori on the rug). Pets outside the board are
static art. After the first board the player picks one of two starter gifts (Paper Lamp or Plump Cushion).

## 2026-10-25 · D16 — One scoring function and one replay verifier, shared with the future server
`competitions/scoring.ts` implements the spec formula in integer arithmetic (round half up), with the published
fixtures as tests (par 150: 75 s clean → 900, 150 s → 850, 300 s → 800, one mistake → 775). Ties: total → clean
clears → less summed time → earlier final verified finish. `competitions/verify.ts` replays an attempt's discrete
event log on a fresh session built from the official board: mistakes and completion are recomputed, hints/revives in
ranked play void the attempt, out-of-order timestamps, off-board moves and edits to givens are rejected, elapsed time
comes from the server clock, and a client clock running ahead of the server is rejected. Implausibly fast solves
are flagged for review, never auto-rejected (slow or fast accessibility users must not be disqualified). Both files are
pure and DOM-free so the Phase 6 Cloud Functions can import them unchanged. `leagueRules.ts` settles a cohort: top 5
promote, bottom 3 relegate only with ≥15 qualified players, provisional players and non-participants never drop,
rewards are coins and cosmetics only.

## 2026-10-25 · D17 — The League tab is honest practice until the backend exists
With `featureFlags.onlineLeagues` off, the Paw Cup screen offers the real five weekly boards (UTC week) under real
rules — no hints, no refills, two attempts, best counts — scored by the same verifier, but labeled everywhere as a
practice score kept on the device. The division preview contains only "You" and says real players will appear when
leagues launch; nothing is fabricated. "You vs last week" compares the player with themself.

## 2026-10-25 · D18 — Missions and badges are small, deterministic and optional
Three daily missions (always "solve any board", plus two chosen by the date, so everyone shares them) and one weekly
mission; missing a day costs nothing and no mission asks for an ad. Twelve badges with fixed small coin gifts.
Claims and gifts use the idempotent ledger. v1 history (cleared levels, best times by board size) is folded into
stats during migration so returning players' Journal and badges reflect what they actually did.

## 2026-10-25 · D19 — Settings say exactly what this build does
Settings states plainly that progress is on-device, no analytics are sent, and (in release) no ads are shown; the store
row says purchases aren't connected. Board cells announce the resident's name to VoiceOver. The v1 glyph module
(`src/game/icons.ts`) was removed once every surface used the new rigs; it remains in git history.

## 2026-10-25 · D20 — Fixes from the independent review
A separate review pass (fresh read of the code, not the author's notes) found seven defects; all are fixed with tests:
1. **Resumed Paw Cup attempts scored 0** — the event log wasn't saved with the board, so the verifier replayed only
   post-resume moves. Cup snapshots now carry the full log; a test proves a save-and-resume attempt scores exactly the
   same as an uninterrupted one.
2. **An open Cup attempt could be lost** by playing any other board (one shared save slot). Open attempts now live in
   their own per-board slots (`save.cup.open`), and League resumes from there. Attempts left open in a past week expire.
3. **A lost board resumed frozen.** Only boards still in play are saved or resumed.
4. **Rules / Settings stopped the Cup clock with the board visible.** In Paw Cup every pause hides the board.
5. **An older daily reset the streak.** Earlier dates are recorded but never touch the streak.
6. **Re-entering a mode wiped its saved board.** Every "play" entry point uses `playMode`, which continues a saved board
   of that same mode.
7. **Erase progress granted fresh Cup attempts.** Attempt records survive a reset (purchases and settings already did).
