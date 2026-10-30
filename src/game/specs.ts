/**
 * Versioned puzzle specs: which board a Journey level or a Daily date gets.
 *
 * Spec 1 is the original ladder (`src/engine/levels.ts`, unchanged): sizes only ever grow and reach 9×9 at level 71
 * and on weekend dailies. Spec 2 caps every new board at 8×8, rotates 5×5–8×8 so size and difficulty vary
 * independently, and picks each board by its *measured* difficulty (src/game/grading.ts) instead of trusting what a
 * level asked for.
 *
 * Nothing already issued changes: levels 1–70 and every daily before DAILY_V2_FROM stay on spec 1, saved boards
 * remember the spec they were built with (SavedSession.specVersion) and resume on it, and Paw Cup is untouched.
 */

import { generatePuzzle } from '../engine/generator';
import { hashString } from '../engine/rng';
import { generateSoloPuzzle } from '../engine/solo';
import type { Difficulty, Puzzle } from '../engine/types';
import { dateFromKey } from './dates';
import { profileOf } from './grading';
import { FIRST_PAIR_LEVEL } from './modes';

export type SpecVersion = 1 | 2 | 3 | 4;

/** First Journey level on spec 2. Levels 61–70 were already 8×8 and stay exactly as players saw them. */
export const JOURNEY_V2_FROM = 71;
/** First Daily date (local) on spec 2. Earlier dates keep their original boards. */
export const DAILY_V2_FROM = '2026-10-27';
/** No newly issued board is larger than this (Paw Cup keeps its published lineup). */
export const MAX_NEW_BOARD_SIZE = 8;
/** Candidates tried per board when searching for a target difficulty. */
export const SEARCH_TRIES = 80;

export interface TargetSpec {
  size: number;
  tier: Difficulty;
  /** Seed namespace; candidate k uses hashString(`${seedKey}#${k}`). */
  seedKey: string;
  /** 'solo': a one-animal board (D35). */
  rule?: 'solo';
}

type Slot = [number, Difficulty];

/**
 * Ten-level blocks. Sizes rotate so a small board can be hard and a big one gentle; every block ends on a big board.
 * Chapters 4–5 (levels 71–100) use block A; from level 101 block B leans harder.
 */
const BLOCK_A: Slot[] = [
  [5, 'hard'],
  [6, 'medium'],
  [7, 'medium'],
  [8, 'hard'],
  [6, 'hard'],
  [7, 'expert'],
  [5, 'expert'],
  [8, 'medium'],
  [7, 'hard'],
  [8, 'expert'],
];
const BLOCK_B: Slot[] = [
  [6, 'hard'],
  [7, 'medium'],
  [8, 'hard'],
  [5, 'expert'],
  [7, 'hard'],
  [8, 'expert'],
  [6, 'expert'],
  [8, 'medium'],
  [7, 'expert'],
  [8, 'hard'],
];

export function journeyTargetV2(level: number): TargetSpec {
  const block = level >= 101 ? BLOCK_B : BLOCK_A;
  const [size, tier] = block[(((level - JOURNEY_V2_FROM) % 10) + 10) % 10];
  return { size, tier, seedKey: `journey-v2-${level}` };
}

// ------------------------------------------------------------------ spec 3: the steeper Journey (D31)

/** First Journey level on spec 3. Levels 1–5 (the first lessons) keep their boards. */
export const JOURNEY_V3_FROM = 6;
/** Largest Journey board on spec 3 (9×9 is back, from about level 40). */
export const MAX_JOURNEY_SIZE = 9;

/** Levels 6–20, one by one: straight to 7×7, a first 8×8 at 15, and two smaller breathers. */
const V3_EARLY: Record<number, Slot> = {
  6: [7, 'easy'],
  7: [7, 'easy'],
  8: [7, 'easy'],
  9: [7, 'medium'],
  10: [6, 'medium'],
  11: [7, 'medium'],
  12: [7, 'medium'],
  13: [7, 'hard'],
  14: [6, 'hard'],
  15: [8, 'easy'],
  16: [7, 'medium'],
  17: [7, 'hard'],
  18: [8, 'medium'],
  19: [7, 'hard'],
  20: [8, 'medium'],
};
/** Levels 21–40: 7×7 and 8×8, 8×8 the more common; the first 9×9 closes the block at 40. */
const V3_B: Slot[] = [
  [7, 'hard'],
  [8, 'medium'],
  [7, 'hard'],
  [8, 'medium'],
  [8, 'hard'],
  [6, 'expert'],
  [8, 'medium'],
  [8, 'hard'],
  [7, 'expert'],
  [8, 'hard'],
];
/** Levels 41–70: mostly 8×8, with a 9×9 every few levels. */
const V3_C: Slot[] = [
  [8, 'hard'],
  [9, 'medium'],
  [8, 'hard'],
  [7, 'expert'],
  [8, 'expert'],
  [9, 'medium'],
  [8, 'hard'],
  [6, 'expert'],
  [9, 'hard'],
  [8, 'expert'],
];
/** Levels 71–100: 9×9 is the main size. */
const V3_D: Slot[] = [
  [9, 'medium'],
  [8, 'expert'],
  [9, 'hard'],
  [9, 'hard'],
  [7, 'expert'],
  [9, 'hard'],
  [8, 'expert'],
  [9, 'expert'],
  [9, 'medium'],
  [9, 'hard'],
];
/** Levels 101+: harder still, with an occasional smaller expert board. */
const V3_E: Slot[] = [
  [9, 'hard'],
  [9, 'expert'],
  [8, 'expert'],
  [9, 'hard'],
  [9, 'expert'],
  [7, 'expert'],
  [9, 'hard'],
  [9, 'expert'],
  [8, 'expert'],
  [9, 'hard'],
];

export function journeyTargetV3(level: number): TargetSpec {
  let slot: Slot;
  if (V3_EARLY[level]) slot = V3_EARLY[level];
  else if (level === 40) slot = [9, 'medium'];
  else if (level <= 40) slot = V3_B[(level - 21) % 10];
  else if (level <= 70) slot = V3_C[(level - 41) % 10];
  else if (level <= 100) slot = V3_D[(level - 71) % 10];
  else slot = V3_E[(level - 101) % 10];
  const [size, tier] = slot;
  return { size, tier, seedKey: `journey-v3-${level}` };
}

/** Weekday ladder, gentle early in the week and biggest at the weekend, never above 8×8. Index = getDay(). */
const DAILY_V2: Slot[] = [
  [8, 'expert'], // Sun
  [6, 'medium'], // Mon
  [7, 'medium'], // Tue
  [7, 'hard'], // Wed
  [8, 'medium'], // Thu
  [6, 'hard'], // Fri
  [8, 'hard'], // Sat
];

export function dailyTargetV2(dateKey: string): TargetSpec {
  const [size, tier] = DAILY_V2[dateFromKey(dateKey).getDay()];
  return { size, tier, seedKey: `daily-v2-${dateKey}` };
}

// ------------------------------------------------------------------ spec 4: one animal first (D35)

/**
 * Journey levels 1–20 are one-animal boards. From level 21 the two-animal Journey starts again from its first lesson:
 * level L plays the very board that two-animal level L − 20 always had (the five original lessons, then the spec-3
 * ramp), so nothing new has to be generated or verified for it.
 */
export const SOLO_LEVELS = FIRST_PAIR_LEVEL - 1;
/** The first two-animal Journey level (the lesson that introduces the second animal). */
export const TWO_ANIMAL_LEVEL = FIRST_PAIR_LEVEL;

/** Levels 1–20, one by one: three 5×5 lessons, then up to 9×9 by level 17, with smaller breathers. */
const V4_SOLO: Slot[] = [
  [5, 'easy'],
  [5, 'easy'],
  [5, 'medium'],
  [6, 'easy'],
  [6, 'medium'],
  [6, 'medium'],
  [7, 'easy'],
  [7, 'medium'],
  [6, 'hard'],
  [7, 'medium'],
  [7, 'hard'],
  [8, 'easy'],
  [8, 'medium'],
  [7, 'hard'],
  [8, 'medium'],
  [8, 'hard'],
  [9, 'medium'],
  [8, 'hard'],
  [9, 'medium'],
  [9, 'hard'],
];

export function journeyTargetSolo(level: number): TargetSpec {
  const [size, tier] = V4_SOLO[Math.max(0, Math.min(SOLO_LEVELS, level) - 1)];
  return { size, tier, seedKey: `journey-solo-${level}`, rule: 'solo' };
}

/** Whether a Journey level is a one-animal board under a spec. */
export function isSoloLevel(level: number, spec: SpecVersion): boolean {
  return spec === 4 && level <= SOLO_LEVELS;
}

/**
 * The id a Journey board's rewards and leaderboard awards are kept under (D35): one-animal levels are `S1`–`S20`, and a
 * level from 21 uses the number of the two-animal level whose board it plays (`L1` for level 21). Ids follow the
 * board, not the level number, so a board solved before D35 (as level L) never pays again as level L + 20.
 */
export function levelRewardKey(level: number): string {
  return level <= SOLO_LEVELS ? `S${level}` : `L${level - SOLO_LEVELS}`;
}

/** The two-animal level (and the spec it was issued under) whose board a spec-4 level from 21 plays. */
export function pairSourceOf(level: number): { level: number; spec: SpecVersion } {
  const p = level - SOLO_LEVELS;
  return { level: p, spec: p >= JOURNEY_V3_FROM ? 3 : 1 };
}

/** Daily one-animal boards (for players who haven't reached two animals yet), never above 8×8. Index = getDay(). */
const DAILY_SOLO: Slot[] = [
  [8, 'medium'], // Sun
  [6, 'easy'], // Mon
  [6, 'medium'], // Tue
  [7, 'medium'], // Wed
  [7, 'hard'], // Thu
  [6, 'hard'], // Fri
  [8, 'hard'], // Sat
];

export function dailyTargetSolo(dateKey: string): TargetSpec {
  const [size, tier] = DAILY_SOLO[dateFromKey(dateKey).getDay()];
  return { size, tier, seedKey: `daily-solo-${dateKey}`, rule: 'solo' };
}

const RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2, expert: 3 };

/**
 * The difficulty a date's Daily pays Paw Points for (D35). A date has two Dailies (one animal until the two-animal
 * lesson, two after) and both pay the same: the easier of the two weekday slots, so nobody gains by playing the other
 * board. Dailies from before the measured slots (spec 1) pay for what was played, as they always did.
 */
export function dailyPointsTier(dateKey: string, measured?: Difficulty): Difficulty | undefined {
  if (dateKey < DAILY_V2_FROM) return measured;
  const two = dailyTargetV2(dateKey).tier;
  const one = dailyTargetSolo(dateKey).tier;
  return RANK[two] <= RANK[one] ? two : one;
}

/**
 * Deterministically finds a board whose measured difficulty matches the target: candidate seeds are tried in a fixed
 * order and the first match wins, so every device picks the same board. If none of the candidates match, the closest
 * one is used and it is labeled with what it really is (labels always come from the measurement, never the target).
 */
export function pickBoard(t: TargetSpec, tries = SEARCH_TRIES): Puzzle {
  let best: Puzzle | null = null;
  let bestDist = Infinity;
  for (let k = 0; k < tries; k++) {
    const seed = hashString(`${t.seedKey}#${k}`);
    const p = t.rule === 'solo' ? generateSoloPuzzle({ size: t.size, seed }) : generatePuzzle({ size: t.size, seed });
    const dist = Math.abs(RANK[profileOf(p).tier] - RANK[t.tier]);
    if (dist === 0) return p;
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  if (!best) throw new Error(`no board for ${t.seedKey}`);
  return best;
}
