/**
 * Attempt replay verification — the logic a ranked server runs (spec §8.6). The client never submits a score: it
 * submits its discrete event log. The verifier replays every event on a fresh session built from the official board
 * (with the server-held solution), recomputes mistakes and completion itself, rejects anything ranked play forbids
 * (hints, revives, out-of-bounds or out-of-order events), and takes elapsed time from the SERVER clock.
 *
 * This file is pure and shared so the Phase 6 backend can import it unchanged. On the client it powers the local
 * practice cup, whose scores are always labeled unverified.
 */

import type { Puzzle } from '../engine/types';
import { Session, type SessionEvent } from '../game/session';
import { scoreBreakdown, type ScoreBreakdown } from './scoring';

export interface VerifyInput {
  puzzle: Puzzle;
  events: SessionEvent[];
  parSeconds: number;
  /** Server-measured duration of the attempt (start → finish), in ms. Authoritative when present. */
  serverElapsedMs?: number;
  /** Rules for ranked play. */
  ranked: boolean;
}

export type VerifyProblem =
  | 'too-many-events'
  | 'time-not-monotonic'
  | 'bad-coordinates'
  | 'given-modified'
  | 'hint-in-ranked'
  | 'revive-in-ranked'
  | 'events-after-finish'
  | 'client-clock-ahead-of-server'
  | 'unknown-event';

export interface VerifyResult {
  valid: boolean;
  problems: VerifyProblem[];
  completed: boolean;
  mistakes: number;
  hintsUsed: number;
  revives: number;
  elapsedSeconds: number;
  score: ScoreBreakdown;
  /** Not grounds for rejection, but worth a human look (e.g. implausibly fast placements). */
  flags: string[];
}

export const MAX_EVENTS = 4000;
/** Allowed client-vs-server clock skew before the log is considered tampered. */
export const CLOCK_TOLERANCE_MS = 3000;
/** Faster than this per placement, on average, is flagged for review (never auto-rejected). */
export const FAST_MS_PER_PLACEMENT = 250;

export function verifyAttempt(input: VerifyInput): VerifyResult {
  const { puzzle, events } = input;
  const n = puzzle.size;
  const problems = new Set<VerifyProblem>();
  const flags: string[] = [];
  let clockMs = 0;
  const s = new Session(puzzle, { hearts: true, now: () => clockMs });
  const inBounds = (r: number, c: number) => Number.isInteger(r) && Number.isInteger(c) && r >= 0 && c >= 0 && r < n && c < n;

  if (events.length > MAX_EVENTS) problems.add('too-many-events');
  let lastT = 0;
  let placements = 0;
  for (const e of events.slice(0, MAX_EVENTS)) {
    if (typeof e.t !== 'number' || !Number.isFinite(e.t) || e.t < lastT) {
      problems.add('time-not-monotonic');
      break;
    }
    lastT = e.t;
    clockMs = e.t;
    if (s.outcome === 'won' && e.type !== 'pause' && e.type !== 'resume') {
      problems.add('events-after-finish');
      break;
    }
    switch (e.type) {
      case 'place':
      case 'clear':
      case 'mark':
      case 'unmark': {
        if (!inBounds(e.r, e.c)) {
          problems.add('bad-coordinates');
          break;
        }
        if (s.givenMask[e.r][e.c]) {
          problems.add('given-modified');
          break;
        }
        if (e.type === 'place') {
          placements++;
          s.place(e.r, e.c, e.s);
        } else if (e.type === 'clear') s.apply(e.r, e.c, 'erase');
        else if (e.type === 'mark') s.markIfEmpty(e.r, e.c);
        else s.unmarkIfMarked(e.r, e.c);
        break;
      }
      case 'undo':
        s.undo();
        break;
      case 'redo':
        s.redo();
        break;
      case 'pause':
      case 'resume':
        break;
      case 'hint':
        if (input.ranked) problems.add('hint-in-ranked');
        else {
          const h = s.peekHint();
          if (h) {
            s.noteHint(h);
          }
        }
        break;
      case 'revive':
        if (input.ranked) problems.add('revive-in-ranked');
        else s.revive();
        break;
      default:
        problems.add('unknown-event');
    }
  }

  const completed = s.outcome === 'won';
  const logElapsed = lastT;
  if (input.serverElapsedMs !== undefined && logElapsed > input.serverElapsedMs + CLOCK_TOLERANCE_MS) problems.add('client-clock-ahead-of-server');
  const elapsedMs = input.serverElapsedMs ?? logElapsed;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (completed && placements > 0 && elapsedMs / placements < FAST_MS_PER_PLACEMENT) flags.push('very-fast-placements');

  const hintsUsed = input.ranked ? events.filter((e) => e.type === 'hint').length : s.hintsUsed;
  const revives = events.filter((e) => e.type === 'revive').length;
  const valid = problems.size === 0;
  const score = scoreBreakdown(
    { completed: valid && completed, elapsedSeconds, mistakes: s.mistakes, hintsUsed, revives },
    input.parSeconds,
  );
  return { valid, problems: [...problems], completed, mistakes: s.mistakes, hintsUsed, revives, elapsedSeconds, score, flags };
}
