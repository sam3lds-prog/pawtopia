/**
 * Economy tuning. Paw Coins are free, earned only by playing, and spent only on cosmetic decor.
 * Nothing here can be bought with real money, and nothing affects puzzle rules or rankings.
 * Values are configuration, not UI logic; tune them from telemetry.
 */

export const ECONOMY = {
  /** First clear of a Journey level. Replays earn nothing (no farming). */
  journeyFirstClear: 35,
  /** First time a Journey level is solved with zero mistakes. */
  journeyCleanBonus: 10,
  /** First clear of a day's Daily Cozy Puzzle. */
  dailyFirstClear: 15,
  /** Clean bonus on the daily. */
  dailyCleanBonus: 10,
  /** Completing a 20-level chapter. Comes with that chapter's decoration gift. */
  chapterComplete: 100,
  /** Zen and Paw Cup boards never pay coins (Zen is for calm; Cup rewards come from the league). */
  zen: 0,
  cup: 0,
} as const;

/** Decor price bands (spec: basic 60–150, special 200–400). */
export const PRICE = { basic: [60, 150], special: [200, 400] } as const;
