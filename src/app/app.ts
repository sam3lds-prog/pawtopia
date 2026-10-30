/**
 * Application context: the loaded save, persistence, the router, the active board and settings application.
 * Screens import `app` instead of reaching into globals.
 */

import { loadSave, saveSave, type SaveV2, type Settings } from '../services/storage';
import { entitlementCounts } from '../services/iap';
import { setHapticsEnabled } from '../services/haptics';
import { setSoundEnabled } from '../services/audio';
import type { Router } from '../ui/router';
import { modeKey, type ModeRef } from '../game/modes';
import type { Session } from '../game/session';
import type { SpecVersion } from '../game/specs';
import type { Cast } from '../meta/cast';
import { captureSession } from '../game/sessionPersistence';
import { reconcileRewards, type RewardSummary } from '../meta/rewards';
import { balance } from '../meta/ledger';
import { grantStarterItems, setTestEntriesCount } from '../meta/items';
import { TEST_BUILD } from '../config/services';
import { iap } from '../services/iap';
import { reconcileGemPurchases } from '../meta/gems';
import { packedLevelTier } from '../game/puzzles';
import { reconcileWorld } from '../meta/world';

type Listener = () => void;

class App {
  save: SaveV2;
  router!: Router;
  /** The board on screen (or last on screen), for saving on background. */
  active: { mode: ModeRef; session: Session; spec?: SpecVersion; cast?: Cast } | null = null;
  /** Development or tester build: test purchases and dev entitlements count here (never in release). */
  readonly isDev = TEST_BUILD;
  private listeners = new Set<Listener>();
  private systemReduced = false;

  /** What a v1 player received when their earlier progress was converted (shown once on Home). */
  upgradeGift: RewardSummary | null = null;

  constructor() {
    setTestEntriesCount(TEST_BUILD);
    this.save = loadSave().save;
    // Grant anything already earned but not yet recorded (v1 levels, Paw Points for clears made before points
    // existed). Idempotent, so it is a no-op after the first run.
    const gift = reconcileRewards(this.save, new Date(), (level, clear) => packedLevelTier(level, clear.spec ?? 1));
    // Everyone, new or returning, gets the starter pantry once (rewards are not back-dated in treats or tickets).
    const pantry = grantStarterItems(this.save);
    // Saves from before D35 start the Pet Garden at their residents' place in its line, and any arrival that was reached
    // but not recorded (an interrupted save) happens now.
    const growthBefore = JSON.stringify(this.save.world.growth);
    const friends = reconcileWorld(this.save);
    if (gift.coins > 0 || gift.decor.length) this.upgradeGift = gift;
    if (gift.coins > 0 || gift.decor.length || gift.points > 0 || pantry || friends.length || growthBefore !== JSON.stringify(this.save.world.growth))
      saveSave(this.save);
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.systemReduced = mq.matches;
      mq.addEventListener?.('change', (e) => {
        this.systemReduced = e.matches;
        this.applySettings();
      });
    } catch {
      /* matchMedia unavailable */
    }
  }

  /**
   * Grants any gem purchase the store has on record that the save doesn't (a crash between purchase and save).
   * Called once after startup; does nothing without a real store.
   */
  async reconcilePurchases(): Promise<number> {
    if (!iap.available || iap.isStub) return 0;
    const txs = await iap.consumableTransactions();
    const n = reconcileGemPurchases(this.save, txs);
    if (n > 0) this.persist();
    return n;
  }

  persist(): void {
    saveSave(this.save);
    for (const fn of this.listeners) fn();
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  replaceSave(s: SaveV2): void {
    this.save = s;
    this.applySettings();
    this.persist();
  }

  get settings(): Settings {
    return this.save.settings;
  }

  /** Effective reduced motion: explicit choice wins, otherwise follow the device. */
  get reducedMotion(): boolean {
    const pref = this.save.settings.reducedMotion;
    if (pref === 'reduce') return true;
    if (pref === 'full') return false;
    return this.systemReduced;
  }

  get removeAds(): boolean {
    const ra = this.save.purchases.removeAds;
    return ra.active && entitlementCounts(ra.source, this.isDev);
  }

  coins(): number {
    return balance(this.save);
  }

  applySettings(): void {
    const s = this.save.settings;
    const root = document.documentElement;
    root.dataset.contrast = s.highContrast ? 'high' : 'normal';
    root.dataset.motion = this.reducedMotion ? 'reduce' : 'full';
    root.dataset.patterns = s.regionPatterns ? 'on' : 'off';
    root.dataset.hand = s.leftHanded ? 'left' : 'right';
    setHapticsEnabled(s.haptics);
    setSoundEnabled(s.sound);
  }

  /** Saves the in-progress board (called on every move and when the app is backgrounded). */
  saveActive(): void {
    if (!this.active) return;
    const { mode, session, spec, cast } = this.active;
    const snap = captureSession(mode, session, new Date(), spec, cast);
    if (mode.kind === 'cup') {
      const k = modeKey(mode);
      if (snap) this.save.cup.open[k] = snap;
      else delete this.save.cup.open[k];
    } else this.save.lastSession = snap;
    saveSave(this.save);
  }

  /** Forgets the saved board for `mode` (finished, lost, or abandoned), leaving other saved boards alone. */
  clearSaved(mode: ModeRef): void {
    if (mode.kind === 'cup') delete this.save.cup.open[modeKey(mode)];
    else if (this.save.lastSession && modeKey(this.save.lastSession.mode) === modeKey(mode)) this.save.lastSession = null;
  }
}

export const app = new App();
