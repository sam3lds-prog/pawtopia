/**
 * Facial expression state for one pet tile. Pure and clock-driven (no DOM, no timers), so it is fully testable.
 *
 * A pet has a resting BASE mood (idle, or sleepy after a quiet spell), at most one TRANSIENT reaction with an
 * expiry (curious, happy, confused, proud, focused, celebrate), and a BLINK overlay. Reactions only ever come
 * from legitimate game events passed in by the game screen; nothing here knows the puzzle or its answer.
 */

export type FaceMood = 'idle' | 'blink' | 'curious' | 'happy' | 'confused' | 'proud' | 'focused' | 'sleepy' | 'celebrate';
export type BaseMood = 'idle' | 'sleepy';
export type ReactionMood = 'curious' | 'happy' | 'confused' | 'proud' | 'focused' | 'celebrate';

/** Where the pupils glance, in rig units (clamped to ±1.6 so they stay inside the eye). */
export type Look = readonly [number, number];

export interface MoodSpec {
  /** Higher wins when two reactions overlap on one pet. */
  priority: number;
  /** Duration range in ms (spec table). The scheduler picks a value inside it deterministically. */
  ms: readonly [number, number];
  /** Eyes are open in this mood, so an idle blink may play. */
  blinkable: boolean;
}

export const MOOD_SPEC: Record<ReactionMood, MoodSpec> = {
  curious: { priority: 1, ms: [250, 450], blinkable: true },
  focused: { priority: 2, ms: [300, 600], blinkable: true },
  confused: { priority: 3, ms: [280, 450], blinkable: true },
  happy: { priority: 4, ms: [420, 650], blinkable: false },
  proud: { priority: 5, ms: [400, 650], blinkable: false },
  celebrate: { priority: 6, ms: [300, 550], blinkable: false },
};

export const BLINK_MS: readonly [number, number] = [140, 220];
export const BLINK_EVERY_MS: readonly [number, number] = [4000, 9000];
export const SLEEPY_AFTER_MS = 20_000;
export const MAX_CONCURRENT = 3;
export const CELEBRATE_TOTAL_MS = 1500;

export function isReaction(m: FaceMood): m is ReactionMood {
  return m in MOOD_SPEC;
}

export function clampLook(l: Look | undefined): Look {
  if (!l) return [0, 0];
  const c = (v: number) => Math.max(-1.6, Math.min(1.6, Number.isFinite(v) ? v : 0));
  return [c(l[0]), c(l[1])];
}

export interface FaceView {
  mood: FaceMood;
  blinking: boolean;
  look: Look;
}

export class FaceMachine {
  base: BaseMood = 'idle';
  private transient: { mood: ReactionMood; until: number; look: Look } | null = null;
  private blinkUntil = 0;

  /** Starts a reaction. Rejected if a higher-priority reaction is still running. */
  react(mood: ReactionMood, now: number, durationMs: number, look?: Look): boolean {
    const t = this.active(now);
    if (t && MOOD_SPEC[t.mood].priority > MOOD_SPEC[mood].priority) return false;
    this.transient = { mood, until: now + Math.max(0, durationMs), look: clampLook(look) };
    this.blinkUntil = 0; // a reaction replaces a blink in progress
    return true;
  }

  /** Starts a blink if the eyes are open and not already blinking. */
  blink(now: number, durationMs: number): boolean {
    const t = this.active(now);
    if (t && !MOOD_SPEC[t.mood].blinkable) return false;
    if (now < this.blinkUntil) return false;
    this.blinkUntil = now + durationMs;
    return true;
  }

  /** Ends any reaction and blink immediately (undo, clear, screen change). */
  cancel(): void {
    this.transient = null;
    this.blinkUntil = 0;
  }

  hasReaction(now: number): boolean {
    return this.active(now) !== null;
  }

  reactionMood(now: number): ReactionMood | null {
    return this.active(now)?.mood ?? null;
  }

  view(now: number): FaceView {
    const t = this.active(now);
    return {
      mood: t ? t.mood : this.base,
      blinking: now < this.blinkUntil,
      look: t ? t.look : [0, 0],
    };
  }

  private active(now: number) {
    if (this.transient && now >= this.transient.until) this.transient = null;
    return this.transient;
  }
}
