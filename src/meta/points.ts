/**
 * Paw Points per solved board. Pure (no save, no browser), shared by the app and the leaderboard server so both count
 * exactly the same way.
 */

import type { Difficulty } from '../engine/types';

export const POINTS = {
  journeyBase: 100,
  dailyBase: 60,
  difficulty: { easy: 0, medium: 25, hard: 50, expert: 100 } as Record<Difficulty, number>,
  clean: 25,
  hintFree: 25,
} as const;
