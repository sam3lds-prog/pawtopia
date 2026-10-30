/**
 * Everything a 3D toy can act out (D34): small everyday moves (a look round, a yawn, a stroll), the tricks and the
 * emotes. A clip is a pure function of normalized time t (0–1) returning pose offsets and, optionally, a face. Every
 * clip starts and ends at rest (offsets 0), so clips can follow one another without a jump. Props (stars, a bubble, a
 * rainbow) are drawn by the stage on the same clock; see `effects.ts`.
 *
 * Good toy motion: anticipation before a jump, squash on landing, overshoot when something pops, and turns that show
 * the animal's side and back.
 */

import type { BodyKind } from './species';
import type { Expr } from './face';
import { arc, bump, easeInOut, easeOut, easeOutBack, hold, seg, wiggle, type PoseDelta } from './pose';

export interface ClipCtx {
  body: BodyKind;
  /** Which way a travelling clip goes (+1 = to the viewer's right): toward the middle of the scene. */
  dir: 1 | -1;
  /** Varies small things (which way to look) from one play to the next. */
  seed: number;
}

export interface Frame {
  pose: PoseDelta;
  face?: Expr;
}

export interface Clip {
  ms: number;
  frame(t: number, c: ClipCtx): Frame;
}

const TAU = Math.PI * 2;

/** A squash–stretch jump: crouch over [a, a+0.1], fly until b, land and settle. */
function jump(t: number, a: number, b: number, h: number): PoseDelta {
  const crouch = bump(t, Math.max(0, a - 0.08), a, a + 0.04) * 0.16;
  const fly = arc(t, a, b, h);
  const stretch = bump(t, a, a + (b - a) * 0.3, b - (b - a) * 0.2) * -0.1;
  const land = bump(t, b - 0.02, b + 0.05, b + 0.16) * 0.14;
  return { py: fly, squash: crouch + stretch + land };
}

function sum(...ds: PoseDelta[]): PoseDelta {
  const out: PoseDelta = {};
  for (const d of ds) for (const k in d) (out as Record<string, number>)[k] = ((out as Record<string, number>)[k] ?? 0) + (d as Record<string, number>)[k];
  return out;
}

/** Little hops along the way while walking (a toy's walk), with the legs paddling. */
function steps(t: number, a: number, b: number, n: number): PoseDelta {
  if (t <= a || t >= b) return {};
  const x = (t - a) / (b - a);
  const s = Math.abs(Math.sin(x * n * Math.PI));
  const p = Math.sin(x * n * Math.PI);
  return { py: s * 0.05, squash: (1 - s) * 0.03, armL: p * 0.5, armR: -p * 0.5, legL: -p * 0.4, legR: p * 0.4, tilt: p * 0.06, tail: p * 0.3 };
}

// ------------------------------------------------------------------ everyday moves (driven by the ambient director)

export const AMBIENT: Record<string, Clip> = {
  blink: { ms: 180, frame: () => ({ pose: {}, face: 'blink' }) },
  look: {
    ms: 1400,
    frame: (t, c) => {
      const s = c.seed % 2 ? 1 : -1;
      const w = hold(t, 0, 1, 0.25);
      return { pose: { headYaw: 0.55 * s * w, headTilt: 0.08 * s * w, ears: 0.15 * w }, face: w > 0.3 ? (s > 0 ? 'lookR' : 'lookL') : undefined };
    },
  },
  yawn: {
    ms: 1600,
    frame: (t) => {
      const w = hold(t, 0.05, 0.85, 0.25);
      return { pose: { headPitch: -0.28 * w, squash: -0.05 * w, armL: 0.25 * w, armR: 0.25 * w, mouth: w, ears: -0.2 * w }, face: w > 0.2 ? 'yawn' : undefined };
    },
  },
  wag: {
    ms: 1100,
    frame: (t) => ({ pose: { tail: wiggle(t, 0, 1, 4, 0.7), tailUp: 0.3 * hold(t, 0, 1), tilt: wiggle(t, 0, 1, 4, -0.03) }, face: 'happy' }),
  },
  stretch: {
    ms: 1400,
    frame: (t, c) => {
      const w = hold(t, 0.05, 0.9, 0.3);
      if (c.body === 'bird') return { pose: { armL: 1.4 * w, armR: 1.4 * w, armLOut: 0.4 * w, armROut: 0.4 * w, squash: -0.06 * w }, face: w > 0.4 ? 'happy' : undefined };
      return { pose: { lean: 0.38 * w, armL: 1.0 * w, armR: 1.0 * w, py: -0.02 * w, tailUp: 0.5 * w, headPitch: -0.3 * w }, face: w > 0.4 ? 'sleepy' : undefined };
    },
  },
  hop: { ms: 700, frame: (t) => ({ pose: { ...jump(t, 0.15, 0.62, 0.2), ears: bump(t, 0.2, 0.45, 0.8) * 0.3 }, face: 'happy' }) },
  love: {
    ms: 1300,
    frame: (t) => {
      const w = hold(t, 0, 1, 0.2);
      return { pose: { headTilt: 0.22 * w, squash: bump(t, 0.05, 0.2, 0.4) * 0.06, tail: wiggle(t, 0, 1, 3, 0.4) }, face: 'love' };
    },
  },
  greet: {
    ms: 1500,
    frame: (t) => ({
      pose: sum(jump(t, 0.1, 0.38, 0.16), {
        armR: 0.45 * hold(t, 0.3, 0.95, 0.15),
        armROut: 2.3 * hold(t, 0.3, 0.95, 0.15) + wiggle(t, 0.4, 0.92, 3, 0.4),
        headTilt: -0.15 * hold(t, 0.3, 0.95),
        tail: wiggle(t, 0, 1, 4, 0.5),
      }),
      face: 'happy',
    }),
  },
  stroll: {
    // A wander: turn to one side (showing its profile), walk a few hops, turn round through its back, walk home, face you.
    ms: 3400,
    frame: (t, c) => {
      const s = c.seed % 2 ? 1 : -1;
      const away = easeInOut(seg(t, 0.12, 0.44)) - easeInOut(seg(t, 0.58, 0.9));
      let yaw = 0;
      if (t < 0.12) yaw = (s * Math.PI) / 2 * easeInOut(t / 0.12);
      else if (t < 0.44) yaw = (s * Math.PI) / 2;
      else if (t < 0.58) yaw = (s * Math.PI) / 2 + s * Math.PI * easeInOut((t - 0.44) / 0.14);
      else if (t < 0.9) yaw = (s * 3 * Math.PI) / 2;
      else yaw = (s * 3 * Math.PI) / 2 + (s * Math.PI) / 2 * easeInOut((t - 0.9) / 0.1);
      return { pose: sum({ px: away * 0.75 * s, yaw }, steps(t, 0.12, 0.44, 4), steps(t, 0.58, 0.9, 4)), face: t > 0.4 && t < 0.62 ? 'lookR' : undefined };
    },
  },
  flutter: {
    ms: 1500,
    frame: (t) => ({ pose: { armL: 0.6 + wiggle(t, 0, 1, 5, 0.6), armR: 0.6 + wiggle(t, 0, 1, 5, 0.6), py: bump(t, 0.1, 0.5, 0.9) * 0.08 }, face: 'happy' }),
  },
};
// `flutter` starts and ends with wings partly open: fade it.
const flutterBase = AMBIENT.flutter.frame;
AMBIENT.flutter = { ms: 1500, frame: (t, c) => scaleFrame(flutterBase(t, c), hold(t, 0, 1, 0.2)) };

function scaleFrame(f: Frame, w: number): Frame {
  const pose: PoseDelta = {};
  for (const k in f.pose) (pose as Record<string, number>)[k] = (f.pose as Record<string, number>)[k] * w;
  return { pose, face: w > 0.3 ? f.face : undefined };
}

// ------------------------------------------------------------------ tricks (D33, now in 3D)

export const TRICK_CLIPS: Record<string, Clip> = {
  wave: {
    ms: 1600,
    frame: (t) => {
      const up = hold(t, 0.05, 0.95, 0.18);
      return { pose: { armR: 0.45 * up, armROut: 2.45 * up + wiggle(t, 0.2, 0.85, 3, 0.45), headTilt: -0.16 * up, tilt: -0.06 * up, tail: wiggle(t, 0, 1, 3, 0.4) }, face: 'happy' };
    },
  },
  hop: {
    ms: 1300,
    frame: (t) => ({
      pose: sum(jump(t, 0.1, 0.4, 0.22), jump(t, 0.52, 0.86, 0.32), { yaw: wiggle(t, 0.5, 0.9, 1, 0.35), ears: bump(t, 0.1, 0.3, 0.9) * 0.3, armLOut: arc(t, 0.52, 0.86, 1.6), armROut: arc(t, 0.52, 0.86, 1.6), armL: arc(t, 0.52, 0.86, 0.3), armR: arc(t, 0.52, 0.86, 0.3) }),
      face: 'happy',
    }),
  },
  spin: {
    ms: 1700,
    frame: (t) => {
      const turn = easeInOut(seg(t, 0.1, 0.5)) + easeInOut(seg(t, 0.5, 0.92));
      const out = hold(t, 0.08, 0.95, 0.12);
      return { pose: sum(jump(t, 0.12, 0.44, 0.08), jump(t, 0.52, 0.86, 0.08), { yaw: turn * TAU, armLOut: 1.35 * out, armROut: 1.35 * out, armL: 0.2 * out, armR: 0.2 * out, tailUp: 0.4 * out }), face: 'happy' };
    },
  },
  bow: {
    ms: 1900,
    frame: (t) => {
      const down = hold(t, 0.08, 0.78, 0.2);
      return {
        pose: { lean: 0.55 * down, headPitch: 0.45 * down, armR: 1.1 * down, armROut: -0.3 * down, armL: 0.3 * down, tailUp: 0.6 * down, ears: -0.25 * down, squash: bump(t, 0.75, 0.86, 0.98) * -0.05 },
        face: t > 0.78 ? 'proud' : down > 0.4 ? 'blink' : undefined,
      };
    },
  },
  rollover: {
    ms: 1900,
    frame: (t, c) => {
      const d = c.dir;
      const roll = easeInOut(seg(t, 0.12, 0.62)) * TAU * d;
      const over = easeInOut(seg(t, 0.12, 0.62)) - easeInOut(seg(t, 0.66, 0.94));
      return {
        pose: sum({ roll, px: over * 0.6 * d, py: bump(t, 0.12, 0.37, 0.62) * 0.12, armL: 1.2 * hold(t, 0.1, 0.65), armR: 1.2 * hold(t, 0.1, 0.65), legL: 0.6 * hold(t, 0.1, 0.65), legR: 0.6 * hold(t, 0.1, 0.65) }, steps(t, 0.66, 0.94, 3), { squash: bump(t, 0.02, 0.1, 0.16) * 0.12 }),
        face: t < 0.62 ? 'laugh' : 'happy',
      };
    },
  },
  dance: {
    ms: 2400,
    frame: (t) => {
      const beat = Math.sin(seg(t, 0.05, 0.95) * 4 * Math.PI);
      const w = hold(t, 0.03, 0.97, 0.1);
      const bounce = Math.abs(Math.sin(seg(t, 0.05, 0.95) * 8 * Math.PI)) * 0.06 * w;
      return {
        pose: { px: beat * 0.12 * w, py: bounce, tilt: beat * 0.16 * w, headTilt: -beat * 0.2 * w, yaw: beat * 0.35 * w, armL: 0.35 * w, armR: 0.35 * w, armLOut: (1.7 + beat * 0.7) * w, armROut: (1.7 - beat * 0.7) * w, tail: beat * 0.6 * w, squash: -bounce * 0.5 },
        face: 'laugh',
      };
    },
  },
  backflip: {
    ms: 2200,
    frame: (t) => {
      const flip = easeInOut(seg(t, 0.26, 0.62));
      return {
        pose: sum(jump(t, 0.22, 0.66, 0.95), { pitch: -flip * TAU, armL: 0.4 * hold(t, 0.22, 0.64), armR: 0.4 * hold(t, 0.22, 0.64), armLOut: 2.2 * hold(t, 0.22, 0.64), armROut: 2.2 * hold(t, 0.22, 0.64), legL: 0.5 * hold(t, 0.26, 0.62), legR: 0.5 * hold(t, 0.26, 0.62), lean: bump(t, 0.06, 0.18, 0.24) * -0.12, tailUp: hold(t, 0.22, 0.7) * 0.7 }),
        face: t < 0.2 ? 'focused' : t < 0.66 ? 'surprised' : 'proud',
      };
    },
  },
  bubble: {
    ms: 3400,
    frame: (t) => {
      const up = easeInOut(seg(t, 0.12, 0.42)) * (1 - easeOut(seg(t, 0.86, 0.95)));
      const drift = wiggle(t, 0.3, 0.86, 2, 0.08);
      return {
        pose: sum({ py: up * 0.75 + bump(t, 0.4, 0.62, 0.86) * 0.08, px: drift, yaw: easeInOut(seg(t, 0.3, 0.84)) * TAU, armL: hold(t, 0.14, 0.88) * 0.5, armR: hold(t, 0.14, 0.88) * 0.5, armLOut: hold(t, 0.14, 0.88) * 1.1 + wiggle(t, 0.2, 0.84, 6, 0.4), armROut: hold(t, 0.14, 0.88) * 1.1 - wiggle(t, 0.2, 0.84, 6, 0.4), legL: hold(t, 0.14, 0.88) * 0.4, legR: hold(t, 0.14, 0.88) * 0.4 }, { squash: bump(t, 0.93, 0.96, 1) * 0.16 }),
        face: t < 0.84 ? 'happy' : 'surprised',
      };
    },
  },
  juggle: {
    ms: 3200,
    frame: (t) => {
      const w = hold(t, 0.04, 0.96, 0.1);
      const p = Math.sin(seg(t, 0.08, 0.92) * 6 * Math.PI);
      return {
        pose: { lean: -0.1 * w, armL: 0.9 * w, armR: 0.9 * w, armLOut: (1.2 + p * 0.5) * w, armROut: (1.2 - p * 0.5) * w, headPitch: -0.32 * w + p * 0.05, headYaw: p * 0.12 * w, py: Math.abs(p) * 0.02 * w, tail: p * 0.4 * w },
        face: t > 0.9 ? 'proud' : 'focused',
      };
    },
  },
  rainbow: {
    ms: 3400,
    frame: (t, c) => {
      const d = c.dir;
      const there = easeInOut(seg(t, 0.2, 0.6));
      const back = easeInOut(seg(t, 0.74, 0.95));
      // Turns toward the leap (three-quarter view), turns round through its back at the far side, faces you at home.
      const a = 0.7;
      let yaw = 0;
      if (t < 0.12) yaw = 0;
      else if (t < 0.2) yaw = a * easeInOut(seg(t, 0.12, 0.2));
      else if (t < 0.62) yaw = a;
      else if (t < 0.74) yaw = a + (TAU - 2 * a) * easeInOut(seg(t, 0.62, 0.74));
      else if (t < 0.95) yaw = TAU - a;
      else yaw = TAU - a + a * easeInOut(seg(t, 0.95, 1));
      return {
        pose: sum(jump(t, 0.2, 0.6, 0.85), steps(t, 0.74, 0.95, 3), { px: (there - back) * 0.95 * d, yaw: yaw * d, armL: hold(t, 0.2, 0.6) * 1.4, armR: hold(t, 0.2, 0.6) * 1.4, legL: hold(t, 0.2, 0.6) * -0.6, legR: hold(t, 0.2, 0.6) * -0.6, tailUp: hold(t, 0.2, 0.6) * 0.6 }),
        face: t < 0.62 ? 'happy' : t < 0.74 ? 'proud' : 'happy',
      };
    },
  },
};

// ------------------------------------------------------------------ emotes (D34): acted out with the face and the body

export const EMOTE_CLIPS: Record<string, Clip> = {
  love: {
    ms: 1800,
    frame: (t) => {
      const w = hold(t, 0.02, 0.98, 0.15);
      return { pose: { headTilt: wiggle(t, 0.05, 0.95, 2, 0.22), tilt: wiggle(t, 0.05, 0.95, 2, 0.06), armL: 0.9 * w, armR: 0.9 * w, armLOut: -0.35 * w, armROut: -0.35 * w, py: Math.abs(Math.sin(t * 4 * Math.PI)) * 0.04 * w, tail: wiggle(t, 0, 1, 4, 0.5) }, face: 'love' };
    },
  },
  laugh: {
    ms: 1800,
    frame: (t) => {
      const w = hold(t, 0.03, 0.97, 0.15);
      return { pose: { headPitch: -0.22 * w, tilt: wiggle(t, 0.05, 0.95, 7, 0.07), py: Math.abs(Math.sin(t * 7 * Math.PI)) * 0.035 * w, armL: 0.7 * w, armR: 0.7 * w, armLOut: -0.45 * w, armROut: -0.45 * w, squash: wiggle(t, 0.05, 0.95, 7, 0.03), mouth: w }, face: 'laugh' };
    },
  },
  cheer: {
    ms: 2000,
    frame: (t) => {
      const up = hold(t, 0.08, 0.92, 0.12);
      const pump = Math.sin(seg(t, 0.15, 0.85) * 4 * Math.PI) * 0.35 * up;
      return { pose: sum(jump(t, 0.18, 0.44, 0.28), jump(t, 0.54, 0.8, 0.28), { armL: 0.3 * up, armR: 0.3 * up, armLOut: (2.55 + pump) * up, armROut: (2.55 - pump) * up, ears: 0.3 * up, tail: wiggle(t, 0, 1, 5, 0.6) }), face: 'laugh' };
    },
  },
  surprised: {
    ms: 1600,
    frame: (t) => {
      const w = hold(t, 0.05, 0.9, 0.08);
      return { pose: sum(jump(t, 0.06, 0.32, 0.18), { pz: -0.18 * w, armL: 0.5 * w, armR: 0.5 * w, armLOut: 1.6 * w, armROut: 1.6 * w, ears: 0.45 * w, tailUp: 0.8 * w, headPitch: -0.12 * w }), face: t < 0.9 ? 'surprised' : undefined };
    },
  },
  sleepy: {
    ms: 3000,
    frame: (t) => {
      const yawn = hold(t, 0.02, 0.3, 0.1);
      const doze = hold(t, 0.3, 0.92, 0.12);
      const nod = Math.max(0, Math.sin(seg(t, 0.32, 0.9) * 2 * Math.PI)) * 0.25 * doze;
      return {
        pose: { headPitch: -0.28 * yawn + (0.25 + nod) * doze, squash: -0.05 * yawn + 0.04 * doze, armL: 0.3 * yawn, armR: 0.3 * yawn, ears: -0.4 * doze, lean: 0.06 * doze, mouth: yawn },
        face: yawn > 0.3 ? 'yawn' : doze > 0.2 ? 'sleepy' : t > 0.92 ? 'blink' : undefined,
      };
    },
  },
  shy: {
    ms: 2200,
    frame: (t) => {
      const w = hold(t, 0.05, 0.85, 0.15);
      const peek = bump(t, 0.6, 0.72, 0.84);
      return { pose: { headYaw: (-0.6 + peek * 0.5) * w, headPitch: 0.3 * w, armR: 1.9 * w, armROut: -0.55 * w, tilt: wiggle(t, 0.1, 0.85, 2, 0.06), ears: -0.3 * w, tail: wiggle(t, 0, 1, 3, 0.3) }, face: t > 0.86 ? 'happy' : 'shy' };
    },
  },
  starstruck: {
    ms: 3000,
    frame: (t) => {
      const w = hold(t, 0.03, 0.97, 0.1);
      return { pose: sum(jump(t, 0.25, 0.65, 0.5), { yaw: easeInOut(seg(t, 0.27, 0.63)) * TAU, armL: 0.3 * w, armR: 0.3 * w, armLOut: 2.5 * w, armROut: 2.5 * w, headPitch: -0.2 * w, ears: 0.3 * w }), face: 'stars' };
    },
  },
  party: {
    ms: 3400,
    frame: (t) => {
      const w = hold(t, 0.04, 0.96, 0.08);
      const beat = Math.sin(seg(t, 0.25, 0.95) * 6 * Math.PI);
      const dancing = hold(t, 0.25, 0.95, 0.06);
      return {
        pose: sum(jump(t, 0.06, 0.24, 0.2), {
          px: beat * 0.1 * dancing,
          tilt: beat * 0.14 * dancing,
          yaw: beat * 0.3 * dancing,
          py: Math.abs(beat) * 0.05 * dancing,
          armL: 0.3 * w,
          armR: 0.3 * w,
          armLOut: (2.2 + beat * 0.5) * w,
          armROut: (2.2 - beat * 0.5) * w,
          headTilt: -beat * 0.2 * dancing,
          tail: beat * 0.6,
        }),
        face: t < 0.24 ? 'surprised' : 'laugh',
      };
    },
  },
};

// ------------------------------------------------------------------ decoration activities (D32), as the rider acts them

/** How the rider acts on each decoration; the path it travels is the decoration's own (the drawn rider's). */
export const ACTIVITY_CLIPS: Record<string, Clip> = {
  balloon: {
    ms: 6200,
    frame: (t) => {
      const wave = hold(t, 0.22, 0.5, 0.06);
      const look = hold(t, 0.55, 0.88, 0.08);
      return {
        pose: { py: wiggle(t, 0, 1, 5, 0.02), armR: 0.4 * wave, armROut: 2.3 * wave + wiggle(t, 0.26, 0.46, 3, 0.4), armLOut: 0.4 * hold(t, 0.05, 0.95), headYaw: Math.sin(seg(t, 0.55, 0.88) * TAU) * 0.6 * look, headPitch: -0.15 * look, tail: wiggle(t, 0, 1, 6, 0.4) },
        face: look > 0.3 ? 'surprised' : 'happy',
      };
    },
  },
  kite: {
    ms: 5600,
    frame: (t) => {
      const w = hold(t, 0.04, 0.96, 0.08);
      return { pose: sum(steps(t, 0.1, 0.9, 10), { armL: 0.6 * w, armLOut: 2.1 * w, armROut: 0.6 * w, headPitch: -0.38 * w, headYaw: -0.3 * w, tailUp: 0.5 * w }), face: 'laugh' };
    },
  },
  goldfountain: {
    ms: 4800,
    frame: (t) => {
      const w = hold(t, 0.04, 0.96, 0.08);
      return { pose: sum(jump(t, 0.12, 0.36, 0.25), jump(t, 0.42, 0.66, 0.25), jump(t, 0.7, 0.84, 0.2), { armLOut: (1.4 + wiggle(t, 0.1, 0.95, 8, 0.6)) * w, armROut: (1.4 - wiggle(t, 0.1, 0.95, 8, 0.6)) * w }), face: 'laugh' };
    },
  },
  eavelights: {
    ms: 5200,
    frame: (t) => {
      const w = hold(t, 0.03, 0.97, 0.08);
      const beat = Math.sin(seg(t, 0.05, 0.95) * 8 * Math.PI);
      return { pose: { py: Math.abs(beat) * 0.05 * w, tilt: beat * 0.15 * w, yaw: beat * 0.4 * w, armLOut: (1.7 + beat * 0.7) * w, armROut: (1.7 - beat * 0.7) * w, headTilt: -beat * 0.2 * w, tail: beat * 0.6 * w }, face: 'laugh' };
    },
  },
  hammock: {
    ms: 6000,
    frame: (t) => {
      const w = hold(t, 0.02, 0.98, 0.12);
      return { pose: { roll: 1.3 * w, py: -0.12 * w, headPitch: -0.1 * w, squash: Math.sin(t * 6 * Math.PI) * 0.02 * w, tail: wiggle(t, 0, 1, 3, 0.3), ears: -0.3 * w }, face: w > 0.3 ? 'sleepy' : undefined };
    },
  },
  opalrock: {
    ms: 4600,
    frame: (t) => {
      const sniff = hold(t, 0.02, 0.36, 0.1);
      const joy = hold(t, 0.58, 0.97, 0.08);
      return {
        pose: sum(jump(t, 0.38, 0.54, 0.22), { lean: 0.35 * sniff, headPitch: 0.35 * sniff + wiggle(t, 0.05, 0.33, 4, 0.08), armLOut: 2.2 * joy, armROut: 2.2 * joy, yaw: easeInOut(seg(t, 0.62, 0.95)) * TAU }),
        face: t < 0.36 ? 'focused' : t < 0.56 ? 'surprised' : 'stars',
      };
    },
  },
  flamingos: {
    ms: 5400,
    frame: (t) => {
      const w = hold(t, 0.04, 0.96, 0.1);
      const beat = Math.sin(seg(t, 0.05, 0.95) * 6 * Math.PI);
      return { pose: { legL: 0.9 * w, tilt: (beat * 0.12 - 0.06) * w, armLOut: (1.5 + beat * 0.5) * w, armROut: (1.5 - beat * 0.5) * w, headTilt: beat * 0.15 * w, py: Math.abs(beat) * 0.03 * w }, face: 'happy' };
    },
  },
  pavilion: {
    ms: 5600,
    frame: (t) => {
      const sip = bump(t, 0.18, 0.28, 0.38) + bump(t, 0.56, 0.66, 0.76);
      return { pose: { armR: 1.5 * sip, armROut: -0.3 * sip, headPitch: -0.12 * sip, tail: wiggle(t, 0, 1, 4, 0.3), headTilt: wiggle(t, 0.4, 0.55, 1, 0.15) }, face: sip > 0.5 ? 'blink' : 'happy' };
    },
  },
  icelanterns: {
    ms: 6000,
    frame: (t) => {
      const w = hold(t, 0.03, 0.97, 0.08);
      return { pose: sum(steps(t, 0.05, 0.95, 12), { armR: 1.0 * w, armROut: 0.3 * w, headPitch: -0.1 * w }), face: 'happy' };
    },
  },
  aurora: {
    ms: 6000,
    frame: (t) => {
      const w = hold(t, 0.04, 0.96, 0.15);
      return { pose: { headPitch: -0.55 * w, lean: -0.1 * w, armL: 0.8 * w, armR: 0.8 * w, armLOut: -0.3 * w, armROut: -0.3 * w, tilt: wiggle(t, 0.1, 0.9, 2, 0.06), tail: wiggle(t, 0, 1, 3, 0.3) }, face: t > 0.3 && t < 0.8 ? 'love' : 'happy' };
    },
  },
  fireflyjars: {
    ms: 5600,
    frame: (t) => {
      const open = hold(t, 0.05, 0.3, 0.08);
      const up = hold(t, 0.3, 0.95, 0.1);
      return { pose: { armL: 1.0 * open, armR: 1.0 * open, armLOut: 2.2 * up, armROut: 2.2 * up, headPitch: -0.35 * up, headYaw: Math.sin(seg(t, 0.3, 0.95) * 2 * TAU) * 0.5 * up, py: bump(t, 0.3, 0.38, 0.46) * 0.12 }, face: t < 0.3 ? 'focused' : 'surprised' };
    },
  },
  waterfall: {
    ms: 4800,
    frame: (t) => {
      const w = hold(t, 0.04, 0.9, 0.08);
      return { pose: sum({ lean: -0.45 * w, armLOut: 2.4 * w, armROut: 2.4 * w, legL: 0.8 * w, legR: 0.8 * w, ears: 0.4 * w }, jump(t, 0.76, 0.86, 0.12)), face: t < 0.2 ? 'surprised' : 'laugh' };
    },
  },
};

/** A decoration activity's clip for the rider. */
export function activityClip(decor: string): Clip | null {
  return ACTIVITY_CLIPS[decor] ?? null;
}

/** A trick's or an emote's clip (they share the catalog's ids; D33/D34). */
export function performClip(id: string): Clip | null {
  return TRICK_CLIPS[id] ?? EMOTE_CLIPS[id] ?? null;
}

/** An everyday move's clip (the ambient director's action names). */
export function ambientClip(action: string): Clip | null {
  return AMBIENT[action] ?? null;
}

/** Angles that end a whole number of turns round count as back at rest. */
export const TURN_CHANNELS = ['yaw', 'pitch', 'roll'] as const;

/** Overshoot for props popping in (re-exported for effects). */
export { easeOutBack };
