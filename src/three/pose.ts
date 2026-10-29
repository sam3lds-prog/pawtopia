/**
 * A toy's pose as a set of named channels (D34). Clips return offsets from the resting pose; the stage adds the idle
 * layer and every playing clip, then applies the sum to the model. Distances are in toy units (1 = the figure scale H),
 * angles in radians. Pure data: no three.js here, so clips can be tested on their own.
 */

export const CHANNELS = [
  // Whole body: where it is and how it is turned.
  'px', // sideways (+ = to the viewer's right)
  'py', // up (a jump)
  'pz', // toward the viewer
  'yaw', // turning around (0 = facing you, π = showing its back)
  'pitch', // a flip around the body's middle (+ = forward, top toward you)
  'roll', // a cartwheel around the body's middle (+ = toward the viewer's right)
  // Body, from the ground.
  'lean', // + = leans forward
  'tilt', // + = leans to the viewer's right
  'squash', // + = squashed down (and wider), − = stretched up
  // Head.
  'headYaw', // + = looks to the viewer's right
  'headPitch', // + = looks down
  'headTilt', // + = tilts toward the viewer's right
  // Ears, limbs, tail.
  'ears', // + = perked up and back, − = flopped down
  'armL', // left front leg / wing / flipper raised forward-up (+)
  'armR',
  'armLOut', // out to the side (+)
  'armROut',
  'legL', // hind legs kicked forward (+)
  'legR',
  'tail', // wag (+ = to the viewer's right)
  'tailUp', // + = lifted
  'trunk', // + = curled up
  'mouth', // 0–1 open (beaks and jaws)
] as const;

export type Channel = (typeof CHANNELS)[number];
export type Pose = Record<Channel, number>;
export type PoseDelta = Partial<Pose>;

export function restPose(): Pose {
  return Object.fromEntries(CHANNELS.map((c) => [c, 0])) as Pose;
}

/** `into += d * w`, channel by channel. */
export function addPose(into: Pose, d: PoseDelta, w = 1): Pose {
  for (const k in d) {
    const v = d[k as Channel];
    if (v !== undefined && Number.isFinite(v)) into[k as Channel] += v * w;
  }
  return into;
}

// ------------------------------------------------------------------ timing helpers

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
/** Where t is between a and b, 0–1. */
export const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
export const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;
export const easeIn = (t: number) => clamp01(t) ** 3;
/** Overshoots a little before settling (for landings and pop-ins). */
export const easeOutBack = (t: number, s = 1.7) => {
  const x = clamp01(t) - 1;
  return 1 + (s + 1) * x ** 3 + s * x ** 2;
};
/** 0 → 1 → 0 between a and b, peaking at m (smooth). */
export function bump(t: number, a: number, m: number, b: number): number {
  if (t <= a || t >= b) return 0;
  return t < m ? easeInOut((t - a) / (m - a)) : easeInOut((b - t) / (b - m));
}
/** Rises over [a, a+r], holds, falls over [b−r, b]: a weight that starts and ends at 0. */
export function hold(t: number, a: number, b: number, r = 0.12): number {
  if (t <= a || t >= b) return 0;
  return Math.min(easeInOut((t - a) / r), 1, easeInOut((b - t) / r));
}
/** A parabolic jump between a and b, peaking at h. */
export function arc(t: number, a: number, b: number, h: number): number {
  if (t <= a || t >= b) return 0;
  const x = (t - a) / (b - a);
  return 4 * h * x * (1 - x);
}
/** n smooth oscillations between a and b, faded in and out. */
export function wiggle(t: number, a: number, b: number, n: number, amp: number): number {
  if (t <= a || t >= b) return 0;
  const x = (t - a) / (b - a);
  return Math.sin(x * n * 2 * Math.PI) * amp * Math.min(1, x * 5, (1 - x) * 5);
}
