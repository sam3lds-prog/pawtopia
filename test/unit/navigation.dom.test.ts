// @vitest-environment happy-dom
/**
 * The four-tab layout (D36): the router's history and scroll restoration, old route names landing on the new screens,
 * the Journey hub's one Continue, and the World's goal above its map. Real screens, mounted in a DOM.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app/app';
import { Router, canonical, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { journeyScreen } from '../../src/ui/screens/journey';
import { worldScreen } from '../../src/ui/screens/world';
import { regionScreen } from '../../src/ui/screens/region';
import { sanctuaryScreen } from '../../src/ui/screens/sanctuary';
import { gameScreen } from '../../src/ui/screens/game';
import { leagueScreen } from '../../src/ui/screens/league';
import { mountNav } from '../../src/ui/components/nav';
import { startGame } from '../../src/app/gameFlow';
import { Session } from '../../src/game/session';
import { puzzleFor } from '../../src/game/puzzles';
import { captureSession } from '../../src/game/sessionPersistence';
import { CAT, EMPTY, type Species } from '../../src/engine/types';
import { defaultSave } from '../../src/services/storage';

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
let router: Router;

function mountAll(): void {
  document.body.innerHTML = '<div id="app"></div>';
  router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['pets', 'shop', 'gallery', 'welcome', 'profile'] as const) reg[k] = blank;
  router.register({ ...reg, journey: journeyScreen, world: worldScreen, region: regionScreen, sanctuary: sanctuaryScreen, game: gameScreen, challenges: leagueScreen });
  app.router = router;
  mountNav(router);
}

const text = (sel: string) => document.querySelector(sel)?.textContent ?? '';
const el = (sel: string) => document.querySelector<HTMLElement>(sel);

/** A saved board for `mode` with one placement, as the app would save it. */
function saveBoard(mode: { kind: 'level'; level: number } | { kind: 'daily'; dateKey: string; rule?: 'solo' } | { kind: 'zen'; size: number; seed: number; rule?: 'solo' }): void {
  const s = new Session(puzzleFor(mode, 4));
  const p = s.puzzle;
  outer: for (let r = 0; r < p.size; r++)
    for (let c = 0; c < p.size; c++)
      if (p.solution[r][c] !== EMPTY && !s.givenMask[r][c]) {
        s.place(r, c, p.solution[r][c] as Species);
        break outer;
      }
  app.save.lastSession = captureSession(mode, s, new Date(), 4, { a: 'cotton', sanctuary: 'farm' }, 'test:board');
}

beforeEach(() => {
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, seenPantryIntro: true, worldTipSeen: true });
  app.save.journey.nextLevel = 8;
  app.save.world.growth.farm = 2;
  app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
  app.active = null;
  window.scrollTo = (opts?: ScrollToOptions | number) => {
    const top = typeof opts === 'number' ? opts : (opts?.top ?? 0);
    Object.defineProperty(window, 'scrollY', { value: top, configurable: true });
  };
  mountAll();
});
afterEach(() => {
  app.active = null;
});

describe('routes', () => {
  it('old names land on the new screens', () => {
    expect(canonical({ screen: 'home' })).toEqual({ screen: 'journey' });
    expect(canonical({ screen: 'play' })).toEqual({ screen: 'journey', view: 'path' });
    expect(canonical({ screen: 'play', chapter: 2 })).toEqual({ screen: 'journey', view: 'path', chapter: 2 });
    expect(canonical({ screen: 'league', tab: 'week' })).toEqual({ screen: 'challenges', tab: 'week' });
    router.go({ screen: 'home' });
    expect(document.querySelector('.journey')).not.toBeNull();
    router.go({ screen: 'league' });
    expect(text('h1')).toBe('Challenges');
  });

  it('the bottom bar has four tabs and highlights the one you are in, sanctuaries under World', () => {
    const tabs = [...document.querySelectorAll<HTMLElement>('.nav [data-tab]')].map((b) => b.dataset.tab);
    expect(tabs).toEqual(['journey', 'world', 'challenges', 'shop']);
    router.go({ screen: 'region', id: 'farm' });
    expect(el('.nav [aria-current="page"]')?.dataset.tab).toBe('world');
    router.go({ screen: 'sanctuary' });
    expect(el('.nav [aria-current="page"]')?.dataset.tab).toBe('world');
    router.go({ screen: 'journey', view: 'path' });
    expect(el('.nav [aria-current="page"]')?.dataset.tab).toBe('journey');
  });
});

describe('back', () => {
  it('returns to the previous screen at the same scroll position; a tab tap starts afresh', () => {
    router.go({ screen: 'world' });
    window.scrollTo({ top: 340 });
    router.go({ screen: 'region', id: 'farm' });
    expect(window.scrollY).toBe(0);
    expect(router.previous?.screen).toBe('world');
    el('.region [data-act="back"]')!.click();
    expect(router.route?.screen).toBe('world');
    expect(window.scrollY).toBe(340);
    // The Pet Garden goes back the same way the Farm does.
    router.go({ screen: 'sanctuary' });
    el('.sanctuary [data-act="back"]')!.click();
    expect(router.route?.screen).toBe('world');
    // A tab is a fresh start: nothing behind it.
    el('.nav [data-tab="journey"]')!.click();
    expect(router.route).toEqual({ screen: 'journey' });
    expect(router.previous).toBeNull();
  });

  it('falls back to the given screen when there is nothing behind, and never returns to a board', () => {
    router.reset({ screen: 'region', id: 'farm' });
    router.back({ screen: 'world' });
    expect(router.route?.screen).toBe('world');
    startGame({ kind: 'level', level: 8 });
    expect(router.route?.screen).toBe('game');
    // Leaving the board returns to the World it was opened from...
    el('.game [data-act="leave"]')!.click();
    expect(router.route?.screen).toBe('world');
    // ...and the board itself is never a place Back goes: open another, leave again.
    startGame({ kind: 'level', level: 8 });
    router.go({ screen: 'journey' });
    expect(router.previous?.screen).toBe('world');
  });

  it('the level path goes back to the hub', () => {
    router.reset({ screen: 'journey' });
    el('.journey [data-act="path"]')!.click();
    expect(router.route).toEqual({ screen: 'journey', view: 'path' });
    expect(text('h1')).toBe('Level path');
    el('.play [data-act="back"]')!.click();
    expect(router.route).toEqual({ screen: 'journey' });
  });
});

describe('the Journey hub', () => {
  it('shows the goal, the next level and one big Continue, in that order, above the Daily', () => {
    router.reset({ screen: 'journey' });
    const order = [...document.querySelectorAll('.goal-card, .continue, .daily-card')].map((e) => e.className);
    expect(order[0]).toContain('goal-card');
    expect(order[1]).toContain('continue');
    expect(order[2]).toContain('daily-card');
    expect(text('.goal-card h2')).toBe('Meadow Farm');
    expect(text('.goal-card__next')).toMatch(/Truffle the piglet/);
    expect(text('#continue-title')).toBe('Level 8');
    expect(text('[data-board-desc]')).toMatch(/One animal/);
    expect(text('.continue__go')).toBe('Play level 8');
    expect(document.querySelectorAll('.journey .btn--block')).toHaveLength(1);
  });

  it('Continue is the Journey\'s: a saved Daily is offered on its own line, not as Continue', () => {
    saveBoard({ kind: 'daily', dateKey: '2026-10-31', rule: 'solo' });
    router.reset({ screen: 'journey' });
    expect(text('.continue__go')).toBe('Play level 8');
    expect(text('.resume-other')).toMatch(/Daily/);
    expect(text('.resume-other')).toMatch(/in progress/);
  });

  it('a saved Journey board is Continue, with the next level a tap away when they differ', () => {
    saveBoard({ kind: 'level', level: 3 });
    router.reset({ screen: 'journey' });
    expect(text('.continue__go')).toBe('Resume level 3');
    expect(text('.continue [data-act="journey"]')).toBe('Play level 8 instead');
    expect(document.querySelector('.resume-other')).toBeNull();
  });

  it('Visit on the goal card opens the sanctuary being built; Back returns to the hub', () => {
    router.reset({ screen: 'journey' });
    el('.goal-card [data-act="visit"]')!.click();
    expect(router.route).toEqual({ screen: 'region', id: 'farm' });
    el('.region [data-act="back"]')!.click();
    expect(router.route).toEqual({ screen: 'journey' });
  });
});

describe('the World', () => {
  it('puts the goal and its actions above the map, with honest status lines', () => {
    app.save.onboarding.worldTipSeen = false;
    router.reset({ screen: 'world' });
    const focus = el('.world-focus')!;
    const map = el('.world-map')!;
    expect(focus.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(text('.world-focus h2')).toBe('Meadow Farm');
    expect(text('.world-focus [data-act="play"]')).toBe('Play level 8');
    expect(text('.world-card[data-go="farm"] .world-card__status')).toMatch(/Building here/);
    expect(text('.world-card[data-go="harmony"] .world-card__status')).toMatch(/^Build here/);
    expect(text('.world-card[data-go="harmony"] .world-card__status')).not.toMatch(/Paused/);
    expect(text('.world-card[data-go="savanna"] .world-card__status')).toMatch(/Locked until level 25/);
    // The first-visit line, dismissed once.
    expect(text('.world-tip')).toMatch(/one home grow at a time/);
    el('.world-tip [data-act="tip-ok"]')!.click();
    expect(document.querySelector('.world-tip')).toBeNull();
    expect(app.save.onboarding.worldTipSeen).toBe(true);
    router.refresh();
    expect(document.querySelector('.world-tip')).toBeNull();
  });

  it('news waits as "New" on the World, the goal card and the tab until the sanctuary is visited', () => {
    app.save.world.unseen = { farm: { animals: ['truffle'], stage: null, opened: false, at: '2026-10-31T00:00:00.000Z' } };
    app.save.inventory.companions.truffle = { unlockedAt: '2026-10-31T00:00:00.000Z' };
    router.reset({ screen: 'journey' });
    expect(text('.goal-card .chip--news')).toBe('New');
    expect(el('.nav [data-tab="world"]')?.classList.contains('has-news')).toBe(true);
    router.reset({ screen: 'world' });
    expect(text('.world-card[data-go="farm"] .chip--news')).toMatch(/New: Truffle came home/);
    expect(el('.world-pin[data-go="farm"] .news-dot')).not.toBeNull();
    router.go({ screen: 'region', id: 'farm' });
    expect(app.save.world.unseen.farm).toBeUndefined();
    router.back({ screen: 'world' });
    expect(el('.world-card[data-go="farm"] .chip--news')).toBeNull();
    expect(el('.nav [data-tab="world"]')?.classList.contains('has-news')).toBe(false);
  });

  it('the world line names a complete sanctuary as complete, and keeps it on the map', () => {
    app.save.world.growth.farm = 26;
    for (const id of ['cotton', 'truffle', 'buttercup', 'pepper', 'marigold', 'hazel']) app.save.inventory.companions[id as 'cotton'] = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    router.reset({ screen: 'world' });
    expect(text('.world-card[data-go="farm"] .world-card__status')).toMatch(/Complete/);
    expect(document.querySelector('.world-pin[data-go="farm"]')).not.toBeNull();
    expect(text('.world-focus h2')).toBe('Pet Garden');
  });
});

export { CAT };
