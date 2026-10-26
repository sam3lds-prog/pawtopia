/**
 * Ranked scoring (spec §8.4). Pure, integer-exact, and identical on client and server so a breakdown shown to the
 * player always matches what a server would compute. Only the server's result is ever "verified"; the client uses
 * the same function to show practice scores, which are labeled as such.
 *
 *   accuracy      = 150 (no mistakes) | 75 (one mistake) | 0
 *   timeComponent = round(300 × par / (par + elapsed))      (round half up, integer arithmetic)
 *   boardScore    = 550 + timeComponent + accuracy           (0 if not completed, any hint, or any revive)
 *   weekly total  = Σ best score per board (five boards)
 */

export const SCORING_VERSION = 'paw-1';
export const BASE_POINTS = 550;
export const TIME_POINTS = 300;
export const ACCURACY_POINTS = { clean: 150, oneMistake: 75 } as const;

export interface AttemptResult {
  completed: boolean;
  elapsedSeconds: number;
  mistakes: number;
  hintsUsed: number;
  revives: number;
}

export interface ScoreBreakdown {
  base: number;
  time: number;
  accuracy: number;
  total: number;
  /** Why the attempt scored zero, if it did. */
  void: 'incomplete' | 'hints' | 'revive' | null;
}

/** a / b rounded half up, for non-negative integers. */
export function roundDiv(a: number, b: number): number {
  return Math.floor((2 * a + b) / (2 * b));
}

export function scoreBreakdown(r: AttemptResult, parSeconds: number): ScoreBreakdown {
  const zero = (why: ScoreBreakdown['void']): ScoreBreakdown => ({ base: 0, time: 0, accuracy: 0, total: 0, void: why });
  if (!r.completed) return zero('incomplete');
  if (r.hintsUsed > 0) return zero('hints');
  if (r.revives > 0) return zero('revive');
  const par = Math.max(1, Math.round(parSeconds));
  const elapsed = Math.max(0, Math.floor(r.elapsedSeconds));
  const time = roundDiv(TIME_POINTS * par, par + elapsed);
  const accuracy = r.mistakes === 0 ? ACCURACY_POINTS.clean : r.mistakes === 1 ? ACCURACY_POINTS.oneMistake : 0;
  return { base: BASE_POINTS, time, accuracy, total: BASE_POINTS + time + accuracy, void: null };
}

export function boardScore(r: AttemptResult, parSeconds: number): number {
  return scoreBreakdown(r, parSeconds).total;
}

export interface BoardBest {
  score: number;
  mistakes: number;
  elapsedSeconds: number;
  /** When the counted attempt was verified (ISO). */
  verifiedAt: string;
}

export interface Standing {
  playerId: string;
  /** Best counted result per board index (missing = not played). */
  boards: Record<number, BoardBest>;
}

export interface StandingTotals {
  total: number;
  cleanClears: number;
  elapsed: number;
  lastVerifiedAt: string;
  boardsPlayed: number;
}

export function totals(s: Standing): StandingTotals {
  let total = 0;
  let cleanClears = 0;
  let elapsed = 0;
  let last = '';
  let played = 0;
  for (const b of Object.values(s.boards)) {
    if (b.score <= 0) continue;
    played++;
    total += b.score;
    if (b.mistakes === 0) cleanClears++;
    elapsed += b.elapsedSeconds;
    if (b.verifiedAt > last) last = b.verifiedAt;
  }
  return { total, cleanClears, elapsed, lastVerifiedAt: last, boardsPlayed: played };
}

/**
 * Ranking order (spec): higher total → more zero-mistake clears → lower summed elapsed → earlier final verified
 * completion. Never by spend, ads watched, or account age.
 */
export function compareStandings(a: Standing, b: Standing): number {
  const A = totals(a);
  const B = totals(b);
  if (A.total !== B.total) return B.total - A.total;
  if (A.cleanClears !== B.cleanClears) return B.cleanClears - A.cleanClears;
  if (A.elapsed !== B.elapsed) return A.elapsed - B.elapsed;
  if (A.lastVerifiedAt !== B.lastVerifiedAt) return A.lastVerifiedAt < B.lastVerifiedAt ? -1 : 1;
  return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
}

/** Keeps the better of two results for the same board. */
export function betterBest(a: BoardBest | undefined, b: BoardBest): BoardBest {
  if (!a) return b;
  if (b.score !== a.score) return b.score > a.score ? b : a;
  if (b.mistakes !== a.mistakes) return b.mistakes < a.mistakes ? b : a;
  if (b.elapsedSeconds !== a.elapsedSeconds) return b.elapsedSeconds < a.elapsedSeconds ? b : a;
  return a.verifiedAt <= b.verifiedAt ? a : b;
}
