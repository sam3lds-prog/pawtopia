import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTION_MS, AmbientDirector, GAP_MS, MAX_ACTIVE, type AmbientAction } from '../../src/ui/animation/ambientDirector';
import type { Clock } from '../../src/ui/animation/faceDirector';
import { COMPANIONS } from '../../src/meta/catalogs/companions';
import { PETS, isPetId } from '../../src/meta/catalogs/pets';
import { applyLevelRewards, arrivalLevels, nextArrival, reconcileRewards, unlockedCompanions } from '../../src/meta/rewards';
import { patFriend, pattedToday, sanctuaryChat } from '../../src/meta/sanctuary';
import { sanctuaryScene } from '../../src/ui/art/sanctuary';
import { defaultSave, normalizeSave } from '../../src/services/storage';

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
      const due = [...this.timers.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.timers.delete(due[0]);
      this.t = due[1].at;
      due[1].fn();
    }
    this.t = end;
  }
}

function setup(reducedMotion = false) {
  const clock = new FakeClock();
  const log: Array<{ t: number; kind: 'play' | 'end'; id: string; action: AmbientAction }> = [];
  let active = 0;
  let maxSeen = 0;
  const d = new AmbientDirector({
    clock,
    seed: 7,
    reducedMotion,
    play: (id, action) => {
      active++;
      maxSeen = Math.max(maxSeen, active);
      log.push({ t: clock.t, kind: 'play', id, action });
    },
    end: (id, action) => {
      active--;
      log.push({ t: clock.t, kind: 'end', id, action });
    },
  });
  for (const id of ['mochi', 'biscuit', 'pip', 'nori', 'friend:ember']) d.add({ id, actions: ['blink', 'wag', 'stretch', 'hop'] });
  d.add({ id: 'decor:fountain', actions: ['sparkle'] });
  return { clock, d, log, peak: () => maxSeen, active: () => active };
}

describe('sanctuary ambient life', () => {
  it('plays one small action every 5–12 s, never more than two at once, and ends each on time', () => {
    const { clock, d, log, peak } = setup();
    d.setLive(true);
    clock.advance(10 * 60_000);
    const plays = log.filter((e) => e.kind === 'play');
    expect(plays.length).toBeGreaterThan(40);
    for (let i = 1; i < plays.length; i++) {
      const gap = plays[i].t - plays[i - 1].t;
      expect(gap).toBeGreaterThanOrEqual(GAP_MS[0]);
      expect(gap).toBeLessThanOrEqual(GAP_MS[1]);
    }
    for (const p of plays) {
      const end = log.find((e) => e.kind === 'end' && e.id === p.id && e.t >= p.t);
      expect(end!.t - p.t).toBe(ACTION_MS[p.action]);
    }
    expect(peak()).toBeLessThanOrEqual(MAX_ACTIVE);
    expect(d.timerCount).toBeLessThanOrEqual(1 + MAX_ACTIVE);
  });

  it('is deterministic for a seed (no synchronized loops, but the same calm sequence)', () => {
    const a = setup();
    const b = setup();
    a.d.setLive(true);
    b.d.setLive(true);
    a.clock.advance(120_000);
    b.clock.advance(120_000);
    expect(a.log).toEqual(b.log);
    expect(new Set(a.log.filter((e) => e.kind === 'play').map((e) => e.id)).size).toBeGreaterThan(2);
  });

  it('pausing (screen hidden or left) ends what is playing and leaves no timers', () => {
    const { clock, d, active } = setup();
    d.setLive(true);
    clock.advance(GAP_MS[1] + 10);
    d.setLive(false);
    expect(active()).toBe(0);
    expect(clock.pending).toBe(0);
    clock.advance(60_000);
    expect(active()).toBe(0);
  });

  it('a tap plays even when paused, and makes room instead of exceeding the cap', () => {
    const { d, peak } = setup();
    expect(d.trigger('mochi', 'love')).toBe(true);
    expect(d.trigger('biscuit', 'wag')).toBe(true);
    expect(d.trigger('pip', 'hop')).toBe(true);
    expect(d.activeCount).toBe(MAX_ACTIVE);
    expect(peak()).toBeLessThanOrEqual(MAX_ACTIVE);
    expect(d.trigger('nobody', 'love')).toBe(false);
  });

  it('under reduced motion nothing runs by itself, and a tap only changes a face', () => {
    const { clock, d, log } = setup(true);
    d.setLive(true);
    clock.advance(5 * 60_000);
    expect(log).toHaveLength(0);
    expect(d.trigger('mochi', 'wag')).toBe(false);
    expect(d.trigger('mochi', 'love')).toBe(true);
    expect(d.trigger('mochi', 'blink')).toBe(true);
  });

  it('dispose clears every timer', () => {
    const { clock, d } = setup();
    d.setLive(true);
    d.trigger('mochi', 'love');
    d.dispose();
    expect(clock.pending).toBe(0);
  });

  it('every action is short', () => {
    for (const ms of Object.values(ACTION_MS)) expect(ms).toBeLessThanOrEqual(1800);
  });
});

describe('sanctuary motion stays in the sanctuary', () => {
  const css = readFileSync('src/ui/styles/sanctuary-life.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('every rule is scoped to the sanctuary scene or its own small parts, never the board', () => {
    for (const [, sel] of css.matchAll(/([^{}@]+)\{[^{}]*\}/g)) {
      for (const one of sel.split(',').map((s) => s.trim())) {
        if (!one || /^(\d+%|from|to)$/.test(one)) continue; // keyframe steps
        expect(one, one).toMatch(/\.sanctuary__scene|\.sanctuary__chat|\.friend|\.affection/);
        expect(one).not.toMatch(/\.cell|\.board/);
      }
    }
  });

  it('nothing loops forever and every animation is short', () => {
    expect(css).not.toMatch(/infinite/);
    for (const [, ms] of css.matchAll(/animation:\s*[\w-]+\s+(\d+)ms/g)) expect(Number(ms)).toBeLessThanOrEqual(1800);
  });
});

describe('wildlife companions', () => {
  it('are a separate model: never a puzzle species, and only the finished ones are listed', () => {
    for (const c of COMPANIONS) expect(isPetId(c.id)).toBe(false);
    expect(COMPANIONS.map((c) => [c.id, c.unlockLevel])).toEqual([
      ['ember', 30],
      ['maple', 45],
    ]);
  });

  it('arrive on their level, once, and are back-dated for players already past it', () => {
    const s = defaultSave();
    s.journey.clears.L30 = { firstClearAt: 'x', bestSeconds: 1, bestMistakes: 0, clean: false, hintFree: false, stars: 1 };
    expect(applyLevelRewards(s, 30, s.journey.clears.L30).companions).toEqual(['ember']);
    expect(applyLevelRewards(s, 30, s.journey.clears.L30).companions).toEqual([]);
    const old = defaultSave();
    for (let L = 1; L <= 50; L++) old.journey.clears[`L${L}`] = { firstClearAt: 'x', bestSeconds: 1, bestMistakes: 0, clean: false, hintFree: false, stars: 1 };
    expect(reconcileRewards(old).companions).toEqual(['ember', 'maple']);
    expect(unlockedCompanions(normalizeSave(JSON.parse(JSON.stringify(old))))).toEqual(['ember', 'maple']);
  });

  it('the path marks only levels where someone really arrives, and the next arrival is honest', () => {
    const levels = arrivalLevels();
    for (const p of PETS) expect(levels.has(p.unlockLevel)).toBe(true);
    expect(levels.has(30) && levels.has(45)).toBe(true);
    expect(levels.has(25) || levels.has(35) || levels.has(40)).toBe(false);
    const s = defaultSave();
    for (const p of PETS) s.inventory.pets[p.id] = { unlockedAt: 'x' };
    expect(nextArrival(s, 24)).toEqual({ name: 'Ember', level: 30 });
    s.inventory.companions.ember = { unlockedAt: 'x' };
    expect(nextArrival(s, 31)).toEqual({ name: 'Maple', level: 45 });
    s.inventory.companions.maple = { unlockedAt: 'x' };
    expect(nextArrival(s, 46)).toBeNull();
  });

  it('appear in the scene only when welcomed; Maple naps in the blossom tree when it is out', () => {
    const none = sanctuaryScene({ decor: [], pets: [] });
    expect(none).not.toMatch(/data-friend=/);
    const withTree = sanctuaryScene({ decor: ['tree'], pets: [], companions: ['ember', 'maple'] });
    expect(withTree).toMatch(/data-friend="ember"/);
    expect(withTree).toMatch(/data-habitat="woodland"/);
    const noTree = sanctuaryScene({ decor: [], pets: [], companions: ['maple'] });
    const mapleAt = (svg: string) => svg.match(/data-friend="maple"[\s\S]*?translate\(([\d.]+) /)?.[1];
    expect(mapleAt(withTree)).toBe('42.0'); // up on the branch
    expect(mapleAt(noTree)).toBe('180.0'); // on the lawn by the cottage
  });

  it('fireflies and the dusk wash only in the evening', () => {
    expect(sanctuaryScene({ decor: [], pets: ['mochi'], evening: true })).toMatch(/sp-fireflies/);
    expect(sanctuaryScene({ decor: [], pets: ['mochi'], evening: false })).not.toMatch(/sp-fireflies/);
  });
});

describe('pats and small talk', () => {
  const NOW = new Date(2026, 9, 26, 15, 0, 0);

  it('a pat adds one heart of affection, once a day', () => {
    const s = defaultSave(NOW);
    expect(patFriend(s, 'mochi', NOW)).toBe(true);
    expect(patFriend(s, 'mochi', NOW)).toBe(false);
    expect(pattedToday(s, 'mochi', NOW)).toBe(true);
    expect(patFriend(s, 'mochi', new Date(2026, 9, 27, 9, 0, 0))).toBe(true);
    expect(s.sanctuary.affection.mochi).toBe(2);
    expect(normalizeSave(JSON.parse(JSON.stringify(s)), NOW).sanctuary.affection.mochi).toBe(2);
  });

  it('only says things that happened', () => {
    const s = defaultSave(NOW);
    expect(sanctuaryChat(s, NOW)).toBeNull();
    s.inventory.pets.mochi = { unlockedAt: new Date(2026, 8, 1).toISOString() };
    expect(sanctuaryChat(s, NOW)).toBe('Mochi is glad you stopped by.');
    s.stats.lastWin = { size: 7, tier: 'expert', mode: 'level', at: new Date(2026, 9, 25, 20, 0, 0).toISOString() };
    expect(sanctuaryChat(s, NOW)).toBe('Mochi thinks your last Expert 7×7 was impressive!');
    s.stats.lastWin = { size: 6, tier: 'easy', mode: 'level', at: NOW.toISOString() };
    expect(sanctuaryChat(s, NOW)).toBe('Mochi saw you solve a 6×6 today.');
    s.stats.lastWin = { size: 7, tier: 'expert', mode: 'level', at: new Date(2026, 9, 10).toISOString() };
    expect(sanctuaryChat(s, NOW)).toBe('Mochi is glad you stopped by.');
  });
});
