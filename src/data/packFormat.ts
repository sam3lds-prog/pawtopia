/** Compact, typed format for frozen level packs, plus the verification every shipped board must pass. */

import { deduce } from '../engine/deduce';
import { countSolutions, isValidSolution } from '../engine/solver';
import { CAT, DOG, EMPTY, type Difficulty, type Kind, type Puzzle, type Species } from '../engine/types';

export interface PackLevel {
  level: number;
  size: number;
  difficulty: Difficulty;
  seed: number;
  /** One string per row, one digit (region id) per cell. */
  regions: string[];
  /** One string per row: '.' empty, 'C' cat, 'D' dog. */
  solution: string[];
  givens: Array<[number, number, 1 | 2]>;
  /** Hardest deduction technique the engine needed. */
  technique: 'single' | 'pointing' | 'neighbor-lock' | null;
  /** Logical steps the engine took. */
  steps: number;
}

export interface PackFile {
  v: 1;
  generatorVersion: number;
  levels: PackLevel[];
}

/**
 * Journey pack 2 (levels 61+). Same board encoding, plus the spec the level belongs to and its measured difficulty
 * (src/game/grading.ts) so the label shown to players is the one the board was verified with.
 */
export interface PackLevel2 extends PackLevel {
  spec: 1 | 2 | 3;
  /** What the spec asked for (spec 2 and 3). */
  target?: Difficulty;
  /** Measured label and score under `gradingVersion`. */
  tier: Difficulty;
  score: number;
}

export interface PackFile2 {
  v: 2;
  generatorVersion: number;
  gradingVersion: number;
  levels: PackLevel2[];
}

export function encodeBoard(level: number, p: Puzzle): PackLevel {
  const d = deduce(p.size, p.regions, p.givens);
  return {
    level,
    size: p.size,
    difficulty: p.difficulty,
    seed: p.seed,
    regions: p.regions.map((row) => row.join('')),
    solution: p.solution.map((row) => row.map((v) => (v === CAT ? 'C' : v === DOG ? 'D' : '.')).join('')),
    givens: p.givens.map((g) => [g.r, g.c, g.kind as 1 | 2]),
    technique: d.hardest,
    steps: d.moves,
  };
}

export function decodeLevel(l: PackLevel): Puzzle {
  return {
    size: l.size,
    regions: l.regions.map((row) => [...row].map(Number)),
    solution: l.solution.map((row) => [...row].map((ch) => (ch === 'C' ? CAT : ch === 'D' ? DOG : EMPTY) as Kind)),
    givens: l.givens.map(([r, c, k]) => ({ r, c, kind: k as Species })),
    difficulty: l.difficulty,
    seed: l.seed,
  };
}

export function decodePack(f: PackFile): Array<{ level: number; puzzle: Puzzle; meta: PackLevel }>;
export function decodePack(f: PackFile2): Array<{ level: number; puzzle: Puzzle; meta: PackLevel2 }>;
export function decodePack(f: PackFile | PackFile2): Array<{ level: number; puzzle: Puzzle; meta: PackLevel | PackLevel2 }> {
  return (f.levels as PackLevel[]).map((l) => ({ level: l.level, puzzle: decodeLevel(l), meta: l }));
}

/** Returns a list of problems (empty = board is shippable). */
export function verifyBoard(p: Puzzle): string[] {
  const n = p.size;
  const out: string[] = [];
  if (p.regions.length !== n || p.regions.some((row) => row.length !== n)) return ['bad region grid shape'];
  // Regions: ids 0..n-1, each connected.
  const ids = new Set(p.regions.flat());
  if (ids.size !== n || [...ids].some((id) => id < 0 || id >= n)) out.push('region ids must be 0..n-1');
  for (const id of ids) {
    const cells: Array<[number, number]> = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (p.regions[r][c] === id) cells.push([r, c]);
    const seen = new Set<string>([`${cells[0][0]},${cells[0][1]}`]);
    const stack = [cells[0]];
    while (stack.length) {
      const [r, c] = stack.pop()!;
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const rr = r + dr;
        const cc = c + dc;
        const k = `${rr},${cc}`;
        if (rr >= 0 && cc >= 0 && rr < n && cc < n && p.regions[rr][cc] === id && !seen.has(k)) {
          seen.add(k);
          stack.push([rr, cc]);
        }
      }
    }
    if (seen.size !== cells.length) out.push(`region ${id} is not connected`);
  }
  if (!isValidSolution(n, p.regions, p.solution)) out.push('solution breaks the rules');
  for (const g of p.givens) if (p.solution[g.r]?.[g.c] !== g.kind) out.push(`given at ${g.r},${g.c} disagrees with the solution`);
  if (!p.givens.length) out.push('needs at least one given');
  const sols = countSolutions(n, p.regions, p.givens, 2);
  if (sols.count !== 1) out.push(`expected exactly one solution, found ${sols.count}`);
  if (!deduce(n, p.regions, p.givens).solved) out.push('not solvable by logic alone');
  return out;
}
