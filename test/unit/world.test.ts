import { describe, expect, it } from 'vitest';
import { COMPANIONS } from '../../src/meta/catalogs/companions';
import { DECOR, decorHome } from '../../src/meta/catalogs/decor';
import { PETS } from '../../src/meta/catalogs/pets';
import { EXOTIC, REGIONS, SANCTUARIES, SANCTUARY_BY_ID, homeOf } from '../../src/meta/catalogs/sanctuaries';
import { nextArrivalIn } from '../../src/meta/animals';
import { castFor, castWord, parseCast } from '../../src/meta/cast';
import { balance, grant } from '../../src/meta/ledger';
import { grantItem } from '../../src/meta/items';
import { buyDecor, shownDecorIds } from '../../src/meta/sanctuary';
import {
  activeSanctuary,
  arrivalProgress,
  countsForGrowth,
  growOnSolve,
  isComplete,
  isOpen,
  nextStage,
  nextToOpen,
  openRegions,
  reconcileWorld,
  regionChat,
  setActive,
  stageOf,
} from '../../src/meta/world';
import { regionScene, REGION_DECOR_ART } from '../../src/ui/art/regions';
import { hasDecorArt } from '../../src/ui/art/sanctuary';
import { projectLonLat } from '../../src/ui/art/worldMap';
import { defaultSave, normalizeSave, type SaveV2 } from '../../src/services/storage';

const NOW = new Date(2026, 9, 28, 12, 0, 0);

function atLevel(cleared: number): SaveV2 {
  const s = defaultSave(NOW);
  s.journey.nextLevel = cleared + 1;
  return s;
}

/** Solves `n` puzzles for whichever sanctuary is being built; returns the news of each. */
function solve(s: SaveV2, n: number) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(growOnSolve(s, openRegions(s), NOW));
  return out;
}

describe('world map', () => {
  it('places pins with the same Natural Earth projection as the outline', () => {
    // Reference points printed by scripts/build-world-map.ts (d3-geo).
    const [sx, sy] = projectLonLat(151.2, -33.9);
    expect(sx).toBeCloseTo(895.3, 0);
    expect(sy).toBeCloseTo(405.8, 0);
    const [lx, ly] = projectLonLat(-0.1, 51.5);
    expect(lx).toBeCloseTo(499.8, 0);
    expect(ly).toBeCloseTo(132.3, 0);
    for (const r of REGIONS) {
      const [x, y] = projectLonLat(r.lon, r.lat);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1000);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(520);
    }
  });

  it('the Farm and the Pet Garden are open from the start; exotic regions open at their levels, in order', () => {
    expect(openRegions(atLevel(0))).toEqual(['farm']);
    expect(isOpen(atLevel(0), 'harmony')).toBe(true);
    expect(nextToOpen(atLevel(0))).toMatchObject({ id: 'outback', left: 10 });
    expect(openRegions(atLevel(10))).toEqual(['farm', 'outback']);
    expect(openRegions(atLevel(25))).toEqual(['farm', 'outback', 'savanna']);
    expect(openRegions(atLevel(60))).toEqual(['farm', 'outback', 'savanna', 'arctic', 'amazon']);
    expect(nextToOpen(atLevel(60))).toBeNull();
    const opens = EXOTIC.map((r) => r.opensAfterLevel);
    expect([...opens].sort((a, b) => a - b)).toEqual(opens);
    expect(SANCTUARIES.filter((x) => x.beginner).map((x) => x.id)).toEqual(['farm', 'harmony']);
  });

  it('a sanctuary already being built stays open even if it now opens later', () => {
    const s = atLevel(7);
    expect(isOpen(s, 'outback')).toBe(false);
    s.world.growth.outback = 2;
    expect(isOpen(s, 'outback')).toBe(true);
  });

  it('every animal lives in exactly one sanctuary and arrives in order: sheep first on the Farm, a bunny first in the Pet Garden', () => {
    const all = SANCTUARIES.flatMap((x) => x.arrivals.map((a) => a.id));
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual([...PETS.map((p) => p.id), ...COMPANIONS.map((c) => c.id)].sort());
    expect(SANCTUARY_BY_ID.farm.arrivals.map((a) => a.id)).toEqual(['cotton', 'truffle', 'buttercup', 'pepper', 'marigold', 'hazel']);
    expect(SANCTUARY_BY_ID.harmony.arrivals[0].id).toBe('juniper');
    for (const c of COMPANIONS) expect(homeOf(c.id), c.id).toBe(c.sanctuary);
    for (const p of PETS) expect(homeOf(p.id)).toBe('harmony');
    for (const x of SANCTUARIES) {
      const at = x.arrivals.map((a) => a.at);
      expect(
        [...at].sort((a, b) => a - b),
        x.id,
      ).toEqual(at);
      // Each animal takes a little longer to bring home than the one before (the gaps never shrink).
      const gaps = at.map((v, i) => v - (i ? at[i - 1] : 0));
      for (let i = 2; i < gaps.length; i++) expect(gaps[i], `${x.id} ${i}`).toBeGreaterThanOrEqual(gaps[i - 1] - 0);
    }
    for (const r of EXOTIC) {
      expect(r.arrivals.map((a) => a.at)).toEqual([3, 8, 15]);
      expect(r.stages.map((x) => x.at)).toEqual([0, 3, 8, 15, 25]);
    }
  });
});

describe('growing a sanctuary', () => {
  it('counts every solved puzzle but the Paw Cup (the guided first board brings the first animal home)', () => {
    expect(countsForGrowth({ kind: 'level', level: 3 }, false)).toBe(true);
    expect(countsForGrowth({ kind: 'daily', dateKey: '2026-10-28' }, false)).toBe(true);
    expect(countsForGrowth({ kind: 'zen', size: 6, seed: 1 } as never, false)).toBe(true);
    expect(countsForGrowth({ kind: 'cup', week: '2026-W44', board: 1 } as never, false)).toBe(false);
    expect(countsForGrowth({ kind: 'level', level: 1 }, true)).toBe(true);
  });

  it('builds the Farm first: Cotton comes home on the first solve, the others one by one, then a coin gift', () => {
    const s = atLevel(0);
    expect(activeSanctuary(s)).toBe('farm');
    expect(nextArrivalIn(s, 'farm')?.id).toBe('cotton');
    const news = solve(s, 26);
    expect(news[0]!.arrived).toEqual(['cotton']);
    expect(news[0]!.stageUp?.name).toBe('First friend');
    expect(news.flatMap((n) => n!.arrived)).toEqual(['cotton', 'truffle', 'buttercup', 'pepper', 'marigold', 'hazel']);
    expect(news[3]!.arrived).toEqual(['truffle']);
    expect(news[7]!.stageUp?.name).toBe('Barn raising');
    expect(news[25]!.completed).toBe(true);
    expect(news[25]!.coins).toBe(150);
    expect(isComplete(s, 'farm')).toBe(true);
    expect(balance(s)).toBe(150);
    // The Farm is finished: building moves on to the Pet Garden, whose bunny is next.
    expect(activeSanctuary(s)).toBe('harmony');
    expect(arrivalProgress(s, 'harmony')).toMatchObject({ next: { id: 'juniper' }, have: 0, need: 1, left: 1 });
    expect(grant(s, 'world:complete:farm', 150, 'gift', NOW)).toBe(false);
  });

  it('progress toward the next animal counts from the last arrival', () => {
    const s = atLevel(0);
    solve(s, 2);
    expect(arrivalProgress(s, 'farm')).toMatchObject({ next: { id: 'truffle' }, have: 2, need: 4, from: 1, left: 2 });
  });

  it('the Pet Garden has no stages: it completes when everyone is home', () => {
    const s = atLevel(0);
    setActive(s, 'harmony');
    const news = solve(s, 53);
    expect(news.flatMap((n) => n!.arrived)).toEqual(SANCTUARY_BY_ID.harmony.arrivals.map((a) => a.id));
    expect(news.every((n) => n!.stageUp === null)).toBe(true);
    expect(news[52]!.completed).toBe(true);
    expect(news[52]!.coins).toBe(200);
    expect(nextStage(s, 'harmony')).toBeNull();
  });

  it('you build one sanctuary at a time and can switch; progress elsewhere is kept', () => {
    const s = atLevel(25);
    expect(activeSanctuary(s)).toBe('farm');
    solve(s, 4);
    expect(setActive(s, 'savanna')).toBe(true);
    solve(s, 2);
    expect(s.world.growth).toEqual({ farm: 4, savanna: 2 });
    expect(setActive(s, 'arctic')).toBe(false); // not open yet
    expect(stageOf(s, 'farm')).toBe(1);
    expect(nextStage(s, 'savanna')).toMatchObject({ have: 2, need: 3 });
    expect(setActive(s, 'harmony')).toBe(true);
  });

  it('a lost write is repaired at startup, and the world survives a save round trip', () => {
    const s = atLevel(25);
    s.world.growth.savanna = 9;
    s.world.active = 'savanna';
    expect(reconcileWorld(s, NOW)).toEqual(['zuri', 'sunny']);
    expect(reconcileWorld(s, NOW)).toEqual([]);
    const back = normalizeSave(JSON.parse(JSON.stringify(s)), NOW);
    expect(back.world).toEqual(s.world);
    expect(back.inventory.companions.zuri).toBeTruthy();
    const junk = normalizeSave({ ...JSON.parse(JSON.stringify(s)), world: { active: 7, growth: { outback: 'lots' }, visited: null } }, NOW);
    expect(junk.world.active).toBeNull();
    expect(junk.world.growth.outback).toBeUndefined();
  });

  it('players from before D35 keep their residents and start the Pet Garden where they are in its line', () => {
    const s = atLevel(16);
    for (const id of ['mochi', 'biscuit', 'pip', 'nori', 'clover'] as const) s.inventory.pets[id] = { unlockedAt: '2026-10-01T00:00:00Z' };
    expect(s.world.growth.harmony).toBeUndefined();
    const arrived = reconcileWorld(s, NOW);
    // Clover (26 in the new line) is the latest one home, so growth starts there and the bunny moves in too.
    expect(s.world.growth.harmony).toBe(26);
    expect(arrived).toEqual(['juniper']);
    expect(nextArrivalIn(s, 'harmony')?.id).toBe('peanut');
    expect(arrivalProgress(s, 'harmony')).toMatchObject({ have: 26, need: 34, left: 8 });
    // Idempotent; and a brand-new player starts the Pet Garden at zero.
    expect(reconcileWorld(s, NOW)).toEqual([]);
    const fresh = atLevel(0);
    reconcileWorld(fresh, NOW);
    expect(fresh.world.growth.harmony).toBeUndefined();
    expect(nextArrivalIn(fresh, 'harmony')?.id).toBe('juniper');
  });

  it('chats only about what happened', () => {
    const s = atLevel(0);
    expect(regionChat(s, 'farm', NOW)).toBeNull();
    solve(s, 1);
    expect(regionChat(s, 'farm', NOW)).toBe('Cotton is still exploring the new home.');
    const later = new Date(2026, 10, 5, 12, 0, 0);
    expect(regionChat(s, 'farm', later)).toBe('Cotton is getting ready for Truffle the piglet: 3 more puzzles.');
  });
});

describe('what boards show (cast)', () => {
  it('a one-animal board shows the animal being brought home', () => {
    const s = atLevel(0);
    expect(castFor(s, 'solo', 7)).toEqual({ a: 'cotton', sanctuary: 'farm' });
    solve(s, 1);
    expect(castFor(s, 'solo', 7).a).toBe('truffle');
    setActive(s, 'harmony');
    expect(castFor(s, 'solo', 7)).toEqual({ a: 'juniper', sanctuary: 'harmony' });
  });

  it('a two-animal board pairs it with someone already home, of another kind when there is one', () => {
    const s = atLevel(30);
    solve(s, 8); // Cotton, Truffle and Buttercup are home; Pepper is next
    for (let seed = 0; seed < 20; seed++) {
      const c = castFor(s, 'pair', seed);
      expect(c.a).toBe('pepper');
      expect(['cotton', 'truffle', 'buttercup']).toContain(c.b);
    }
    // Nobody home anywhere yet: the next in line keeps it company.
    const fresh = atLevel(30);
    const c = castFor(fresh, 'pair', 3);
    expect(c.a).toBe('cotton');
    expect(c.b).toBe('truffle');
    // The Pet Garden: next is Pip (a cat) once the bunny, Biscuit and Mochi are home; partner is never another cat if a dog is home.
    const g = atLevel(30);
    setActive(g, 'harmony');
    solve(g, 8);
    for (let seed = 0; seed < 20; seed++) expect(['juniper', 'biscuit']).toContain(castFor(g, 'pair', seed).b);
  });

  it('a saved cast is checked before it is reused, and names stand in when both animals are one kind', () => {
    expect(parseCast({ a: 'cotton', sanctuary: 'farm' }, 'solo')).toEqual({ a: 'cotton', sanctuary: 'farm' });
    expect(parseCast({ a: 'cotton', sanctuary: 'farm' }, 'pair')).toBeNull();
    expect(parseCast({ a: 'cotton', b: 'cotton', sanctuary: 'farm' }, 'pair')).toBeNull();
    expect(parseCast({ a: 'dragon', sanctuary: 'farm' }, 'solo')).toBeNull();
    expect(parseCast({ a: 'pip', b: 'mochi', sanctuary: 'harmony' }, 'pair')).toEqual({ a: 'pip', b: 'mochi', sanctuary: 'harmony' });
    expect(castWord({ a: 'pip', b: 'mochi', sanctuary: 'harmony' }, 'a')).toBe('Pip');
    expect(castWord({ a: 'pip', b: 'biscuit', sanctuary: 'harmony' }, 'b')).toBe('dog');
    expect(castWord({ a: 'pepper', sanctuary: 'farm' }, 'a')).toBe('goat kid');
  });
});

describe('regional decorations', () => {
  it('belong to one sanctuary, have art, and can be bought only once it is open', () => {
    for (const d of DECOR) expect(hasDecorArt(d.id), d.id).toBe(true);
    for (const id of Object.keys(REGION_DECOR_ART)) expect(decorHome(DECOR.find((d) => d.id === id)!), id).not.toBe('harmony');
    const s = atLevel(3);
    grant(s, 'test:coins', 500, 'gift', NOW);
    // The Farm's are for sale from the start; a region's once it opens.
    expect(buyDecor(s, 'scarecrow', NOW)).toBe('ok');
    expect(buyDecor(s, 'campfire', NOW)).toBe('locked');
    expect(balance(s)).toBe(500 - 120);
    grant(s, 'test:coins2', 120, 'gift', NOW);
    s.journey.nextLevel = 11;
    expect(buyDecor(s, 'campfire', NOW)).toBe('ok');
    expect(balance(s)).toBe(500 - 120);
    expect(shownDecorIds(s, 'outback')).toEqual(['campfire']);
    expect(shownDecorIds(s)).toEqual([]);
    grantItem(s, 'test:gems', 'gem', 100, 'test', NOW);
    expect(buyDecor(s, 'opalrock', NOW)).toBe('ok');
    expect(shownDecorIds(s, 'outback')).toEqual(['campfire', 'opalrock']);
  });
});

describe('regional scenes', () => {
  it('show only the stages reached and the animals welcomed', () => {
    const wild = regionScene('outback', { stage: 0, companions: [], decor: [] });
    expect(wild).not.toMatch(/data-stage=/);
    expect(wild).toMatch(/data-sign/);
    const grown = regionScene('outback', { stage: 2, companions: ['gumnut', 'skipper'], decor: ['campfire'] });
    expect(grown).toMatch(/data-stage="1"/);
    expect(grown).toMatch(/data-stage="2"/);
    expect(grown).not.toMatch(/data-stage="3"/);
    expect(grown).toMatch(/data-friend="gumnut"/);
    expect(grown).toMatch(/data-friend="skipper"/);
    expect(grown).not.toMatch(/data-friend="dozer"/);
    expect(grown).toMatch(/data-decor="campfire"/);
    // Another region's animal or decoration never appears here.
    const other = regionScene('outback', { stage: 4, companions: ['zuri'], decor: ['igloo'] });
    expect(other).not.toMatch(/data-friend="zuri"/);
    expect(other).not.toMatch(/data-decor="igloo"/);
  });

  it('draws the aurora in the sky, behind the land', () => {
    const svg = regionScene('arctic', { stage: 1, companions: [], decor: ['aurora'] }, 'a');
    expect(svg.indexOf('data-decor="aurora"')).toBeLessThan(svg.indexOf('url(#a-snow)'));
  });

  it('the Farm grows a pasture, a barn, a pond and an orchard, and its animals stand in their spots', () => {
    const wild = regionScene('farm', { stage: 0, companions: [], decor: [] });
    expect(wild).not.toMatch(/data-stage=/);
    const all = regionScene('farm', {
      stage: 4,
      companions: ['cotton', 'truffle', 'buttercup', 'pepper', 'marigold', 'hazel'],
      decor: ['tireswing', 'tractor', 'scarecrow'],
    });
    for (const st of [1, 2, 3, 4]) expect(all).toMatch(new RegExp(`data-stage="${st}"`));
    for (const id of ['cotton', 'truffle', 'buttercup', 'pepper', 'marigold', 'hazel']) expect(all).toMatch(new RegExp(`data-friend="${id}"`));
    expect(all).toMatch(/class="sp-swing"/);
    expect(all).toMatch(/class="sp-tractor"/);
  });

  it('every region has a place, an accent and an honest blurb', () => {
    for (const r of REGIONS) {
      expect(SANCTUARY_BY_ID[r.id].place.length).toBeGreaterThan(3);
      expect(r.accent).toMatch(/^#[0-9A-F]{6}$/i);
      expect(isOpen(atLevel(r.opensAfterLevel), r.id as never)).toBe(true);
      if (r.opensAfterLevel > 0) expect(isOpen(atLevel(r.opensAfterLevel - 1), r.id as never)).toBe(false);
    }
  });
});
