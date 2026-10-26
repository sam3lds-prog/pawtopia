import { describe, expect, it } from 'vitest';
import { defaultSave, migrateV1 } from '../../src/services/storage';
import { ACHIEVEMENTS, checkAchievements } from '../../src/meta/achievements';
import { claimMission, dailyMissions, missionStates, recordMissionEvent, unclaimedCount } from '../../src/meta/missions';
import { balance } from '../../src/meta/ledger';
import { recordWin } from '../../src/meta/progression';
import { attemptsLeft, bestAttempt, finishAttempt, startAttempt, weekSummary } from '../../src/competitions/localCup';
import { puzzleFor } from '../../src/game/puzzles';
import { captureSession, resumeSession } from '../../src/game/sessionPersistence';
import { Session } from '../../src/game/session';
import { EMPTY, type Species } from '../../src/engine/types';

const NOW = new Date(2026, 9, 25, 12);

describe('missions', () => {
  it('three a day, always including "Solve any board", the same for everyone on a date', () => {
    const a = dailyMissions('2026-10-25');
    expect(a).toHaveLength(3);
    expect(a[0].id).toBe('solve1');
    expect(dailyMissions('2026-10-25').map((m) => m.id)).toEqual(a.map((m) => m.id));
    expect(new Set(a.map((m) => m.id)).size).toBe(3);
  });

  it('progress, completion and a single claim', () => {
    const s = defaultSave(NOW);
    const done = recordMissionEvent(s, { kind: 'solved', mode: 'level', size: 7, mistakes: 0, hints: 0 }, NOW);
    expect(done.map((m) => m.id)).toContain('solve1');
    const key = missionStates(s, NOW).find((m) => m.def.id === 'solve1')!.key;
    expect(unclaimedCount(s, NOW)).toBeGreaterThanOrEqual(1);
    expect(claimMission(s, key, NOW)).toBe(20);
    expect(claimMission(s, key, NOW)).toBe(0);
    expect(balance(s)).toBeGreaterThanOrEqual(20);
  });

  it('cannot claim an unfinished mission', () => {
    const s = defaultSave(NOW);
    const m = missionStates(s, NOW)[0];
    expect(claimMission(s, m.key, NOW)).toBe(0);
    expect(balance(s)).toBe(0);
  });

  it('a new day starts fresh without touching anything earned', () => {
    const s = defaultSave(NOW);
    recordMissionEvent(s, { kind: 'solved', mode: 'level', size: 5, mistakes: 0, hints: 0 }, NOW);
    claimMission(s, missionStates(s, NOW)[0].key, NOW);
    const coins = balance(s);
    const tomorrow = new Date(2026, 9, 26, 12);
    expect(missionStates(s, tomorrow).filter((m) => !m.weekly).every((m) => m.progress === 0 && !m.claimed)).toBe(true);
    expect(balance(s)).toBe(coins);
  });

  it('the weekly mission counts distinct board sizes this week', () => {
    const s = defaultSave(NOW);
    for (const size of [5, 6, 7]) recordWin(s, { kind: 'zen', size, seed: size }, { size, seconds: 60, mistakes: 0, hintsUsed: 0, revives: 0, hearts: false }, NOW);
    const w = missionStates(s, NOW).find((m) => m.weekly)!;
    expect(w.done).toBe(true);
  });
});

describe('achievements', () => {
  it('unlock once, with a fixed coin gift', () => {
    const s = defaultSave(NOW);
    recordWin(s, { kind: 'level', level: 1 }, { size: 5, seconds: 40, mistakes: 0, hintsUsed: 0, revives: 0, hearts: true }, NOW);
    const first = checkAchievements(s, NOW).map((a) => a.id);
    expect(first).toEqual(expect.arrayContaining(['first_friend', 'perfect_pair']));
    expect(checkAchievements(s, NOW)).toEqual([]);
    const gifts = ACHIEVEMENTS.filter((a) => first.includes(a.id)).reduce((t, a) => t + a.coins, 0);
    expect(balance(s)).toBe(gifts);
  });

  it('every badge reports sane progress for a fresh save', () => {
    const s = defaultSave(NOW);
    for (const a of ACHIEVEMENTS) {
      const [cur, target] = a.progress(s);
      expect(cur).toBeGreaterThanOrEqual(0);
      expect(target).toBeGreaterThan(0);
    }
  });

  it('v1 players get credit for history (stats derived during migration)', () => {
    const s = migrateV1({ level: 14, bestTimes: { L1: 40, L12: 95 }, dailyDone: { '2026-10-01': true }, streak: 2, lastDailyDate: '2026-10-01', installDate: '2026-01-01T00:00:00Z', removeAds: false }, true, NOW);
    expect(s.stats.solved).toBe(14);
    expect(s.stats.bestBySize['5']).toBe(40);
    expect(s.stats.bestBySize['6']).toBe(95);
    expect(checkAchievements(s, NOW).map((a) => a.id)).toContain('first_friend');
  });
});

describe('local Paw Cup practice', () => {
  const mode = { kind: 'cup' as const, weekKey: '2026-W44', index: 0 };

  function solve(): { events: Session['events']; ms: number } {
    const p = puzzleFor(mode);
    let t = 0;
    const s = new Session(p, { now: () => t });
    for (let r = 0; r < p.size; r++)
      for (let c = 0; c < p.size; c++)
        if (p.solution[r][c] !== EMPTY && !s.givenMask[r][c]) {
          t += 5000;
          s.place(r, c, p.solution[r][c] as Species);
        }
    return { events: s.events, ms: t };
  }

  it('allows exactly two attempts per board and keeps the best', () => {
    const s = defaultSave(NOW);
    expect(startAttempt(s, mode, NOW)).toBe(true);
    const { events, ms } = solve();
    const sc = finishAttempt(s, mode, events, ms);
    expect(sc.total).toBeGreaterThan(550);
    expect(attemptsLeft(s, mode.weekKey, 0)).toBe(1);
    expect(startAttempt(s, mode, NOW)).toBe(true);
    finishAttempt(s, mode, events.slice(0, 2), 10_000); // abandoned / failed attempt
    expect(startAttempt(s, mode, NOW)).toBe(false);
    expect(bestAttempt(s, mode.weekKey, 0)?.score).toBe(sc.total);
    expect(weekSummary(s, mode.weekKey)).toMatchObject({ total: sc.total, boardsCleared: 1, attemptsUsed: 2 });
  });

  it('regression: an attempt saved and resumed midway scores the same as one played straight through', () => {
    const p = puzzleFor(mode);
    const moves: Array<[number, number, Species]> = [];
    for (let r = 0; r < p.size; r++) for (let c = 0; c < p.size; c++) if (p.solution[r][c] !== EMPTY && !p.givens.some((g) => g.r === r && g.c === c)) moves.push([r, c, p.solution[r][c] as Species]);

    const straight = defaultSave(NOW);
    startAttempt(straight, mode, NOW);
    const { events, ms } = solve();
    const expected = finishAttempt(straight, mode, events, ms).total;

    const save = defaultSave(NOW);
    startAttempt(save, mode, NOW);
    let t = 0;
    let s = new Session(p, { now: () => t });
    const half = Math.floor(moves.length / 2);
    for (const [r, c, sp] of moves.slice(0, half)) {
      t += 5000;
      s.place(r, c, sp);
    }
    const saved = JSON.parse(JSON.stringify(captureSession(mode, s))); // app closed here
    const back = resumeSession(saved)!;
    s = back.session;
    s.resume();
    for (const [r, c, sp] of moves.slice(half)) {
      // the restored session reads the real clock; drive its log the same way the game would
      s.place(r, c, sp);
    }
    expect(s.outcome).toBe('won');
    const got = finishAttempt(save, mode, s.events, ms);
    expect(got.total).toBe(expected);
    expect(got.total).toBeGreaterThan(550);
  });

  it('a hint in the log voids the attempt', () => {
    const s = defaultSave(NOW);
    startAttempt(s, mode, NOW);
    const { events, ms } = solve();
    const withHint = [{ t: 1, type: 'hint' as const }, ...events];
    expect(finishAttempt(s, mode, withHint, ms).total).toBe(0);
  });
});
