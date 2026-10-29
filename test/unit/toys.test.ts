import { describe, expect, it } from 'vitest';
import { AMBIENT, EMOTE_CLIPS, TRICK_CLIPS, TURN_CHANNELS, ambientClip, performClip } from '../../src/three/clips';
import { CHANNELS, restPose, addPose } from '../../src/three/pose';
import { ALL_TOY_IDS, FRIEND_TOYS, PET_TOYS, toySpec } from '../../src/three/species';
import { EXPRESSIONS, exprForMood } from '../../src/three/face';
import { PETS } from '../../src/meta/catalogs/pets';
import { COMPANIONS } from '../../src/meta/catalogs/companions';
import { TRICKS } from '../../src/meta/catalogs/tricks';
import { ACTION_MS } from '../../src/ui/animation/ambientDirector';
import { Toy, ToyKit } from '../../src/three/toy';
import { hasEffect } from '../../src/three/effects';

const TAU = Math.PI * 2;
const near0 = (k: string, v: number) => ((TURN_CHANNELS as readonly string[]).includes(k) ? Math.abs(((v % TAU) + TAU + Math.PI) % TAU - Math.PI) : Math.abs(v));

describe('3D toys (D34)', () => {
  it('every resident and wildlife friend has a toy', () => {
    for (const p of PETS) expect(PET_TOYS[p.id], p.id).toBeDefined();
    for (const c of COMPANIONS) expect(FRIEND_TOYS[c.id], c.id).toBeDefined();
    expect(ALL_TOY_IDS.length).toBe(PETS.length + COMPANIONS.length);
    for (const id of ALL_TOY_IDS) {
      const s = toySpec(id)!;
      for (const c of [s.fur, s.shade, s.light, s.dark, s.inner, s.snout.color, s.snout.nose, s.tail.color]) expect(c, `${id} ${c}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(s.head.every((v) => v > 0.3 && v < 1)).toBe(true);
    }
  });

  it('every toy builds (without a canvas), with a rig the clips can move', () => {
    const kit = new ToyKit();
    for (const id of ALL_TOY_IDS) {
      const toy = new Toy(toySpec(id)!, kit, 'happy');
      expect(toy.hits.length, id).toBeGreaterThan(6);
      expect(toy.height, id).toBeGreaterThan(0.6);
      expect(toy.height, id).toBeLessThan(1.8);
      const p = restPose();
      for (const c of CHANNELS) p[c] = Math.sin(c.length) * 0.8;
      toy.setPose(p);
      toy.root.updateMatrixWorld(true);
      toy.root.traverse((o) => expect(o.matrixWorld.elements.every(Number.isFinite), `${id} ${o.type}`).toBe(true));
      toy.dispose();
    }
    kit.dispose();
  });

  it('faces: every mood maps to an expression', () => {
    for (const m of ['idle', 'happy', 'sleepy', 'proud', 'curious', 'focused', 'confused', 'celebrate', undefined]) expect(EXPRESSIONS).toContain(exprForMood(m));
  });
});

describe('3D clips', () => {
  const all = { ...Object.fromEntries(Object.entries(AMBIENT).map(([k, v]) => [`ambient:${k}`, v])), ...Object.fromEntries(Object.entries(TRICK_CLIPS).map(([k, v]) => [`trick:${k}`, v])), ...Object.fromEntries(Object.entries(EMOTE_CLIPS).map(([k, v]) => [`emote:${k}`, v])) };

  it('start and end at rest (so one can follow another), and never break', () => {
    for (const [name, clip] of Object.entries(all))
      for (const body of ['sit', 'bird', 'seal', 'upright'] as const)
        for (const dir of [1, -1] as const) {
          const ctx = { body, dir, seed: 7 };
          for (const t of [0, 1]) {
            const f = clip.frame(t, ctx);
            for (const [k, v] of Object.entries(f.pose)) expect(near0(k, v as number), `${name} ${k} at t=${t}`).toBeLessThan(0.03);
          }
          for (let i = 0; i <= 60; i++) {
            const f = clip.frame(i / 60, ctx);
            const p = addPose(restPose(), f.pose);
            for (const c of CHANNELS) expect(Number.isFinite(p[c]), `${name} ${c}`).toBe(true);
            expect(Math.abs(p.px), `${name} px`).toBeLessThan(1.25);
            expect(p.py, `${name} py`).toBeLessThan(1.3);
            expect(p.py, `${name} py`).toBeGreaterThan(-0.15);
            if (f.face) expect(EXPRESSIONS).toContain(f.face);
          }
        }
  });

  it('every trick has a 3D performance as long as the trick itself', () => {
    for (const t of TRICKS) {
      const clip = performClip(t.id);
      expect(clip, t.id).not.toBeNull();
      expect(clip!.ms, t.id).toBe(t.ms);
    }
  });

  it('every everyday move the director plays has a 3D version', () => {
    for (const a of ['blink', 'look', 'yawn', 'wag', 'stretch', 'hop', 'love', 'greet', 'stroll', 'flutter'] as const) {
      expect(ambientClip(a), a).not.toBeNull();
      expect(ACTION_MS[a]).toBeGreaterThan(0);
    }
  });

  it('travelling clips go the way they are told (toward the middle of the scene)', () => {
    for (const id of ['rainbow', 'rollover']) {
      const right = TRICK_CLIPS[id].frame(0.6, { body: 'sit', dir: 1, seed: 1 }).pose.px!;
      const left = TRICK_CLIPS[id].frame(0.6, { body: 'sit', dir: -1, seed: 1 }).pose.px!;
      expect(right, id).toBeGreaterThan(0.2);
      expect(left, id).toBeLessThan(-0.2);
    }
  });
});

describe('3D props', () => {
  it('every premium trick and emote, and most others, bring props of their own; a pat brings a heart', () => {
    const bubbleOnly = ['wave', 'spin'];
    for (const t of TRICKS) expect(hasEffect(`perform:${t.id}`), t.id).toBe(!bubbleOnly.includes(t.id));
    expect(hasEffect('ambient:love')).toBe(true);
  });
});
