/**
 * Ads. The game talks to `AdService` only.
 *
 * Pawtopia shows **reward videos only, and only when the player asks for one** (an extra life, a hint, or a video
 * token). No banners, and no interstitials: `INTERSTITIALS_ENABLED` is false, so the cadence rule below is kept for the
 * record but never reached. A reward is granted only when the ad network confirms the video was watched.
 *
 * Which service runs:
 *  - iOS app with `VITE_ADMOB_ENABLED=1` (Info.plist set up, see docs/native-setup.md) → `AdMobAdService`, using Google's
 *    test unit until `VITE_ADMOB_REWARDED_IOS` is set. Consent (UMP) and Apple's tracking prompt are asked the first time
 *    the player chooses to watch a video, never at launch.
 *  - Development and tester builds → `TestVideoAdService`: a clearly labeled stand-in so the whole flow can be tried.
 *  - Anything else → `UnavailableAdService`: no video buttons are shown and nothing is granted.
 */

import { Capacitor } from '@capacitor/core';
import { ADMOB, TEST_BUILD } from '../config/services';
import type { ModeKind } from '../game/modes';

export type RewardedPlacement = 'life' | 'hint' | 'token';

/** No forced ads between boards. */
export const INTERSTITIALS_ENABLED = false;

export interface AdService {
  /** True when a real (or, in dev, simulated) ad network is ready. */
  readonly available: boolean;
  readonly isStub: boolean;
  showInterstitial(): Promise<boolean>;
  /** Resolves true only when the reward was earned. */
  showRewarded(placement: RewardedPlacement): Promise<boolean>;
}

export interface AdCadenceState {
  removeAds: boolean;
  /** Journey levels completed so far (onboarding grace). */
  levelsCompleted: number;
  /** Solo boards completed since the last interstitial. */
  boardsSinceLast: number;
  lastShownAt: number | null;
  /** Interstitials shown today. */
  shownToday: number;
}

export interface AdTrigger {
  mode: ModeKind;
  outcome: 'won' | 'lost';
  now: number;
}

export const AD_POLICY = {
  onboardingGraceLevels: 8,
  minBoardsBetween: 4,
  minMsBetween: 8 * 60_000,
  dailyCap: 3,
} as const;

/** Pure cadence rule. Called only after the player taps through the results sheet. */
export function shouldShowInterstitial(s: AdCadenceState, t: AdTrigger): boolean {
  if (s.removeAds) return false;
  if (t.outcome !== 'won') return false; // never right after a loss
  if (t.mode === 'cup') return false; // never in competitive play
  if (s.levelsCompleted < AD_POLICY.onboardingGraceLevels) return false;
  if (s.shownToday >= AD_POLICY.dailyCap) return false;
  if (s.boardsSinceLast < AD_POLICY.minBoardsBetween) return false;
  if (s.lastShownAt !== null && t.now - s.lastShownAt < AD_POLICY.minMsBetween) return false;
  return true;
}

/** Nothing to show, no rewards granted. */
export class UnavailableAdService implements AdService {
  readonly available = false;
  readonly isStub = false;
  async showInterstitial(): Promise<boolean> {
    return false;
  }
  async showRewarded(): Promise<boolean> {
    return false;
  }
}

/** Test builds only: a clearly labeled stand-in video, so the reward flow can be tried end to end. */
export class TestVideoAdService implements AdService {
  readonly available = true;
  readonly isStub = true;
  constructor(private readonly ms = 1500) {}
  async showInterstitial(): Promise<boolean> {
    return false;
  }
  async showRewarded(placement: RewardedPlacement): Promise<boolean> {
    return fakeVideo(`Test video · ${placement}`, this.ms);
  }
}

/** Kept for older imports and tests. */
export const DevStubAdService = TestVideoAdService;

/**
 * Google AdMob reward videos. The SDK is started, and consent asked, on the first video the player chooses to watch.
 * The reward counts only if the SDK reports it (the Rewarded event or the resolved show call).
 */
export class AdMobAdService implements AdService {
  readonly available = true;
  readonly isStub = false;
  private ready: Promise<boolean> | null = null;
  constructor(
    private readonly adId: string,
    private readonly testing: boolean,
  ) {}

  private start(): Promise<boolean> {
    this.ready ??= (async () => {
      try {
        const { AdMob, AdmobConsentStatus } = await import('@capacitor-community/admob');
        await AdMob.initialize({ initializeForTesting: this.testing });
        // Privacy first: the consent form where the law requires it (UMP), then Apple's tracking question.
        const info = await AdMob.requestConsentInfo();
        if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm();
        const att = await AdMob.trackingAuthorizationStatus();
        if (att.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
        return true;
      } catch {
        this.ready = null; // try again next time
        return false;
      }
    })();
    return this.ready;
  }

  async showInterstitial(): Promise<boolean> {
    return false;
  }

  async showRewarded(): Promise<boolean> {
    if (!(await this.start())) return false;
    const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');
    let rewarded = false;
    const handle = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      rewarded = true;
    });
    try {
      await AdMob.prepareRewardVideoAd({ adId: this.adId, isTesting: this.testing });
      const item = await AdMob.showRewardVideoAd();
      if (item && typeof item.type === 'string') rewarded = true;
    } catch {
      /* no fill, closed early, or a network error: no reward */
    } finally {
      await handle.remove();
    }
    return rewarded;
  }
}

function fakeVideo(label: string, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'fake-ad';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', label);
    const box = document.createElement('div');
    box.className = 'fake-ad__box';
    const l = document.createElement('div');
    l.className = 'fake-ad__label';
    l.textContent = label;
    const sub = document.createElement('div');
    sub.className = 'fake-ad__sub';
    sub.textContent = 'Test build: a stand-in for a reward video. No ad network.';
    box.append(l, sub);
    el.appendChild(box);
    document.body.appendChild(el);
    setTimeout(() => {
      el.remove();
      resolve(true);
    }, ms);
  });
}

export function createAdService(opts: { native: boolean; testBuild: boolean; admobEnabled: boolean; adId: string; testAdId: string }): AdService {
  if (opts.native && opts.admobEnabled) return new AdMobAdService(opts.adId || opts.testAdId, !opts.adId);
  if (opts.testBuild) return new TestVideoAdService();
  return new UnavailableAdService();
}

export const ads: AdService = createAdService({
  native: Capacitor.isNativePlatform(),
  testBuild: TEST_BUILD,
  admobEnabled: ADMOB.enabled,
  adId: ADMOB.rewardedIos,
  testAdId: ADMOB.testRewardedIos,
});
