import { describe, expect, it } from 'vitest';
import { generatePuzzle } from '../../src/engine/generator';
import { CAT, DOG, EMPTY, type Puzzle, type Species } from '../../src/engine/types';
import { CASUAL_HEARTS, CUP_HEARTS, rulesFor } from '../../src/game/modes';
import { MARK, Session, type SessionEvent } from '../../src/game/session';
import { captureSession, resumeSession } from '../../src/game/sessionPersistence';
import { puzzleFor } from '../../src/game/puzzles';
import { verifyAttempt } from '../../src/competitions/verify';

const p = generatePuzzle({ size: 6, seed: 21 });

function cellWhere(s: Session, pz: Puzzle, want: number): [number, number] {
  for (let r = 0; r < pz.size; r++) for (let c = 0; c < pz.size; c++) if (!s.givenMask[r][c] && pz.solution[r][c] === want) return [r, c];
  throw new Error('no cell');
}

function casual(pz: Puzzle = p): Session {
  return new Session(pz, { maxHearts: CASUAL_HEARTS });
}

describe('heart allowance per mode', () => {
  it('casual boards start with five hearts, Paw Cup keeps three', () => {
    expect(rulesFor({ kind: 'level', level: 12 }).maxHearts).toBe(5);
    expect(rulesFor({ kind: 'daily', dateKey: '2026-10-26' }).maxHearts).toBe(5);
    expect(rulesFor({ kind: 'cup', weekKey: '2026-W44', index: 0 }).maxHearts).toBe(3);
    expect(rulesFor({ kind: 'zen', size: 6, seed: 1 }).hearts).toBe(false);
    const s = casual();
    expect(s.hearts).toBe(5);
    expect(s.maxHearts).toBe(5);
  });

  it('the default stays at three (the original rule), so older callers are unchanged', () => {
    const s = new Session(p);
    expect(s.maxHearts).toBe(3);
    expect(s.hearts).toBe(3);
  });

  it('five wrong placements end a casual board, exactly once; a refill restores all five', () => {
    const s = casual();
    const [r, c] = cellWhere(s, p, DOG);
    for (let i = 0; i < 4; i++) s.place(r, c, CAT);
    expect(s.outcome).toBe('playing');
    expect(s.hearts).toBe(1);
    s.place(r, c, CAT);
    expect(s.outcome).toBe('lost');
    expect(s.claimOutcome()).toBe('lost');
    expect(s.claimOutcome()).toBeNull();
    // More taps after the loss change nothing.
    expect(s.place(r, c, CAT).ignored).toBe(true);
    expect(s.hearts).toBe(0);
    expect(s.mistakes).toBe(5);
    s.revive();
    expect(s.hearts).toBe(5);
  });
});

describe('wrong placements in a two-species game', () => {
  it('a Cat on a Dog tile costs one heart and leaves the tile exactly as it was (no ✕, no Dog)', () => {
    const s = casual();
    const [r, c] = cellWhere(s, p, DOG);
    const res = s.apply(r, c, 'cat');
    expect(res.wrong).toBe(true);
    expect(res.placed).toBe(CAT);
    expect(s.cells[r][c]).toBe(EMPTY);
    expect(s.hearts).toBe(4);
    expect(s.mistakes).toBe(1);
    expect(s.canUndo()).toBe(false); // nothing to undo, so undo can never refund the heart
  });

  it('a Dog on a Cat tile the player had marked ✕ keeps the ✕ and reveals nothing', () => {
    const s = casual();
    const [r, c] = cellWhere(s, p, CAT);
    s.apply(r, c, 'mark');
    expect(s.cells[r][c]).toBe(MARK);
    const res = s.apply(r, c, 'dog');
    expect(res.wrong).toBe(true);
    expect(s.cells[r][c]).toBe(MARK);
    expect(s.hearts).toBe(4);
  });

  it('a Cat on an empty tile is a mistake too, and the tile stays empty', () => {
    const s = casual();
    const [r, c] = cellWhere(s, p, EMPTY);
    expect(s.apply(r, c, 'cat').wrong).toBe(true);
    expect(s.cells[r][c]).toBe(EMPTY);
  });

  it('never charges for givens, the other pet on a placed tile, or no-op taps', () => {
    const s = casual();
    const g = p.givens[0];
    expect(s.apply(g.r, g.c, g.kind === CAT ? 'dog' : 'cat').ignored).toBe(true);
    const [r, c] = cellWhere(s, p, CAT);
    s.apply(r, c, 'cat');
    expect(s.apply(r, c, 'dog').ignored).toBe(true); // a Dog never silently replaces a Cat
    expect(s.cells[r][c]).toBe(CAT);
    const [er, ec] = cellWhere(s, p, EMPTY);
    expect(s.apply(er, ec, 'erase').ignored).toBe(true);
    expect(s.hearts).toBe(5);
    expect(s.mistakes).toBe(0);
  });

  it('tapping a placed pet with its own tool clears it without a mistake', () => {
    const s = casual();
    const [r, c] = cellWhere(s, p, DOG);
    s.apply(r, c, 'dog');
    expect(s.apply(r, c, 'dog').cleared).toBe(true);
    expect(s.cells[r][c]).toBe(EMPTY);
    expect(s.hearts).toBe(5);
  });

  it('a double-fired tap on a wrong tile charges twice only because it is two placements, and both are logged', () => {
    const s = casual();
    const [r, c] = cellWhere(s, p, DOG);
    s.apply(r, c, 'cat');
    s.apply(r, c, 'cat');
    expect(s.hearts).toBe(3);
    expect(s.events.filter((e) => e.type === 'place')).toHaveLength(2);
  });
});

describe('saving and resuming with the new allowance', () => {
  it('round-trips a five-heart board', () => {
    const s = casual();
    const [r, c] = cellWhere(s, p, DOG);
    s.place(r, c, CAT);
    s.place(r, c, CAT);
    const snap = s.snapshot();
    expect(snap.maxHearts).toBe(5);
    const t = Session.restore(p, snap, { maxHearts: CASUAL_HEARTS })!;
    expect(t.hearts).toBe(3);
    expect(t.maxHearts).toBe(5);
  });

  it('a board saved under the old three-heart rule keeps its mistakes and gains the two new hearts', () => {
    const old = new Session(p);
    const [r, c] = cellWhere(old, p, DOG);
    old.place(r, c, CAT); // 2 of 3 left
    const snap = old.snapshot();
    delete snap.maxHearts; // what an older build wrote
    const t = Session.restore(p, snap, { maxHearts: CASUAL_HEARTS })!;
    expect(t.hearts).toBe(4);
    expect(t.mistakes).toBe(1);
  });

  it('resumes a saved Journey board with five hearts through the real persistence path', () => {
    const mode = { kind: 'level' as const, level: 14 };
    const pz = puzzleFor(mode);
    const s = new Session(pz, { maxHearts: CASUAL_HEARTS });
    const [r, c] = cellWhere(s, pz, CAT);
    s.place(r, c, CAT);
    const saved = captureSession(mode, s)!;
    const back = resumeSession(saved)!;
    expect(back.session.maxHearts).toBe(5);
    expect(back.session.hearts).toBe(5);
    expect(back.session.cells[r][c]).toBe(CAT);
  });

  it('a Paw Cup board resumes at three hearts', () => {
    const mode = { kind: 'cup' as const, weekKey: '2026-W44', index: 0 };
    const pz = puzzleFor(mode);
    const s = new Session(pz, { maxHearts: CUP_HEARTS });
    const saved = captureSession(mode, s)!;
    expect(resumeSession(saved)!.session.maxHearts).toBe(3);
  });
});

describe('Paw Cup verification keeps its three-heart rule', () => {
  it('three wrong placements end a ranked attempt even though casual boards allow five', () => {
    const [r, c] = cellWhere(new Session(p), p, DOG);
    const events: SessionEvent[] = [1000, 2000, 3000].map((t) => ({ t, type: 'place', r, c, s: CAT as Species }));
    // Then the player keeps going: every remaining correct placement.
    let t = 4000;
    for (let rr = 0; rr < p.size; rr++)
      for (let cc = 0; cc < p.size; cc++) {
        const v = p.solution[rr][cc];
        if (v === EMPTY || p.givens.some((g) => g.r === rr && g.c === cc)) continue;
        events.push({ t: (t += 1000), type: 'place', r: rr, c: cc, s: v as Species });
      }
    const res = verifyAttempt({ puzzle: p, events, parSeconds: 150, ranked: true });
    expect(res.mistakes).toBe(3);
    expect(res.completed).toBe(false);
  });
});
