/**
 * Coordinates the faces on one board.
 *
 *  - One FaceMachine per visible pet tile, registered when the tile's pet appears and removed when it leaves
 *    (cleared, undone), which cancels its pending timers.
 *  - At most MAX_CONCURRENT reactions at once; a new event retires the oldest. The win sequence is the one
 *    exception and is staggered to finish within CELEBRATE_TOTAL_MS.
 *  - Idle blinks are staggered by a seeded random per tile (seed + key), so faces never blink in sync.
 *    No per-frame loop: each pet has one pending timeout at most.
 *  - Ambient life (blinks, dozing off) pauses while the board is paused, hidden, or in reduced-motion mode.
 *  - Reactions come only from explicit game events. The director never sees the puzzle or its solution.
 *
 * DOM-free: it talks to a `FaceTarget` (the SVG rig) and a `Clock`, so tests drive it with a fake clock.
 */

import { hashString, mulberry32, type Rng } from '../../engine/rng';
import {
  BLINK_EVERY_MS,
  BLINK_MS,
  CELEBRATE_TOTAL_MS,
  FaceMachine,
  MAX_CONCURRENT,
  MOOD_SPEC,
  SLEEPY_AFTER_MS,
  type FaceView,
  type Look,
  type ReactionMood,
} from './faceMachine';

export interface Clock {
  now(): number;
  set(fn: () => void, ms: number): number;
  clear(id: number): void;
}

export interface FaceTarget {
  /** Render the view. Called only when it changes. */
  apply(view: FaceView): void;
}

export type FaceSpecies = 'cat' | 'dog';

interface Entry {
  key: string;
  species: FaceSpecies;
  target: FaceTarget;
  machine: FaceMachine;
  rng: Rng;
  blinkTimer: number | null;
  reactTimer: number | null;
  reactStartedAt: number;
  addedAt: number;
  last: string;
}

export interface DirectorOptions {
  clock: Clock;
  seed: number;
  reducedMotion: boolean;
  /** Slow blinkers (Mochi) get the long end of the blink range. */
  slowBlink?: (key: string) => boolean;
}

export class FaceDirector {
  private readonly entries = new Map<string, Entry>();
  private readonly clock: Clock;
  private readonly seed: number;
  private reduced: boolean;
  private ambient = true;
  private sleepTimer: number | null = null;
  private celebrateTimers: number[] = [];
  private seq = 0;
  private disposed = false;
  private readonly slowBlink: (key: string) => boolean;

  constructor(o: DirectorOptions) {
    this.clock = o.clock;
    this.seed = o.seed >>> 0;
    this.reduced = o.reducedMotion;
    this.slowBlink = o.slowBlink ?? (() => false);
    this.armSleep();
  }

  get size(): number {
    return this.entries.size;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  view(key: string): FaceView | null {
    const e = this.entries.get(key);
    return e ? e.machine.view(this.clock.now()) : null;
  }

  /** Reactions currently playing (for tests and the concurrency cap). */
  activeReactions(): string[] {
    const now = this.clock.now();
    return [...this.entries.values()].filter((e) => e.machine.hasReaction(now)).map((e) => e.key);
  }

  add(key: string, species: FaceSpecies, target: FaceTarget): void {
    if (this.disposed) return;
    this.remove(key);
    const e: Entry = {
      key,
      species,
      target,
      machine: new FaceMachine(),
      rng: mulberry32((this.seed ^ hashString(key)) >>> 0),
      blinkTimer: null,
      reactTimer: null,
      reactStartedAt: 0,
      addedAt: ++this.seq,
      last: '',
    };
    if (this.anySleepy()) e.machine.base = 'sleepy';
    this.entries.set(key, e);
    this.render(e);
    this.scheduleBlink(e);
  }

  /** The pet left its tile: stop everything it had pending. */
  remove(key: string): void {
    const e = this.entries.get(key);
    if (!e) return;
    this.clearTimers(e);
    this.entries.delete(key);
  }

  /**
   * Plays a reaction on one pet. Returns false if the pet is unknown or a stronger reaction is running.
   * Respects the concurrency cap by retiring the oldest running reaction.
   */
  react(key: string, mood: ReactionMood, look?: Look): boolean {
    const e = this.entries.get(key);
    if (!e || this.disposed) return false;
    const now = this.clock.now();
    const ms = this.pick(e.rng, MOOD_SPEC[mood].ms);
    if (!e.machine.react(mood, now, ms, look)) return false;
    if (mood !== 'celebrate') this.enforceCap(e.key);
    e.reactStartedAt = now;
    if (e.blinkTimer !== null) {
      // A blink-reopen timer may be pending; the reaction replaced the blink, so just reschedule.
      this.clock.clear(e.blinkTimer);
      e.blinkTimer = null;
      this.scheduleBlink(e);
    }
    if (e.reactTimer !== null) this.clock.clear(e.reactTimer);
    e.reactTimer = this.clock.set(() => {
      e.reactTimer = null;
      this.render(e);
    }, ms);
    this.render(e);
    return true;
  }

  /** A gentle glance from one pet of `species` (the most recently placed), e.g. when its tool is picked. */
  curiousOne(species: FaceSpecies, look: Look): string | null {
    let best: Entry | null = null;
    for (const e of this.entries.values()) if (e.species === species && (!best || e.addedAt > best.addedAt)) best = e;
    if (!best) return null;
    return this.react(best.key, 'curious', look) ? best.key : null;
  }

  /** Win: a brief staggered smile/wink across every pet, finishing within CELEBRATE_TOTAL_MS. */
  celebrate(order: string[]): void {
    if (this.disposed) return;
    this.wake();
    const keys = order.filter((k) => this.entries.has(k));
    if (!keys.length) return;
    const maxMs = MOOD_SPEC.celebrate.ms[1];
    const step = keys.length > 1 ? Math.min(90, (CELEBRATE_TOTAL_MS - maxMs) / (keys.length - 1)) : 0;
    keys.forEach((k, i) => {
      if (this.reduced || i === 0) this.react(k, 'celebrate');
      else {
        const id = this.clock.set(() => this.react(k, 'celebrate'), Math.round(i * step));
        this.celebrateTimers.push(id);
      }
    });
  }

  /** Any player input: wakes sleepy pets and restarts the doze timer. */
  activity(): void {
    this.wake();
    this.armSleep();
  }

  /** Ends all reactions (undo, restart). Pets return to their resting face. */
  calmAll(): void {
    for (const id of this.celebrateTimers) this.clock.clear(id);
    this.celebrateTimers = [];
    for (const e of this.entries.values()) {
      if (e.reactTimer !== null) this.clock.clear(e.reactTimer);
      e.reactTimer = null;
      e.machine.cancel();
      this.render(e);
    }
  }

  /** Blinks and dozing run only while the board is visible and active. */
  setAmbient(on: boolean): void {
    if (this.ambient === on) return;
    this.ambient = on;
    for (const e of this.entries.values()) {
      if (e.blinkTimer !== null) this.clock.clear(e.blinkTimer);
      e.blinkTimer = null;
      if (on) this.scheduleBlink(e);
    }
    if (on) this.armSleep();
    else if (this.sleepTimer !== null) {
      this.clock.clear(this.sleepTimer);
      this.sleepTimer = null;
    }
  }

  /** Reduced motion stops idle blinks; reactions still change the face, instantly (CSS transitions are off). */
  setReducedMotion(on: boolean): void {
    this.reduced = on;
    for (const e of this.entries.values()) {
      if (e.blinkTimer !== null) this.clock.clear(e.blinkTimer);
      e.blinkTimer = null;
      this.scheduleBlink(e);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const id of this.celebrateTimers) this.clock.clear(id);
    this.celebrateTimers = [];
    for (const e of this.entries.values()) this.clearTimers(e);
    this.entries.clear();
    if (this.sleepTimer !== null) this.clock.clear(this.sleepTimer);
    this.sleepTimer = null;
  }

  // ---------------------------------------------------------------- internals

  private render(e: Entry): void {
    const v = e.machine.view(this.clock.now());
    const sig = `${v.mood}|${v.blinking ? 1 : 0}|${v.look[0]},${v.look[1]}`;
    if (sig === e.last) return;
    e.last = sig;
    e.target.apply(v);
  }

  private enforceCap(except: string): void {
    const now = this.clock.now();
    const running = [...this.entries.values()].filter((x) => x.key !== except && x.machine.hasReaction(now) && x.machine.reactionMood(now) !== 'celebrate');
    running.sort((a, b) => a.reactStartedAt - b.reactStartedAt);
    while (running.length >= MAX_CONCURRENT) {
      const old = running.shift()!;
      if (old.reactTimer !== null) this.clock.clear(old.reactTimer);
      old.reactTimer = null;
      old.machine.cancel();
      this.render(old);
    }
  }

  private scheduleBlink(e: Entry): void {
    if (!this.ambient || this.reduced || this.disposed) return;
    const wait = this.pick(e.rng, BLINK_EVERY_MS);
    e.blinkTimer = this.clock.set(() => {
      e.blinkTimer = null;
      if (!this.ambient || this.reduced) return;
      const slow = this.slowBlink(e.key);
      const ms = slow ? BLINK_MS[1] : this.pick(e.rng, [BLINK_MS[0], BLINK_MS[1] - 30]);
      if (e.machine.blink(this.clock.now(), ms)) {
        this.render(e);
        e.blinkTimer = this.clock.set(() => {
          e.blinkTimer = null;
          this.render(e);
          this.scheduleBlink(e);
        }, ms);
      } else this.scheduleBlink(e);
    }, wait);
  }

  private armSleep(): void {
    if (this.sleepTimer !== null) this.clock.clear(this.sleepTimer);
    this.sleepTimer = null;
    if (!this.ambient || this.disposed) return;
    this.sleepTimer = this.clock.set(() => {
      this.sleepTimer = null;
      for (const e of this.entries.values()) {
        e.machine.base = 'sleepy';
        this.render(e);
      }
    }, SLEEPY_AFTER_MS);
  }

  private wake(): void {
    for (const e of this.entries.values()) {
      if (e.machine.base !== 'idle') {
        e.machine.base = 'idle';
        this.render(e);
      }
    }
  }

  private anySleepy(): boolean {
    for (const e of this.entries.values()) if (e.machine.base === 'sleepy') return true;
    return false;
  }

  private clearTimers(e: Entry): void {
    if (e.blinkTimer !== null) this.clock.clear(e.blinkTimer);
    if (e.reactTimer !== null) this.clock.clear(e.reactTimer);
    e.blinkTimer = e.reactTimer = null;
  }

  private pick(rng: Rng, [lo, hi]: readonly [number, number]): number {
    return Math.round(lo + rng() * (hi - lo));
  }
}

/** Glance direction from a pet's tile toward another tile (a tap nearby), in rig units. Position only. */
export function lookToward(from: { r: number; c: number }, to: { r: number; c: number }): Look {
  const dr = Math.sign(to.r - from.r);
  const dc = Math.sign(to.c - from.c);
  return [dc * 1.4, dr * 1.0];
}
