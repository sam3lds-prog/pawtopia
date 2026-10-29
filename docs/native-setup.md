# Pawtopia — Native setup (iOS app, App Store, AdMob, RevenueCat, Firebase)

Everything outside the game itself is **off until you configure it**. A build with no settings plays fully offline,
sells nothing, shows no videos and makes no network calls. Turn services on one at a time.

Settings go in `.env.local` at the repo root (git-ignored). Copy `.env.example` and fill in what you have.
They are public client identifiers (they ship inside the app anyway), but keep them out of git so each machine and
build can use its own.

## 0. The iOS project (Capacitor 8)

Capacitor was upgraded to 8 before the iOS project was first generated, so there is nothing to migrate.
Requirements: Node 22+, Xcode 26+, CocoaPods or Swift Package Manager (Capacitor 8 defaults to SPM).

```
npm ci
npm run build
npx cap add ios        # once
npx cap sync ios
npx cap open ios
```

Set your Team in Xcode, keep the bundle id `com.sam3lds.catsvsdogs` (D9), and run on a device.

## 1. Reward videos — Google AdMob (`@capacitor-community/admob`)

Pawtopia only shows **reward videos the player asks for** (an extra life, a hint, a video token). No banners, no
interstitials. Consent (Google UMP) and Apple's tracking prompt are asked the first time a player chooses a video.

1. In `ios/App/App/Info.plist` add:
   - `GADApplicationIdentifier` = your AdMob **app id**. Until you have one, use Google's test app id
     `ca-app-pub-3940256099942544~1458002511`.
   - `NSUserTrackingUsageDescription` = "Pawtopia asks so the optional reward videos can be more relevant. You can say
     no and still get every reward."
   - `SKAdNetworkItems` = the list from Google's iOS quick-start (copy it from the AdMob docs; it changes over time).
2. In the AdMob console create a **Rewarded** ad unit for the iOS app; put its id in `.env.local`:
   `VITE_ADMOB_REWARDED_IOS=ca-app-pub-…/…` (leave empty to keep Google's test videos).
3. Only after step 1, set `VITE_ADMOB_ENABLED=1`. Without the Info.plist keys the Google SDK would crash the app on
   the first video, which is why the switch exists.
4. In AdMob, create the GDPR / US-state privacy messages (Privacy & messaging) so the consent form has something to
   show. Players can reopen it from Settings → Ad privacy choices.
5. App Store Connect privacy label: with AdMob live the app is **no longer "Data Not Collected"**. Declare what the
   Google Mobile Ads SDK collects (identifiers, usage data, diagnostics; used for third-party advertising), and update
   the privacy policy. If you ever submit to the Kids category, remove ads first.

Daily cap: 10 reward videos per player per day, shared by all rewards (`src/app/rewarded.ts`).

## 2. Gems and purchases — RevenueCat (`@revenuecat/purchases-capacitor`)

1. In App Store Connect create the in-app purchases with exactly these product ids (`src/config/services.ts`):
   | Product id | Type | Grants |
   | --- | --- | --- |
   | `pawtopia.gems.60` | Consumable | 60 gems |
   | `pawtopia.gems.160` | Consumable | 160 gems |
   | `pawtopia.gems.420` | Consumable | 420 gems |
   | `pawtopia.removeads` | Non-consumable | entitlement `remove_ads` (for v1 owners; no forced ads exist) |
   Suggested price tiers: $0.99 / $1.99 / $4.99. Prices always come from the store.
2. Create a RevenueCat project, add the iOS app (App Store Connect shared secret / in-app purchase key), import the four
   products, and create an entitlement `remove_ads` attached to `pawtopia.removeads`.
3. Put RevenueCat's **public iOS SDK key** in `.env.local`: `VITE_REVENUECAT_IOS_KEY=appl_…`.
4. In Xcode enable the **In-App Purchase** capability. Test with a sandbox account.

How grants stay safe: gems are granted once per store transaction id; on launch the app asks RevenueCat for all
consumable transactions and grants any it missed (a crash between paying and saving). Restore Purchases restores
`remove_ads`. Gems only buy premium decorations — never hearts, hints or rankings.

## 3. Leaderboards — Firebase (see `functions/README.md`)

1. Create a Firebase project (**Blaze** plan, needed for Cloud Functions; a small leaderboard stays well inside the free
   quotas) and add a **Web app** (the game runs in a web view and uses the JS SDK). Enable **Authentication →
   Sign-in method → Anonymous**. Create the **Firestore** database (production mode).
2. From the Web app's config put in `.env.local`:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`
   (and `VITE_FIREBASE_REGION` if you deploy the functions outside `us-central1`; then also set `FUNCTIONS_REGION` in
   `functions/.env`). The web config is not a secret; it identifies the project.
3. Install the Firebase CLI (`npm i -g firebase-tools`), `firebase login`, copy `.firebaserc.example` to `.firebaserc`
   with your project id, then: `npm --prefix functions install && npm run fb:deploy`. That builds `functions/lib`,
   deploys the four callable functions (`lbProfile`, `lbSubmit`, `lbReport`, `lbDelete`), the security rules and the
   two composite indexes (weekly table and weekly rank).
4. Run the security-rules tests once against the emulator: `npm run fb:test` (needs Java; the CLI downloads the
   emulator the first time).
5. Update the App Store privacy label (docs/privacy-security.md has the exact answers).
6. **App Check is not wired up yet.** The game runs in a web view, where Firebase's web App Check can't use App Attest;
   it needs a native provider plugin (for example `@capacitor-firebase/app-check`) once the iOS project exists. Until
   that is added and tested, **leave `ENFORCE_APP_CHECK` unset**: enforcing it would reject every call. The server's
   replay check and pacing limits work without it; App Check mainly stops scripted sign-ups.

Players are never signed in automatically: nothing reaches Firebase until a player opens League → Leaderboard and taps
**Join**. Leaving (League → Leaderboard → Leave) deletes their documents and their anonymous account.
Without the Firebase settings a release build says the leaderboard is coming; development builds and the tester
preview run the same server logic on the device (a table with only you on it).

## 4. Tester builds

`npm run artifact -- --qa` builds `artifact/pawtopia-qa.html`: a single-file web build with a **test store** (free,
labeled gems), **test videos** and the Tester shortcuts in Settings. Test gems never count in a release build.
