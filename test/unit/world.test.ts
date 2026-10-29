import { describe, expect, it } from 'vitest';
import { COMPANIONS } from '../../src/meta/catalogs/companions';
import { DECOR, decorHome } from '../../src/meta/catalogs/decor';
import { REGIONS, SANCTUARY_BY_ID } from '../../src/meta/catalogs/sanctuaries';
import { balance, grant } from '../../src/meta/ledger';
import { grantItem } from '../../src/meta/items';
import { buyDecor, shownDecorIds } from '../../src/meta/sanctuary';
import {
  activeRegion,
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

  it('regions open at their Journey levels, in order, for free', () => {
    expect(openRegions(atLevel(0))).toEqual([]);
    expect(nextToOpen(atLevel(0))).toMatchObject({ id: 'outback', left: 6 });
    expect(openRegions(atLevel(6))).toEqual(['outback']);
    expect(openRegions(atLevel(20))).toEqual(['outback', 'savanna']);
    expect(openRegions(atLevel(60))).toEqual(['outback', 'savanna', 'arctic', 'amazon']);
    expect(nextToOpen(atLevel(60))).toBeNull();
    const opens = REGIONS.map((r) => r.opensAfterLevel);
    expect([...opens].sort((a, b) => a - b)).toEqual(opens);
  });

  it('every regional animal arrives at a stage, three per region', () => {
    for (const r of REGIONS) {
      const here = COMPANIONS.filter((c) => c.sanctuary === r.id);
      expect(here.map((c) => c.stage)).toEqual([1, 2, 3]);
      expect(r.stages.map((s) => s.at)).toEqual([0, 3, 8, 15, 25]);
    }
  });
});

describe('growing a sanctuary', () => {
  it('only counts solved puzzles outside Paw Cup and the guided first board', () => {
    expect(countsForGrowth({ kind: 'level', level: 3 }, false)).toBe(true);
    expect(countsForGrowth({ kind: 'daily', dateKey: '2026-10-28' }, false)).toBe(true);
    expect(countsForGrowth({ kind: 'zen', size: 6, seed: 1 } as never, false)).toBe(true);
    expect(countsForGrowth({ kind: 'cup', week: '2026-W44', board: 1 } as never, false)).toBe(false);
    expect(countsForGrowth({ kind: 'level', level: 1 }, true)).toBe(false);
  });

  it('nothing grows before a region opens', () => {
    const s = atLevel(3);
    expect(growOnSolve(s, openRegions(s), NOW)).toBeNull();
    expect(s.world.growth).toEqual({});
  });

  it('announces a region opening on the solve that opens it', () => {
    const s = atLevel(5);
    const before = openRegions(s);
    s.journey.nextLevel = 7; // the win that clears level 6
    const news = growOnSolve(s, before, NOW)!;
    expect(news.opened).toEqual(['outback']);
    expect(news.sanctuary).toBe('outback');
    expect(news.growth).toBe(1);
  });

  it('grows through the stages, welcomes each animal once, and completes with one coin gift', () => {
    const s = atLevel(10);
    const news = solve(s, 25);
    expect(news[1]!.stageUp).toBeNull();
    expect(news[2]!.stageUp?.name).toBe('First friend');
    expect(news[2]!.arrived).toEqual(['gumnut']);
    expect(news[7]!.arrived).toEqual(['skipper']);
    expect(news[14]!.arrived).toEqual(['dozer']);
    expect(news.flatMap((n) => n!.arrived)).toEqual(['gumnut', 'skipper', 'dozer']);
    expect(news[24]!.completed).toBe(true);
    expect(news[24]!.coins).toBe(150);
    expect(isComplete(s, 'outback')).toBe(true);
    expect(balance(s)).toBe(150);
    // Complete: nothing else to build until the Savanna opens.
    expect(activeRegion(s)).toBeNull();
    expect(growOnSolve(s, openRegions(s), NOW)).toBeNull();
    expect(s.world.growth.outback).toBe(25);
    // The completion gift is idempotent even if the stage is re-derived.
    expect(grant(s, 'world:complete:outback', 150, 'gift', NOW)).toBe(false);
  });

  it('you build one sanctuary at a time and can switch; progress elsewhere is kept', () => {
    const s = atLevel(25);
    expect(activeRegion(s)).toBe('outback');
    solve(s, 4);
    expect(setActive(s, 'savanna')).toBe(true);
    solve(s, 2);
    expect(s.world.growth).toEqual({ outback: 4, savanna: 2 });
    expect(setActive(s, 'arctic')).toBe(false); // not open yet
    expect(stageOf(s, 'outback')).toBe(1);
    expect(nextStage(s, 'savanna')).toMatchObject({ have: 2, need: 3 });
    const done = atLevel(25);
    done.world.growth.outback = 25;
    expect(setActive(done, 'outback')).toBe(false); // complete
    expect(activeRegion(done)).toBe('savanna');
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
    // Junk is dropped, not trusted.
    const junk = normalizeSave({ ...JSON.parse(JSON.stringify(s)), world: { active: 7, growth: { outback: 'lots' }, visited: null } }, NOW);
    expect(junk.world.active).toBeNull();
    expect(junk.world.growth.outback).toBeUndefined();
  });

  it('chats only about what happened', () => {
    const s = atLevel(10);
    expect(regionChat(s, 'outback', NOW)).toBeNull();
    solve(s, 3);
    expect(regionChat(s, 'outback', NOW)).toBe('Gumnut is still exploring the new home.');
    const later = new Date(2026, 10, 5, 12, 0, 0);
    expect(regionChat(s, 'outback', later)).toBe('Gumnut is watching the land grow: 5 more puzzles until shelter.');
  });
});

describe('regional decorations', () => {
  it('belong to one sanctuary, have art, and can be bought only once it is open', () => {
    for (const d of DECOR) expect(hasDecorArt(d.id), d.id).toBe(true);
    for (const id of Object.keys(REGION_DECOR_ART)) expect(decorHome(DECOR.find((d) => d.id === id)!), id).not.toBe('harmony');
    const s = atLevel(3);
    grant(s, 'test:coins', 500, 'gift', NOW);
    expect(buyDecor(s, 'campfire', NOW)).toBe('locked');
    expect(balance(s)).toBe(500);
    s.journey.nextLevel = 7;
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

  it('every region has a place, an accent and an honest blurb', () => {
    for (const r of REGIONS) {
      expect(SANCTUARY_BY_ID[r.id].place.length).toBeGreaterThan(3);
      expect(r.accent).toMatch(/^#[0-9A-F]{6}$/i);
      expect(isOpen(atLevel(r.opensAfterLevel), r.id as never)).toBe(true);
      expect(isOpen(atLevel(r.opensAfterLevel - 1), r.id as never)).toBe(false);
    }
  });
});
