import { describe, expect, it } from 'vitest';
import {
  applySoloMove,
  countSoloSolutions,
  createSoloBoard,
  deduceSolo,
  generateSoloPuzzle,
  isValidSoloSolution,
  nextSoloMove,
  touching,
} from '../../src/engine/solo';
import { CAT, DOG, EMPTY, makeGrid, ruleOf, type Kind } from '../../src/engine/types';
import { profileOf, profileSoloBoard } from '../../src/game/grading';
import { puzzleDigest } from '../../src/game/puzzleDigest';

/** A hand-made 4×4: regions are the rows shifted, one known solution. */
const REG4 = [
  [0, 0, 1, 1],
  [0, 0, 1, 1],
  [2, 2, 3, 3],
  [2, 2, 3, 3],
];

describe('one-animal rule', () => {
  it('touching includes corners and excludes the cell itself', () => {
    expect(touching({ r: 2, c: 2 }, { r: 3, c: 3 })).toBe(true);
    expect(touching({ r: 2, c: 2 }, { r: 2, c: 3 })).toBe(true);
    expect(touching({ r: 2, c: 2 }, { r: 2, c: 2 })).toBe(false);
    expect(touching({ r: 2, c: 2 }, { r: 4, c: 2 })).toBe(false);
  });

  it('validates grids: one per line and region, never touching', () => {
    const p = generateSoloPuzzle({ size: 6, seed: 11 });
    expect(isValidSoloSolution(6, p.regions, p.solution)).toBe(true);
    // Move one animal sideways: its column now has two, or it touches someone.
    const g = p.solution.map((row) => row.slice()) as Kind[][];
    const c = g[0].indexOf(CAT);
    g[0][c] = EMPTY;
    g[0][(c + 1) % 6] = CAT;
    expect(isValidSoloSolution(6, p.regions, g)).toBe(false);
    // A dog is never part of a one-animal grid.
    const d = p.solution.map((row) => row.slice()) as Kind[][];
    d[0][c] = DOG;
    expect(isValidSoloSolution(6, p.regions, d)).toBe(false);
  });

  it('counts every solution of a small board, and respects givens', () => {
    // Four 2×2 blocks: exactly two ways, columns 1,3,0,2 and 2,0,3,1.
    const all = countSoloSolutions(4, REG4, [], 5);
    expect(all.count).toBe(2);
    expect(all.solutions.map((g) => g.map((row) => row.indexOf(CAT)))).toEqual([
      [1, 3, 0, 2],
      [2, 0, 3, 1],
    ]);
    expect(countSoloSolutions(4, REG4, [{ r: 0, c: 1, kind: CAT }], 5).count).toBe(1);
    expect(countSoloSolutions(4, REG4, [{ r: 0, c: 0, kind: CAT }], 5).count).toBe(0);
  });

  for (const size of [5, 6, 7, 8, 9]) {
    it(`generates unique, logic-only ${size}×${size} boards with no animals given`, () => {
      for (let seed = 1; seed <= 6; seed++) {
        const p = generateSoloPuzzle({ size, seed });
        expect(p.rule).toBe('solo');
        expect(ruleOf(p)).toBe('solo');
        expect(p.givens).toEqual([]);
        expect(isValidSoloSolution(size, p.regions, p.solution)).toBe(true);
        expect(countSoloSolutions(size, p.regions, [], 2).count).toBe(1);
        expect(deduceSolo(size, p.regions, []).solved).toBe(true);
        // every region is connected and holds exactly one animal
        for (let g = 0; g < size; g++) {
          const cells: Array<[number, number]> = [];
          for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (p.regions[r][c] === g) cells.push([r, c]);
          expect(cells.filter(([r, c]) => p.solution[r][c] === CAT)).toHaveLength(1);
          const seen = new Set([cells[0].join()]);
          const q = [cells[0]];
          while (q.length) {
            const [r, c] = q.pop()!;
            for (const [dr, dc] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ])
              if (cells.some(([a, b]) => a === r + dr && b === c + dc) && !seen.has(`${r + dr},${c + dc}`)) {
                seen.add(`${r + dr},${c + dc}`);
                q.push([r + dr, c + dc]);
              }
          }
          expect(seen.size).toBe(cells.length);
        }
      }
    });
  }

  it('is deterministic for a seed', () => {
    expect(generateSoloPuzzle({ size: 7, seed: 42 }).regions).toEqual(generateSoloPuzzle({ size: 7, seed: 42 }).regions);
    expect(generateSoloPuzzle({ size: 7, seed: 42 }).regions).not.toEqual(generateSoloPuzzle({ size: 7, seed: 43 }).regions);
  });

  it('every deduction is sound: placements match the solution, eliminations never remove it', () => {
    for (const size of [5, 7, 9])
      for (let seed = 20; seed < 26; seed++) {
        const p = generateSoloPuzzle({ size, seed });
        const b = createSoloBoard(size, p.regions, []);
        for (let m = nextSoloMove(b); m; m = nextSoloMove(b)) {
          expect(m.species).toBe(CAT);
          if (m.kind === 'place') expect(p.solution[m.r][m.c]).toBe(CAT);
          else expect(p.solution[m.r][m.c]).toBe(EMPTY);
          expect(m.reason.length).toBeGreaterThan(10);
          applySoloMove(b, m);
        }
        expect(b.placed).toEqual(p.solution);
        // DOG candidates never appear on a one-animal board.
        expect(b.cand[DOG].flat().some(Boolean)).toBe(false);
      }
  });

  it('a board built from placed animals already rules out their lines, regions and neighbors', () => {
    const p = generateSoloPuzzle({ size: 6, seed: 5 });
    const placed = makeGrid<Kind>(6, EMPTY);
    const c = p.solution[2].indexOf(CAT);
    placed[2][c] = CAT;
    const b = createSoloBoard(6, p.regions, [], placed);
    for (let i = 0; i < 6; i++) {
      expect(b.cand[CAT][2][i]).toBe(false);
      expect(b.cand[CAT][i][c]).toBe(false);
    }
    for (const [dr, dc] of [
      [-1, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
    ])
      if (2 + dr >= 0 && c + dc >= 0 && c + dc < 6) expect(b.cand[CAT][2 + dr][c + dc]).toBe(false);
  });

  it('grades boards with its own scale, and the rule is part of the digest', () => {
    const p = generateSoloPuzzle({ size: 5, seed: 1 });
    const prof = profileSoloBoard(5, p.regions, []);
    expect(prof.rule).toBe('solo');
    expect(prof.solved).toBe(true);
    expect(prof.placements).toBe(5);
    expect(profileOf(p)).toEqual(prof);
    expect(puzzleDigest(p)).not.toBe(puzzleDigest({ ...p, rule: undefined }));
    // Singles-only boards are always Easy.
    let easy = 0;
    for (let seed = 1; seed < 40; seed++) {
      const q = generateSoloPuzzle({ size: 5, seed });
      const pr = profileSoloBoard(5, q.regions, []);
      if (pr.hardest === 'single') {
        expect(pr.tier).toBe('easy');
        easy++;
      }
    }
    expect(easy).toBeGreaterThan(3);
  });
});

describe('one-animal sessions', () => {
  const p = generateSoloPuzzle({ size: 6, seed: 3 });
  const cells = () => {
    const out: Array<[number, number]> = [];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (p.solution[r][c] === CAT) out.push([r, c]);
    return out;
  };

  it('wins after one animal per row, with no unit celebrations', async () => {
    const { Session } = await import('../../src/game/session');
    const s = new Session(p);
    expect(s.rule).toBe('solo');
    expect(s.total).toBe(6);
    for (const [r, c] of cells()) {
      const res = s.place(r, c, CAT);
      expect(res.wrong).toBeUndefined();
      expect(res.completed).toEqual([]);
    }
    expect(s.outcome).toBe('won');
  });

  it('a wrong animal costs a heart and is not kept', async () => {
    const { Session } = await import('../../src/game/session');
    const s = new Session(p, { maxHearts: 5 });
    const [r, c] = cells()[0];
    const wrongC = (c + 3) % 6;
    const res = s.place(r, wrongC, CAT);
    expect(res.wrong).toBe(true);
    expect(s.hearts).toBe(4);
    expect(s.cells[r][wrongC]).toBe(EMPTY);
  });

  it('tap toggles ✕ and never touches an animal', async () => {
    const { Session, MARK } = await import('../../src/game/session');
    const s = new Session(p);
    const [r, c] = cells()[0];
    const e = (c + 2) % 6;
    expect(s.toggleMark(r, e).marked).toBe(true);
    expect(s.cells[r][e]).toBe(MARK);
    expect(s.toggleMark(r, e).unmarked).toBe(true);
    expect(s.cells[r][e]).toBe(EMPTY);
    s.place(r, c, CAT);
    expect(s.toggleMark(r, c).ignored).toBe(true);
    expect(s.cells[r][c]).toBe(CAT);
  });

  it('hints walk the board to the solution, and dead tiles surround each animal', async () => {
    const { Session } = await import('../../src/game/session');
    const s = new Session(p);
    let guard = 0;
    while (s.outcome === 'playing' && guard++ < 20) {
      const h = s.peekHint();
      expect(h).not.toBeNull();
      expect(p.solution[h!.r][h!.c]).toBe(CAT);
      expect(h!.species).toBe(CAT);
      s.hint();
      const dead = s.deadCells();
      // Every tile touching a placed animal is dead (or holds an animal).
      for (let r = 0; r < 6; r++)
        for (let c = 0; c < 6; c++)
          if (s.cells[r][c] === CAT)
            for (const [dr, dc] of [
              [-1, -1],
              [-1, 1],
              [1, -1],
              [1, 1],
              [0, 1],
              [1, 0],
            ])
              if (r + dr >= 0 && c + dc >= 0 && r + dr < 6 && c + dc < 6 && s.cells[r + dr][c + dc] === EMPTY) expect(dead[r + dr][c + dc]).toBe(true);
    }
    expect(s.outcome).toBe('won');
    expect(guard).toBe(6);
  });

  it('restores from a snapshot and rejects a dog', async () => {
    const { Session } = await import('../../src/game/session');
    const s = new Session(p);
    const [r, c] = cells()[1];
    s.place(r, c, CAT);
    const snap = s.snapshot();
    const back = Session.restore(p, snap)!;
    expect(back.cells[r][c]).toBe(CAT);
    expect(back.rule).toBe('solo');
    const bad = { ...snap, cells: snap.cells.map((row) => row.slice()) };
    bad.cells[r][c] = DOG;
    expect(Session.restore(p, bad)).toBeNull();
  });
});
