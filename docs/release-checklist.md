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
- [ ] (D37) Tap ✕ / double-tap on a real finger: the double-tap window (380 ms) feels right; no marks while panning a
      Large board; a ✕ drag marks exactly the tiles under the finger; a tap on a placed animal never erases it
- [ ] (D37) Mistake marks: a red ✕ (one-animal board, or both animals tried) and the struck animal (two-animal board)
      are legible at 320 and in High contrast; Erase leaves them; the same wrong double-tap twice costs one heart
- [ ] (D37) Hint shows the hint count; dots appear on Easy boards only
- [ ] Existing save on a device: progress untouched; a save that chose *Tap cycle* keeps it
- [ ] Journey: goal card, level and Continue visible without scrolling on an SE (375×667) with the tab bar; Daily/Zen
      a swipe below
- [ ] World: goal panel and Play above the map on an SE; map pins tappable; "New" dot visible on the tab
- [ ] Back from the Farm, the Pet Garden, the album, the Journal and a Shop opened from a sanctuary lands where you
      were, at the same scroll position; a tab tap starts afresh
- [ ] Win sheet: ordinary win is quick (one button); an arrival/region/stage shows the hero; both scroll under
      Dynamic Type; reduced motion skips the hero pop
- [ ] VoiceOver: animal buttons announce "Sheep: a double tap places a sheep"; mistakes read "a mistake, no animal here"
      or "not a cat, a mistake"; Hint reads the count; the World tab announces
      "something new to see" when a marker is set; the win sheet's main action is the first thing focused
- [ ] Level 21 bridge sheet reads well on a small phone; "Show me" lands on the glowing tile
- [ ] First run: the Farm welcome, Cotton on the tile, "Meet Cotton" → the guided board says to double-tap
- [ ] Interrupt mid-gesture (call, notification) during a ✕ drag: no stray marks; background during the win sheet →
      the credit is recorded once (`world.credits`)
- [ ] Five-player usability script (docs/DECISIONS.md D36, §10 of the review plan): tasks 1–5 without coaching

### D38 PR A — saved boards per mode
- [ ] Half-play a Journey level, leave; play and finish the Daily; Continue resumes the very same Journey board (cells,
      mistakes, hearts, hint used, clock)
- [ ] The reverse (Daily first, then a level and a Zen); all three offered on the hub; kill the app and relaunch: still
      all three
- [ ] "Play level N" from the World, the Farm, the Pet Garden and the level path while a *different* level is saved:
      the question appears every time; *Resume* opens the saved board, *Not now* changes nothing
- [ ] Tap a Zen size with a Zen board in progress: the question; *Resume* opens it and the next Zen board is still new
- [ ] Install the previous build over this one (rollback): the newest saved board is still offered; come back to this
      build: nothing finished is offered again

### D38 PR B — gesture clarity
- [ ] First placement on an ordinary board shows the controls note once, over the coach line; nothing moves; ✕ and the
      link work; never again after (also after a relaunch)
- [ ] VoiceOver on the board: "activate" on an empty tile marks ✕, activate again places — no double-tap window to
      beat; Switch Control the same
- [ ] Settings → Controls: *Fast double-tap* / *Two-step tap*; the little picture loops; under Reduce Motion it is a
      still of the last frame; the picture follows the choice
- [ ] Pause: the Controls line reads right for both schemes; "Settings and controls" opens Settings with the board paused
- [ ] 320 and 375 widths: the note fits in two or three lines without covering the board

### D38 PR C — Journey and World hierarchy
- [ ] SE (320×568) and SE2/8 (375×667): the hub's Play/Resume button and both quiet links sit above the tab bar without
      scrolling; the Daily card's top edge shows
- [ ] Hero with a saved Journey board: *Resume level N*, *Play level M instead*, both links; "New" chip when a sanctuary
      has news; the picture opens the sanctuary
- [ ] World at 320: one Play button, the two quiet links on one line; pills row; pin labels legible (12 px); the halo
      breathes (still under Reduce Motion); locked pins quiet; Expand map pans and starts on the home being built
- [ ] VoiceOver: the hero reads goal → level → Play → links; the pills announce their sanctuary; Expand map announces
      pressed / not pressed

### D38 PR D — growth policy 2 (only if the owner accepts it)
- [ ] Existing save: after the update, growth, animals and gifts unchanged; replaying a cleared level shows the replay
      note and grows nothing; the next new level grows the sanctuary
- [ ] Ordinary win: "+1" pops, "N → N−1 puzzles away", the bar slides once; a tap mid-slide settles it; Reduce Motion
      shows the end state
- [ ] Arrival from the win sheet: the newcomer drops into place once, then greets; opening the sanctuary any other way
      shows no drop

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
