/**
 * Turns a ModeRef into its Puzzle. Everything here is deterministic, so a mode reference is enough to
 * rebuild the exact board on any device (resume, share, verification).
 */

import { generatePuzzle } from '../engine/generator';
import { dailySpec, levelSpec } from '../engine/levels';
import type { Difficulty, Puzzle } from '../engine/types';
import { profileOf } from './grading';
import { cupBoardSpec } from '../competitions/cup';
import { dateFromKey } from './dates';
import type { ModeRef } from './modes';
import { modeKey } from './modes';
import { LEVEL_PACK } from '../data/levelPack';
import { JOURNEY_PACK_2 } from '../data/journeyPack2';
import { decodePack, type PackLevel, type PackLevel2 } from '../data/packFormat';
import { DAILY_V2_FROM, JOURNEY_V2_FROM, dailyTargetV2, journeyTargetV2, pickBoard, type SpecVersion } from './specs';

export type { SpecVersion } from './specs';

/**
 * Bump when the generator's output for an existing (size, seed, difficulty) changes. Saved sessions and
 * competitive events record the version they were built with; a mismatch means "don't resume this".
 */
export const GENERATOR_VERSION = 1;

export type PuzzleSource = (mode: ModeRef, spec: SpecVersion) => Puzzle | null;

const PACK = new Map(decodePack(LEVEL_PACK).map((e) => [e.level, e]));
const PACK_2 = new Map(decodePack(JOURNEY_PACK_2).map((e) => [e.level, e]));

/**
 * The spec a mode's board is issued under today. Journey levels from JOURNEY_V2_FROM and dailies from DAILY_V2_FROM
 * use spec 2 (5×5–8×8, measured difficulty); everything else, including Zen and Paw Cup, stays on spec 1.
 */
export function currentSpec(mode: ModeRef): SpecVersion {
  if (mode.kind === 'level') return mode.level >= JOURNEY_V2_FROM ? 2 : 1;
  if (mode.kind === 'daily') return mode.dateKey >= DAILY_V2_FROM ? 2 : 1;
  return 1;
}

/**
 * The frozen, verified Journey packs: levels 1–60 (launch pack, identical to v1) and 61–150 (pack 2). A pack board is
 * used only for the spec it was issued under, so a board saved under spec 1 at level 75 still finds its 9×9.
 */
export const levelPackSource: PuzzleSource = (mode, spec) => {
  if (mode.kind !== 'level') return null;
  const first = PACK.get(mode.level);
  if (first) return first.puzzle;
  const second = PACK_2.get(mode.level);
  return second && second.meta.spec === spec ? second.puzzle : null;
};

/**
 * Measured difficulty of a shipped Journey board without generating anything (packs only), or undefined when the
 * board isn't in a pack (beyond 150, or an old spec-1 board at 71+).
 */
export function packedLevelTier(level: number, spec: SpecVersion): Difficulty | undefined {
  const first = PACK.get(level);
  if (first) return profileOf(first.puzzle).tier;
  const second = PACK_2.get(level);
  return second && second.meta.spec === spec ? second.meta.tier : undefined;
}

/** Pack-2 metadata (spec, measured tier) for a level, or null outside 61–150. */
export function journeyMeta(level: number): PackLevel2 | null {
  return PACK_2.get(level)?.meta ?? null;
}

/** Grading metadata for a shipped level (null beyond the pack). */
export function levelMeta(level: number): PackLevel | null {
  return PACK.get(level)?.meta ?? null;
}

/** Curated/frozen boards consulted before generating. Defaults to the launch pack. */
let packSource: PuzzleSource | null = levelPackSource;
export function setPuzzlePack(src: PuzzleSource | null): void {
  packSource = src;
  cache.clear();
}

const cache = new Map<string, Puzzle>();
const CACHE_MAX = 12;

/** The board for a mode. `spec` defaults to the one the mode is issued under now; saved boards pass their own. */
export function puzzleFor(mode: ModeRef, spec: SpecVersion = currentSpec(mode)): Puzzle {
  const key = `${modeKey(mode)}@${spec}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = packSource?.(mode, spec) ?? generateFor(mode, spec);
  cache.set(key, p);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return p;
}

function generateFor(mode: ModeRef, version: SpecVersion): Puzzle {
  switch (mode.kind) {
    case 'level': {
      if (version === 2) return pickBoard(journeyTargetV2(mode.level));
      const spec = levelSpec(mode.level);
      return generatePuzzle({ size: spec.size, seed: spec.seed, difficulty: spec.difficulty });
    }
    case 'daily': {
      if (version === 2) return pickBoard(dailyTargetV2(mode.dateKey));
      const spec = dailySpec(dateFromKey(mode.dateKey));
      return generatePuzzle({ size: spec.size, seed: spec.seed, difficulty: spec.difficulty });
    }
    case 'zen':
      return generatePuzzle({ size: mode.size, seed: mode.seed });
    case 'cup': {
      const spec = cupBoardSpec(mode.weekKey, mode.index);
      return generatePuzzle({ size: spec.size, seed: spec.seed, difficulty: spec.difficulty });
    }
  }
}

/** Size of the board a mode will produce, without generating it. */
export function sizeFor(mode: ModeRef, spec: SpecVersion = currentSpec(mode)): number {
  switch (mode.kind) {
    case 'level':
      return spec === 2 ? journeyTargetV2(mode.level).size : levelSpec(mode.level).size;
    case 'daily':
      return spec === 2 ? dailyTargetV2(mode.dateKey).size : dailySpec(dateFromKey(mode.dateKey)).size;
    case 'zen':
      return mode.size;
    case 'cup':
      return cupBoardSpec(mode.weekKey, mode.index).size;
  }
}

export { puzzleDigest } from './puzzleDigest';

export function modeTitle(mode: ModeRef): string {
  switch (mode.kind) {
    case 'level':
      return `Level ${mode.level}`;
    case 'daily':
      return 'Daily Cozy Puzzle';
    case 'zen':
      return 'Zen Garden';
    case 'cup':
      return `Paw Cup · Board ${mode.index + 1}`;
  }
}

/** Compact title for the in-game top bar. */
export function modeShortTitle(mode: ModeRef): string {
  switch (mode.kind) {
    case 'level':
      return `Level ${mode.level}`;
    case 'daily':
      return 'Daily';
    case 'zen':
      return 'Zen';
    case 'cup':
      return `Cup ${mode.index + 1}`;
  }
}
