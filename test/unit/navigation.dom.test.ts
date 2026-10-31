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
import { welcomeScreen } from '../../src/ui/screens/welcome';
import { mountNav } from '../../src/ui/components/nav';
import { startGame } from '../../src/app/gameFlow';
import { Session } from '../../src/game/session';
import { puzzleFor } from '../../src/game/puzzles';
import { captureSession } from '../../src/game/sessionPersistence';
import { CAT, EMPTY, type Species } from '../../src/engine/types';
import { defaultSave, setSavedSession } from '../../src/services/storage';

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
let router: Router;

function mountAll(): void {
  document.body.innerHTML = '<div id="app"></div>';
  router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['pets', 'shop', 'gallery', 'profile'] as const) reg[k] = blank;
  router.register({ ...reg, journey: journeyScreen, world: worldScreen, region: regionScreen, sanctuary: sanctuaryScreen, game: gameScreen, challenges: leagueScreen, welcome: welcomeScreen });
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
  setSavedSession(app.save, mode, captureSession(mode, s, new Date(), 4, { a: 'cotton', sanctuary: 'farm' }, 'test:board'));
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

  it('a brand-new player never comes Back to the welcome splash (regression, PR 3)', () => {
    // A fresh install: Welcome → "Meet Cotton" starts the guided board → the player leaves it (or wins and visits).
    app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
    mountAll();
    router.reset({ screen: 'welcome' });
    (el('.welcome [data-act="start"]') as HTMLButtonElement).click();
    expect(router.route?.screen).toBe('game');
    expect(router.previous).toBeNull();
    el('.game [data-act="leave"]')!.click();
    expect(router.route).toEqual({ screen: 'journey' });
    // The same from a sanctuary visited straight after that first board.
    router.reset({ screen: 'welcome' });
    (el('.welcome [data-act="start"]') as HTMLButtonElement).click();
    router.go({ screen: 'region', id: 'farm' });
    el('.region [data-act="back"]')!.click();
    expect(router.route?.screen).not.toBe('welcome');
    expect(router.route).toEqual({ screen: 'world' });
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
  it('one hero: the goal, then the next level and one big Play, above the Daily; the path and the sanctuary a quiet tap away (D38)', () => {
    router.reset({ screen: 'journey' });
    const order = [...document.querySelectorAll('.hero, .daily-card')].map((e) => e.className);
    expect(order[0]).toContain('hero');
    expect(order[1]).toContain('daily-card');
    // Inside the hero: the goal row first, then the level.
    const goal = el('.hero__goal')!;
    const play = el('.hero__play')!;
    expect(goal.compareDocumentPosition(play) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(text('.hero__eyebrow')).toMatch(/Building the Meadow Farm/);
    expect(text('.hero__next')).toMatch(/Truffle the piglet/);
    expect(el('.hero__bar')?.getAttribute('aria-valuenow')).toBe('2');
    expect(text('#continue-title')).toBe('Level 8');
    expect(text('[data-board-desc]')).toMatch(/One animal/);
    expect(text('.continue__go')).toBe('Play level 8');
    expect(document.querySelectorAll('.journey .btn--block')).toHaveLength(1);
    // The quiet links: the path and the sanctuary being built. The World tab is the map; the hub does not repeat it.
    expect(text('.hero__links [data-act="path"]')).toMatch(/View path/);
    expect(text('.hero__links [data-act="visit"]')).toBe('Visit Farm');
    expect(el('.hero [data-act="world"]')).toBeNull();
    expect(el('.goal-card')).toBeNull();
  });

  it('with every open sanctuary finished, the hero points at the next home to open and offers the World instead of a Visit', () => {
    app.save.world.growth.farm = 26;
    app.save.world.growth.harmony = 60;
    // The Farm's animals and the Garden's woodland visitors are companions; its cats and dogs are pets.
    for (const id of ['cotton', 'truffle', 'buttercup', 'pepper', 'marigold', 'hazel', 'juniper', 'ember', 'maple']) app.save.inventory.companions[id as 'cotton'] = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    for (const id of ['biscuit', 'mochi', 'pip', 'nori', 'clover', 'peanut']) app.save.inventory.pets[id] = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    router.reset({ screen: 'journey' });
    expect(text('.hero__next')).toMatch(/Outback.* opens after level 10/);
    expect(el('.hero [data-act="visit"]')).toBeNull();
    expect(text('.hero__links [data-act="world"]')).toBe('World');
    expect(text('.continue__go')).toBe('Play level 8');
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
    expect(text('.hero [data-act="journey"]')).toBe('Play level 8 instead');
    expect(document.querySelector('.resume-other')).toBeNull();
  });

  it('"Play level N instead" never throws the saved board away without asking (regression, PR 3)', () => {
    saveBoard({ kind: 'level', level: 3 });
    const before = JSON.stringify(app.save.sessions);
    router.reset({ screen: 'journey' });
    el('.hero [data-act="journey"]')!.click();
    // A question first, and "Not now" leaves everything as it was.
    expect(text('.sheet')).toMatch(/Start level 8\?/);
    expect(text('.sheet')).toMatch(/level 3 board \(1 move so far\) will be cleared/);
    (el('.sheet [data-act="keep"]') as HTMLButtonElement).click();
    expect(router.route).toEqual({ screen: 'journey' });
    expect(JSON.stringify(app.save.sessions)).toBe(before);
    // Choosing to start is the player's call.
    el('.hero [data-act="journey"]')!.click();
    (el('.sheet [data-act="go"]') as HTMLButtonElement).click();
    expect(router.route?.screen).toBe('game');
    expect(app.active?.mode).toEqual({ kind: 'level', level: 8 });
  });

  it('Visit on the hero (the picture or the link) opens the sanctuary being built; Back returns to the hub', () => {
    router.reset({ screen: 'journey' });
    el('.hero__scene[data-act="visit"]')!.click();
    expect(router.route).toEqual({ screen: 'region', id: 'farm' });
    el('.region [data-act="back"]')!.click();
    expect(router.route).toEqual({ screen: 'journey' });
    el('.hero__links [data-act="visit"]')!.click();
    expect(router.route).toEqual({ screen: 'region', id: 'farm' });
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
    // One big button; Visit and Build elsewhere are quiet links (D38).
    expect(document.querySelectorAll('.world-focus .btn--block')).toHaveLength(1);
    expect(text('.world-focus__links [data-go="farm"]')).toBe('Visit Farm');
    // What else is going on: the next home to open, as a pill that opens it.
    expect(text('.world-now .now-pill--next')).toMatch(/Next to open: Outback · after level 10/);
    // The map can be expanded and shrunk; the pins and cards stay.
    const wrap = el('[data-map-wrap]')!;
    el('[data-act="expand"]')!.click();
    expect(wrap.classList.contains('is-large')).toBe(true);
    expect(el('[data-act="expand"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(text('[data-act="expand"]')).toMatch(/Shrink map/);
    el('[data-act="expand"]')!.click();
    expect(wrap.classList.contains('is-large')).toBe(false);
    expect(document.querySelectorAll('.world-pin')).toHaveLength(6);
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
    expect(text('.hero .chip--news')).toBe('New');
    expect(el('.nav [data-tab="world"]')?.classList.contains('has-news')).toBe(true);
    router.reset({ screen: 'world' });
    expect(text('.world-card[data-go="farm"] .chip--news')).toMatch(/New: Truffle came home/);
    expect(el('.world-pin[data-go="farm"] .news-dot')).not.toBeNull();
    // And at the top, a pill that goes straight there.
    expect(text('.world-now .now-pill--news')).toMatch(/Truffle came home · Farm/);
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

describe('first run and first visits (PR 5)', () => {
  it('the welcome shows the Farm and the animal on the first board, and the button names her', () => {
    app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
    router.reset({ screen: 'welcome' });
    expect(el('.welcome__tile .pet')?.dataset.pet).toBe('cotton');
    expect(text('.welcome__story')).toMatch(/Meadow Farm/);
    expect(text('.welcome__story')).toMatch(/Cotton the sheep/);
    expect(text('.welcome [data-act="start"]')).toBe('Meet Cotton');
    expect(document.querySelector('.welcome [data-pet="mochi"], .welcome [data-pet="biscuit"]')).toBeNull();
  });

  it('the Farm shows one cue to tap an animal, once; tapping one is what dismisses it', () => {
    router.reset({ screen: 'region', id: 'farm' });
    expect(text('[data-scene-cue="tap"]')).toMatch(/Try tapping an animal/);
    (el('.sanctuary__scene .sanctuary__pet') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el('[data-scene-cue]')).toBeNull();
    expect(app.save.onboarding.sceneTapTipSeen).toBe(true);
    router.refresh();
    expect(el('[data-scene-cue="tap"]')).toBeNull();
  });

  it('the decoration cue waits for a decoration that can be used, and its close remembers', () => {
    app.save.onboarding.sceneTapTipSeen = true;
    router.reset({ screen: 'region', id: 'farm' });
    expect(el('[data-scene-cue]')).toBeNull();
    app.save.inventory.decor.tractor = { ownedAt: '2026-10-30T00:00:00.000Z' };
    router.refresh();
    expect(text('[data-scene-cue="decor"]')).toMatch(/Tap a decoration/);
    (el('[data-scene-cue="decor"] [data-act="cue-ok"]') as HTMLElement).click();
    expect(el('[data-scene-cue]')).toBeNull();
    expect(app.save.onboarding.decorTipSeen).toBe(true);
  });
});
