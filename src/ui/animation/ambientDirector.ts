/**
 * Sanctuary ambient life: a calm scheduler for small, occasional actions (a tail wag, a stretch, a blink, the fountain
 * catching the light). DOM-free and clock-injected, so it is tested with a fake clock like `FaceDirector`.
 *
 * Budget, by construction:
 *  - one pending "next action" timer, plus at most one end timer per running action;
 *  - at most `maxActive` (3) actors moving at once; an actor never overlaps itself;
 *  - the next action comes 3.5–9 s after the previous one started, from a seeded random sequence (no synchronized loops);
 *  - nothing runs while paused (screen hidden or left) or under reduced motion, except actions the player triggers by
 *    tapping, which still play, as a face-only change, so the scene answers a touch without moving;
 *  - `dispose()` clears every timer.
 *
 * This is deliberately separate from the puzzle board, where pets animate their faces only (D11). Sanctuary pets may
 * move their whole body a little (D24).
 */

import { mulberry32, type Rng } from '../../engine/rng';
import type { Clock } from './faceDirector';

export type AmbientAction =
  | 'blink'
  | 'look'
  | 'yawn'
  | 'wag'
  | 'stretch'
  | 'hop'
  | 'sparkle'
  | 'glow'
  | 'drift'
  | 'twinkle'
  | 'love'
  | 'spin'
  | 'shimmer'
  | 'sway'
  | 'flutter'
  | 'greet'
  | 'stroll';

/** How long each action plays, in ms. Kept short (≤ 1.8 s). */
export const ACTION_MS: Record<AmbientAction, number> = {
  blink: 220,
  look: 1400,
  yawn: 1600,
  wag: 1100,
  stretch: 1300,
  hop: 650,
  sparkle: 1600,
  glow: 1800,
  drift: 1800,
  twinkle: 1600,
  love: 1100,
  spin: 1800,
  shimmer: 1800,
  sway: 1600,
  flutter: 1500,
  greet: 1400,
  stroll: 1800,
};

/** Actions that only change a face (allowed under reduced motion when the player taps). */
export const FACE_ONLY: ReadonlySet<AmbientAction> = new Set(['blink', 'look', 'yawn', 'love']);

export const GAP_MS: readonly [number, number] = [3500, 9000];
export const MAX_ACTIVE = 3;

export interface AmbientActor {
  id: string;
  actions: readonly AmbientAction[];
}

export interface AmbientOptions {
  clock: Clock;
  seed: number;
  reducedMotion: boolean;
  /** Plays an action on an actor. The director ends it after ACTION_MS[action] by calling `end`. */
  play(actorId: string, action: AmbientAction): void;
  end(actorId: string, action: AmbientAction): void;
  maxActive?: number;
}

export class AmbientDirector {
  private readonly actors = new Map<string, AmbientActor>();
  /** actor id → { action, end timer } */
  private readonly running = new Map<string, { action: AmbientAction; timer: number }>();
  private next: number | null = null;
  private live = false;
  private disposed = false;
  private readonly rng: Rng;
  private readonly max: number;

  constructor(private readonly o: AmbientOptions) {
    this.rng = mulberry32(o.seed >>> 0);
    this.max = o.maxActive ?? MAX_ACTIVE;
  }

  add(actor: AmbientActor): void {
    if (actor.actions.length) this.actors.set(actor.id, actor);
  }

  remove(id: string): void {
    this.actors.delete(id);
    this.stop(id);
  }

  get activeCount(): number {
    return this.running.size;
  }

  /** Pending timers (for tests and the performance budget). */
  get timerCount(): number {
    return (this.next !== null ? 1 : 0) + this.running.size;
  }

  isRunning(id: string): boolean {
    return this.running.has(id);
  }

  /** Starts or pauses ambient life (screen shown / hidden). Pausing ends what is playing. */
  setLive(on: boolean): void {
    if (this.disposed) return;
    const want = on && !this.o.reducedMotion;
    if (want === this.live) return;
    this.live = want;
    if (want) this.schedule();
    else {
      this.clearNext();
      for (const id of [...this.running.keys()]) this.stop(id);
    }
  }

  /**
   * A player's tap. Plays even when ambient life is off; under reduced motion only face-only actions play. Returns
   * whether something played. Never exceeds the active cap: the oldest running action makes room.
   */
  trigger(id: string, action: AmbientAction): boolean {
    if (this.disposed || !this.actors.has(id)) return false;
    if (this.o.reducedMotion && !FACE_ONLY.has(action)) return false;
    this.stop(id);
    if (this.running.size >= this.max) this.stop(this.running.keys().next().value as string);
    this.start(id, action);
    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.live = false;
    this.clearNext();
    for (const id of [...this.running.keys()]) this.stop(id);
    this.actors.clear();
  }

  private schedule(): void {
    this.clearNext();
    if (!this.live || this.disposed) return;
    const [lo, hi] = GAP_MS;
    const wait = lo + Math.floor(this.rng() * (hi - lo));
    this.next = this.o.clock.set(() => {
      this.next = null;
      this.fire();
      this.schedule();
    }, wait);
  }

  private fire(): void {
    if (this.running.size >= this.max) return;
    const idle = [...this.actors.values()].filter((a) => !this.running.has(a.id));
    if (!idle.length) return;
    const actor = idle[Math.floor(this.rng() * idle.length)];
    const action = actor.actions[Math.floor(this.rng() * actor.actions.length)];
    this.start(actor.id, action);
  }

  private start(id: string, action: AmbientAction): void {
    this.o.play(id, action);
    const timer = this.o.clock.set(() => {
      if (this.running.get(id)?.timer === timer) {
        this.running.delete(id);
        this.o.end(id, action);
      }
    }, ACTION_MS[action]);
    this.running.set(id, { action, timer });
  }

  private stop(id: string): void {
    const r = this.running.get(id);
    if (!r) return;
    this.o.clock.clear(r.timer);
    this.running.delete(id);
    this.o.end(id, r.action);
  }

  private clearNext(): void {
    if (this.next !== null) this.o.clock.clear(this.next);
    this.next = null;
  }
}
