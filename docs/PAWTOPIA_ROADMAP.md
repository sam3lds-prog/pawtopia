# Pawtopia — Roadmap & status

Branch: `feature/pawtopia` · Base: `main` @ `282d459` (Cats vs Dogs v1)

The full product spec lives outside the repo (`PAWTOPIA_FULL_PRODUCT_AND_CLAUDE_BUILD_PLAN.md`). This file tracks what
is actually built, by sprint, and what still needs external setup. Decisions are in `DECISIONS.md`.

## Baseline audit (main @ 282d459)

| Check | Result |
| --- | --- |
| `npm test` | 12/12 passing |
| `npm run gen:check` | 1,000 puzzles, 0 failures |
| `npm run build` | OK (28 kB JS) |

Defects confirmed in source and fixed in Sprint 0:

| # | Defect | Where | Fix |
| --- | --- | --- | --- |
| 1 | "Next level" replays the solved level | `main.ts` win sheet called `startLevel(mode.level)` | `nextAfterWin()` → `level + 1`, unit + e2e regression |
| 2 | Reset wipes every key on the origin | `localStorage.clear()` | `resetProgress()` removes only `pawtopia.*`/`cvd.*`, keeps purchases |
| 3 | First-run rules read can throw | bare `localStorage.getItem('cvd.seenRules')` | all storage through guarded `KV` with memory fallback |
| 4 | Win/loss can be processed twice | `checkOutcome()` re-entrancy | `Session.claimOutcome()` |
| 5 | Async continuations after leaving the board | rewarded ad / revive callbacks | router `Scope` lifecycle |
| 6 | Closing the app loses the board | no persistence | snapshot on every move + on background, digest-checked resume |
| 7 | Interstitial before the celebration | `onWin` awaited the ad first | results first, then policy-gated ad |
| 8 | IAP stub "succeeds" in any build | `StubIapService` | dev-only stub, release returns `unavailable`, dev grants ignored in release |
| 9 | Streak "yesterday" from wall clock at win time | `onWin` | computed from the puzzle's own date key |
| 10 | Pet art moves when placed / on error | `.pop` scale, `.shake` translate | facial-only animation, CSS-guard tests |

## Sprint status

- [x] **Sprint 0** — bug fixes, v2 save + migration, session persistence, ad/IAP safety, regression tests
- [x] **Sprint 1** — design system, router lifecycle, modular screens, bottom nav
- [x] **Sprint 2** — six original pet face rigs, facial-only animation scheduler, dev expression gallery
- [x] **Sprint 3** — verified 60-level pack, welcome + guided tutorial, one-idea-per-level tips (Zen, hint tiers, chapters, daily from Sprint 1)
- [x] **Sprint 4** — sanctuary, resident collection, decor shop, idempotent coin ledger, v1 reward reconcile
- [x] **Sprint 5** — scoring + replay verifier, league rules, honest Paw Cup practice, missions, badges, Journal
- [x] **Sprint 6** — settings/accessibility polish, e2e smoke suite, docs (architecture, design system, privacy, backend plan, release checklist)

### Feel & progression refinement (2026-10-26, plan: `PAWTOPIA_REFINED_FEEL_AND_PROGRESSION_PLAN.md`)

- [x] **Sprint A** (D21) — five hearts on Journey/Daily, Paw Cup keeps three; mistake ghost + strike, tile unchanged;
  remembered pet tool; controls preview; legacy saves gain the extra hearts
- [x] **Sprint B** (D22) — measured difficulty (`docs/DIFFICULTY.md`), versioned specs, Journey 71+ rotates 5×5–8×8,
  dailies ≤ 8×8 from 2026-10-27, Journey pack 2 (61–150) frozen; old 9×9 saves still resume; Paw Cup unchanged
- [x] **Sprint C** (D23) — treats (+1 heart) and hint tickets (first look free, one ticket per hint target), starter
  pantry, Paw Points and Paw Rank, staged win sheet, replay goals
- [x] **Sprint D** (D24) — living sanctuary (ambient director, ≤ 2 actors), Ember the fox and Maple the red panda,
  daily pats, honest small talk, evening fireflies; path milestones fixed
- [x] **Sprint F** (D26) — softer board (no dark region lines), colored life and hint icons, Play opens on your level
- [x] **Sprint G** (D27) — Paw Coins, video tokens and gems; food and treats; optional reward videos (AdMob); gem
  packs (RevenueCat); Capacitor 8
- [x] **Sprint H** (D28) — world map; Outback, Savanna, Arctic and Amazon sanctuaries that grow with every puzzle; 12
  regional animals; 16 regional decorations; Animal album
- [x] **Sprint I** (D29) — animals greet you, react to food and taps, stroll; livelier, still calm
- [x] **Sprint J** (D30) — opt-in Paw Points leaderboard on Firebase, every solve replayed by the server
- [ ] Game Center and online Paw Cup leagues — not started

Test count: 222 unit tests + 38 browser e2e checks (incl. 9 fixes from a second independent review, D25). Bundle: ~87 kB JS gzipped (incl. both level packs), 11 kB CSS.

Deferred on purpose: an optional long-press action sheet (needs a usability test against drag-marking); sanctuary
walks between anchor points; capybara, otter, axolotl and owl (need art); seasonal recolors.

## Alpha acceptance (spec §13)

- [x] A new player completes the tutorial without reading long rules (welcome + guided board, e2e covered)
- [x] Puzzle constraints and deterministic existing boards unchanged (engine untouched; pack digests == generator)
- [x] Core game works without network or login
- [x] 5×5 to 9×9 boards legible and usable at 320–430px (screenshots in the PR); *real-device check still needed*
- [x] Tile art animates faces only; no head/body movement (CSS-guard tests + e2e bounding-box check)
- [x] Correct, wrong, idle and win expressions without leaking answers (identity by region; reactions only from events)
- [x] Reduced motion, accessible labels, non-color cues (patterns, hatch + ring for mistakes)
- [x] Win sheet before any ad; "Next level" loads the next level
- [x] New pet after documented milestone appears in collection and sanctuary
- [x] Decor purchase deducts coins exactly once; reload keeps items
- [x] Daily and Journey progress migrate from `cvd.progress.v1` without loss
- [x] Nonfunctional purchase/ad/cloud/league features hidden or labeled (Not available / Practice / Preview)
- [x] `npm test`, `npm run gen:check`, `npm run build` succeed; *device performance check still needed*
- [x] No compilation errors, secrets, or mock users

## Not built yet (by design)

- **Online Paw Cup leagues, Daily Dash rankings, friends** — need their own verified backend (`docs/backend-plan.md`).
  The Paw Points leaderboard is built (D30).
- **Gems and reward videos** are integrated (D27) and switch on with their keys; release builds without keys show
  "coming soon" and no videos.
- **Pet cosmetic accents, more habitats, seasonal themes, music, localization, dark mode** — P4 backlog.
- **Native haptics** use `@capacitor/haptics` already; needs a device check once `ios/` is generated.

## Needs you (external)

0. **Feel check on a phone**: five hearts and the treat sheet (tap the hearts), the hint button's Free / ticket badge,
   a wrong pet on a Dog tile, the win sheet's three-stage reveal, and the sanctuary after a minute (it should move
   gently, never more than two things at once). Tell me if the economy feels stingy or generous: starter pantry 3
   treats + 5 tickets, +1 treat per new level, +1 ticket per two new levels (`src/meta/items.ts`).

1. **Run it on a phone**: `npm run build && npx cap add ios && npx cap sync && npx cap open ios`, set your Team in Xcode,
   run on a device. Please check face animation smoothness and 9×9 legibility on your smallest iPhone.
2. **Upgrade test**: install the current App Store / TestFlight v1, play a few levels, then install this build over it.
3. **Keys for gems and videos** (when you want them live): App Store Connect products, RevenueCat and AdMob, as in
   `docs/native-setup.md` §1–2. Keys go in `.env.local`, never in git.
4. **Firebase for the leaderboard**: a project on the Blaze plan with a Web app and Anonymous sign-in, the web config in
   `.env.local`, then `npm --prefix functions install && npm run fb:deploy`, then `npm run fb:test` once (this
   environment couldn't download the emulator, so the rules tests haven't run yet), then App Check (App Attest) and
   `ENFORCE_APP_CHECK=true` before inviting players (`docs/native-setup.md` §3).
5. **App Store Connect**: rename the listing to Pawtopia (bundle id stays), new screenshots (World map, a regional
   sanctuary, the Leaderboard), and the privacy label for the services you turn on (`docs/privacy-security.md`).
