/**
 * Offline Paw Cup practice. The five weekly boards are the real ones (same for everyone, derived from the UTC week),
 * with the real rules: no hints, no revives, two attempts per board, best attempt counts. Scores are computed by
 * replaying the attempt's own event log through the same verifier a server would run — but they are computed on
 * this device, so they are always shown as PRACTICE scores: never ranked against anyone, never called verified.
 */

import { utcWeekKey } from '../game/dates';
import type { ModeRef } from '../game/modes';
import { puzzleFor } from '../game/puzzles';
import type { SessionEvent } from '../game/session';
import type { CupAttemptRecord, SaveV2 } from '../services/storage';
import { CUP_ATTEMPTS_PER_BOARD, CUP_BOARD_COUNT, cupBoardSpec } from './cup';
import type { ScoreBreakdown } from './scoring';
import { verifyAttempt } from './verify';

type CupMode = Extract<ModeRef, { kind: 'cup' }>;

export function cupKey(weekKey: string, index: number): string {
  return `C${weekKey}-${index}`;
}

export function attemptsFor(save: Pick<SaveV2, 'cup'>, weekKey: string, index: number): CupAttemptRecord[] {
  return save.cup.attempts[cupKey(weekKey, index)] ?? [];
}

export function attemptsLeft(save: Pick<SaveV2, 'cup'>, weekKey: string, index: number): number {
  return Math.max(0, CUP_ATTEMPTS_PER_BOARD - attemptsFor(save, weekKey, index).length);
}

/** Opens a new attempt. Returns false when both attempts for this board are used. */
export function startAttempt(save: SaveV2, mode: CupMode, now = new Date()): boolean {
  if (attemptsLeft(save, mode.weekKey, mode.index) <= 0) return false;
  const key = cupKey(mode.weekKey, mode.index);
  save.cup.attempts[key] = [...attemptsFor(save, mode.weekKey, mode.index), { at: now.toISOString(), completed: false, seconds: 0, mistakes: 0, score: 0 }];
  return true;
}

/** Closes the latest attempt with a score recomputed from its event log. */
export function finishAttempt(save: SaveV2, mode: CupMode, events: SessionEvent[], elapsedMs: number): ScoreBreakdown {
  const spec = cupBoardSpec(mode.weekKey, mode.index);
  const v = verifyAttempt({ puzzle: puzzleFor(mode), events, parSeconds: spec.parSeconds, ranked: true, serverElapsedMs: elapsedMs });
  const list = attemptsFor(save, mode.weekKey, mode.index);
  const rec: CupAttemptRecord = { at: list[list.length - 1]?.at ?? new Date().toISOString(), completed: v.completed && v.valid, seconds: v.elapsedSeconds, mistakes: v.mistakes, score: v.score.total };
  if (list.length) list[list.length - 1] = rec;
  else list.push(rec);
  save.cup.attempts[cupKey(mode.weekKey, mode.index)] = list;
  return v.score;
}

export function bestAttempt(save: Pick<SaveV2, 'cup'>, weekKey: string, index: number): CupAttemptRecord | null {
  let best: CupAttemptRecord | null = null;
  for (const a of attemptsFor(save, weekKey, index)) {
    if (!best || a.score > best.score || (a.score === best.score && a.seconds < best.seconds)) best = a;
  }
  return best && best.score > 0 ? best : null;
}

export interface WeekSummary {
  weekKey: string;
  total: number;
  boardsCleared: number;
  cleanClears: number;
  attemptsUsed: number;
}

export function weekSummary(save: Pick<SaveV2, 'cup'>, weekKey = utcWeekKey()): WeekSummary {
  let total = 0;
  let cleared = 0;
  let clean = 0;
  let used = 0;
  for (let i = 0; i < CUP_BOARD_COUNT; i++) {
    used += attemptsFor(save, weekKey, i).length;
    const b = bestAttempt(save, weekKey, i);
    if (!b) continue;
    total += b.score;
    cleared++;
    if (b.mistakes === 0) clean++;
  }
  return { weekKey, total, boardsCleared: cleared, cleanClears: clean, attemptsUsed: used };
}

/** The ISO week before `weekKey` (for "you vs last week"). */
export function previousWeekKey(now = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - 7);
  return utcWeekKey(d);
}
