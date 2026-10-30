/**
 * The one-animal rule (D35). Journey levels 1–20 are played this way before the two-animal rule (D1) takes over:
 *
 *  1. Every row, every column and every color region holds exactly one animal.
 *  2. Animals never touch, not even at a corner.
 *
 * A one-animal board keeps its animal as CAT, the board's "first animal" (which animal it shows is up to the game, not
 * the engine). Everything here mirrors the two-animal engine's shapes (`Board`, `Move`, `DeductionReport`), so the
 * session, hints and grading can drive either rule; on a one-animal board the DOG candidates are always false.
 *
 * Nothing in this file touches the two-animal engine, so every board issued before it stays exactly as it was.
 */

import { CAT, EMPTY, makeGrid, type Cell, type Given, type Kind, type Puzzle } from './types';
import type { Board, DeductionReport, Move, Technique } from './deduce';
import { mulberry32, randInt, shuffle, type Rng } from './rng';

/** Two different cells touch when they share an edge or a corner. */
export function touching(a: Cell, b: Cell): boolean {
  return (a.r !== b.r || a.c !== b.c) && Math.abs(a.r - b.r) <= 1 && Math.abs(a.c - b.c) <= 1;
}

// ------------------------------------------------------------------ exact solver

export interface SoloSolveResult {
  /** Solutions found (capped at `limit`). */
  count: number;
  solutions: Kind[][][];
  /** Search nodes visited, a rough hardness signal. */
  nodes: number;
}

/** Counts solutions row by row: each row picks one column, never next to the previous row's. Fast for n ≤ 10. */
export function countSoloSolutions(size: number, regions: number[][], givens: Given[], limit = 2): SoloSolveResult {
  const n = size;
  const col = new Array<number>(n).fill(-1);
  const colUsed = new Array<boolean>(n).fill(false);
  const regUsed = new Array<boolean>(n).fill(false);
  const fixed = new Array<number>(n).fill(-1);
  for (const g of givens) {
    if (fixed[g.r] >= 0 && fixed[g.r] !== g.c) return { count: 0, solutions: [], nodes: 0 };
    fixed[g.r] = g.c;
  }
  const solutions: Kind[][][] = [];
  let nodes = 0;
  const rec = (r: number): void => {
    if (solutions.length >= limit) return;
    if (r === n) {
      const grid = makeGrid<Kind>(n, EMPTY);
      for (let i = 0; i < n; i++) grid[i][col[i]] = CAT;
      solutions.push(grid);
      return;
    }
    nodes++;
    const prev = r > 0 ? col[r - 1] : -99;
    const from = fixed[r] >= 0 ? fixed[r] : 0;
    const to = fixed[r] >= 0 ? fixed[r] : n - 1;
    for (let c = from; c <= to; c++) {
      if (colUsed[c] || Math.abs(c - prev) < 2) continue;
      const g = regions[r][c];
      if (regUsed[g]) continue;
      col[r] = c;
      colUsed[c] = regUsed[g] = true;
      rec(r + 1);
      colUsed[c] = regUsed[g] = false;
      col[r] = -1;
      if (solutions.length >= limit) return;
    }
  };
  rec(0);
  return { count: solutions.length, solutions, nodes };
}

/** Validates a full one-animal grid (tests, the win check, the leaderboard verifier). */
export function isValidSoloSolution(size: number, regions: number[][], grid: Kind[][]): boolean {
  const n = size;
  const rows = new Array<number>(n).fill(0);
  const cols = new Array<number>(n).fill(0);
  const regs = new Array<number>(n).fill(0);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const k = grid[r][c];
      if (k === EMPTY) continue;
      if (k !== CAT) return false;
      rows[r]++;
      cols[c]++;
      regs[regions[r][c]]++;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && cc >= 0 && rr < n && cc < n && grid[rr][cc] !== EMPTY) return false;
        }
    }
  for (let i = 0; i < n; i++) if (rows[i] !== 1 || cols[i] !== 1 || regs[i] !== 1) return false;
  return true;
}

// ------------------------------------------------------------------ deduction (hints and grading)

export function createSoloBoard(size: number, regions: number[][], givens: Given[], placed?: Kind[][]): Board {
  const b: Board = { size, regions, placed: makeGrid<Kind>(size, EMPTY), cand: [[], makeGrid(size, true), makeGrid(size, false)] };
  for (const g of givens) applySoloPlacement(b, g.r, g.c);
  if (placed) {
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (placed[r][c] !== EMPTY && b.placed[r][c] === EMPTY) applySoloPlacement(b, r, c);
  }
  return b;
}

/** Places the animal at (r,c): its row, column, region and every touching cell can no longer hold one. */
export function applySoloPlacement(b: Board, r: number, c: number): void {
  const n = b.size;
  const cand = b.cand[CAT];
  b.placed[r][c] = CAT;
  const reg = b.regions[r][c];
  for (let i = 0; i < n; i++) {
    cand[r][i] = false;
    cand[i][c] = false;
  }
  for (let rr = 0; rr < n; rr++) for (let cc = 0; cc < n; cc++) if (b.regions[rr][cc] === reg) cand[rr][cc] = false;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < n && cc < n) cand[rr][cc] = false;
    }
}

type UnitKind = 'row' | 'column' | 'region';
interface Unit {
  kind: UnitKind;
  index: number;
  name: string;
  cells: Array<[number, number]>;
}

const unitCache = new WeakMap<number[][], Unit[]>();

function unitsOf(b: Board): Unit[] {
  const hit = unitCache.get(b.regions);
  if (hit) return hit;
  const n = b.size;
  const out: Unit[] = [];
  for (let r = 0; r < n; r++) out.push({ kind: 'row', index: r, name: `row ${r + 1}`, cells: Array.from({ length: n }, (_, c) => [r, c] as [number, number]) });
  for (let c = 0; c < n; c++)
    out.push({ kind: 'column', index: c, name: `column ${c + 1}`, cells: Array.from({ length: n }, (_, r) => [r, c] as [number, number]) });
  const regCells: Array<Array<[number, number]>> = Array.from({ length: n }, () => []);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) regCells[b.regions[r][c]].push([r, c]);
  regCells.forEach((cells, i) => out.push({ kind: 'region', index: i, name: `region ${i + 1}`, cells }));
  unitCache.set(b.regions, out);
  return out;
}

const filled = (b: Board, u: Unit) => u.cells.some(([r, c]) => b.placed[r][c] !== EMPTY);
const cands = (b: Board, u: Unit) => u.cells.filter(([r, c]) => b.cand[CAT][r][c]);

function listNames(kind: string, idx: number[]): string {
  const nums = idx.map((i) => i + 1);
  const words = nums.length === 2 ? `${nums[0]} and ${nums[1]}` : `${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`;
  return `${kind}s ${words}`;
}

const elim = (r: number, c: number, technique: Technique, reason: string): Move => ({ kind: 'eliminate', species: CAT, r, c, technique, reason });

/** k-subsets of `items` (k ≥ 2), smallest first. */
function* combos<T>(items: T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) {
    yield acc.slice();
    return;
  }
  for (let i = start; i <= items.length - (k - acc.length); i++) {
    acc.push(items[i]);
    yield* combos(items, k, i + 1, acc);
    acc.pop();
  }
}

/**
 * The next forced move a careful human could find, cheapest idea first:
 *  1. single         a row, column or region has one open spot left
 *  2. pointing       a region's open spots share one row or column (that line's animal lives there), or a line's open
 *                    spots sit in one region (that region's animal lives there)
 *  3. neighbor-lock  an animal here would touch, or share a line or region with, every open spot of some other unit
 *  4. subset         k regions fit only in k rows (or columns), so nothing else in those lines can hold an animal; and
 *                    the same with lines and regions swapped
 * Returns null when stuck (never on shipped boards).
 */
export function nextSoloMove(b: Board): Move | null {
  const n = b.size;
  const cand = b.cand[CAT];
  const units = unitsOf(b);
  const open = units.filter((u) => !filled(b, u));
  const rowsOpen = open.filter((u) => u.kind === 'row');
  const colsOpen = open.filter((u) => u.kind === 'column');
  const regsOpen = open.filter((u) => u.kind === 'region');

  // 1. singles
  for (const u of open) {
    const cs = cands(b, u);
    if (cs.length === 0) return null; // contradiction: only on a board that was never valid
    if (cs.length === 1) {
      const [r, c] = cs[0];
      return { kind: 'place', species: CAT, r, c, technique: 'single', reason: `Only one spot left for an animal in ${u.name}.` };
    }
  }

  // 2. pointing
  const regionOf = (r: number, c: number) => b.regions[r][c];
  for (const u of regsOpen) {
    const cs = cands(b, u);
    const rows = new Set(cs.map(([r]) => r));
    const cols = new Set(cs.map(([, c]) => c));
    if (rows.size === 1) {
      const r = [...rows][0];
      for (let c = 0; c < n; c++)
        if (cand[r][c] && regionOf(r, c) !== u.index)
          return elim(
            r,
            c,
            'pointing',
            `Every open spot in ${u.name} is in row ${r + 1}, so row ${r + 1}'s animal lives there and the rest of the row stays empty.`,
          );
    }
    if (cols.size === 1) {
      const c = [...cols][0];
      for (let r = 0; r < n; r++)
        if (cand[r][c] && regionOf(r, c) !== u.index)
          return elim(
            r,
            c,
            'pointing',
            `Every open spot in ${u.name} is in column ${c + 1}, so column ${c + 1}'s animal lives there and the rest of the column stays empty.`,
          );
    }
  }
  for (const u of [...rowsOpen, ...colsOpen]) {
    const cs = cands(b, u);
    const regs = new Set(cs.map(([r, c]) => regionOf(r, c)));
    if (regs.size !== 1) continue;
    const reg = [...regs][0];
    const inLine = (r: number, c: number) => (u.kind === 'row' ? r === u.index : c === u.index);
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (cand[r][c] && regionOf(r, c) === reg && !inLine(r, c))
          return elim(
            r,
            c,
            'pointing',
            `Every open spot in ${u.name} is in region ${reg + 1}, so that region's animal lives in ${u.name} and the rest of the region stays empty.`,
          );
  }

  // 3. neighbor-lock (one step of looking ahead)
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!cand[r][c]) continue;
      const reg = regionOf(r, c);
      const hits = (rr: number, cc: number) => rr === r || cc === c || regionOf(rr, cc) === reg || (Math.abs(rr - r) <= 1 && Math.abs(cc - c) <= 1);
      for (const u of open) {
        if (u.cells.some(([rr, cc]) => rr === r && cc === c)) continue;
        const cs = cands(b, u);
        if (!cs.every(([rr, cc]) => hits(rr, cc))) continue;
        const touchAll = cs.every(([rr, cc]) => Math.abs(rr - r) <= 1 && Math.abs(cc - c) <= 1);
        return elim(
          r,
          c,
          'neighbor-lock',
          touchAll
            ? `An animal here would touch every open spot in ${u.name}, leaving it no room.`
            : `An animal here would leave ${u.name} with no open spot, so this one stays empty.`,
        );
      }
    }

  // 4. subsets: k regions confined to k lines, or k lines confined to k regions (pigeonhole)
  const maxK = Math.max(2, regsOpen.length - 1);
  for (let k = 2; k <= maxK; k++) {
    for (const lineKind of ['row', 'column'] as const) {
      const lineOf = (r: number, c: number) => (lineKind === 'row' ? r : c);
      for (const set of combos(regsOpen, k)) {
        const ids = new Set(set.map((u) => u.index));
        const lines = new Set<number>();
        for (const u of set) for (const [r, c] of cands(b, u)) lines.add(lineOf(r, c));
        if (lines.size !== k) continue;
        for (let r = 0; r < n; r++)
          for (let c = 0; c < n; c++)
            if (cand[r][c] && lines.has(lineOf(r, c)) && !ids.has(regionOf(r, c)))
              return elim(
                r,
                c,
                'subset',
                `${cap(
                  listNames(
                    'region',
                    [...ids].sort((a, x) => a - x),
                  ),
                )} only fit in ${listNames(
                  lineKind,
                  [...lines].sort((a, x) => a - x),
                )}, so nothing else in those ${lineKind}s can hold an animal.`,
              );
      }
      const linesOpen = lineKind === 'row' ? rowsOpen : colsOpen;
      for (const set of combos(linesOpen, k)) {
        const idx = new Set(set.map((u) => u.index));
        const regs = new Set<number>();
        for (const u of set) for (const [r, c] of cands(b, u)) regs.add(regionOf(r, c));
        if (regs.size !== k) continue;
        for (let r = 0; r < n; r++)
          for (let c = 0; c < n; c++)
            if (cand[r][c] && regs.has(regionOf(r, c)) && !idx.has(lineOf(r, c)))
              return elim(
                r,
                c,
                'subset',
                `${cap(
                  listNames(
                    lineKind,
                    [...idx].sort((a, x) => a - x),
                  ),
                )} only fit in ${listNames(
                  'region',
                  [...regs].sort((a, x) => a - x),
                )}, so the rest of those regions stays empty.`,
              );
      }
    }
  }
  return null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function applySoloMove(b: Board, m: Move): void {
  if (m.kind === 'place') applySoloPlacement(b, m.r, m.c);
  else b.cand[CAT][m.r][m.c] = false;
}

export const SOLO_RANK: Record<Technique, number> = { single: 1, pointing: 2, 'neighbor-lock': 3, subset: 4 };

/** Runs the engine to the end: whether logic alone solves it, and the hardest idea it needed. */
export function deduceSolo(size: number, regions: number[][], givens: Given[]): DeductionReport {
  const b = createSoloBoard(size, regions, givens);
  let hardest: Technique | null = null;
  let moves = 0;
  for (;;) {
    const m = nextSoloMove(b);
    if (!m) break;
    applySoloMove(b, m);
    moves++;
    if (!hardest || SOLO_RANK[m.technique] > SOLO_RANK[hardest]) hardest = m.technique;
    if (moves > size * size * 4) break; // safety: every move fills or removes a cell
  }
  let placed = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (b.placed[r][c] !== EMPTY) placed++;
  return { solved: placed === size, hardest, moves };
}

// ------------------------------------------------------------------ generator

/** A random placement of n animals, one per row and column, none touching (rows next to each other differ by ≥ 2). */
function placeAnimals(n: number, rng: Rng): number[] | null {
  const col = new Array<number>(n).fill(-1);
  const used = new Array<boolean>(n).fill(false);
  let budget = 5000;
  const rec = (r: number): boolean => {
    if (r === n) return true;
    if (--budget < 0) return false;
    for (const c of shuffle(rng, [...Array(n).keys()])) {
      if (used[c] || (r > 0 && Math.abs(c - col[r - 1]) < 2)) continue;
      col[r] = c;
      used[c] = true;
      if (rec(r + 1)) return true;
      used[c] = false;
      col[r] = -1;
    }
    return false;
  };
  return rec(0) ? col : null;
}

const N4: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Grows one region from each animal: every step a region (picked by its own growth rate) takes a neighboring cell. */
function growRegions(n: number, col: number[], rng: Rng): number[][] {
  const regions = makeGrid<number>(n, -1);
  for (let r = 0; r < n; r++) regions[r][col[r]] = r;
  // Uneven growth rates give a mix of big regions and small ones, which is what makes these boards interesting.
  const rate = Array.from({ length: n }, () => 0.15 + rng() * rng() * 2.4);
  let left = n * n - n;
  while (left > 0) {
    const frontier: Array<Array<[number, number]>> = Array.from({ length: n }, () => []);
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (regions[r][c] !== -1) continue;
        const seen = new Set<number>();
        for (const [dr, dc] of N4) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
          const g = regions[rr][cc];
          if (g >= 0 && !seen.has(g)) {
            seen.add(g);
            frontier[g].push([r, c]);
          }
        }
      }
    let total = 0;
    for (let g = 0; g < n; g++) if (frontier[g].length) total += rate[g];
    let pick = rng() * total;
    let g = 0;
    for (; g < n; g++) {
      if (!frontier[g].length) continue;
      pick -= rate[g];
      if (pick <= 0) break;
    }
    if (g >= n) g = frontier.findIndex((f) => f.length > 0);
    const [r, c] = frontier[g][randInt(rng, frontier[g].length)];
    regions[r][c] = g;
    left--;
  }
  return regions;
}

/** Whether region `g` stays connected without cell (r,c). */
function connectedWithout(regions: number[][], g: number, r0: number, c0: number): boolean {
  const n = regions.length;
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (regions[r][c] === g && (r !== r0 || c !== c0)) cells.push([r, c]);
  if (!cells.length) return false;
  const seen = new Set<number>([cells[0][0] * n + cells[0][1]]);
  const q = [cells[0]];
  while (q.length) {
    const [r, c] = q.pop()!;
    for (const [dr, dc] of N4) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n || (rr === r0 && cc === c0) || regions[rr][cc] !== g) continue;
      const k = rr * n + cc;
      if (!seen.has(k)) {
        seen.add(k);
        q.push([rr, cc]);
      }
    }
  }
  return seen.size === cells.length;
}

/**
 * Reshapes regions until the planted placement is the only solution: each round finds another solution and hands one
 * of its animal cells to a neighboring region, which breaks that solution and never the planted one (every region
 * keeps its planted animal and stays connected).
 */
function makeUnique(n: number, regions: number[][], col: number[], rng: Rng, rounds: number): boolean {
  for (let i = 0; i < rounds; i++) {
    const res = countSoloSolutions(n, regions, [], 2);
    if (res.count === 1) return true;
    const other = res.solutions.find((s) => s.some((row, r) => row[col[r]] !== CAT));
    if (!other) return false;
    const spots: Array<[number, number]> = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (other[r][c] === CAT && col[r] !== c) spots.push([r, c]);
    let moved = false;
    for (const [r, c] of shuffle(rng, spots)) {
      const from = regions[r][c];
      const targets = new Set<number>();
      for (const [dr, dc] of N4) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < n && cc < n && regions[rr][cc] !== from) targets.add(regions[rr][cc]);
      }
      if (!targets.size || !connectedWithout(regions, from, r, c)) continue;
      const list = [...targets];
      regions[r][c] = list[randInt(rng, list.length)];
      moved = true;
      break;
    }
    if (!moved) return false;
  }
  return countSoloSolutions(n, regions, [], 2).count === 1;
}

export interface SoloGenerateOptions {
  size: number;
  seed: number;
}

/**
 * Generates a one-animal board deterministically from (size, seed): a valid placement, regions grown around it and
 * reshaped until the solution is unique, and kept only if the deduction engine can finish it from an empty board (no
 * guessing, no animals given). Region ids are shuffled so colors don't follow the rows.
 */
export function generateSoloPuzzle(opts: SoloGenerateOptions): Puzzle {
  const { size: n, seed } = opts;
  const rng = mulberry32((seed ^ Math.imul(n, 0x85ebca6b) ^ 0x51a0) >>> 0);
  for (let attempt = 0; attempt < 4000; attempt++) {
    const col = placeAnimals(n, rng);
    if (!col) continue;
    const grown = growRegions(n, col, rng);
    if (!makeUnique(n, grown, col, rng, 6 * n)) continue;
    const relabel = shuffle(rng, [...Array(n).keys()]);
    const regions = grown.map((row) => row.map((g) => relabel[g]));
    const rep = deduceSolo(n, regions, []);
    if (!rep.solved) continue;
    const solution = makeGrid<Kind>(n, EMPTY);
    for (let r = 0; r < n; r++) solution[r][col[r]] = CAT;
    const difficulty = rep.hardest === 'single' ? 'easy' : rep.hardest === 'pointing' ? 'medium' : rep.hardest === 'neighbor-lock' ? 'hard' : 'expert';
    return { size: n, regions, givens: [], solution, difficulty, seed, rule: 'solo' };
  }
  throw new Error(`Could not generate a ${n}×${n} one-animal board for seed ${seed}`);
}
