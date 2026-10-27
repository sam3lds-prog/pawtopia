/**
 * What a finished board means for the save: journey advance, best times, stars, daily streak (with a
 * monthly Cozy Day), and lifetime stats. Pure apart from mutating the passed save, so it is easy to test.
 * Rewards (coins, unlocks, achievements) layer on top in `meta/rewards.ts`.
 */

import type { ModeRef } from '../game/modes';
import { daysBetween, monthKey, prevDateKey, localDateKey, localWeekStart } from '../game/dates';
import type { SaveV2 } from '../services/storage';

export interface BoardResult {
  size: number;
  seconds: number;
  mistakes: number;
  hintsUsed: number;
  revives: number;
  /** Whether hearts were in play (Journey, Daily, Cup). Zen mistakes don't make a comeback. */
  hearts: boolean;
  /** Spec of the board that was solved (src/game/specs.ts); missing = 1. */
  spec?: 1 | 2;
}

export interface WinRecord {
  firstClear: boolean;
  isBest: boolean;
  prevBest: number | null;
  stars: number;
  clean: boolean;
  hintFree: boolean;
  /** Daily only. */
  streak?: number;
  usedCozyDay?: boolean;
  newDaily?: boolean;
}

export function starsFor(r: BoardResult): number {
  return 1 + (r.mistakes === 0 ? 1 : 0) + (r.hintsUsed === 0 ? 1 : 0);
}

export function recordWin(save: SaveV2, mode: ModeRef, r: BoardResult, now = new Date()): WinRecord {
  const at = now.toISOString();
  const clean = r.mistakes === 0;
  const hintFree = r.hintsUsed === 0;
  const stars = starsFor(r);
  const out: WinRecord = { firstClear: false, isBest: false, prevBest: null, stars, clean, hintFree };

  if (mode.kind === 'level') {
    const key = `L${mode.level}`;
    const prev = save.journey.clears[key];
    const spec = r.spec ?? 1;
    // Times only compare on the same board: a level number that moved to a new spec starts its records fresh
    // (the clear itself, its stars and its one-time rewards are kept).
    const sameBoard = !prev || (prev.spec ?? 1) === spec;
    const prevBest = sameBoard ? save.journey.bestTimes[key] : undefined;
    out.prevBest = prevBest ?? null;
    out.isBest = prevBest === undefined || r.seconds < prevBest;
    if (out.isBest) save.journey.bestTimes[key] = r.seconds;
    out.firstClear = !prev;
    save.journey.clears[key] = prev
      ? {
          ...prev,
          bestSeconds: sameBoard && prev.bestSeconds > 0 ? Math.min(prev.bestSeconds, r.seconds) : r.seconds,
          bestMistakes: sameBoard ? Math.min(prev.bestMistakes, r.mistakes) : r.mistakes,
          clean: prev.clean || clean,
          hintFree: prev.hintFree || hintFree,
          stars: Math.max(prev.stars, stars),
        }
      : { firstClearAt: at, bestSeconds: r.seconds, bestMistakes: r.mistakes, clean, hintFree, stars };
    const cl = save.journey.clears[key];
    if (spec === 2) cl.spec = 2;
    else delete cl.spec;
    if (mode.level >= save.journey.nextLevel) save.journey.nextLevel = mode.level + 1;
    if (mode.level === 1) save.onboarding.tutorialDone = true;
  } else if (mode.kind === 'daily') {
    const key = `D${mode.dateKey}`;
    const prevBest = save.daily.bestTimes[key];
    out.prevBest = prevBest ?? null;
    out.isBest = prevBest === undefined || r.seconds < prevBest;
    if (out.isBest) save.daily.bestTimes[key] = r.seconds;
    if (!save.daily.done[mode.dateKey]) {
      out.firstClear = true;
      out.newDaily = true;
      save.daily.done[mode.dateKey] = { at, seconds: r.seconds, mistakes: r.mistakes };
      const s = advanceStreak(save, mode.dateKey);
      out.streak = s.streak;
      out.usedCozyDay = s.usedCozyDay;
    } else {
      out.streak = save.daily.streak;
    }
  } else if (mode.kind === 'zen') {
    save.zen.solved++;
  }

  // Lifetime stats (all modes).
  save.stats.solved++;
  if (clean) save.stats.clean++;
  if (hintFree) save.stats.hintFree++;
  if (r.hearts && (r.revives > 0 || r.mistakes >= 2)) save.stats.comebacks++;
  const sizeKey = String(r.size);
  const prevSize = save.stats.bestBySize[sizeKey];
  if (prevSize === undefined || r.seconds < prevSize) save.stats.bestBySize[sizeKey] = r.seconds;
  const today = localDateKey(now);
  save.stats.playDays[today] = true;
  const wk = localWeekStart(today);
  // `sizesThisWeek` keys are `${weekStart}:${size}` so old weeks never count toward this week.
  save.stats.sizesThisWeek[`${wk}:${sizeKey}`] = true;
  return out;
}

/**
 * Daily streak: +1 when yesterday's daily was done. Missing exactly one day is forgiven once per calendar
 * month with a free Cozy Day. Otherwise the streak restarts at 1. Collections are never affected.
 */
export function advanceStreak(save: SaveV2, dateKey: string): { streak: number; usedCozyDay: boolean } {
  const d = save.daily;
  let usedCozyDay = false;
  // An older daily (clock or time zone moved back, or catching up) is recorded but never touches the streak.
  if (d.lastDate && daysBetween(d.lastDate, dateKey) < 0) return { streak: d.streak, usedCozyDay };
  if (d.lastDate === prevDateKey(dateKey)) {
    d.streak += 1;
  } else if (d.lastDate && daysBetween(d.lastDate, dateKey) === 2 && d.streak > 0 && !d.cozyDays[monthKey(dateKey)]) {
    d.cozyDays[monthKey(dateKey)] = prevDateKey(dateKey);
    d.streak += 1;
    usedCozyDay = true;
  } else if (d.lastDate === dateKey) {
    // Same day again: unchanged.
  } else {
    d.streak = 1;
  }
  // Only move lastDate forward (playing an older daily never rewinds the streak window).
  if (!d.lastDate || daysBetween(d.lastDate, dateKey) > 0) d.lastDate = dateKey;
  d.bestStreak = Math.max(d.bestStreak, d.streak);
  return { streak: d.streak, usedCozyDay };
}

/** Streak as the player should see it today: 0 if it already lapsed beyond Cozy Day help. */
export function liveStreak(save: SaveV2, today = localDateKey()): number {
  const d = save.daily;
  if (!d.lastDate || d.streak === 0) return 0;
  const gap = daysBetween(d.lastDate, today);
  if (gap <= 1) return d.streak;
  if (gap === 2 && !d.cozyDays[monthKey(today)]) return d.streak; // still rescuable today
  return 0;
}

export function recordLoss(save: SaveV2): void {
  save.stats.losses++;
}
