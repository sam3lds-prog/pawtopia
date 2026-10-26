import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FaceMachine, MOOD_SPEC, BLINK_EVERY_MS, CELEBRATE_TOTAL_MS, MAX_CONCURRENT, SLEEPY_AFTER_MS, type FaceMood, type FaceView } from '../../src/ui/animation/faceMachine';
import { FaceDirector, lookToward, type Clock } from '../../src/ui/animation/faceDirector';
import { petSvg, poseFor } from '../../src/ui/art/pets';
import { rosterFor, tilePetId } from '../../src/ui/art/petTiles';
import { PETS } from '../../src/meta/catalogs/pets';
import { CAT, DOG } from '../../src/engine/types';
import { defaultSave } from '../../src/services/storage';

/** Deterministic fake clock: timers fire only when the test advances time. */
class FakeClock implements Clock {
  t = 0;
  private id = 0;
  private timers = new Map<number, { at: number; fn: () => void }>();
  now() {
    return this.t;
  }
  set(fn: () => void, ms: number) {
    const id = ++this.id;
    this.timers.set(id, { at: this.t + ms, fn });
    return id;
  }
  clear(id: number) {
    this.timers.delete(id);
  }
  get pending() {
    return this.timers.size;
  }
  advance(ms: number) {
    const end = this.t + ms;
    for (;;) {
      let next: [number, { at: number; fn: () => void }] | null = null;
      for (const e of this.timers) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
      if (!next) break;
      this.timers.delete(next[0]);
      this.t = next[1].at;
      next[1].fn();
    }
    this.t = end;
  }
}

function recorder() {
  const views: FaceView[] = [];
  return { views, target: { apply: (v: FaceView) => views.push(v) } };
}

const MOODS: FaceMood[] = ['idle', 'blink', 'curious', 'happy', 'confused', 'proud', 'focused', 'sleepy', 'celebrate'];

describe('face state machine', () => {
  it('a stronger reaction wins; a weaker one cannot interrupt it', () => {
    const m = new FaceMachine();
    expect(m.react('happy', 0, 500)).toBe(true);
    expect(m.react('curious', 100, 300)).toBe(false);
    expect(m.view(100).mood).toBe('happy');
    expect(m.react('proud', 200, 500)).toBe(true);
    expect(m.view(300).mood).toBe('proud');
  });

  it('reactions expire back to the resting mood', () => {
    const m = new FaceMachine();
    m.react('confused', 0, 300);
    expect(m.view(299).mood).toBe('confused');
    expect(m.view(300).mood).toBe('idle');
    m.base = 'sleepy';
    expect(m.view(400).mood).toBe('sleepy');
  });

  it('blinks only with open eyes, and a reaction cancels a blink in progress', () => {
    const m = new FaceMachine();
    expect(m.blink(0, 160)).toBe(true);
    expect(m.view(50).blinking).toBe(true);
    expect(m.view(160).blinking).toBe(false);
    m.react('proud', 200, 500); // eyes closed in a smile
    expect(m.blink(250, 160)).toBe(false);
    const n = new FaceMachine();
    n.blink(0, 200);
    n.react('happy', 50, 500);
    expect(n.view(60).blinking).toBe(false);
  });

  it('cancel ends everything immediately', () => {
    const m = new FaceMachine();
    m.react('celebrate', 0, 500);
    m.cancel();
    expect(m.view(1).mood).toBe('idle');
  });

  it('pupil glances are clamped inside the eye', () => {
    const m = new FaceMachine();
    m.react('curious', 0, 400, [9, -9]);
    expect(m.view(1).look).toEqual([1.6, -1.6]);
  });
});

describe('face director (scheduler)', () => {
  it('idle blinks are staggered per tile and fall inside the 4–9 s window', () => {
    const clock = new FakeClock();
    const d = new FaceDirector({ clock, seed: 42, reducedMotion: false });
    const firstBlink = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const key = `0,${i}`;
      d.add(key, 'cat', { apply: (v) => v.blinking && !firstBlink.has(key) && firstBlink.set(key, clock.t) });
    }
    clock.advance(BLINK_EVERY_MS[1] + 10);
    expect(firstBlink.size).toBe(12);
    const times = [...firstBlink.values()];
    for (const t of times) {
      expect(t).toBeGreaterThanOrEqual(BLINK_EVERY_MS[0]);
      expect(t).toBeLessThanOrEqual(BLINK_EVERY_MS[1]);
    }
    expect(new Set(times).size).toBeGreaterThan(8); // not in sync
    d.dispose();
  });

  it('caps concurrent reactions at three, retiring the oldest', () => {
    const clock = new FakeClock();
    const d = new FaceDirector({ clock, seed: 1, reducedMotion: false });
    for (let i = 0; i < 5; i++) d.add(`k${i}`, 'dog', { apply: () => {} });
    for (let i = 0; i < 5; i++) {
      d.react(`k${i}`, 'happy');
      clock.advance(10);
    }
    expect(d.activeReactions()).toHaveLength(MAX_CONCURRENT);
    expect(d.activeReactions()).toEqual(['k2', 'k3', 'k4']);
    d.dispose();
  });

  it('the win wave reaches every pet and finishes within 1.5 s', () => {
    const clock = new FakeClock();
    const d = new FaceDirector({ clock, seed: 3, reducedMotion: false });
    const celebrated = new Map<string, number>();
    const keys = Array.from({ length: 18 }, (_, i) => `p${i}`);
    for (const k of keys) d.add(k, 'cat', { apply: (v) => v.mood === 'celebrate' && !celebrated.has(k) && celebrated.set(k, clock.t) });
    d.celebrate(keys);
    clock.advance(CELEBRATE_TOTAL_MS);
    expect(celebrated.size).toBe(18);
    expect(d.activeReactions()).toHaveLength(0); // all back to rest by 1.5 s
    d.dispose();
  });

  it('removing a pet (cleared / undone) cancels its pending animation', () => {
    const clock = new FakeClock();
    const d = new FaceDirector({ clock, seed: 9, reducedMotion: false });
    const { views, target } = recorder();
    d.add('a', 'cat', target);
    d.react('a', 'happy');
    const before = views.length;
    d.remove('a');
    clock.advance(20_000);
    expect(views.length).toBe(before); // nothing fired into a removed tile
    expect(d.has('a')).toBe(false);
    d.dispose();
  });

  it('undo calms every face immediately', () => {
    const clock = new FakeClock();
    const d = new FaceDirector({ clock, seed: 9, reducedMotion: false });
    d.add('a', 'cat', { apply: () => {} });
    d.add('b', 'dog', { apply: () => {} });
    d.react('a', 'proud');
    d.react('b', 'proud');
    d.calmAll();
    expect(d.activeReactions()).toHaveLength(0);
    expect(d.view('a')?.mood).toBe('idle');
    d.dispose();
  });

  it('reduced motion: no idle blinks, but reactions still change the face', () => {
    const clock = new FakeClock();
    const d = new FaceDirector({ clock, seed: 5, reducedMotion: true });
    const { views, target } = recorder();
    d.add('a', 'cat', target);
    clock.advance(30_000);
    expect(views.some((v) => v.blinking)).toBe(false);
    d.react('a', 'happy');
    expect(d.view('a')?.mood).toBe('happy');
    d.dispose();
  });

  it('ambient life pauses while the board is paused or hidden', () => {
    const clock = new FakeClock();
    const d = new FaceDirector({ clock, seed: 5, reducedMotion: false });
    const { views, target } = recorder();
    d.add('a', 'cat', target);
    d.setAmbient(false);
    clock.advance(60_000);
    expect(views.some((v) => v.blinking || v.mood === 'sleepy')).toBe(false);
    d.dispose();
  });

  it('pets doze off after a quiet spell and wake on the next input', () => {
    const clock = new FakeClock();
    const d = new FaceDirector({ clock, seed: 5, reducedMotion: false });
    d.add('a', 'dog', { apply: () => {} });
    clock.advance(SLEEPY_AFTER_MS + 1);
    expect(d.view('a')?.mood).toBe('sleepy');
    d.activity();
    expect(d.view('a')?.mood).toBe('idle');
    d.dispose();
  });

  it('dispose leaves no timers behind (screen change)', () => {
    const clock = new FakeClock();
    const d = new FaceDirector({ clock, seed: 5, reducedMotion: false });
    for (let i = 0; i < 6; i++) d.add(`k${i}`, 'cat', { apply: () => {} });
    d.celebrate(['k0', 'k1', 'k2', 'k3', 'k4', 'k5']);
    d.react('k0', 'happy');
    expect(clock.pending).toBeGreaterThan(0);
    d.dispose();
    expect(clock.pending).toBe(0);
    expect(d.react('k1', 'happy')).toBe(false);
  });

  it('a curious glance picks one pet of the chosen species', () => {
    const clock = new FakeClock();
    const d = new FaceDirector({ clock, seed: 5, reducedMotion: false });
    d.add('c1', 'cat', { apply: () => {} });
    d.add('d1', 'dog', { apply: () => {} });
    d.add('c2', 'cat', { apply: () => {} });
    expect(d.curiousOne('cat', [0, 1])).toBe('c2');
    expect(d.activeReactions()).toEqual(['c2']);
    d.dispose();
  });
});

describe('facial-only guarantees', () => {
  it('transforms in pets.css target only eyes (pupils, lids) and brows', () => {
    const css = readFileSync('src/ui/styles/pets.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const allowed = /\.pf-(look|lid|brow--l|brow--r)\b/;
    let checked = 0;
    for (const [, sel, body] of rules) {
      if (!/(^|;|\s)transform\s*:/.test(body)) continue;
      for (const one of sel.split(',')) {
        expect(one.trim(), `transform on "${one.trim()}"`).toMatch(allowed);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(4);
    expect(css).not.toMatch(/@keyframes/); // faces use transitions between poses, no free-running loops
  });

  it('board pets never move: no transform or animation on tile pets, and the miss ghost only fades', () => {
    const css = readFileSync('src/ui/styles/board.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (/cell__pet|\.pet\b/.test(sel)) expect(body).not.toMatch(/transform|animation/);
    }
    const ghost = css.match(/@keyframes ghost\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(ghost).toMatch(/opacity/);
    expect(ghost).not.toMatch(/transform|scale|translate/);
  });

  it('the static head layer carries no animated parts', () => {
    for (const p of PETS) {
      const svg = petSvg(p.id);
      const head = svg.match(/<g data-layer="head-static">([\s\S]*?)<\/g><g data-layer="cheeks">/)?.[1] ?? '';
      expect(head.length).toBeGreaterThan(100);
      expect(head).not.toMatch(/class="pf-/);
      for (const layer of ['cheeks', 'eyes', 'lids', 'brows', 'mouth']) expect(svg).toContain(`data-layer="${layer}"`);
    }
  });

  it('every pet has a valid pose for every mood', () => {
    for (const p of PETS)
      for (const m of MOODS) {
        const pose = poseFor(p.id, m, false, [3, 3]);
        expect(Math.abs(pose.px)).toBeLessThanOrEqual(1.6);
        expect(Math.abs(pose.py)).toBeLessThanOrEqual(1.6);
        expect(pose.lid).toBeGreaterThanOrEqual(0);
        expect(pose.lid).toBeLessThanOrEqual(1.05);
        expect(Math.abs(pose.blr)).toBeLessThanOrEqual(15);
        expect(Math.abs(pose.brr)).toBeLessThanOrEqual(15);
        expect(Math.abs(pose.bly)).toBeLessThanOrEqual(3);
      }
  });

  it('reaction durations stay inside the spec table', () => {
    expect(MOOD_SPEC.happy.ms).toEqual([420, 650]);
    expect(MOOD_SPEC.confused.ms).toEqual([280, 450]);
    expect(MOOD_SPEC.celebrate.ms[1]).toBeLessThanOrEqual(550);
  });
});

describe('no answer leaks', () => {
  it("a tile's pet depends on region, seed and roster only — not on the solution", () => {
    const roster = { cat: ['mochi', 'pip', 'clover'], dog: ['biscuit', 'nori'] } as const;
    const regions = [
      [0, 0, 1],
      [2, 1, 1],
      [2, 2, 1],
    ];
    const a = { regions, seed: 11 };
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        // Same answer for any cell in the same region: the solution never enters the choice.
        const id = tilePetId(a, r, c, CAT, { cat: [...roster.cat], dog: [...roster.dog] });
        for (let rr = 0; rr < 3; rr++)
          for (let cc = 0; cc < 3; cc++)
            if (regions[rr][cc] === regions[r][c]) expect(tilePetId(a, rr, cc, CAT, { cat: [...roster.cat], dog: [...roster.dog] })).toBe(id);
      }
  });

  it('glance direction depends only on the two tile positions', () => {
    expect(lookToward({ r: 2, c: 2 }, { r: 2, c: 3 })).toEqual([1.4, 0]);
    expect(lookToward({ r: 2, c: 2 }, { r: 1, c: 1 })).toEqual([-1.4, -1]);
  });

  it('a new player sees the founding pair; unlocked pets join the roster', () => {
    const s = defaultSave();
    expect(rosterFor(s)).toEqual({ cat: ['mochi'], dog: ['biscuit'] });
    s.inventory.pets.pip = { unlockedAt: 'x' };
    s.inventory.pets.nori = { unlockedAt: 'x' };
    expect(rosterFor(s)).toEqual({ cat: ['mochi', 'pip'], dog: ['biscuit', 'nori'] });
    expect(['biscuit', 'nori']).toContain(tilePetId({ regions: [[0]], seed: 1 }, 0, 0, DOG, rosterFor(s)));
  });
});
