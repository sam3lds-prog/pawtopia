/**
 * Difficulty grading from measured reasoning, not from what a level asked for.
 *
 * The engine's own `grade()` (inside the frozen generator) looks only at the hardest technique and how sparse the
 * givens are. That is a fine generator filter but a coarse label: a board that needs one pointing step and a board
 * that needs a long run of them both read "Medium". This module replays the same human deduction engine step by step
 * and measures how much thinking a board asks for, then derives the label shown to players from those numbers.
 *
 * It lives outside `src/engine/` on purpose (D1): it only calls the engine's public step functions and never changes
 * what the engine does, so every shipped board and every existing test stays exactly as it was.
 *
 * Bump GRADING_VERSION whenever a threshold or formula changes; curated packs record the version they were graded with.
 */

import { applyMove, createBoard, nextMove, type Board, type Technique } from '../engine/deduce';
import { applySoloMove, createSoloBoard, nextSoloMove, SOLO_RANK } from '../engine/solo';
import { CAT, DOG, EMPTY, type Difficulty, type Given, type Puzzle, type Rule, type Species } from '../engine/types';
import { puzzleDigest } from './puzzleDigest';

export const GRADING_VERSION = 1;

export interface DifficultyProfile {
  gradingVersion: number;
  /** Which rule the board is played with (missing in profiles made before the one-animal rule: two animals). */
  rule?: Rule;
  size: number;
  /** Pets already home at the start. */
  givens: number;
  /** Placements the player has to make (2n − givens). */
  placements: number;
  /** Every deduction step the engine took (placements + eliminations). */
  steps: number;
  /** Elimination steps by technique. Placements always come from singles. */
  pointing: number;
  neighborLock: number;
  /** One-animal boards only: pigeonhole steps (k regions that fit only in k lines). */
  subset?: number;
  hardest: Technique | null;
  /** Placements that are forced by a single before any thinking: how many easy ways in there are. */
  openingSingles: number;
  /** Times the board went quiet (no single anywhere) and needed a pointing / neighbor-lock idea to move on. */
  breakthroughs: number;
  /** The longest run of eliminations in a row before the next placement appears. */
  longestChain: number;
  /** Composite reasoning load (see `scoreOf`). */
  score: number;
  /** The label players see. */
  tier: Difficulty;
  /** Solvable by logic alone (always true for shipped boards). */
  solved: boolean;
}

/** Score cut-offs for each label. Calibrated with `npm run grade:report` (docs/DIFFICULTY.md). */
export const TIER_THRESHOLDS = { hard: 18, expert: 34 } as const;

/**
 * Reasoning load. Each breakthrough is the moment a player has to stop scanning for singles and find an idea; a long
 * chain means the idea is several steps deep; neighbor-locks are the least obvious technique; few opening singles
 * and sparse givens make the start harder. Weights were chosen so the score separates the engine's own bands and
 * rises smoothly with size (see the calibration report), then fixed under GRADING_VERSION 1.
 */
export function scoreOf(p: Omit<DifficultyProfile, 'score' | 'tier' | 'gradingVersion'>): number {
  const opening = Math.max(0, 3 - p.openingSingles); // 0 when the start offers 3+ easy placements
  const sparse = Math.max(0, Math.round(p.size / 3) - p.givens); // fewer pets home than ~n/3
  const load = 3 * p.breakthroughs + 2 * Math.max(0, p.longestChain - 1) + 2 * p.neighborLock + Math.min(p.pointing, 12) / 2 + 2 * opening + 2 * sparse;
  // The same chain of reasoning is harder to spot on a bigger board (more cells to scan, more candidates to hold).
  const sizeFactor = 0.8 + 0.07 * (p.size - 5);
  return load * sizeFactor;
}

export function tierFor(score: number, hardest: Technique | null): Difficulty {
  // Easy means singles only: every placement is "the one spot left in a line", however long the board is.
  if (hardest === null || hardest === 'single') return 'easy';
  // Anything that needs an idea beyond singles is at least Medium. Expert additionally needs neighbor logic.
  if (score >= TIER_THRESHOLDS.expert && hardest === 'neighbor-lock') return 'expert';
  if (score >= TIER_THRESHOLDS.hard) return 'hard';
  return 'medium';
}

interface UnitCells {
  cells: Array<[number, number]>;
}

function unitsOf(b: Board): UnitCells[] {
  const n = b.size;
  const out: UnitCells[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ cells: Array.from({ length: n }, (_, c) => [i, c] as [number, number]) });
    out.push({ cells: Array.from({ length: n }, (_, r) => [r, i] as [number, number]) });
  }
  const byRegion = new Map<number, Array<[number, number]>>();
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const k = b.regions[r][c];
      if (!byRegion.has(k)) byRegion.set(k, []);
      byRegion.get(k)!.push([r, c]);
    }
  for (const cells of byRegion.values()) out.push({ cells });
  return out;
}

/** Distinct cells a single forces right now. */
function singlesNow(b: Board): number {
  const forced = new Set<string>();
  for (const u of unitsOf(b))
    for (const s of [CAT, DOG] as Species[]) {
      if (u.cells.some(([r, c]) => b.placed[r][c] === s)) continue;
      const cs = u.cells.filter(([r, c]) => b.cand[s][r][c]);
      if (cs.length === 1) forced.add(`${cs[0][0]},${cs[0][1]}`);
    }
  return forced.size;
}

/** Measures a board. Pure and deterministic: the same board always gets the same profile. */
export function profileBoard(size: number, regions: number[][], givens: Given[]): DifficultyProfile {
  const b = createBoard(size, regions, givens);
  const openingSingles = singlesNow(b);
  let steps = 0;
  let pointing = 0;
  let neighborLock = 0;
  let breakthroughs = 0;
  let chain = 0;
  let longestChain = 0;
  let hardest: Technique | null = null;
  const rank: Record<Technique, number> = { single: 1, pointing: 2, 'neighbor-lock': 3, subset: 4 };
  for (;;) {
    const m = nextMove(b);
    if (!m) break;
    applyMove(b, m);
    steps++;
    if (!hardest || rank[m.technique] > rank[hardest]) hardest = m.technique;
    if (m.kind === 'place') {
      chain = 0;
    } else {
      if (chain === 0) breakthroughs++;
      chain++;
      longestChain = Math.max(longestChain, chain);
      if (m.technique === 'pointing') pointing++;
      else if (m.technique === 'neighbor-lock') neighborLock++;
    }
    if (steps > size * size * 20) break; // safety, mirrors the engine
  }
  let placed = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (b.placed[r][c] !== EMPTY) placed++;
  const base = {
    size,
    givens: givens.length,
    placements: 2 * size - givens.length,
    steps,
    pointing,
    neighborLock,
    hardest,
    openingSingles,
    breakthroughs,
    longestChain,
    solved: placed === 2 * size,
  };
  const score = Math.round(scoreOf(base) * 10) / 10;
  return { ...base, gradingVersion: GRADING_VERSION, score, tier: tierFor(score, hardest) };
}

// ------------------------------------------------------------------ one-animal boards (D35)

/** Score cut-offs for one-animal boards, calibrated separately (their ideas and lengths differ). */
export const SOLO_TIER_THRESHOLDS = { hard: 16, expert: 40 } as const;

/**
 * Reasoning load on a one-animal board. Same idea as `scoreOf`: moments that need a new idea, how deep each idea goes,
 * and how unusual the idea is (looking ahead, then pigeonholes), weighted up for bigger boards.
 */
export function soloScoreOf(p: {
  size: number;
  breakthroughs: number;
  longestChain: number;
  pointing: number;
  neighborLock: number;
  subset: number;
  openingSingles: number;
}): number {
  const opening = Math.max(0, 2 - p.openingSingles);
  const load =
    3 * p.breakthroughs +
    1.5 * Math.max(0, p.longestChain - 1) +
    1.5 * Math.min(p.neighborLock, 10) +
    4 * p.subset +
    Math.min(p.pointing, 12) / 2 +
    2 * opening;
  return load * (0.8 + 0.07 * (p.size - 5));
}

export function soloTierFor(score: number, hardest: Technique | null): Difficulty {
  if (hardest === null || hardest === 'single') return 'easy';
  if (hardest === 'pointing') return score >= SOLO_TIER_THRESHOLDS.hard ? 'hard' : 'medium';
  if (score >= SOLO_TIER_THRESHOLDS.expert && hardest === 'subset') return 'expert';
  if (score >= SOLO_TIER_THRESHOLDS.hard) return 'hard';
  return 'medium';
}

function soloSinglesNow(b: Board): number {
  const n = b.size;
  const forced = new Set<string>();
  const lines: Array<Array<[number, number]>> = [];
  for (let i = 0; i < n; i++) {
    lines.push(Array.from({ length: n }, (_, c) => [i, c] as [number, number]));
    lines.push(Array.from({ length: n }, (_, r) => [r, i] as [number, number]));
  }
  const regs = new Map<number, Array<[number, number]>>();
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const g = b.regions[r][c];
      if (!regs.has(g)) regs.set(g, []);
      regs.get(g)!.push([r, c]);
    }
  for (const cells of [...lines, ...regs.values()]) {
    if (cells.some(([r, c]) => b.placed[r][c] !== EMPTY)) continue;
    const cs = cells.filter(([r, c]) => b.cand[CAT][r][c]);
    if (cs.length === 1) forced.add(`${cs[0][0]},${cs[0][1]}`);
  }
  return forced.size;
}

/** Measures a one-animal board with the one-animal engine. */
export function profileSoloBoard(size: number, regions: number[][], givens: Given[]): DifficultyProfile {
  const b = createSoloBoard(size, regions, givens);
  const openingSingles = soloSinglesNow(b);
  let steps = 0;
  let pointing = 0;
  let neighborLock = 0;
  let subset = 0;
  let breakthroughs = 0;
  let chain = 0;
  let longestChain = 0;
  let hardest: Technique | null = null;
  for (;;) {
    const m = nextSoloMove(b);
    if (!m) break;
    applySoloMove(b, m);
    steps++;
    if (!hardest || SOLO_RANK[m.technique] > SOLO_RANK[hardest]) hardest = m.technique;
    if (m.kind === 'place') chain = 0;
    else {
      if (chain === 0) breakthroughs++;
      chain++;
      longestChain = Math.max(longestChain, chain);
      if (m.technique === 'pointing') pointing++;
      else if (m.technique === 'neighbor-lock') neighborLock++;
      else if (m.technique === 'subset') subset++;
    }
    if (steps > size * size * 4) break;
  }
  let placed = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (b.placed[r][c] !== EMPTY) placed++;
  const score = Math.round(soloScoreOf({ size, breakthroughs, longestChain, pointing, neighborLock, subset, openingSingles }) * 10) / 10;
  return {
    gradingVersion: GRADING_VERSION,
    rule: 'solo',
    size,
    givens: givens.length,
    placements: size - givens.length,
    steps,
    pointing,
    neighborLock,
    subset,
    hardest,
    openingSingles,
    breakthroughs,
    longestChain,
    score,
    tier: soloTierFor(score, hardest),
    solved: placed === size,
  };
}

const memo = new Map<string, DifficultyProfile>();

/** Profile of a puzzle, memoized by layout digest (grading an 8×8 takes a few milliseconds). */
export function profileOf(p: Pick<Puzzle, 'size' | 'regions' | 'givens' | 'rule'>): DifficultyProfile {
  const key = puzzleDigest(p);
  const hit = memo.get(key);
  if (hit) return hit;
  const prof = p.rule === 'solo' ? profileSoloBoard(p.size, p.regions, p.givens) : profileBoard(p.size, p.regions, p.givens);
  memo.set(key, prof);
  if (memo.size > 64) memo.delete(memo.keys().next().value as string);
  return prof;
}

/** The difficulty label for a puzzle, from its measured profile. */
export function displayDifficulty(p: Pick<Puzzle, 'size' | 'regions' | 'givens' | 'rule'>): Difficulty {
  return profileOf(p).tier;
}

/** One short, honest sentence about why a board has its label. */
export function difficultyReason(prof: DifficultyProfile): string {
  const bits: string[] = [];
  if (prof.tier === 'easy')
    return prof.hardest === 'single' || prof.hardest === null ? 'Every step is a single spot left in a line.' : 'Mostly single spots, with one small idea.';
  if (prof.breakthroughs >= 4) bits.push(`${prof.breakthroughs} moments that need a new idea`);
  else if (prof.breakthroughs > 0)
    bits.push(prof.breakthroughs === 1 ? 'one moment that needs a new idea' : `${prof.breakthroughs} moments that need a new idea`);
  if (prof.longestChain >= 4) bits.push('long chains of reasoning');
  if (prof.neighborLock > 0) bits.push('neighbor logic');
  if ((prof.subset ?? 0) > 0) bits.push('colors that share whole rows');
  // One-animal boards always start empty, so the head start only says something on two-animal boards.
  if (prof.rule !== 'solo' && prof.givens <= Math.max(1, Math.round(prof.size / 3)))
    bits.push(prof.givens === 0 ? 'no animals to start' : prof.givens === 1 ? 'one animal to start' : 'few animals to start');
  const s = bits.slice(0, 3).join(', ');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) + '.' : 'Needs a little more than single spots.';
}
