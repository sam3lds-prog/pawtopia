# Pawtopia

*A clever little puzzle with a whole lot of heart.*

Pawtopia is a cozy, portrait-first logic puzzle for iPhone. Every row, column and color region needs exactly
**one cat and one dog**, and pets never sit side by side. Every board has one answer you can reach by logic alone.
Solving boards welcomes residents into the Harmony Sanctuary, a garden you decorate with coins you earn by playing.
The pets on the board are alive in the smallest way: they blink, glance, smile and frown, but only their faces move.

![Pawtopia screens](docs/screenshots/pawtopia-screens.png)

Built with Vite + TypeScript (no UI framework) and shipped to iOS with Capacitor. It grew out of Cats vs Dogs v1; the
puzzle engine, its tests and every v1 board are preserved, and v1 saves migrate automatically.

## What's in the game

| | |
| --- | --- |
| **Journey** | 60 verified launch levels in chapters of 20 (5×5 → 8×8), then endless generated boards up to 9×9. Stars for clean, hint-free solves. A new resident at levels 1, 5, 10, 15 and 20; a decoration gift per chapter. |
| **First run** | A two-sentence welcome, then a forgiving guided board where the deduction engine highlights two forced moves one at a time. Later levels introduce one idea each in one sentence. |
| **Daily Cozy Puzzle** | One shared board per day, with a gentle streak and one free Cozy Day per month. |
| **Zen Garden** | Any size, no clock, no hearts. |
| **Paw Cup** | Five fixed boards per UTC week, two attempts each, no hints, best counts. Practice-only (clearly labeled) until the verified backend exists. |
| **Sanctuary** | An illustrated garden with 15 decorations in fixed spots and your residents sitting on their favorites. |
| **Residents** | Six original pets (Mochi, Pip, Clover, Biscuit, Nori, Peanut) with personalities that shape their expressions. |
| **Meta** | Free Paw Coins on an idempotent ledger, 3 daily missions + 1 weekly, 12 badges, a Journal of stats. |
| **Comfort** | Tool or tap-cycle controls, left-handed layout, reduced motion, high contrast, region patterns, large board mode, VoiceOver labels, offline play, no sign-in. |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (open the LAN URL on your phone)
npm test           # 146 unit tests: engine, session, storage, faces, economy, scoring, verifier
npm run gen:check  # generates 1,000 puzzles and verifies uniqueness / validity
npm run pack:check # re-verifies the 60-level launch pack
npm run build      # typecheck + production build → dist/
npm run e2e        # browser smoke test against `npm run dev` (needs Playwright, see test/e2e/smoke.mjs)
```

In development builds, Settings → Developer → *Expression gallery* shows every pet in every mood with live tiles.

## Ship it to iOS

Needs a Mac with Xcode and an Apple Developer account.

```bash
npm run build
npx cap add ios          # once; creates ios/App
npx cap sync             # copies dist/ into the native shell
npx cap open ios         # opens Xcode
```

The bundle id stays `com.sam3lds.catsvsdogs` so Pawtopia ships as an update to the existing app (see
`docs/DECISIONS.md` D9). Before TestFlight, work through `docs/release-checklist.md`.

## Project layout

```
src/engine/        puzzle engine (unchanged from v1): solver, deduction, generator, levels, rng
src/data/          frozen, verified 60-level launch pack + pack format/verification
src/game/          session (marks, hearts, undo/redo, hints, snapshots, event log), modes, dates, persistence
src/meta/          progression, rewards, ledger, sanctuary, missions, achievements, onboarding, catalogs
src/competitions/  scoring formula, replay verifier, league rules, weekly cup boards, local practice cup
src/services/      storage (v2 + migration), kv guard, ads/iap adapters, analytics, audio, haptics
src/ui/            router + screen lifecycle, screens, components, art (pet rigs, sanctuary), face animation
src/config/        feature flags, economy tuning
test/              unit tests (vitest) + e2e smoke (playwright)
docs/              roadmap, decisions, architecture, design system, assets, privacy, backend plan, release checklist
```

## Honest by design

- Paw Coins are earned only by playing and buy only cosmetics. Nothing random, nothing pay-to-win.
- Release builds can't buy anything or show an ad until a real, verified store / ad network is integrated.
- League scores are labeled practice and never ranked against anyone until server verification exists.
  No made-up players, ever.
- No account, no sign-in, no analytics sent. Everything stays on the device.

See `docs/PAWTOPIA_ROADMAP.md` for status and the steps that need you (Apple, StoreKit, Firebase).
