# Pawtopia — Release checklist (TestFlight → App Store)

## Build health
- [ ] `npm test` (222+), `npm run gen:check`, `npm run pack:check`, `npm run build` all green
- [ ] `npm run e2e` against `npm run dev` all green
- [ ] Version bumped in `package.json` and Xcode (marketing + build number)
- [ ] Set `DAILY_V2_FROM` in `src/game/specs.ts` to the first day the update is live for everyone (after store
      review and any staged rollout), so players on the old and new builds share the same Daily board until then.
      Dailies before that date stay on their original boards. (Currently 2026-10-27, i.e. immediately.)
- [ ] `npm run grade:report` unchanged since the last release, or `GRADING_VERSION` bumped and D22 updated (a grading
      change alters which board future dailies and levels 151+ get)

## Device QA (real iPhones: small/SE, standard, Pro Max)
- [ ] Portrait at 320 / 375 / 390 / 430 widths; safe areas (notch, home indicator)
- [ ] 8×8 boards legible at 320 (and old 9×9 saves / Paw Cup Grand Hall); Large board mode scrolls smoothly
- [ ] Sanctuary: gentle motion, never more than two things at once, still under Reduce Motion; no frame drops
- [ ] Faces: blinks/reactions smooth (60fps), only faces move, nothing shifts; reduced-motion respected
- [ ] VoiceOver: board cells announce row, column, region, pet; sheets trap focus; buttons labeled
- [ ] Dynamic text sizes don't clip win/settings sheets (they scroll)
- [ ] Background/terminate mid-board → resume offers the same board; Paw Cup attempt stays open
- [ ] Airplane mode: everything works
- [ ] Haptics feel right; sound off/on; silent switch respected
- [ ] Upgrade test: install v1 build, play to level ~14, install Pawtopia over it → progress, coins, pets carried over once

### D36 (Journey / World / controls review) — not yet checked on a device
- [ ] One-tap controls on a real finger: no accidental placements while scrolling the Journey, no marks while panning a
      Large board; the ✕ drag marks exactly the tiles under the finger; a tap on a placed animal never erases
- [ ] Two-animal boards: five controls in a row (two animals, ✕, Erase, Hint) legible and tappable at 320 and 375
- [ ] Existing save on a device: the one-time "one tap places" card shows once; Settings → Controls → *Tap ✕, double-tap*
      restores the old feel; a save that chose *Tap cycle* is untouched
- [ ] Journey: goal card, level and Continue visible without scrolling on an SE (375×667) with the tab bar; Daily/Zen
      a swipe below
- [ ] World: goal panel and Play above the map on an SE; map pins tappable; "New" dot visible on the tab
- [ ] Back from the Farm, the Pet Garden, the album, the Journal and a Shop opened from a sanctuary lands where you
      were, at the same scroll position; a tab tap starts afresh
- [ ] Win sheet: ordinary win is quick (one button); an arrival/region/stage shows the hero; both scroll under
      Dynamic Type; reduced motion skips the hero pop
- [ ] VoiceOver: tool buttons announce "Sheep: a tap places a sheep", "Mark empty…", "Erase…"; the World tab announces
      "something new to see" when a marker is set; the win sheet's main action is the first thing focused
- [ ] Level 21 bridge sheet reads well on a small phone; "Show me" lands on the glowing tile
- [ ] First run: the Farm welcome, Cotton on the tile, "Meet Cotton" → one tap places on the first board
- [ ] Interrupt mid-gesture (call, notification) during a ✕ drag: no stray marks; background during the win sheet →
      the credit is recorded once (`world.credits`)
- [ ] Five-player usability script (docs/DECISIONS.md D36, §10 of the review plan): tasks 1–5 without coaching

## Store integration (only when ready; see roadmap)
- [ ] StoreKit products created (remove_ads, starter_decor, cozy_theme, pet_portraits, supporter); verified entitlement
      + restore via a maintained bridge (e.g. RevenueCat Capacitor SDK); sandbox buy, restore, refund, reinstall
- [ ] Release build never uses the dev store; legacy v1 `removeAds` confirmed by a real restore
- [ ] If ads: maintained SDK, ATT prompt policy, cadence via `shouldShowInterstitial`, none in Paw Cup or onboarding

## Leaderboard (Firebase, only when configured)
- [ ] `npm run fb:test` passes against the emulator; `npm run fb:deploy` done for the release project
- [ ] If this release changes a board spec (`game/specs.ts`), the functions were deployed *before* the app is
      released (an older server rejects the new spec and the app drops rejected solves; functions/README.md)
- [ ] App Check: only once a native App Attest provider is added and tested; until then `ENFORCE_APP_CHECK` stays unset
- [ ] TestFlight: join → solve a level and the Daily → both tables show the points → edit name → leave (documents and
      auth user gone in the console); airplane mode while joined queues solves and sends them later
- [ ] A blocked name is refused; a report from three test accounts renames the target

## App Store Connect
- [ ] Name "Pawtopia" (bundle id unchanged), subtitle, keywords, age rating (4+, no Kids Category)
- [ ] Privacy label matches docs/privacy-security.md for the services this build turns on
- [ ] Screenshots from the real build (Home, a board with faces, Sanctuary, Residents, Paw Cup practice)
- [ ] Support URL and privacy policy URL
- [ ] Review notes: Paw Cup is offline practice; the leaderboard is opt-in (anonymous, nickname only, leave = delete);
      gems buy cosmetic decorations only; reward videos only when the player chooses one
