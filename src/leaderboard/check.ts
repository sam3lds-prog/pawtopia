/**
 * Checks one solved board for the leaderboard. Pure and shared: the Cloud Function runs exactly this, and so does the
 * on-device test leaderboard. The client never sends points. It sends which board it solved (Journey level or Daily
 * date, and the spec it was issued under) and its move log; this rebuilds the official board, replays every move with
 * that mode's rules and computes the Paw Points itself, with the same table the app uses (`meta/points.ts`).
 *
 * Each award has a stable id (`L12`, `clean:L12`, `nohint:L12`, `D2026-10-29`), so a board pays at most once per
 * account however often it is sent. Both Dailies of a date share one id: a day's Daily pays once, whichever was played.
 */

import { MAX_EVENTS, verifyAttempt } from '../competitions/verify';
import type { Difficulty } from '../engine/types';
import { addDaysKey } from '../game/dates';
import { profileOf } from '../game/grading';
import { rulesFor, type ModeRef } from '../game/modes';
import { currentSpec, puzzleFor } from '../game/puzzles';
import { isSessionEvent, type SessionEvent } from '../game/session';
import type { SpecVersion } from '../game/specs';
import { POINTS } from '../meta/points';

/** A Daily is either the two-animal board or (for players before two animals, D35) the one-animal board of that date. */
export type BoardRef = { kind: 'level'; level: number } | { kind: 'daily'; dateKey: string; rule?: 'solo' };

export interface SolveSubmission {
  mode: BoardRef;
  spec: SpecVersion;
  events: SessionEvent[];
}

export interface Award {
  id: string;
  points: number;
}

export type RejectReason = 'bad-board' | 'bad-spec' | 'out-of-window' | 'too-long' | 'invalid-log' | 'not-solved' | 'too-fast';

export type CheckResult =
  { ok: true; key: string; awards: Award[]; tier: Difficulty; mistakes: number; hintsUsed: number } | { ok: false; key: string; reason: RejectReason };

/** Highest Journey level accepted (far beyond anything a person can reach). */
export const MAX_LEVEL = 5000;
/** A Daily counts if solved within this many days of its date (late sync after playing offline). */
export const DAILY_WINDOW_DAYS = 7;
/** Faster than this per placement on average is not a person playing; it doesn't count (never banned, just not counted). */
export const MIN_MS_PER_PLACEMENT = 250;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function boardKey(b: BoardRef): string {
  return b.kind === 'level' ? `L${b.level}` : `D${b.dateKey}`;
}

/** Shape check for anything arriving from a client. */
export function parseSubmission(x: unknown): SolveSubmission | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const m = o.mode as Record<string, unknown> | undefined;
  if (!m || typeof m !== 'object') return null;
  let mode: BoardRef;
  if (m.kind === 'level' && Number.isInteger(m.level)) mode = { kind: 'level', level: m.level as number };
  else if (m.kind === 'daily' && typeof m.dateKey === 'string' && (m.rule === undefined || m.rule === 'solo'))
    mode = { kind: 'daily', dateKey: m.dateKey, ...(m.rule === 'solo' ? { rule: 'solo' as const } : {}) };
  else return null;
  if (o.spec !== 1 && o.spec !== 2 && o.spec !== 3 && o.spec !== 4) return null;
  if (!Array.isArray(o.events) || o.events.length > MAX_EVENTS || !o.events.every(isSessionEvent)) return null;
  return { mode, spec: o.spec, events: o.events };
}

function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function checkSolve(sub: SolveSubmission, now: Date): CheckResult {
  const key = boardKey(sub.mode);
  const fail = (reason: RejectReason): CheckResult => ({ ok: false, key, reason });
  const m = sub.mode;
  if (m.kind === 'level' && (m.level < 1 || m.level > MAX_LEVEL)) return fail('bad-board');
  if (m.kind === 'daily') {
    if (!DATE_KEY.test(m.dateKey) || Number.isNaN(Date.parse(`${m.dateKey}T12:00:00Z`))) return fail('bad-board');
    // Local dates run up to a day ahead of UTC; late syncs are allowed for a week.
    const today = utcDateKey(now);
    if (m.dateKey > addDaysKey(today, 1) || m.dateKey < addDaysKey(today, -DAILY_WINDOW_DAYS)) return fail('out-of-window');
  }
  const mode = m as ModeRef;
  // A board counts only on the spec it is issued under today (a forger can't pick the better-paying one).
  if (sub.spec !== currentSpec(mode)) return fail('bad-spec');
  if (sub.events.length > MAX_EVENTS) return fail('too-long');
  let puzzle;
  try {
    puzzle = puzzleFor(mode, sub.spec);
  } catch {
    return fail('bad-spec');
  }
  // Each hint is logged once per target cell, so a board can't have more hints than cells; the cap also bounds the
  // replay's cost (every hint runs the deduction engine).
  if (sub.events.filter((e) => e.type === 'hint').length > puzzle.size * puzzle.size) return fail('invalid-log');
  const rules = rulesFor(mode);
  const v = verifyAttempt({ puzzle, events: sub.events, parSeconds: 1, ranked: false, hearts: rules.hearts, maxHearts: rules.maxHearts });
  if (!v.valid) return fail('invalid-log');
  if (!v.completed) return fail('not-solved');
  if (v.placements > 0 && v.logMs / v.placements < MIN_MS_PER_PLACEMENT) return fail('too-fast');

  const tier = profileOf(puzzle).tier;
  const clean = v.mistakes === 0;
  const hintFree = v.hintsUsed === 0;
  const awards: Award[] = [];
  if (m.kind === 'level') {
    awards.push({ id: key, points: POINTS.journeyBase + POINTS.difficulty[tier] });
    if (clean) awards.push({ id: `clean:${key}`, points: POINTS.clean });
    if (hintFree) awards.push({ id: `nohint:${key}`, points: POINTS.hintFree });
  } else {
    awards.push({ id: key, points: POINTS.dailyBase + POINTS.difficulty[tier] + (clean ? POINTS.clean : 0) + (hintFree ? POINTS.hintFree : 0) });
  }
  return { ok: true, key, awards, tier, mistakes: v.mistakes, hintsUsed: v.hintsUsed };
}

/** The award ids a solve could still earn, given which ones the account already has (to skip pointless sends). */
export function possibleAwards(b: BoardRef, mistakes: number, hintsUsed: number): string[] {
  const key = boardKey(b);
  if (b.kind === 'daily') return [key];
  return [key, ...(mistakes === 0 ? [`clean:${key}`] : []), ...(hintsUsed === 0 ? [`nohint:${key}`] : [])];
}
