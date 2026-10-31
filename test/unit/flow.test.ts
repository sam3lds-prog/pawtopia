import { describe, expect, it } from 'vitest';
import { nextAfterWin, modeKey, isValidModeRef } from '../../src/game/modes';
import { captureSession, hasMeaningfulProgress, resumeSession } from '../../src/game/sessionPersistence';
import { GENERATOR_VERSION, puzzleFor } from '../../src/game/puzzles';
import { Session } from '../../src/game/session';
import { CAT, EMPTY } from '../../src/engine/types';
import { AD_POLICY, shouldShowInterstitial, type AdCadenceState } from '../../src/services/ads';
import { createIapService, entitlementCounts } from '../../src/services/iap';
import { addDaysKey, daysBetween, localWeekStart, prevDateKey, utcWeekBounds, utcWeekKey } from '../../src/game/dates';

describe('Next level (regression: v1 replayed the completed level)', () => {
  it('advances Journey to the following level', () => {
    expect(nextAfterWin({ kind: 'level', level: 1 })).toEqual({ kind: 'level', level: 2 });
    expect(nextAfterWin({ kind: 'level', level: 18 })).toEqual({ kind: 'level', level: 19 });
  });
  it('sends other modes back to their hub', () => {
    expect(nextAfterWin({ kind: 'daily', dateKey: '2026-10-25' })).toBe('journey');
    expect(nextAfterWin({ kind: 'zen', size: 6, seed: 3 })).toBe('journey');
    expect(nextAfterWin({ kind: 'cup', weekKey: '2026-W43', index: 0 })).toBe('cup');
  });
});

describe('mode refs', () => {
  it('keys are stable', () => {
    expect(modeKey({ kind: 'level', level: 7 })).toBe('L7');
    expect(modeKey({ kind: 'daily', dateKey: '2026-10-25' })).toBe('D2026-10-25');
  });
  it('validates untrusted saved refs', () => {
    expect(isValidModeRef({ kind: 'level', level: 3 })).toBe(true);
    expect(isValidModeRef({ kind: 'level', level: 0 })).toBe(false);
    expect(isValidModeRef({ kind: 'zen', size: 12, seed: 1 })).toBe(false);
    expect(isValidModeRef({ kind: 'daily', dateKey: 'yesterday' })).toBe(false);
    expect(isValidModeRef(null)).toBe(false);
  });
});

describe('resume after the app is closed', () => {
  it('restores the exact board', () => {
    const mode = { kind: 'level' as const, level: 4 };
    const s = new Session(puzzleFor(mode));
    const p = s.puzzle;
    let placed = 0;
    for (let r = 0; r < p.size && placed < 2; r++)
      for (let c = 0; c < p.size && placed < 2; c++)
        if (p.solution[r][c] !== EMPTY && !s.givenMask[r][c]) {
          s.place(r, c, p.solution[r][c] as 1 | 2);
          placed++;
        }
    const saved = JSON.parse(JSON.stringify(captureSession(mode, s)));
    expect(hasMeaningfulProgress(saved)).toBe(true);
    const back = resumeSession(saved)!;
    expect(back.mode).toEqual(mode);
    expect(back.session.cells).toEqual(s.cells);
  });

  it('keeps the board id, so a resumed board is credited to the world under the id it started with', () => {
    const mode = { kind: 'level' as const, level: 4 };
    const s = new Session(puzzleFor(mode));
    const saved = JSON.parse(JSON.stringify(captureSession(mode, s, new Date(), 4, { a: 'cotton', sanctuary: 'farm' }, 'L4:k1x:abc')));
    expect(saved.boardId).toBe('L4:k1x:abc');
    expect(resumeSession(saved)?.boardId).toBe('L4:k1x:abc');
    // Older saves had none; resuming one works and simply has no id (the game mints one).
    delete saved.boardId;
    expect(resumeSession(saved)?.boardId).toBeUndefined();
  });

  it('refuses to resume when the layout digest or generator version differs', () => {
    const mode = { kind: 'level' as const, level: 2 };
    const s = new Session(puzzleFor(mode));
    const saved = captureSession(mode, s)!;
    expect(resumeSession({ ...saved, digest: 'deadbeef' })).toBeNull();
    expect(resumeSession({ ...saved, generatorVersion: GENERATOR_VERSION + 1 })).toBeNull();
  });

  it('does not keep finished boards or lost Paw Cup attempts', () => {
    const cup = { kind: 'cup' as const, weekKey: '2026-W43', index: 0 };
    const s = new Session(puzzleFor(cup));
    const p = s.puzzle;
    let wrong: [number, number] | null = null;
    for (let r = 0; r < p.size && !wrong; r++) for (let c = 0; c < p.size && !wrong; c++) if (p.solution[r][c] !== CAT && !s.givenMask[r][c]) wrong = [r, c];
    for (let i = 0; i < 3; i++) s.place(wrong![0], wrong![1], CAT);
    expect(captureSession(cup, s)).toBeNull();
  });

  it('regression: a lost board is never saved or resumed (it used to come back frozen)', () => {
    const mode = { kind: 'level' as const, level: 5 };
    const s = new Session(puzzleFor(mode));
    const p = s.puzzle;
    let wrong: [number, number] | null = null;
    for (let r = 0; r < p.size && !wrong; r++) for (let c = 0; c < p.size && !wrong; c++) if (p.solution[r][c] !== CAT && !s.givenMask[r][c]) wrong = [r, c];
    const before = captureSession(mode, s)!;
    for (let i = 0; i < 3; i++) s.place(wrong![0], wrong![1], CAT);
    expect(s.outcome).toBe('lost');
    expect(captureSession(mode, s)).toBeNull();
    // A lost snapshot written by an older build is refused too.
    const lostSnap = { ...before, snap: { ...s.snapshot(), outcome: 'lost' as const } };
    expect(resumeSession(lostSnap)).toBeNull();
  });

  it('regression: a resumed Paw Cup attempt keeps its whole move log', () => {
    const cup = { kind: 'cup' as const, weekKey: '2026-W44', index: 1 };
    let t = 0;
    const s = new Session(puzzleFor(cup), { now: () => t });
    const p = s.puzzle;
    for (let r = 0; r < p.size; r++)
      for (let c = 0; c < p.size; c++)
        if (p.solution[r][c] !== EMPTY && !s.givenMask[r][c] && s.events.length < 2) {
          t += 3000;
          s.place(r, c, p.solution[r][c] as 1 | 2);
        }
    const saved = JSON.parse(JSON.stringify(captureSession(cup, s)));
    expect(saved.snap.events).toHaveLength(2);
    const back = resumeSession(saved)!;
    expect(back.session.events.map((e) => e.type)).toEqual(['place', 'place']);
    // Journey boards carry theirs too (the leaderboard server replays them); Zen boards don't need one.
    const lvl = { kind: 'level' as const, level: 3 };
    const ls = new Session(puzzleFor(lvl));
    expect(captureSession(lvl, ls)!.snap.events).toEqual([]);
    const zen = { kind: 'zen' as const, size: 6, seed: 3 };
    expect(captureSession(zen, new Session(puzzleFor(zen)))!.snap.events).toBeUndefined();
  });
});

describe('ad cadence policy', () => {
  const base: AdCadenceState = { removeAds: false, levelsCompleted: 20, boardsSinceLast: 5, lastShownAt: null, shownToday: 0 };
  const win = { mode: 'level' as const, outcome: 'won' as const, now: 10_000_000 };
  it('allows one after enough boards and time', () => {
    expect(shouldShowInterstitial(base, win)).toBe(true);
  });
  it('never during onboarding, after a loss, in Paw Cup, or for ad-free players', () => {
    expect(shouldShowInterstitial({ ...base, levelsCompleted: AD_POLICY.onboardingGraceLevels - 1 }, win)).toBe(false);
    expect(shouldShowInterstitial(base, { ...win, outcome: 'lost' })).toBe(false);
    expect(shouldShowInterstitial(base, { ...win, mode: 'cup' })).toBe(false);
    expect(shouldShowInterstitial({ ...base, removeAds: true }, win)).toBe(false);
  });
  it('respects spacing and the daily cap', () => {
    expect(shouldShowInterstitial({ ...base, boardsSinceLast: 2 }, win)).toBe(false);
    expect(shouldShowInterstitial({ ...base, lastShownAt: win.now - 60_000 }, win)).toBe(false);
    expect(shouldShowInterstitial({ ...base, shownToday: AD_POLICY.dailyCap }, win)).toBe(false);
  });
});

describe('purchases', () => {
  it('release builds cannot buy anything until a real store is wired', async () => {
    const store = createIapService(false);
    expect(store.available).toBe(false);
    expect(await store.purchase('remove_ads')).toEqual({ ok: false, reason: 'unavailable' });
    expect((await store.products()).every((p) => p.price === null)).toBe(true);
  });
  it('dev-stub grants never count in a release build', () => {
    expect(entitlementCounts('dev', false)).toBe(false);
    expect(entitlementCounts('dev', true)).toBe(true);
    expect(entitlementCounts('store', false)).toBe(true);
    expect(entitlementCounts(null, true)).toBe(false);
  });
});

describe('dates', () => {
  it('steps across month, year and DST boundaries by calendar day', () => {
    expect(prevDateKey('2026-03-01')).toBe('2026-02-28');
    expect(prevDateKey('2027-01-01')).toBe('2026-12-31');
    expect(prevDateKey('2026-03-09')).toBe('2026-03-08'); // US DST starts Mar 8 2026
    expect(addDaysKey('2026-11-01', 1)).toBe('2026-11-02'); // US DST ends Nov 1 2026
    expect(daysBetween('2026-10-01', '2026-10-25')).toBe(24);
    expect(localWeekStart('2026-10-25')).toBe('2026-10-19');
  });
  it('computes ISO weeks in UTC', () => {
    expect(utcWeekKey(new Date('2026-10-25T23:30:00Z'))).toBe('2026-W43');
    expect(utcWeekKey(new Date('2026-10-26T00:00:00Z'))).toBe('2026-W44');
    expect(utcWeekKey(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01');
    expect(utcWeekKey(new Date('2027-01-01T12:00:00Z'))).toBe('2026-W53');
    const { start, end } = utcWeekBounds(new Date('2026-10-25T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-10-19T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-26T00:00:00.000Z');
  });
});
