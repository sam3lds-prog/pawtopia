// @vitest-environment happy-dom
/**
 * The play screen's input rules, mounted for real in a DOM: what one tap does under each control scheme, what a wrong
 * placement leaves behind, and what a solve credits. These cover the P0 items of the Journey/World review (D36).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute } from '../../src/ui/router';
import { gameScreen } from '../../src/ui/screens/game';
import { startGame } from '../../src/app/gameFlow';
import { CAT, DOG, EMPTY } from '../../src/engine/types';
import { MARK } from '../../src/game/session';
import { setActive } from '../../src/meta/world';
import { defaultSave, type ControlScheme } from '../../src/services/storage';

/** A stand-in screen for every route the game can leave to. */
const blank = { tab: null, title: 'x', mount: () => {} };

function mountRouter(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute["screen"], typeof blank>;
  for (const k of ['journey', 'pets', 'challenges', 'shop', 'sanctuary', 'world', 'region', 'gallery', 'welcome', 'profile'] as const) reg[k] = blank;
  router.register({ ...reg, game: gameScreen } as never);
  app.router = router;
  return router;
}

const cell = (r: number, c: number) => document.querySelector<HTMLButtonElement>(`.cell[data-r="${r}"][data-c="${c}"]`)!;
const toolBtn = (t: string) => document.querySelector<HTMLButtonElement>(`[data-tool="${t}"]`);
const coach = () => document.querySelector('[data-coach]')?.textContent ?? '';

/** A pointer tap on a cell, the way the board listens for it. */
function tap(r: number, c: number): void {
  const el = cell(r, c);
  const box = { x: 10 + c * 40, y: 10 + r * 40 };
  document.elementFromPoint = () => el;
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: box.x, clientY: box.y }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1, clientX: box.x, clientY: box.y }));
}

/** Finger down on one cell, moved across others, lifted. */
function drag(cells: Array<[number, number]>): void {
  const [first, ...rest] = cells;
  const el0 = cell(first[0], first[1]);
  document.elementFromPoint = () => el0;
  el0.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 2, clientX: 5, clientY: 5 }));
  for (const [r, c] of rest) {
    const el = cell(r, c);
    document.elementFromPoint = () => el;
    el0.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 2, clientX: 5 + c, clientY: 5 + r }));
  }
  el0.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 2 }));
}

function find(pred: (r: number, c: number) => boolean): [number, number] {
  const s = app.active!.session;
  for (let r = 0; r < s.size; r++) for (let c = 0; c < s.size; c++) if (!s.givenMask[r][c] && s.cells[r][c] === EMPTY && pred(r, c)) return [r, c];
  throw new Error('no such cell');
}

function start(level: number, controls: ControlScheme = 'place'): void {
  app.settings.controls = controls;
  if (level > 20) app.save.journey.nextLevel = Math.max(app.save.journey.nextLevel, level);
  startGame({ kind: 'level', level });
}

const placeEvents = () => app.active!.session.events.filter((e) => e.type === 'place');

beforeEach(() => {
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
  // Past the tutorial and the lessons: ordinary boards with hearts.
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, pairRulesSeen: true, pairLessonDone: true });
  app.active = null;
  mountRouter();
});
afterEach(() => {
  app.active = null;
});

describe('one tap places (the default scheme, D36)', () => {
  it('a one-animal board: the animal is the pressed tool; one tap places it with one event', () => {
    start(5); // no level tip, so the coach line is the scheme's
    const s = app.active!.session;
    expect(toolBtn('cat')?.getAttribute('aria-checked')).toBe('true');
    expect(toolBtn('mark')).not.toBeNull();
    expect(toolBtn('erase')).not.toBeNull();
    expect(document.querySelector('[data-act="erase"]')).toBeNull();
    expect(coach()).toMatch(/Tap a tile to place/);
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    tap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
    expect(placeEvents()).toHaveLength(1);
    expect(s.mistakes).toBe(0);
  });

  it('a tap on a placed animal does nothing but say how to take it back', () => {
    start(4);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    tap(r, c);
    tap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
    expect(coach()).toMatch(/Erase/);
    // Erase takes it back, and Erase stays pressed until it is tapped again.
    toolBtn('erase')!.click();
    expect(toolBtn('erase')?.getAttribute('aria-checked')).toBe('true');
    tap(r, c);
    expect(s.cells[r][c]).toBe(EMPTY);
    expect(toolBtn('erase')?.getAttribute('aria-checked')).toBe('true');
    toolBtn('erase')!.click();
    expect(toolBtn('cat')?.getAttribute('aria-checked')).toBe('true');
  });

  it('the ✕ tool marks with a tap, marks a run with a drag, and gives the animal back on a second press', () => {
    start(4);
    const s = app.active!.session;
    toolBtn('mark')!.click();
    expect(toolBtn('mark')?.getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('.game')?.classList.contains('is-marking')).toBe(true);
    const a = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(a[0], a[1]);
    expect(s.cells[a[0]][a[1]]).toBe(MARK);
    tap(a[0], a[1]);
    expect(s.cells[a[0]][a[1]]).toBe(EMPTY);
    // A drag across row 0's free tiles marks exactly those.
    const row = [...Array(s.size).keys()].filter((c) => !s.givenMask[0][c] && s.cells[0][c] === EMPTY).map((c) => [0, c] as [number, number]);
    drag(row);
    for (const [r, c] of row) expect(s.cells[r][c]).toBe(MARK);
    expect(placeEvents()).toHaveLength(0);
    toolBtn('mark')!.click();
    expect(toolBtn('cat')?.getAttribute('aria-checked')).toBe('true');
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    tap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
  });

  it('a two-animal board: pick an animal, then one tap places it; the pick is remembered', () => {
    start(30);
    const s = app.active!.session;
    expect(s.rule).toBe('pair');
    expect(document.querySelectorAll('[data-tool]')).toHaveLength(4);
    toolBtn('dog')!.click();
    expect(toolBtn('dog')?.getAttribute('aria-checked')).toBe('true');
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === DOG);
    tap(r, c);
    expect(s.cells[r][c]).toBe(DOG);
    expect(placeEvents()).toHaveLength(1);
    expect(app.settings.lastSpecies).toBe('dog');
  });

  it('a wrong tap costs one heart and leaves the tile as it was (empty, or the player\'s own ✕)', () => {
    start(30);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === DOG);
    toolBtn('cat')!.click();
    tap(r, c);
    expect(s.hearts).toBe(s.maxHearts - 1);
    expect(s.cells[r][c]).toBe(EMPTY);
    expect(cell(r, c).querySelector('.cell__mark')).toBeNull();
    expect(cell(r, c).querySelector('.cell__ghost')).not.toBeNull();
    expect(s.events[s.events.length - 1]).toMatchObject({ type: 'place', r, c, s: CAT });
    // On a tile the player marked ✕ themselves, a wrong keyboard placement keeps their ✕.
    const [r2, c2] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    cell(r2, c2).dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    expect(s.cells[r2][c2]).toBe(MARK);
    cell(r2, c2).dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    expect(s.hearts).toBe(s.maxHearts - 2);
    expect(s.cells[r2][c2]).toBe(MARK);
  });

  it('keyboard: Enter applies the pressed tool; 1 and 2 place directly; x marks', () => {
    start(30);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    cell(r, c).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(s.cells[r][c]).toBe(CAT);
    const [r2, c2] = find((r, c) => s.puzzle.solution[r][c] === DOG);
    cell(r2, c2).dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
    expect(s.cells[r2][c2]).toBe(DOG);
    toolBtn('mark')!.click();
    const [r3, c3] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    cell(r3, c3).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(s.cells[r3][c3]).toBe(MARK);
  });
});

describe('the other schemes still work', () => {
  it('tap and double-tap (D35): a tap marks ✕, a quick second tap places, a wrong one leaves the tile empty', () => {
    start(5, 'tap');
    const s = app.active!.session;
    expect(document.querySelector('[data-act="erase"]')).not.toBeNull();
    expect(toolBtn('mark')).toBeNull();
    expect(coach()).toMatch(/double-tap/);
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    tap(r, c);
    expect(s.cells[r][c]).toBe(MARK);
    tap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
    const [wr, wc] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(wr, wc);
    tap(wr, wc);
    expect(s.hearts).toBe(s.maxHearts - 1);
    expect(s.cells[wr][wc]).toBe(EMPTY);
  });

  it('tap cycle: empty → ✕ → animal, no timing', () => {
    start(5, 'classic');
    const s = app.active!.session;
    expect(coach()).toMatch(/Tap once to mark/);
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    tap(r, c);
    expect(s.cells[r][c]).toBe(MARK);
    tap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
  });
});

describe('a solve credits the sanctuary the board started for (P0)', () => {
  function solve(): void {
    const s = app.active!.session;
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) {
        const want = s.puzzle.solution[r][c];
        if (want === EMPTY || s.givenMask[r][c] || s.cells[r][c] === want) continue;
        if (!document.querySelector('.cell')) return;
        toolBtn(want === CAT ? 'cat' : 'dog')?.click();
        tap(r, c);
        if (s.outcome === 'won') return;
      }
  }

  it('Farm board, then Pet Garden chosen, then the Farm board is finished: the Farm grows, the Garden does not', () => {
    start(4);
    expect(app.active!.cast!.sanctuary).toBe('farm');
    const board = app.active!.boardId;
    expect(board).toBeTruthy();
    // The player goes to the World and decides to build the Pet Garden while this board is still on the table.
    expect(setActive(app.save, 'harmony')).toBe(true);
    app.persist();
    solve();
    expect(app.active).toBeNull();
    expect(app.save.world.growth.farm ?? 0).toBe(1);
    expect(app.save.world.growth.harmony ?? 0).toBe(0);
    expect(app.save.world.active).toBe('harmony');
    expect(app.save.world.credits[board!]).toBe('farm');
    // The next board is for the Pet Garden, as chosen.
    start(5);
    expect(app.active!.cast!.sanctuary).toBe('harmony');
    expect(app.active!.boardId).not.toBe(board);
  });

  it('the status line says which sanctuary the board is for, even after a re-mount', () => {
    start(4);
    expect(document.querySelector('[data-for="farm"]')?.textContent).toContain('Farm');
    setActive(app.save, 'harmony');
    app.router.refresh();
    expect(document.querySelector('[data-for="farm"]')).not.toBeNull();
  });
});

describe('level 21: the bridge, then the lesson', () => {
  it('shows the two-animal rules once, with this board\'s animals, before the guided first pair', () => {
    app.save.onboarding.pairRulesSeen = false;
    app.save.onboarding.pairLessonDone = false;
    app.save.journey.nextLevel = 21;
    startGame({ kind: 'level', level: 21 });
    const sheet = document.querySelector('.rules-bridge');
    expect(sheet).not.toBeNull();
    expect(sheet?.textContent).toMatch(/A second animal joins/);
    expect(sheet?.textContent).toMatch(/Tap a tile to place the animal you picked/);
    expect(document.querySelector('.cell.is-guide')).toBeNull();
    (sheet!.querySelector('[data-act="ok"]') as HTMLButtonElement).click();
    expect(document.querySelector('.rules-bridge')).toBeNull();
    expect(document.querySelector('.cell.is-guide')).not.toBeNull();
    expect(coach()).toMatch(/Now two animals/);
    expect(app.save.onboarding.pairRulesSeen).toBe(true);
  });
});

describe('the win sheet: milestones first, ordinary wins quick (PR 4)', () => {
  // The sheet rises a beat after the last placement (the faces celebrate first).
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  function solveBoard(): void {
    placeAll();
    vi.advanceTimersByTime(700);
  }
  function placeAll(): void {
    const s = app.active!.session;
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) {
        const want = s.puzzle.solution[r][c];
        if (want === EMPTY || s.givenMask[r][c] || s.cells[r][c] === want) continue;
        toolBtn(want === CAT ? 'cat' : 'dog')?.click();
        tap(r, c);
        if (s.outcome === 'won') return;
      }
  }
  const sheet = () => document.querySelector('.win-sheet');

  it('an ordinary win: no hero, Play next is the one big button, the visit is quiet, the world line says +1', () => {
    app.save.world.growth.farm = 1;
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(4);
    solveBoard();
    expect(sheet()).not.toBeNull();
    expect(sheet()!.classList.contains('win-sheet--milestone')).toBe(false);
    expect(sheet()!.querySelector('.win-hero')).toBeNull();
    const blocks = [...sheet()!.querySelectorAll<HTMLElement>('.sheet__actions .btn--block')];
    expect(blocks.map((b) => b.textContent)).toEqual(['Play level 5']);
    expect(blocks[0].dataset.act).toBe('next');
    expect(sheet()!.querySelector('.win-secondary [data-act="region"]')?.textContent).toContain('Visit the Farm');
    expect(sheet()!.textContent).toMatch(/Farm \+1/);
  });

  it('an arrival: the newcomer is the hero, Meet is the main action and Play next a full second button', () => {
    app.save.world.growth.farm = 3; // Truffle arrives at 4
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(4);
    solveBoard();
    const sh = sheet()!;
    expect(sh.classList.contains('win-sheet--milestone')).toBe(true);
    expect(sh.querySelector('[data-hero="arrived"]')?.textContent).toMatch(/Truffle the piglet came home!/);
    const blocks = [...sh.querySelectorAll<HTMLElement>('.sheet__actions .btn--block')];
    expect(blocks.map((b) => [b.dataset.act, b.textContent])).toEqual([
      ['meet', 'Meet Truffle'],
      ['next', 'Play level 5'],
    ]);
    // The news waits on the World until the Farm is visited.
    expect(app.save.world.unseen.farm?.animals).toEqual(['truffle']);
    (blocks[0] as HTMLButtonElement).click();
    expect(app.router.route).toMatchObject({ screen: 'region', id: 'farm' });
  });

  it('a region opening on the same solve outranks the arrival: Explore is the main action and goes there', () => {
    app.save.journey.nextLevel = 10; // clearing level 10 opens the Outback
    app.save.world.growth.farm = 3;
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(10);
    solveBoard();
    const sh = sheet()!;
    expect(sh.querySelector('[data-hero="opened"]')?.textContent).toMatch(/The Outback Sanctuary is open!/);
    // The arrival still shows, below.
    expect(sh.textContent).toMatch(/Truffle the piglet came home to the Farm/);
    const primary = sh.querySelector<HTMLElement>('.sheet__actions .btn--block')!;
    expect(primary.textContent).toBe('Explore the Outback');
    // Both hold news until each is visited (the real sanctuary screens clear it; see navigation.dom.test).
    expect(app.save.world.unseen.outback).toMatchObject({ opened: true });
    expect(app.save.world.unseen.farm?.animals).toEqual(['truffle']);
    primary.click();
    expect(app.router.route).toMatchObject({ screen: 'region', id: 'outback' });
  });

  it('a replay of the level that brought an animal home is an ordinary win: no hero, nothing re-fired', () => {
    app.save.world.growth.farm = 3;
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(4);
    solveBoard();
    expect(sheet()!.querySelector('.win-hero')).not.toBeNull();
    (sheet()!.querySelector('[data-act="next"]') as HTMLButtonElement).click();
    // Back to level 4 on purpose: a replay.
    start(4);
    solveBoard();
    expect(sheet()!.querySelector('.win-hero')).toBeNull();
    expect(sheet()!.textContent).not.toMatch(/came home/);
    expect(app.save.world.growth.farm).toBe(5);
  });
});
