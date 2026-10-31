// @vitest-environment happy-dom
/**
 * The play screen's input rules, mounted for real in a DOM (D37): a tap marks ✕, a double tap places, a wrong animal
 * costs a heart and leaves a mistake mark, Erase only takes ✕ marks back, Hint shows the player's hint count, and dots
 * appear on Easy boards only. Plus what a solve credits and what the win sheet shows (D36).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute } from '../../src/ui/router';
import { gameScreen } from '../../src/ui/screens/game';
import { startGame } from '../../src/app/gameFlow';
import { CAT, DOG, EMPTY } from '../../src/engine/types';
import { MARK } from '../../src/game/session';
import { setActive } from '../../src/meta/world';
import { setPantry } from '../../src/app/qaTools';
import { defaultSave, type ControlScheme } from '../../src/services/storage';

/** A stand-in screen for every route the game can leave to. */
const blank = { tab: null, title: 'x', mount: () => {} };

function mountRouter(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], typeof blank>;
  for (const k of ['journey', 'pets', 'challenges', 'shop', 'sanctuary', 'world', 'region', 'gallery', 'welcome', 'profile'] as const) reg[k] = blank;
  router.register({ ...reg, game: gameScreen } as never);
  app.router = router;
  return router;
}

const cell = (r: number, c: number) => document.querySelector<HTMLButtonElement>(`.cell[data-r="${r}"][data-c="${c}"]`)!;
const toolBtn = (t: string) => document.querySelector<HTMLButtonElement>(`[data-tool="${t}"]`);
const eraseBtn = () => document.querySelector<HTMLButtonElement>('[data-act="erase"]')!;
const coach = () => document.querySelector('[data-coach]')?.textContent ?? '';
const key = (r: number, c: number, k: string) => cell(r, c).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

/** The clock the double-tap window reads; each tap moves it on, so taps are slow unless a test says otherwise. */
let nowMs = 1_000;

/** A pointer tap on a cell, the way the board listens for it, `gapMs` after the previous one. */
function tap(r: number, c: number, gapMs = 1_000): void {
  nowMs += gapMs;
  const el = cell(r, c);
  const box = { x: 10 + c * 40, y: 10 + r * 40 };
  document.elementFromPoint = () => el;
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: box.x, clientY: box.y }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1, clientX: box.x, clientY: box.y }));
}

/** Two quick taps on one tile: the place gesture. */
function dblTap(r: number, c: number): void {
  tap(r, c);
  tap(r, c, 60);
}

/** Finger down on one cell, moved across others, lifted. */
function drag(cells: Array<[number, number]>): void {
  nowMs += 1_000;
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

function find(pred: (r: number, c: number) => boolean, skip: Array<[number, number]> = []): [number, number] {
  const s = app.active!.session;
  for (let r = 0; r < s.size; r++)
    for (let c = 0; c < s.size; c++)
      if (!s.givenMask[r][c] && s.cells[r][c] === EMPTY && !s.errorsAt(r, c).length && pred(r, c) && !skip.some(([a, b]) => a === r && b === c)) return [r, c];
  throw new Error('no such cell');
}

function start(level: number, controls: ControlScheme = 'tap'): void {
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
  nowMs = 1_000;
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  mountRouter();
});
afterEach(() => {
  app.active = null;
  vi.restoreAllMocks();
});

describe('tap marks, double-tap places (D37)', () => {
  it('a one-animal board has Erase and Hint, no ✕ button; a tap marks, a slow second tap clears', () => {
    start(5); // no level tip, so the coach line is the scheme's
    const s = app.active!.session;
    expect(document.querySelectorAll('[data-tool]')).toHaveLength(0);
    expect(eraseBtn()).not.toBeNull();
    expect(coach()).toMatch(/Tap to mark ✕, double-tap to place/);
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(r, c);
    expect(s.cells[r][c]).toBe(MARK);
    expect(cell(r, c).querySelector('.cell__mark')).not.toBeNull();
    tap(r, c);
    expect(s.cells[r][c]).toBe(EMPTY);
  });

  it('a double tap places the animal with exactly one place event, and one Undo empties the tile', () => {
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
    expect(placeEvents()).toHaveLength(1);
    expect(s.mistakes).toBe(0);
    s.undo();
    expect(s.cells[r][c]).toBe(EMPTY);
  });

  it('a wrong double tap costs one heart and leaves a red mistake mark; trying it again costs nothing', () => {
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    dblTap(r, c);
    expect(s.hearts).toBe(s.maxHearts - 1);
    expect(s.cells[r][c]).toBe(EMPTY);
    expect(s.errorsAt(r, c)).toEqual([CAT]);
    expect(cell(r, c).querySelector('.cell__err')).not.toBeNull();
    expect(cell(r, c).querySelector('.cell__mark')).toBeNull();
    expect(cell(r, c).getAttribute('aria-label')).toMatch(/a mistake, no animal here$/);
    expect(coach()).toMatch(/so it's marked/);
    // The same guess again, on purpose or a double-fired tap: no second heart, no second event.
    const events = s.events.length;
    dblTap(r, c);
    expect(s.hearts).toBe(s.maxHearts - 1);
    expect(s.events.length).toBe(events);
    expect(coach()).toMatch(/You already tried/);
    // A single tap on a mistake doesn't turn it into a ✕; the mark stays, and survives a re-mount and an Undo.
    tap(r, c);
    expect(s.cells[r][c]).toBe(EMPTY);
    expect(coach()).toMatch(/A mistake was marked here/);
    app.router.refresh();
    s.undo();
    app.router.refresh();
    expect(cell(r, c).querySelector('.cell__err')).not.toBeNull();
  });

  it('a mistake on a tile the player had marked ✕ replaces their ✕', () => {
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    key(r, c, 'x');
    expect(s.cells[r][c]).toBe(MARK);
    key(r, c, '1');
    expect(s.hearts).toBe(s.maxHearts - 1);
    expect(s.cells[r][c]).toBe(EMPTY);
    expect(cell(r, c).querySelector('.cell__err')).not.toBeNull();
    expect(cell(r, c).querySelector('.cell__mark')).toBeNull();
  });

  it('two-animal boards: animal buttons, no ✕ button; a wrong cat on a dog tile marks "no cat", and the dog still fits', () => {
    start(30);
    const s = app.active!.session;
    expect(s.rule).toBe('pair');
    expect([...document.querySelectorAll<HTMLElement>('[data-tool]')].map((b) => b.dataset.tool)).toEqual(['cat', 'dog']);
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === DOG);
    toolBtn('cat')!.click();
    dblTap(r, c);
    expect(s.hearts).toBe(s.maxHearts - 1);
    // Not a red ✕: that would say the tile is empty. The struck cat says only "no cat here".
    expect(cell(r, c).querySelector('.cell__err')).toBeNull();
    expect(cell(r, c).querySelector('.cell__tried .pet, .cell__tried svg')).not.toBeNull();
    expect(cell(r, c).getAttribute('aria-label')).toMatch(/: not a [a-z ]+, a mistake$/);
    tap(r, c);
    expect(coach()).toMatch(/^No [a-z ]+ here\. If an? [a-z ]+ lives here, pick it below and double-tap\.$/);
    toolBtn('dog')!.click();
    dblTap(r, c);
    expect(s.cells[r][c]).toBe(DOG);
    expect(cell(r, c).querySelector('.cell__tried')).toBeNull();
    expect(app.settings.lastSpecies).toBe('dog');
  });

  it('two-animal boards: both animals wrong on one tile make it a red ✕ (no animal lives there)', () => {
    start(30);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    toolBtn('cat')!.click();
    dblTap(r, c);
    expect(cell(r, c).querySelector('.cell__tried')).not.toBeNull();
    toolBtn('dog')!.click();
    dblTap(r, c);
    expect(s.hearts).toBe(s.maxHearts - 2);
    expect(cell(r, c).querySelector('.cell__err')).not.toBeNull();
    expect(cell(r, c).querySelector('.cell__tried')).toBeNull();
  });

  it('Erase takes back ✕ marks only: animals and mistakes stay; a drag clears a run of ✕', () => {
    start(5);
    const s = app.active!.session;
    const x = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(x[0], x[1]);
    const a = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(a[0], a[1]);
    const m = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    dblTap(m[0], m[1]);
    expect([s.cells[x[0]][x[1]], s.cells[a[0]][a[1]], s.errorsAt(m[0], m[1]).length]).toEqual([MARK, CAT, 1]);
    eraseBtn().click();
    expect(eraseBtn().getAttribute('aria-pressed')).toBe('true');
    expect(coach()).toMatch(/Animals and mistakes stay/);
    tap(x[0], x[1]);
    expect(s.cells[x[0]][x[1]]).toBe(EMPTY);
    tap(a[0], a[1]);
    expect(s.cells[a[0]][a[1]]).toBe(CAT);
    expect(coach()).toMatch(/Erase only takes back ✕ marks/);
    tap(m[0], m[1]);
    expect(s.errorsAt(m[0], m[1])).toEqual([CAT]);
    expect(coach()).toMatch(/Mistakes stay marked/);
    // Erase stays on; a drag lifts a run of ✕ and passes over everything else.
    eraseBtn().click();
    const row = [...Array(s.size).keys()].filter((c) => !s.givenMask[s.size - 1][c] && s.cells[s.size - 1][c] === EMPTY && !s.errorsAt(s.size - 1, c).length).slice(0, 3).map((c) => [s.size - 1, c] as [number, number]);
    drag(row);
    for (const [r, c] of row) expect(s.cells[r][c]).toBe(MARK);
    eraseBtn().click();
    drag(row);
    for (const [r, c] of row) expect(s.cells[r][c]).toBe(EMPTY);
    // Delete on the keyboard follows the same rule.
    eraseBtn().click();
    key(a[0], a[1], 'Delete');
    expect(s.cells[a[0]][a[1]]).toBe(CAT);
  });

  it('a ✕ drag marks exactly the tiles under the finger, passing over mistakes', () => {
    start(5);
    const s = app.active!.session;
    const m = find((r, c) => s.puzzle.solution[r][c] === EMPTY && r === 1);
    dblTap(m[0], m[1]);
    const before = s.cells.map((r) => r.slice());
    const run = [...Array(s.size).keys()].filter((c) => !s.givenMask[1][c] && s.cells[1][c] === EMPTY).map((c) => [1, c] as [number, number]);
    const start0 = run.find(([r, c]) => !s.errorsAt(r, c).length)!;
    drag([start0, ...run.filter((t) => t !== start0)]);
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) {
        const touched = run.some(([rr, cc]) => rr === r && cc === c) && !s.errorsAt(r, c).length;
        expect(s.cells[r][c]).toBe(touched ? MARK : before[r][c]);
      }
    expect(s.errorsAt(m[0], m[1])).toEqual([CAT]);
  });

  it('keyboard: Enter places the picked animal, 2 the other; x marks; a wrong guess is marked', () => {
    start(30);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    key(r, c, 'Enter');
    expect(s.cells[r][c]).toBe(CAT);
    const [r2, c2] = find((r, c) => s.puzzle.solution[r][c] === DOG);
    key(r2, c2, '2');
    expect(s.cells[r2][c2]).toBe(DOG);
    const [r3, c3] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    key(r3, c3, 'x');
    expect(s.cells[r3][c3]).toBe(MARK);
    key(r3, c3, '1');
    expect(s.errorsAt(r3, c3)).toEqual([CAT]);
    expect(s.cells[r3][c3]).toBe(EMPTY);
  });

  it('the tap cycle needs no timing: empty → ✕ → animal; a wrong one is marked; animals stay', () => {
    start(5, 'classic');
    const s = app.active!.session;
    expect(coach()).toMatch(/Tap once to mark/);
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    tap(r, c);
    expect(s.cells[r][c]).toBe(MARK);
    tap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
    tap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
    const [w, v] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(w, v);
    tap(w, v);
    expect(s.hearts).toBe(s.maxHearts - 1);
    expect(s.cells[w][v]).toBe(EMPTY);
    expect(cell(w, v).querySelector('.cell__err')).not.toBeNull();
  });
});

describe('Hint shows your hints; dots only on Easy boards (D37)', () => {
  const badge = () => document.querySelector('[data-hint-badge]')?.textContent?.trim();
  const label = () => document.querySelector('[data-hint-label]')?.textContent;
  const give = (n: number) => app.save.inventory.items.push({ id: `test:hints:${n}`, item: 'hint', delta: n, at: '2026-10-30T00:00:00.000Z', source: 'gift' });

  it('the badge is always the hint count; the first look is labelled free and costs nothing', () => {
    give(3);
    start(5);
    expect(badge()).toBe('3');
    expect(label()).toBe('Free hint');
    expect(document.querySelector('[data-act="hint"]')?.getAttribute('aria-label')).toMatch(/free this time\. You have 3 hints\./);
    (document.querySelector('[data-act="hint"]') as HTMLButtonElement).click();
    expect(label()).toBe('Explain');
    expect(badge()).toBe('3');
    (document.querySelector('[data-act="hint"]') as HTMLButtonElement).click();
    expect(label()).toBe('Place it');
    expect(badge()).toBe('2');
  });

  it('Zen shows the count too (its hints stay free)', () => {
    give(4);
    app.settings.controls = 'tap';
    startGame({ kind: 'zen', size: 6, seed: 7_000_123, rule: 'solo' });
    expect(badge()).toBe('4');
    (document.querySelector('[data-act="hint"]') as HTMLButtonElement).click();
    (document.querySelector('[data-act="hint"]') as HTMLButtonElement).click();
    expect(badge()).toBe('4');
  });

  it('dots on tiles no animal can reach show on an Easy board, never on a harder one', () => {
    start(4); // 6×6 Easy
    expect(document.querySelector('.chip--board')?.textContent).toMatch(/Easy/);
    let s = app.active!.session;
    let [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    expect(document.querySelectorAll('.cell__dot').length).toBeGreaterThan(0);
    start(5); // 6×6 Medium
    expect(document.querySelector('.chip--board')?.textContent).toMatch(/Medium/);
    s = app.active!.session;
    [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
    expect(document.querySelectorAll('.cell__dot')).toHaveLength(0);
    // And the setting still turns them off on Easy boards.
    app.settings.autoMark = false;
    start(4);
    s = app.active!.session;
    [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    expect(document.querySelectorAll('.cell__dot')).toHaveLength(0);
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
        dblTap(r, c);
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
    expect(sheet?.textContent).toMatch(/Double-tap to place the animal you picked/);
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
        dblTap(r, c);
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

  it('a replay of the level that brought an animal home is an ordinary win: no hero, nothing re-fired, and (D38) no growth', () => {
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
    // The level already grew the Farm once; a replay sharpens stars and times, it doesn't grow the world again.
    expect(app.save.world.growth.farm).toBe(4);
    expect(sheet()!.querySelector('[data-replay-note]')?.textContent).toMatch(/A replay: it already grew the Farm once/);
    expect(sheet()!.textContent).not.toMatch(/\+1/);
  });

  describe('growth you can see, and fair (D38 PR D)', () => {
    it('an ordinary win says the step the animal took and moves its bar from before to after', () => {
      app.save.world.growth.farm = 1; // Truffle (at 4) is three puzzles away
      app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
      start(6);
      solveBoard();
      const w = sheet()!;
      expect(w.querySelector('.win-hero')).toBeNull();
      expect(w.querySelector('.win-plus')?.textContent).toBe('Farm +1');
      expect(w.querySelector('.win-next-friend')?.textContent).toMatch(/Truffle the piglet: 3 → 2 puzzles away/);
      const bar = w.querySelector<HTMLElement>('[data-grow-bar]')!;
      // Starts where it was (0 of 3), settles where it is now (1 of 3) a beat later; a tap settles it at once.
      expect(bar.style.width).toBe('0%');
      expect(bar.dataset.to).toBe('33');
      vi.advanceTimersByTime(700);
      w.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(bar.style.width).toBe('33%');
      expect(app.save.world.growth.farm).toBe(2);
      expect(app.save.world.grown.L6).toBeDefined();
    });

    it('under reduced motion the bar is already where it is now and the +1 does not animate', () => {
      app.settings.reducedMotion = 'reduce';
      app.save.world.growth.farm = 1;
      app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
      start(6);
      solveBoard();
      const w = sheet()!;
      expect(w.classList.contains('is-revealed')).toBe(true);
      expect(w.querySelector<HTMLElement>('[data-grow-bar]')!.style.width).toBe('33%');
      app.settings.reducedMotion = 'system';
    });

    it('a restarted Zen board is the same puzzle: it grows the world once; a fresh Zen board counts again', () => {
      app.save.world.growth.farm = 1;
      app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
      const zen = { kind: 'zen' as const, size: 5, seed: 7_000_102, rule: 'solo' as const };
      startGame(zen);
      solveBoard();
      expect(app.save.world.growth.farm).toBe(2);
      (sheet()!.querySelector('[data-act="next"]') as HTMLButtonElement).click();
      startGame(zen); // the very same board again
      solveBoard();
      expect(app.save.world.growth.farm).toBe(2);
      expect(sheet()!.querySelector('[data-replay-note]')).not.toBeNull();
      (sheet()!.querySelector('[data-act="next"]') as HTMLButtonElement).click();
      startGame({ ...zen, seed: 7_000_199 });
      solveBoard();
      expect(app.save.world.growth.farm).toBe(3);
    });
  });
});

describe('small kindnesses on the board (PR 5)', () => {
  it('a replay says which stars are still to earn; the difficulty chip explains itself on a tap', () => {
    app.save.journey.clears.L5 = { firstClearAt: '2026-10-30T00:00:00.000Z', bestSeconds: 83, bestMistakes: 1, clean: false, hintFree: true, stars: 2 };
    app.save.journey.bestTimes.L5 = 83;
    start(5);
    expect(coach()).toBe('Replay. One star to earn: solve it with no mistakes.');
    (document.querySelector('.chip--board') as HTMLElement).click();
    expect(coach()).toMatch(/^(Easy|Medium|Hard|Expert): /);
    expect(coach()).not.toMatch(/row \d|column \d/i); // the reason never names a move
  });

  it('a fully starred replay offers the best time to beat', () => {
    app.save.journey.clears.L5 = { firstClearAt: '2026-10-30T00:00:00.000Z', bestSeconds: 61, bestMistakes: 0, clean: true, hintFree: true, stars: 3 };
    app.save.journey.bestTimes.L5 = 61;
    start(5);
    expect(coach()).toBe('Replay. All three stars are yours; your best is 1:01.');
  });

  it('on a one-animal board, placing an animal glows its whole color for a beat (overlay only)', () => {
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    const region = s.puzzle.regions[r][c];
    const glowing = [...document.querySelectorAll<HTMLElement>('.cell.is-glow')].map((e) => Number(e.dataset.r) * 100 + Number(e.dataset.c));
    const expected = s.unitCells({ kind: 'region', index: region }).map(([rr, cc]) => rr * 100 + cc);
    expect(glowing.sort()).toEqual(expected.sort());
  });
});

describe('hardening: large boards, assistive tech, no videos (review gaps)', () => {
  it('Large board mode: a finger moving across tiles pans, it never marks or places', () => {
    app.settings.largeBoard = true;
    start(5);
    const s = app.active!.session;
    expect(document.querySelector('.board.is-pannable')).not.toBeNull();
    const row = [...Array(s.size).keys()].filter((c) => !s.givenMask[0][c]).map((c) => [0, c] as [number, number]);
    drag(row);
    expect(s.events.filter((e) => e.type === 'mark' || e.type === 'place')).toHaveLength(0);
    for (const [r, c] of row) expect(s.cells[r][c]).toBe(EMPTY);
    // A click (a real tap, not a pan) still marks.
    cell(0, row[0][1]).click();
    expect(s.cells[0][row[0][1]]).toBe(MARK);
    app.settings.largeBoard = false;
  });

  it('animal buttons tell a screen reader what a double tap places, and cells say what they hold', () => {
    start(30);
    expect(toolBtn('cat')?.getAttribute('aria-label')).toMatch(/^[A-Z][a-z]+: a double tap places an? [a-z ]+$/);
    expect(document.querySelector('.tools')?.getAttribute('role')).toBe('radiogroup');
    expect(toolBtn('cat')?.getAttribute('role')).toBe('radio');
    expect(eraseBtn().getAttribute('aria-pressed')).toBe('false');
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(r, c);
    expect(cell(r, c).getAttribute('aria-label')).toMatch(/marked empty$/);
  });

  it('under reduced motion a placement does not glow the color (the overlay flash is skipped)', () => {
    app.settings.reducedMotion = 'reduce';
    expect(app.reducedMotion).toBe(true);
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
    expect(document.querySelectorAll('.cell.is-glow')).toHaveLength(0);
    app.settings.reducedMotion = 'system';
  });

  it('with no video network, the hearts sheet never offers a video and the Journey loop still runs', async () => {
    const ads = await import('../../src/services/ads');
    const spy = vi.spyOn(ads.ads, 'available', 'get').mockReturnValue(false);
    try {
      start(5);
      const s = app.active!.session;
      // Lose every heart (a different wrong tile each time): the loss sheet must offer Try again and Back, never a video.
      for (let i = 0; i < s.maxHearts; i++) {
        const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
        dblTap(r, c);
      }
      expect(s.outcome).toBe('lost');
      const sheet = document.querySelector('.sheet')!;
      expect(sheet.textContent).toMatch(/Out of hearts/);
      expect(sheet.querySelector('[data-act="revive"]')).toBeNull();
      expect(sheet.textContent).not.toMatch(/video/i);
      expect(sheet.querySelector('[data-act="restart"]')).not.toBeNull();
      (sheet.querySelector('[data-act="leave"]') as HTMLButtonElement).click();
      expect(app.router.route?.screen).toBe('journey');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('gesture clarity (D38 PR B)', () => {
  it('after the first animal placed on an ordinary board, one line explains the controls, once', () => {
    start(5);
    const s = app.active!.session;
    expect(document.querySelector('[data-controls-tip]')).toBeNull();
    // A ✕ alone is not the moment.
    const [er, ec] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(er, ec);
    expect(document.querySelector('[data-controls-tip]')).toBeNull();
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    const tip = document.querySelector('[data-controls-tip]')!;
    expect(tip).not.toBeNull();
    expect(tip.textContent).toMatch(/Tap marks ✕ · double-tap places/);
    expect(tip.textContent).toMatch(/Controls in Settings/);
    expect(app.save.onboarding.controlsTipSeen).toBe(true);
    // The coach line underneath still says what the move did; the tip takes no input away.
    expect(coach()).toMatch(/Nicely reasoned|Settled in|That one belongs|Good spot|complete/);
    (tip.querySelector('[data-act="tip-close"]') as HTMLButtonElement).click();
    expect(document.querySelector('[data-controls-tip]')).toBeNull();
    // Never again on the next board.
    app.active = null;
    start(6);
    const s2 = app.active!.session;
    const [r2, c2] = find((r, c) => s2.puzzle.solution[r][c] === CAT);
    dblTap(r2, c2);
    expect(document.querySelector('[data-controls-tip]')).toBeNull();
  });

  it('the tip names the two-step scheme when that is the setting, and its link opens Settings', () => {
    start(5, 'classic');
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    tap(r, c);
    tap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
    const tip = document.querySelector('[data-controls-tip]')!;
    expect(tip.textContent).toMatch(/Two-step tap/);
    (tip.querySelector('[data-act="tip-controls"]') as HTMLButtonElement).click();
    expect(document.querySelector('[data-controls-tip]')).toBeNull();
    expect(document.querySelector('.sheet')?.textContent).toMatch(/Settings/);
    expect(document.querySelector('.sheet [data-choice="controls"][data-value="classic"]')?.textContent).toBe('Two-step tap (no timing)');
    expect(document.querySelector('.sheet [data-choice="controls"][data-value="tap"]')?.textContent).toBe('Fast double-tap');
    expect(document.querySelector('.sheet .cp-demo')?.getAttribute('data-scheme')).toBe('classic');
    expect(s.paused).toBe(true);
  });

  it('an activation without a pointer (a screen reader, a switch) is two-step under the fast scheme: no timing to beat', () => {
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    // The way assistive tech activates a button: a click with no taps behind it (detail 0), seconds apart.
    const activate = () => cell(r, c).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    activate();
    expect(s.cells[r][c]).toBe(MARK);
    nowMs += 5_000;
    activate();
    expect(s.cells[r][c]).toBe(CAT);
    expect(placeEvents()).toHaveLength(1);
    // A finger still gets the fast scheme: a slow second tap clears the ✕ instead of placing.
    const [r2, c2] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(r2, c2);
    tap(r2, c2);
    expect(s.cells[r2][c2]).toBe(EMPTY);
  });

  it('the pause sheet says what the controls are and offers Settings; How to play says where the other scheme is', () => {
    start(5);
    document.querySelector<HTMLButtonElement>('[data-act="pause"]')!.click();
    expect(document.querySelector('[data-pause-controls]')?.textContent).toMatch(/Tap marks ✕, double-tap places/);
    expect(document.querySelector('.sheet [data-act="settings"]')?.textContent).toMatch(/Settings and controls/);
    document.querySelector<HTMLButtonElement>('.sheet [data-act="rules"]')!.click();
    expect(document.querySelector('.sheet')?.textContent).toMatch(/Prefer no timing\? Settings → Controls → Two-step tap/);
  });
});

describe('polish (D38 PR E)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('each hint step previews the next one and its cost, so a tap is never an accidental purchase', () => {
    setPantry(app.save, 'hint', 3);
    start(5);
    const hintBtn = document.querySelector<HTMLButtonElement>('[data-act="hint"]')!;
    hintBtn.click();
    expect(coach()).toMatch(/Look at .*Next: Explain says why \((free|uses a hint)\)\./);
    hintBtn.click();
    expect(coach()).toMatch(/Next: Place it puts the animal there \((free|uses a hint)\)\./);
  });

  it('a Medium or harder solve says so, and "What made it …?" opens the grader\'s own reason', () => {
    start(8); // level 8 is measured Medium
    const s = app.active!.session;
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) {
        const want = s.puzzle.solution[r][c];
        if (want === EMPTY || s.givenMask[r][c] || s.cells[r][c] === want) continue;
        dblTap(r, c);
        if (s.outcome === 'won') break;
      }
    vi.advanceTimersByTime(700);
    const sheet = document.querySelector('.win-sheet')!;
    const skill = sheet.querySelector('[data-skill]')!;
    expect(skill.textContent).toMatch(/You solved a Medium 7×7\./);
    (skill.querySelector('[data-act="why"]') as HTMLButtonElement).click();
    expect(skill.textContent).toMatch(/^Medium: /);
    expect(skill.querySelector('[data-act="why"]')).toBeNull();
    // The sheet is still open: the question did not count as a tap to leave.
    expect(document.querySelector('.win-sheet')).not.toBeNull();
  });

  it('an Easy solve keeps the sheet quiet: no skill line', () => {
    start(2); // level 2 is measured Easy
    const s = app.active!.session;
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) {
        const want = s.puzzle.solution[r][c];
        if (want === EMPTY || s.givenMask[r][c] || s.cells[r][c] === want) continue;
        dblTap(r, c);
        if (s.outcome === 'won') break;
      }
    vi.advanceTimersByTime(700);
    expect(document.querySelector('.win-sheet [data-skill]')).toBeNull();
  });
});
