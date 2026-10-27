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
import { captureSession } from '../game/sessionPersistence';
import { reconcileRewards, type RewardSummary } from '../meta/rewards';
import { balance } from '../meta/ledger';

type Listener = () => void;

class App {
  save: SaveV2;
  router!: Router;
  /** The board on screen (or last on screen), for saving on background. */
  active: { mode: ModeRef; session: Session; spec?: SpecVersion } | null = null;
  readonly isDev = import.meta.env.DEV;
  private listeners = new Set<Listener>();
  private systemReduced = false;

  /** What a v1 player received when their earlier progress was converted (shown once on Home). */
  upgradeGift: RewardSummary | null = null;

  constructor() {
    this.save = loadSave().save;
    // Grant anything already earned but not yet recorded (v1 levels). Idempotent, so it is a no-op after the first run.
    const gift = reconcileRewards(this.save);
    if (gift.coins > 0 || gift.pets.length || gift.decor.length) {
      this.upgradeGift = gift;
      saveSave(this.save);
    }
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
    const { mode, session, spec } = this.active;
    const snap = captureSession(mode, session, new Date(), spec);
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
