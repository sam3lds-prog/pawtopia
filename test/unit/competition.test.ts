import { describe, expect, it } from 'vitest';
import { betterBest, boardScore, compareStandings, roundDiv, scoreBreakdown, type Standing } from '../../src/competitions/scoring';
import { verifyAttempt } from '../../src/competitions/verify';
import { LEAGUE_RULES, pointsToNext, settleCohort, type CohortMember } from '../../src/competitions/leagueRules';
import { cupBoardSpec, CUP_ATTEMPTS_PER_BOARD } from '../../src/competitions/cup';
import { generatePuzzle } from '../../src/engine/generator';
import { CAT, DOG, EMPTY, type Species } from '../../src/engine/types';
import { Session, type SessionEvent } from '../../src/game/session';

const ok = { completed: true, mistakes: 0, hintsUsed: 0, revives: 0 };

describe('board score formula (spec §8.4 fixtures)', () => {
  it('matches the published examples at par 150', () => {
    expect(boardScore({ ...ok, elapsedSeconds: 75 }, 150)).toBe(900);
    expect(boardScore({ ...ok, elapsedSeconds: 150 }, 150)).toBe(850);
    expect(boardScore({ ...ok, elapsedSeconds: 300 }, 150)).toBe(800);
    expect(boardScore({ ...ok, elapsedSeconds: 150, mistakes: 1 }, 150)).toBe(775);
    expect(boardScore({ ...ok, elapsedSeconds: 150, mistakes: 2 }, 150)).toBe(700);
  });
  it('is zero for incomplete, hinted or revived attempts', () => {
    expect(scoreBreakdown({ ...ok, completed: false, elapsedSeconds: 10 }, 150).void).toBe('incomplete');
    expect(scoreBreakdown({ ...ok, hintsUsed: 1, elapsedSeconds: 10 }, 150).void).toBe('hints');
    expect(scoreBreakdown({ ...ok, revives: 1, elapsedSeconds: 10 }, 150).void).toBe('revive');
  });
  it('stays below 1000 for any positive time and rounds half up in integers', () => {
    expect(boardScore({ ...ok, elapsedSeconds: 1 }, 90)).toBeLessThan(1000);
    expect(boardScore({ ...ok, elapsedSeconds: 0 }, 90)).toBe(1000);
    expect(roundDiv(5, 2)).toBe(3);
    expect(roundDiv(7, 3)).toBe(2);
    expect(roundDiv(300 * 240, 240 + 3600)).toBe(19); // 18.75 → 19
  });
});

describe('standings', () => {
  const st = (id: string, boards: Standing['boards']): Standing => ({ playerId: id, boards });
  const b = (score: number, mistakes = 0, elapsedSeconds = 100, verifiedAt = '2026-10-20T10:00:00Z') => ({ score, mistakes, elapsedSeconds, verifiedAt });

  it('orders by total, then clean clears, then elapsed, then earlier finish', () => {
    const a = st('a', { 0: b(850), 1: b(800, 1) });
    const c = st('c', { 0: b(825), 1: b(825) });
    expect(compareStandings(a, c)).toBeGreaterThan(0); // same total 1650; c has more clean clears
    const d = st('d', { 0: b(850, 0, 90), 1: b(800, 1, 100) });
    expect(compareStandings(d, a)).toBeLessThan(0); // faster
    const e = st('e', { 0: b(850, 0, 100, '2026-10-20T09:00:00Z'), 1: b(800, 1, 100, '2026-10-20T09:00:00Z') });
    expect(compareStandings(e, a)).toBeLessThan(0); // earlier
  });
  it('keeps the better attempt per board', () => {
    expect(betterBest(b(800), b(850)).score).toBe(850);
    expect(betterBest(b(850, 0, 90), b(850, 0, 120)).elapsedSeconds).toBe(90);
  });
  it('pawprints to next place', () => {
    const list = [st('a', { 0: b(900) }), st('me', { 0: b(850) }), st('z', { 0: b(700) })];
    expect(pointsToNext(list, 'me')).toEqual({ rank: 1, gap: 51 });
    expect(pointsToNext(list, 'a')).toBeNull();
  });
});

describe('league settlement', () => {
  const member = (i: number, total: number, tier: CohortMember['tier'] = 'bronze', provisional = false): CohortMember => ({
    standing: { playerId: `p${i}`, boards: total ? { 0: { score: total, mistakes: 0, elapsedSeconds: 100, verifiedAt: '2026-10-20T00:00:00Z' } } : {} },
    tier,
    provisional,
  });
  it('promotes the top five and relegates the bottom three of a healthy cohort', () => {
    const ms = Array.from({ length: 20 }, (_, i) => member(i, 1000 - i * 10));
    const r = settleCohort(ms);
    expect(r.filter((m) => m.movement === 'promote').map((m) => m.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(r.filter((m) => m.movement === 'relegate').map((m) => m.rank)).toEqual([18, 19, 20]);
    expect(r.find((m) => m.rank === 1)?.nextTier).toBe('silver');
  });
  it('never relegates in a sparse cohort, and never punishes skipping a week', () => {
    const ms = [...Array.from({ length: 10 }, (_, i) => member(i, 900 - i)), member(99, 0)];
    const r = settleCohort(ms);
    expect(r.some((m) => m.movement === 'relegate')).toBe(false);
    expect(r.find((m) => m.playerId === 'p99')).toMatchObject({ movement: 'stay', nextTier: 'bronze' });
  });
  it('provisional players are not relegated', () => {
    const ms = Array.from({ length: 20 }, (_, i) => member(i, 1000 - i * 10, 'bronze', i === 19));
    expect(settleCohort(ms).find((m) => m.playerId === 'p19')?.movement).toBe('stay');
  });
  it('rewards are coins and cosmetics only', () => {
    const r = settleCohort(Array.from({ length: 20 }, (_, i) => member(i, 1000 - i)));
    for (const m of r) for (const c of m.cosmetics) expect(typeof c).toBe('string');
    expect(LEAGUE_RULES.attemptsPerBoard).toBe(CUP_ATTEMPTS_PER_BOARD);
  });
});

describe('attempt replay verification', () => {
  const spec = cupBoardSpec('2026-W43', 0);
  const puzzle = generatePuzzle({ size: spec.size, seed: spec.seed, difficulty: spec.difficulty });
  const answer: Array<[number, number, Species]> = [];
  for (let r = 0; r < puzzle.size; r++) for (let c = 0; c < puzzle.size; c++) if (puzzle.solution[r][c] !== EMPTY && !puzzle.givens.some((g) => g.r === r && g.c === c)) answer.push([r, c, puzzle.solution[r][c] as Species]);

  function play(stepMs = 4000, extra: (s: Session, t: () => number) => void = () => {}): SessionEvent[] {
    let t = 0;
    const s = new Session(puzzle, { now: () => t });
    extra(s, () => t);
    for (const [r, c, sp] of answer) {
      t += stepMs;
      s.place(r, c, sp);
    }
    return s.events;
  }

  it('recomputes a clean attempt and its score from the log alone', () => {
    const v = verifyAttempt({ puzzle, events: play(), parSeconds: spec.parSeconds, ranked: true, serverElapsedMs: answer.length * 4000 + 500 });
    expect(v.valid).toBe(true);
    expect(v.completed).toBe(true);
    expect(v.mistakes).toBe(0);
    expect(v.score.total).toBeGreaterThan(550);
  });

  it('counts mistakes from the replay, whatever the client claims', () => {
    const events = play(4000, (s, t) => {
      for (let r = 0; r < puzzle.size; r++)
        for (let c = 0; c < puzzle.size; c++)
          if (puzzle.solution[r][c] === EMPTY && !s.givenMask[r][c]) {
            void t;
            s.place(r, c, CAT);
            return;
          }
    });
    const v = verifyAttempt({ puzzle, events, parSeconds: spec.parSeconds, ranked: true });
    expect(v.mistakes).toBe(1);
    expect(v.score.accuracy).toBe(75);
  });

  it('rejects hints and revives in ranked play', () => {
    const events: SessionEvent[] = [{ t: 10, type: 'hint' }, ...play().map((e) => ({ ...e, t: e.t + 20 }))];
    const v = verifyAttempt({ puzzle, events, parSeconds: spec.parSeconds, ranked: true });
    expect(v.valid).toBe(false);
    expect(v.problems).toContain('hint-in-ranked');
    expect(v.score.total).toBe(0);
  });

  it('rejects reordered timestamps, out-of-board moves and edits to givens', () => {
    const ev = play();
    const swapped = [...ev];
    [swapped[0], swapped[1]] = [{ ...swapped[1] }, { ...swapped[0] }];
    expect(verifyAttempt({ puzzle, events: swapped, parSeconds: 150, ranked: true }).problems).toContain('time-not-monotonic');
    expect(verifyAttempt({ puzzle, events: [{ t: 1, type: 'place', r: 99, c: 0, s: DOG }], parSeconds: 150, ranked: true }).problems).toContain('bad-coordinates');
    const g = puzzle.givens[0];
    expect(verifyAttempt({ puzzle, events: [{ t: 1, type: 'clear', r: g.r, c: g.c }], parSeconds: 150, ranked: true }).problems).toContain('given-modified');
  });

  it('takes time from the server clock and rejects a client clock running ahead of it', () => {
    const ev = play(4000);
    const fast = verifyAttempt({ puzzle, events: ev, parSeconds: 150, ranked: true, serverElapsedMs: 600_000 });
    expect(fast.elapsedSeconds).toBe(600);
    const lie = verifyAttempt({ puzzle, events: ev, parSeconds: 150, ranked: true, serverElapsedMs: 5_000 });
    expect(lie.problems).toContain('client-clock-ahead-of-server');
  });

  it('an unfinished attempt scores zero', () => {
    const v = verifyAttempt({ puzzle, events: play().slice(0, 3), parSeconds: 150, ranked: true });
    expect(v.completed).toBe(false);
    expect(v.score.total).toBe(0);
  });

  it('flags (but does not reject) implausibly fast solves for review', () => {
    const v = verifyAttempt({ puzzle, events: play(50), parSeconds: 150, ranked: true });
    expect(v.valid).toBe(true);
    expect(v.flags).toContain('very-fast-placements');
  });
});
