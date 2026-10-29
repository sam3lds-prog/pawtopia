/**
 * Outside services: the App Store through RevenueCat (gems, remove-ads), Google AdMob (optional reward videos) and
 * Firebase (leaderboards). Only public client identifiers live here, read from build-time variables so they are set
 * per machine in `.env.local` (git-ignored), never committed. See docs/native-setup.md.
 *
 * Each service stays OFF until its variables are present, so a build without them behaves exactly like before:
 * nothing can be bought, no ad SDK runs, no network calls are made.
 */

const env = import.meta.env;

/** Development builds and the tester web preview (`npm run artifact -- --qa`). Never true in a release build. */
export const TEST_BUILD = !!env.DEV || env.VITE_QA === '1';

export const REVENUECAT = {
  /** RevenueCat's public iOS SDK key (starts with `appl_`). Empty → purchases off. */
  iosKey: (env.VITE_REVENUECAT_IOS_KEY as string | undefined) ?? '',
  /** The RevenueCat entitlement that removes interstitials (none are shown today; kept for the v1 purchase). */
  removeAdsEntitlement: 'remove_ads',
} as const;

/**
 * App Store product identifiers. Create these in App Store Connect (and attach them in RevenueCat) with exactly these
 * ids. Gem packs are consumables; remove-ads is a non-consumable. Prices always come from the store.
 */
export const STORE_PRODUCTS = {
  remove_ads: 'pawtopia.removeads',
  gems_60: 'pawtopia.gems.60',
  gems_160: 'pawtopia.gems.160',
  gems_420: 'pawtopia.gems.420',
} as const;

export const ADMOB = {
  /**
   * Set to '1' only after the iOS project has `GADApplicationIdentifier`, `SKAdNetworkItems` and
   * `NSUserTrackingUsageDescription` in Info.plist (docs/native-setup.md). Without them the Google SDK would crash the
   * app on first use, so the reward-video button stays hidden until then.
   */
  enabled: env.VITE_ADMOB_ENABLED === '1',
  /** Your rewarded ad unit id. Empty → Google's public test unit (test videos, no payout). */
  rewardedIos: (env.VITE_ADMOB_REWARDED_IOS as string | undefined) ?? '',
  /** Google's documented test ids (https://developers.google.com/admob/ios/test-ads). */
  testRewardedIos: 'ca-app-pub-3940256099942544/1712485313',
  testAppIdIos: 'ca-app-pub-3940256099942544~1458002511',
} as const;

export const FIREBASE = {
  apiKey: (env.VITE_FIREBASE_API_KEY as string | undefined) ?? '',
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ?? '',
  projectId: (env.VITE_FIREBASE_PROJECT_ID as string | undefined) ?? '',
  appId: (env.VITE_FIREBASE_APP_ID as string | undefined) ?? '',
  /** Region the Cloud Functions are deployed in. */
  functionsRegion: (env.VITE_FIREBASE_REGION as string | undefined) || 'us-central1',
  /** Point the client at local emulators (development only). */
  useEmulators: env.VITE_FIREBASE_EMULATORS === '1',
} as const;

export const firebaseConfigured = (): boolean => !!(FIREBASE.apiKey && FIREBASE.projectId && FIREBASE.appId);
