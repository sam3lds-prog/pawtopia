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

## 2026-10-26 · D21 — Five hearts on casual boards; Paw Cup keeps three
Journey and Daily boards now allow five wrong placements (`CASUAL_HEARTS`); Paw Cup keeps its published three
(`CUP_HEARTS`), and the replay verifier pins that number explicitly so a casual-rule change can never alter a ranked
result. Zen and the guided first board stay heart-free. Hearts are per board and never carry over.
`Session` takes `maxHearts` (default 3, so every existing caller and test behaves as before) and snapshots record it.
A board saved under the old three-heart rule keeps the mistakes it made and gains the two new hearts (2 of 3 → 4 of 5).

Wrong placements already behaved as the feel review asked (the attempted pet appears as a faint, puzzled ghost; the
tile keeps whatever it held, empty or the player's ✕; nothing reveals the other species). The ghost now also gets a
thin strike that fades with it, opacity only. The pet tool picked last is remembered for the next board (Cat/Dog
only, so a first tap always places), Settings shows a small picture of what one tap does under each control scheme,
and the loss sheet states the real allowance. Fixed in passing: long sheets (Settings) squeezed their sections to fit
the screen and clipped rows; sheet children no longer shrink.

Not done, on purpose: an optional long-press action sheet. It conflicts with drag-marking and needs a usability test
first. At 8×8 on a 320px phone cells are ~36px, below 44pt; "Large board" (≥46px, scrollable) remains the answer.

## 2026-10-26 · D22 — Measured difficulty, versioned specs, 8×8 cap for new boards (D1 kept)
Labels now come from measuring each board (`src/game/grading.ts`, method and calibration in `docs/DIFFICULTY.md`):
the grader replays the unchanged deduction engine step by step and scores breakthroughs, chain length, neighbor
logic, easy openings and sparse givens. Easy = singles only; Expert additionally requires neighbor logic. It lives
outside `src/engine/`, so D1 stands: no engine file changed and every original test passes unmodified.

Which board a level or day gets is now versioned (`src/game/specs.ts`):
- **Spec 1** (unchanged): Journey 1–70, every daily before 2026-10-27, Zen, and Paw Cup.
- **Spec 2**: Journey 71+ rotates 5×5–8×8 in ten-level blocks (a small board can be Expert, a big one Medium) and
  dailies from 2026-10-27 follow a ≤8×8 weekday ladder. Each board is *picked* by its measured label from a fixed
  sequence of candidate seeds, so every device gets the same board.
- Journey 61–150 are frozen in `src/data/journeyPack2.ts` (61–70 exactly as players already saw them). `pack:check`
  regenerates and fails if any committed board would change. Beyond 150, boards are picked on device by the same rule.
- Saved boards record `specVersion` and resume on it; older saves are spec 1, so an in-progress 9×9 at level 75 still
  resumes as that 9×9. A cleared level that moved to a new board keeps its clear, stars and one-time rewards; only its
  best time starts fresh (`LevelClear.spec`).
- Zen offers 5–8. Paw Cup keeps its published five boards including the 9×9 Grand Hall (owner decision), so the
  Grand Thinker badge stays reachable there.

Performance: picking a board takes ~70 ms on a laptop on average, ~0.6 s worst case over a year of dailies; only
dailies and levels beyond 150 pick on device.

## 2026-10-26 · D23 — A small pantry (treats, hint tickets) and Paw Points; a staged win moment
Hearts, treats, tickets, coins and points are kept apart (`src/meta/items.ts`):
- **Hearts** are per board (D21). **Treats** (one heart back on a Journey or Daily board, mid-board or to continue
  after a loss with every placement kept) and **hint tickets** persist between boards, capped at 10 each; anything
  earned past a cap arrives as 10 coins per item instead of vanishing. Neither works in Paw Cup; a treat is logged as a
  revive, so the verifier voids a ranked attempt that used one.
- **Hints** (owner decision): each board's first look (tier 1) is free; after that one ticket pays for one hint target,
  whichever tiers are opened for it (the exact cell, then placing it). Zen and the guided first board stay free. The
  "no hints" star still means no hint of any kind. The ticket and the board's record of it are saved in one write.
- **Earning**: a first clear gives a treat, every even-numbered new level a ticket, some errands add one; replays
  earn none. Everyone gets a one-time starter pantry (3 treats, 5 tickets) instead of back-dated items for old clears
  (owner decision), explained once on Home. With no ad network live, the "watch a video for a ticket" option exists
  only in development builds (D6 unchanged).
- **Paw Points / Paw Rank**: first clear 100 + difficulty bonus by measured label (0/25/50/100), +25 for the first
  clean and +25 for the first hint-free solve of a level; dailies 60 + bonus. Back-dated for old clears (they buy
  nothing). Eight named ranks, shown on the win sheet and in the Journal, never as a competitive score.
- **Win moment**: the sheet opens 0.5 s after the last pet (faces finish their wave behind it), then stars and
  stats, points and rank, rewards and the next resident rise in three stages within ~1.5 s; a tap reveals all, the
  buttons work immediately, reduced motion shows everything at once. Replays show what's left to improve instead of
  rewards.

## 2026-10-26 · D24 — A living sanctuary (revises D11/D15 for the sanctuary only) and the first wildlife friends
On the puzzle board nothing changes: pets animate their faces only, and the existing CSS guards still enforce it. The
**sanctuary scene** is now a lightly animated diorama (`ui/animation/ambientDirector.ts`, DOM-free, fake-clock tested):
every 5–12 s one figure or decoration does something small (blink, glance, yawn, tail wag, stretch, hop; the fountain
catches the light, the lantern glows, a blossom petal drifts, fireflies twinkle in the evening). At most two move at
once, each action lasts ≤ 1.8 s, there is one scheduling timer plus one end timer per running action, and everything
stops when the screen is hidden or left. Reduced motion shows a still scene; a tap still gets a face-only reaction.
All motion CSS lives in `sanctuary-life.css`, scoped to `.sanctuary__scene.is-live`, and a test fails if a rule
escapes that scope, loops forever or runs longer than 1.8 s. Home's scene card stays still.

- **Wildlife friends** are a separate model (`meta/catalogs/companions.ts`), never a puzzle species: Ember the fox
  (level 30, by a woodland log) and Maple the red panda (level 45, napping in the blossom tree when it's out, otherwise
  on the lawn by the cottage). Deterministic milestones, back-dated like residents. Capybara, otter, axolotl and owl
  are planned but not listed until their art exists.
- The Play path's paw marks now sit only on levels where someone really arrives (they used to mark every fifth level,
  including 25, 35, 40… where nobody came); the win sheet counts down to the next arrival.
- A once-a-day **pat** on any resident or friend adds a heart of affection (cosmetic only). Tapping a figure in the
  garden makes it react. One line under the scene comes from a resident and only states real facts (a recent Hard or
  Expert solve, the streak, a newcomer, today's solve). Evenings (7 pm–6 am local) get a dusk wash and fireflies.

## 2026-10-26 · D25 — Fixes from the second independent review
A fresh review of D21–D24 found no data loss, no double grants and no Paw Cup leak, and nine smaller defects; all are
fixed with tests where testable:
1. A board with a spent ticket, a mistake or a treat but no placement was thrown away on re-entry (so a paid hint could
   be paid again, and lost hearts came back). Such boards are now resumable.
2. Looking at the free hint again after any move charged a ticket. The free look's cell is remembered (and saved).
3. Tapping the win sheet could leave the Paw Points count-up frozen mid-count. The final number now always wins.
4. Under reduced motion the win sheet's later sections still waited out their stage delays. Everything shows at once.
5. The hint badge said a ticket was needed when the next look was already paid for. It now asks the session.
6. A held key (H, C, D…) auto-repeated actions and could run through hint tiers and tickets. Repeats are ignored.
7. An errand claimed with a full treat jar announced "+1 treat" while the treat had become coins. The toast now says
   exactly what arrived (`claimMissionDetailed`).
8. Paw Cup boards were labeled by their lineup slot in the League list but by measurement on the board. The list now
   shows size and par only (measuring five Cup boards on screen open would cost up to a second each on a phone).
9. The Play path showed the new board's size for a level whose old 9×9 was still in progress. It now uses the saved spec.
Also: a treat is spent only after checking it will really restore a heart; erasing progress grants the starter pantry
again; the release checklist now covers setting `DAILY_V2_FROM` to the rollout date and pinning grading changes.

## 2026-10-29 · D26 — Softer board, colored game icons, Play opens on your level, treats become Extra lives
- **Board**: dark region dividers and the dark frame are gone. Regions are separated by 4px light seams in the board's
  ivory, with a faint outer ring and shadow. Players who need stronger edges get the dark dividers back in
  Settings → High contrast (unchanged), and Region patterns still add texture.
- **Icons**: lives are glossy hearts (a lost one is a pale dashed outline, so it isn't color alone); hints are a golden
  bulb with a paw; extra lives, video tokens, gems and food have their own colored icons. Drawn in layers, no
  gradients, so cloned copies render identically.
- **Play tab**: opens centered on the level you're on, with a pinned "Play level N · size · difficulty" button above the
  tab bar (it resumes a saved board of that level, on that board's own spec).
- **Naming**: the item that gives a heart back is now an **Extra life** (ledger kind `life`; saved `treat` entries load
  as `life`). Hint tickets are just **hints** in the UI. "Treats" now means food for sanctuary animals (D27). Ledger
  ids keep their original `treat` wording (`starter:pantry:treat`, `treat:L12`, `mission:…:treat`) so nothing is ever
  granted twice.

## 2026-10-29 · D27 — Three currencies, sanctuary food, optional reward videos (AdMob), gems (RevenueCat); Capacitor 8
Owner decisions (2026-10-29): reward videos through Google AdMob, paid gems through RevenueCat. This revises D6
("no ad SDK, nothing for sale") under the same principles: optional, honest, never pay-to-win.

- **Currencies**: Paw Coins (earned by solving; everyday decor and food), **video tokens** (only from reward videos;
  special decor and special treats), **gems** (App Store gem packs; premium decor only). Gems and tokens live in the
  item ledger (`vtoken`, `gem`), spent with idempotent ids like coins. Nothing sold or earned by video affects puzzles,
  Paw Cup or rankings; hearts and hints can be earned by playing or by a video, never bought with money.
- **Decor**: each item has exactly one price. New for Harmony: Rainbow Kite and Cottage String Lights (video tokens),
  Hot-Air Balloon and Golden Fountain (gems). Items can share a **slot** (the Golden Fountain stands where the Stone
  Fountain does); bringing one out tucks the other away, and a bought item comes straight out.
- **Food & treats**: 8 foods for coins, 3 special treats for video tokens, kept in the pantry (max 30 each) and fed from
  an animal's card. Favorites count double; special treats are everyone's favorite. An animal takes up to 6 hearts of
  affection from food a day, then politely declines (the food stays). Affection gives a friendship level (New friend →
  Family). Cosmetic only.
- **Reward videos** (`services/ads.ts`, `app/rewarded.ts`): only when the player taps "Watch a short video" for an extra
  life (when out of extra lives, incl. on the loss sheet, where it brings the board back), a hint (when out of hints)
  or a video token (Shop). 10 a day, shared. Granted only when the SDK confirms the reward, and kept even if the player
  left the screen. **No interstitials** (`INTERSTITIALS_ENABLED = false`) and no banners. The old "refill all hearts"
  revive is gone; a video gives one heart, like an extra life. AdMob runs only on the iOS app with `VITE_ADMOB_ENABLED=1`
  (Info.plist must be set up first, or the SDK crashes); consent (UMP) and Apple's tracking prompt are asked on the first
  video the player chooses, never at launch. Google's test unit is used until a real one is configured.
- **Gems** (`services/iap.ts`, `meta/gems.ts`): RevenueCat on the iOS app when `VITE_REVENUECAT_IOS_KEY` is set. Each
  purchase is granted once per store transaction id, and on launch any recorded consumable the save lacks is granted.
  Release builds without a key show gem packs as "coming soon". The never-built bundles (starter decor, cozy theme,
  portraits, supporter) were removed from the catalog; Remove interruptions stays for v1 owners.
- **Test builds** (dev and the tester preview) use a labeled test store and test videos. Test gems carry source `test`
  and never count in a release build (`setTestEntriesCount`), mirroring D6's dev entitlements.
- **Capacitor 6 → 8** (plus `@capacitor/haptics` 8), done before the iOS project was first generated, because both
  plugins require Capacitor 8. Setup steps for Info.plist, App Store Connect products, RevenueCat and AdMob are in
  `docs/native-setup.md`; keys go in `.env.local` (`.env.example` lists them).

## 2026-10-29 · D28 — The world map and regional sanctuaries
Owner decisions (2026-10-29): four regional sanctuaries — Australian Outback, African Savanna, Arctic, Amazon
Rainforest — each with animals from that region, tracked on a world map.

- **Opening**: regions open for free at Journey milestones (after levels 6, 20, 40, 60). Opening and growing a region
  are never sold; there is no way to buy progress.
- **Growing**: you build one regional sanctuary at a time (the first open, unfinished one, or the one you pick with
  "Build here"; progress elsewhere is kept). Every solved puzzle adds one to it — Journey (replays too), Daily and Zen;
  Paw Cup is competition and the guided first board is practice, so neither counts. Stages at 3 / 8 / 15 / 25 solves:
  first friend, shelter, water and shade, thriving. Each of the first three stages welcomes one of the region's
  animals; the last gives 150 Paw Coins once (`world:complete:<id>`). Stages and arrivals are derived from the growth
  count, so a reconcile at startup repairs an interrupted save and nothing is granted twice (`meta/world.ts`).
- **Animals**: 12 regional wildlife friends (koala, kangaroo, wombat; giraffe, meerkat, elephant calf; snowy owl, polar
  bear cub, seal pup; toucan, sloth, capybara), drawn in code like Ember and Maple, with pats, food and favorites. They
  live only in their sanctuary and never appear on a puzzle board (cats and dogs only, D11).
- **Decor**: each region has four decorations of its own (two for coins, one for video tokens, one for gems), bought
  once that region is open. The Shop's decor tab picks a sanctuary. Every decoration belongs to exactly one sanctuary.
- **Map**: Natural Earth land outlines (public domain, via world-atlas) projected with Natural Earth I by a one-off
  script; the output is committed and the app computes pin positions with the same formula (no d3 at runtime). Harmony
  is a small fictional island in the Pacific.
- **Navigation**: the bottom bar's Pets tab becomes **World** (map → regional sanctuary). The resident collection is
  now the **Animal album** (from World), with every wildlife friend listed by sanctuary. Home shows a strip with the
  sanctuary being built and how close its next stage is.
- **Life**: regional scenes reuse the sanctuary ambient director (D24): blades turn, the aurora ripples, birds and
  butterflies drift, hammocks sway, one short action at a time, nothing looping, still under reduced motion. Animals
  say hello when you arrive (a bigger hello on the first visit of the day or right after a solve that helped), and a
  stage just reached grows in.

## 2026-10-29 · D29 — Livelier sanctuaries, still calm
Owner request: sanctuaries more animated, and animals excited when you visit.

- **Arrival**: everyone in a sanctuary (Harmony or a region) says hello one after another when you arrive: a hop or a
  wag, or a bigger hello (two happy hops, a smile and a heart) on the first visit of the day and right after a puzzle
  that helped that place. A stage just reached grows in.
- **Taps and care**: tapping an animal in the scene gets a happy hop and a heart. Feeding or patting from an animal's
  card makes it react in the scene once the card closes, where you can see it.
- **Ambient pacing** (revises D24's numbers, not its rules): up to three small actions at once (was two), one every
  3.5–9 s (was 5–12 s), plus short strolls (a few steps, a turn, back to its spot). Every action is still ≤ 1.8 s, nothing
  loops forever, everything pauses when the screen is hidden, and under reduced motion nothing moves by itself (a tap
  still gets a smile and a heart). The puzzle board is unchanged: faces only (D11).

## 2026-10-29 · D30 — A real leaderboard on our own server (Firebase)
Owner decision (2026-10-29): leaderboard on our own server, Firebase.

- **What is ranked**: Paw Points from the Journey and the Daily (the progress measure players already know), in a
  weekly table (UTC week) and an all-time table. Paw Cup stays offline practice; its online leagues are still Phase 6.
- **Opt-in**: League → Leaderboard → Join, with a nickname (a friendly suggestion is the default) and a picture of one
  of the player's welcomed animals. Anonymous sign-in happens only then. Leaving deletes everything.
- **Fair by construction**: the client never sends points. It sends which board it solved (mode + spec) and the move
  log; the server rebuilds the board and replays the log with that mode's rules (the same `Session` and verifier the
  game uses), then awards with the app's own point table. Award ids (`L12`, `clean:L12`, `nohint:L12`, `D<date>`) pay
  once per account. Logs faster than 250 ms per placement don't count, a board counts only on the spec it is issued
  under today, and no log may hold more hints than the board has cells. 30 solves an hour, 80 a day, checked before any
  board is rebuilt. Only boards solved after joining count (earlier solves have no logs to check). Honest about the
  limit: a script can replay boards like a person would, so pacing (not the replay) bounds what it can add; App Check
  and reports are the next lines. To make every board checkable, a hint that places a pet
  is now logged as a placement, and Journey/Daily saves keep their move log across resumes.
- **Names**: 3–20 characters, no links; strong words blocked anywhere, short ambiguous ones only as whole words (so
  Hancock and Dickens are fine); checked on device and server. Three distinct reporters (each with a counted solve)
  replace a name with "Player ####". Only real players are shown, ever.
- **Deletion**: leaving removes every document, the player's id in reports they made, and the sign-in; erasing
  progress leaves first; a daily clean-up removes accounts inactive for a year. A sync still in flight when the player
  leaves is ignored.
- **App Check** isn't wired up: the web view can't use App Attest without a native plugin, and enforcing it without
  one would reject every call. It stays off until that plugin exists.
- **Shape**: all decisions in `src/leaderboard/` (pure, unit-tested against an in-memory store that enforces Firestore's
  reads-before-writes); `functions/src/index.ts` only adapts Firestore and Auth. Firestore rules deny all client
  writes. The Firebase SDK is loaded only when the leaderboard is used. Without Firebase settings, development builds
  and the tester preview run the same logic on the device (a table with only you); release builds say it's coming.
- **Not done here**: the security-rules tests and the functions could not be run against the Firebase emulator in this
  environment (its download is blocked); they are ready to run with `npm run fb:test` / `npm run fb:emulators`.

## 2026-10-29 · D31 — A steeper Journey: 7×7 from level 6, then 8×8 and 9×9
Owner decisions (2026-10-29): new boards for every level from 6; 8×8 and 9×9 mix later. This revises D22's 8×8 cap
for the Journey (dailies keep it).

- **Spec 3** (`game/specs.ts → journeyTargetV3`, frozen in `data/journeyPack3.ts` for 6–150): 7×7 right after the five
  first lessons, 8×8 from 15, the first 9×9 at 40, 9×9 the main size after 70, with occasional smaller breather boards.
  Each board is chosen by measured difficulty and its label is what it measures.
- **What players keep**: levels already cleared stay cleared with their stars, coins, points and arrivals. A replay of
  such a level is the new board, with its best time starting fresh (times only compare on the same board). A board in
  progress resumes on the spec it was started on (spec 1 and 2 boards stay buildable), and the leaderboard counts a
  board only on the spec it's issued under today.
- Tips moved with the sizes (7×7 at 6, 8×8 at 15, 9×9 at 40).
