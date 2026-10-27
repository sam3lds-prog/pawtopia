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

## Store integration (only when ready; see roadmap)
- [ ] StoreKit products created (remove_ads, starter_decor, cozy_theme, pet_portraits, supporter); verified entitlement
      + restore via a maintained bridge (e.g. RevenueCat Capacitor SDK); sandbox buy, restore, refund, reinstall
- [ ] Release build never uses the dev store; legacy v1 `removeAds` confirmed by a real restore
- [ ] If ads: maintained SDK, ATT prompt policy, cadence via `shouldShowInterstitial`, none in Paw Cup or onboarding

## App Store Connect
- [ ] Name "Pawtopia" (bundle id unchanged), subtitle, keywords, age rating (4+, no Kids Category)
- [ ] Privacy label: "Data Not Collected" for this build; update when SDKs are added
- [ ] Screenshots from the real build (Home, a board with faces, Sanctuary, Residents, Paw Cup practice)
- [ ] Support URL and privacy policy URL
- [ ] Review notes: leagues are offline practice; no purchases or ads in this version
