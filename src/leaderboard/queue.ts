/** The device's queue of solved boards waiting for the leaderboard server. Pure, so it is unit-tested directly. */

import type { ModeRef } from '../game/modes';
import type { SessionEvent } from '../game/session';
import type { SpecVersion } from '../game/specs';
import { LB_PENDING_MAX, type LeaderboardSave } from '../services/storage';
import { boardKey, possibleAwards, type BoardRef } from './check';

/** Adds a solved Journey level or Daily, unless the player isn't on the leaderboard or it can't earn anything more. */
export function enqueueSolve(lb: LeaderboardSave, mode: ModeRef, spec: SpecVersion, events: SessionEvent[], mistakes: number, hintsUsed: number, now = new Date()): boolean {
  if (!lb.joined) return false;
  if (mode.kind !== 'level' && mode.kind !== 'daily') return false;
  const board: BoardRef = mode.kind === 'level' ? { kind: 'level', level: mode.level } : { kind: 'daily', dateKey: mode.dateKey };
  if (possibleAwards(board, mistakes, hintsUsed).every((id) => lb.awarded[id])) return false;
  lb.pending.push({ key: boardKey(board), mode: board, spec, events: events.map((e) => ({ ...e })), at: now.toISOString() });
  if (lb.pending.length > LB_PENDING_MAX) lb.pending.splice(0, lb.pending.length - LB_PENDING_MAX);
  return true;
}
