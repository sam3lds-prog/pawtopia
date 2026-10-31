// @vitest-environment happy-dom
/**
 * The play screen's input rules, mounted for real in a DOM: what a wrong placement leaves behind, and what a solve
 * credits. These are the two P0 invariants of the Journey/World review (2026-10-31).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type Route } from '../../src/ui/router';
import { gameScreen } from '../../src/ui/screens/game';
import { startGame } from '../../src/app/gameFlow';
import { CAT, DOG, EMPTY, type Species } from '../../src/engine/types';
import { MARK } from '../../src/game/session';
import { setActive } from '../../src/meta/world';
import { defaultSave } from '../../src/services/storage';

/** A stand-in screen for every route the game can leave to. */
const blank = { tab: null, title: 'x', mount: () => {} };

function mountRouter(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<Route['screen'], typeof blank>;
  for (const k of ['home', 'play', 'pets', 'league', 'shop', 'sanctuary', 'world', 'region', 'gallery', 'welcome', 'profile'] as const) reg[k] = blank;
  router.register({ ...reg, game: gameScreen } as never);
  app.router = router;
  return router;
}

const cell = (r: number, c: number) => document.querySelector<HTMLButtonElement>(`.cell[data-r="${r}"][data-c="${c}"]`)!;

/** A pointer tap on a cell, the way the board listens for it. */
function tap(r: number, c: number): void {
  const el = cell(r, c);
  const box = { x: 10 + c * 40, y: 10 + r * 40 };
  document.elementFromPoint = () => el;
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: box.x, clientY: box.y }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1, clientX: box.x, clientY: box.y }));
}

function dblTap(r: number, c: number): void {
  tap(r, c);
  tap(r, c);
}

function find(pred: (r: number, c: number) => boolean): [number, number] {
  const s = app.active!.session;
  for (let r = 0; r < s.size; r++) for (let c = 0; c < s.size; c++) if (!s.givenMask[r][c] && s.cells[r][c] === EMPTY && pred(r, c)) return [r, c];
  throw new Error('no such cell');
}

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

describe('a wrong placement (P0)', () => {
  it('on a one-animal board costs a heart and leaves the tile empty, never a ✕', () => {
    startGame({ kind: 'level', level: 4 });
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    dblTap(r, c);
    expect(s.hearts).toBe(s.maxHearts - 1);
    expect(s.mistakes).toBe(1);
    expect(s.cells[r][c]).toBe(EMPTY);
    expect(cell(r, c).querySelector('.cell__mark')).toBeNull();
    expect(cell(r, c).querySelector('.cell__ghost')).not.toBeNull();
  });

  it('on a two-animal board leaves the other animal\'s tile empty (a ✕ there would be a lie)', () => {
    app.save.journey.nextLevel = 30;
    startGame({ kind: 'level', level: 30 });
    const s = app.active!.session;
    expect(s.rule).toBe('pair');
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === DOG);
    document.querySelector<HTMLButtonElement>('[data-tool="cat"]')!.click();
    dblTap(r, c);
    expect(s.hearts).toBe(s.maxHearts - 1);
    expect(s.cells[r][c]).toBe(EMPTY);
    // The last thing logged is the wrong placement itself: nothing marks the tile afterwards.
    expect(s.events[s.events.length - 1]).toMatchObject({ type: 'place', r, c, s: CAT });
    expect(cell(r, c).querySelector('.cell__mark')).toBeNull();
  });

  it('keeps the player\'s own ✕ when the keyboard places a wrong animal on it', () => {
    startGame({ kind: 'level', level: 4 });
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    const el = cell(r, c);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    expect(s.cells[r][c]).toBe(MARK);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    expect(s.hearts).toBe(s.maxHearts - 1);
    expect(s.cells[r][c]).toBe(MARK);
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
        const tool = document.querySelector<HTMLButtonElement>(`[data-tool="${want === CAT ? 'cat' : 'dog'}"]`);
        tool?.click();
        dblTap(r, c);
        if (s.outcome === 'won') return;
      }
  }

  it('Farm board, then Pet Garden chosen, then the Farm board is finished: the Farm grows, the Garden does not', () => {
    startGame({ kind: 'level', level: 4 });
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
    startGame({ kind: 'level', level: 5 });
    expect(app.active!.cast!.sanctuary).toBe('harmony');
    expect(app.active!.boardId).not.toBe(board);
  });

  it('the header says which sanctuary the board is for', () => {
    startGame({ kind: 'level', level: 4 });
    expect(document.querySelector('[data-for="farm"]')?.textContent).toContain('Farm');
    setActive(app.save, 'harmony');
    app.router.refresh();
    // The same board, re-mounted: still the Farm's.
    expect(document.querySelector('[data-for="farm"]')).not.toBeNull();
  });
});

export type { Species };
