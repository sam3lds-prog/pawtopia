/**
 * An animal on stage (D34): its toy, the gentle idle motion (breathing, a swaying tail, ears that twitch, blinks), and
 * the clips playing on top. A new clip from a trick or emote takes over from small everyday moves, which fade out.
 * Under reduced motion nothing moves by itself; clips still show their faces, held still.
 */

import { activityClip, ambientClip, performClip, type Clip, type ClipCtx } from './clips';
import type { Expr } from './face';
import { addPose, restPose, type Pose } from './pose';
import type { Toy } from './toy';

interface Layer {
  clip: Clip;
  kind: 'ambient' | 'perform';
  id: string;
  start: number;
  ctx: ClipCtx;
  /** Fading out from this time (ms), when replaced. */
  fadeFrom?: number;
  /** Plays the face only (reduced motion). */
  still: boolean;
}

const FADE_MS = 160;
const OPEN_EYED: ReadonlySet<Expr> = new Set(['idle', 'lookL', 'lookR', 'focused', 'surprised']);

export class Actor {
  readonly toy: Toy;
  private layers: Layer[] = [];
  private seed: number;
  private nextBlink = 0;
  private blinkUntil = 0;
  private nextTwitch = 0;
  private twitchAt = -1e9;
  /** Hidden while away on a decoration (D32). */
  away = false;
  /** Which way travelling clips go (toward the middle of the scene). */
  dir: 1 | -1 = 1;
  /** Extra turn while riding (to face where the decoration takes it). */
  extraYaw = 0;

  constructor(toy: Toy, seed: number) {
    this.toy = toy;
    this.seed = seed;
  }

  private ctx(): ClipCtx {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return { body: this.toy.spec.body, dir: this.dir, seed: this.seed >> 8 };
  }

  /** An everyday move from the ambient director. Ignored while performing. */
  ambient(action: string, now: number, still = false): boolean {
    const clip = ambientClip(action);
    if (!clip || this.performing(now)) return false;
    // A new move replaces the same move already playing.
    this.layers = this.layers.filter((l) => l.id !== action);
    this.layers.push({ clip, kind: 'ambient', id: action, start: now, ctx: this.ctx(), still });
    return true;
  }

  /** A trick or emote: everything else fades out first. */
  perform(id: string, now: number, still = false): number {
    const clip = performClip(id);
    if (!clip) return 0;
    for (const l of this.layers) l.fadeFrom ??= now;
    this.layers.push({ clip, kind: 'perform', id, start: now, ctx: this.ctx(), still });
    return clip.ms;
  }

  /** Acts out a decoration activity (D32) while the stage carries the toy along the decoration's path. */
  ride(decor: string, now: number, still = false): number {
    const clip = activityClip(decor);
    if (!clip) return 0;
    for (const l of this.layers) l.fadeFrom ??= now;
    this.layers.push({ clip, kind: 'perform', id: `act:${decor}`, start: now, ctx: this.ctx(), still });
    return clip.ms;
  }

  /** Ends a ride early (the activity was stopped). */
  endRide(now: number): void {
    for (const l of this.layers) if (l.id.startsWith('act:')) l.fadeFrom ??= now;
    this.extraYaw = 0;
  }

  performing(now: number): string | null {
    const l = this.layers.find((x) => x.kind === 'perform' && x.fadeFrom === undefined && now - x.start < x.clip.ms);
    return l ? l.id : null;
  }

  /** Progress (0–1) of the trick or emote playing now, for its props. */
  progress(id: string, now: number): number | null {
    const l = this.layers.find((x) => x.kind === 'perform' && x.id === id);
    return l ? Math.min(1, (now - l.start) / l.clip.ms) : null;
  }

  busy(now: number): boolean {
    return this.layers.some((l) => now - l.start < l.clip.ms);
  }

  /** Advances to `now` (ms) and poses the toy. `idle` adds the breathing and twitches. */
  update(now: number, idle: boolean): void {
    const pose: Pose = restPose();
    let face: Expr | null = null;
    let faceWeight = 0;
    this.layers = this.layers.filter((l) => now - l.start < l.clip.ms && (l.fadeFrom === undefined || now - l.fadeFrom < FADE_MS));
    for (const l of this.layers) {
      const t = (now - l.start) / l.clip.ms;
      const f = l.clip.frame(t, l.ctx);
      const w = l.fadeFrom === undefined ? 1 : 1 - (now - l.fadeFrom) / FADE_MS;
      if (!l.still) addPose(pose, f.pose, w);
      const fw = (l.kind === 'perform' ? 2 : 1) * w;
      if (f.face && fw > faceWeight) {
        face = f.face;
        faceWeight = fw;
      }
    }
    if (idle) this.idle(pose, now);
    pose.yaw += this.extraYaw;
    this.toy.setPose(pose);

    // Blinks every few seconds while the eyes are open.
    if (now >= this.nextBlink) {
      this.blinkUntil = now + 140;
      this.nextBlink = now + 2600 + ((this.seed >> 4) % 3200);
      this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    }
    let e = face ?? this.toy.baseExpr;
    if (OPEN_EYED.has(e) && now < this.blinkUntil && idle) e = 'blink';
    this.toy.setFace(e);
    this.toy.root.visible = !this.away;
  }

  private idle(p: Pose, now: number): void {
    const s = (this.seed % 1000) / 1000;
    const tt = now / 1000;
    const breathe = Math.sin(tt * ((2 * Math.PI) / 3.4) + s * 6);
    p.squash += breathe * 0.012;
    p.headPitch += Math.sin(tt * ((2 * Math.PI) / 5.3) + s * 3) * 0.03;
    p.headTilt += Math.sin(tt * ((2 * Math.PI) / 7.1) + s * 5) * 0.035;
    p.tail += Math.sin(tt * ((2 * Math.PI) / 2.9) + s * 2) * 0.18;
    p.trunk += Math.sin(tt * ((2 * Math.PI) / 3.7) + s) * 0.25 + 0.15;
    if (this.toy.spec.body === 'bird') p.armL += Math.max(0, Math.sin(tt * 1.3 + s * 4)) * 0.04;
    if (this.toy.spec.body === 'bird') p.armR += Math.max(0, Math.sin(tt * 1.3 + s * 4)) * 0.04;
    // An ear twitch now and then.
    if (now >= this.nextTwitch) {
      this.twitchAt = now;
      this.nextTwitch = now + 3500 + ((this.seed >> 3) % 5000);
    }
    const k = (now - this.twitchAt) / 260;
    if (k >= 0 && k < 1) p.ears += Math.sin(k * Math.PI) * 0.35;
  }
}
