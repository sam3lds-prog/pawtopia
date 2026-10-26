/**
 * Sound effects, synthesized with Web Audio so every sound is original and ships with no asset licenses.
 * A soft wooden click for placements, a warm two-note chime for completions, a gentle low tap for mistakes.
 * The context is created on first use after a user gesture (iOS requirement) and every call is guarded.
 */

export type Sfx = 'place' | 'mark' | 'unit' | 'win' | 'oops' | 'coin' | 'tap';

let enabled = true;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Short pitched pluck with a quick decay: reads as a wooden tap at these pitches. */
function pluck(a: AudioContext, freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'triangle'): void {
  const o = a.createOscillator();
  const g = a.createGain();
  const f = a.createBiquadFilter();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  o.frequency.exponentialRampToValueAtTime(freq * 0.82, at + dur);
  f.type = 'lowpass';
  f.frequency.value = freq * 3.2;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(f).connect(g).connect(master!);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function bell(a: AudioContext, freq: number, at: number, dur: number, gain: number): void {
  for (const [mult, g] of [
    [1, gain],
    [2.01, gain * 0.28],
    [3.02, gain * 0.1],
  ] as const) {
    const o = a.createOscillator();
    const env = a.createGain();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(g, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(env).connect(master!);
    o.start(at);
    o.stop(at + dur + 0.05);
  }
}

export function sfx(kind: Sfx): void {
  const a = audio();
  if (!a || !master) return;
  try {
    const t = a.currentTime + 0.005;
    switch (kind) {
      case 'place':
        pluck(a, 520, t, 0.09, 0.32);
        pluck(a, 1040, t, 0.05, 0.08, 'sine');
        break;
      case 'mark':
      case 'tap':
        pluck(a, 760, t, 0.05, 0.12);
        break;
      case 'unit':
        bell(a, 784, t, 0.35, 0.12);
        bell(a, 1175, t + 0.07, 0.4, 0.09);
        break;
      case 'win':
        bell(a, 659, t, 0.6, 0.14);
        bell(a, 784, t + 0.11, 0.6, 0.13);
        bell(a, 1047, t + 0.22, 0.9, 0.13);
        break;
      case 'coin':
        bell(a, 1318, t, 0.25, 0.08);
        bell(a, 1568, t + 0.06, 0.3, 0.07);
        break;
      case 'oops':
        pluck(a, 196, t, 0.16, 0.26, 'sine');
        pluck(a, 165, t + 0.09, 0.2, 0.18, 'sine');
        break;
    }
  } catch {
    /* audio unavailable */
  }
}
