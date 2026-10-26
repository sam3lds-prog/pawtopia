/**
 * Application context: the loaded save, persistence, the router, the active board and settings application.
 * Screens import `app` instead of reaching into globals.
 */

import { loadSave, saveSave, type SaveV2, type Settings } from '../services/storage';
import { entitlementCounts } from '../services/iap';
import { setHapticsEnabled } from '../services/haptics';
import { setSoundEnabled } from '../services/audio';
import type { Router } from '../ui/router';
import type { ModeRef } from '../game/modes';
import type { Session } from '../game/session';
import { captureSession } from '../game/sessionPersistence';

type Listener = () => void;

class App {
  save: SaveV2;
  router!: Router;
  /** The board on screen (or last on screen), for saving on background. */
  active: { mode: ModeRef; session: Session } | null = null;
  readonly isDev = import.meta.env.DEV;
  private listeners = new Set<Listener>();
  private systemReduced = false;

  constructor() {
    this.save = loadSave().save;
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
    let sum = 0;
    for (const e of this.save.inventory.ledger) sum += e.delta;
    return sum;
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
    this.save.lastSession = captureSession(this.active.mode, this.active.session);
    saveSave(this.save);
  }
}

export const app = new App();
