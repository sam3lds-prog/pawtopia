import { describe, expect, it } from 'vitest';
import { defaultSave } from '../../src/services/storage';
import { advanceStreak, liveStreak, recordWin, starsFor, type BoardResult } from '../../src/meta/progression';
import { chapterAt, chapterOf, visibleChapters } from '../../src/meta/chapters';

const clean: BoardResult = { size: 5, seconds: 60, mistakes: 0, hintsUsed: 0, revives: 0, hearts: true };

describe('journey wins', () => {
  it('first clear advances nextLevel and records stars; a replay is not a first clear', () => {
    const s = defaultSave(new Date('2026-10-25T12:00:00Z'));
    const a = recordWin(s, { kind: 'level', level: 1 }, clean);
    expect(a.firstClear).toBe(true);
    expect(a.stars).toBe(3);
    expect(s.journey.nextLevel).toBe(2);
    expect(s.onboarding.tutorialDone).toBe(true);
    const b = recordWin(s, { kind: 'level', level: 1 }, { ...clean, seconds: 50, mistakes: 2 });
    expect(b.firstClear).toBe(false);
    expect(b.isBest).toBe(true);
    expect(s.journey.clears.L1.stars).toBe(3); // best stars kept
    expect(s.journey.clears.L1.bestSeconds).toBe(50);
    expect(s.journey.nextLevel).toBe(2); // replaying never moves the journey
  });

  it('replaying an older level does not rewind progress', () => {
    const s = defaultSave();
    s.journey.nextLevel = 9;
    recordWin(s, { kind: 'level', level: 3 }, clean);
    expect(s.journey.nextLevel).toBe(9);
  });

  it('stars: 1 for a solve, +1 no mistakes, +1 no hints', () => {
    expect(starsFor({ ...clean, mistakes: 1, hintsUsed: 1 })).toBe(1);
    expect(starsFor({ ...clean, hintsUsed: 2 })).toBe(2);
    expect(starsFor(clean)).toBe(3);
  });
});

describe('daily streak', () => {
  it('counts consecutive days and forgives one missed day per month (Cozy Day)', () => {
    const s = defaultSave();
    expect(advanceStreak(s, '2026-10-01').streak).toBe(1);
    expect(advanceStreak(s, '2026-10-02').streak).toBe(2);
    const skip = advanceStreak(s, '2026-10-04'); // missed the 3rd
    expect(skip).toEqual({ streak: 3, usedCozyDay: true });
    expect(advanceStreak(s, '2026-10-06').streak).toBe(1); // second miss in October resets
    expect(s.daily.bestStreak).toBe(3);
  });

  it('a new month gets a fresh Cozy Day', () => {
    const s = defaultSave();
    advanceStreak(s, '2026-10-30');
    advanceStreak(s, '2026-11-01'); // missed the 31st, uses November's
    expect(s.daily.streak).toBe(2);
    expect(s.daily.cozyDays['2026-11']).toBe('2026-10-31');
  });

  it('playing an older daily never rewinds the streak window', () => {
    const s = defaultSave();
    advanceStreak(s, '2026-10-10');
    advanceStreak(s, '2026-10-05');
    expect(s.daily.lastDate).toBe('2026-10-10');
  });

  it('live streak lapses only after Cozy Day can no longer help', () => {
    const s = defaultSave();
    advanceStreak(s, '2026-10-10');
    advanceStreak(s, '2026-10-11');
    expect(liveStreak(s, '2026-10-12')).toBe(2);
    expect(liveStreak(s, '2026-10-13')).toBe(2); // still rescuable today
    expect(liveStreak(s, '2026-10-14')).toBe(0);
  });

  it('a daily win records the day once and reports the streak', () => {
    const s = defaultSave();
    const w = recordWin(s, { kind: 'daily', dateKey: '2026-10-25' }, clean, new Date(2026, 9, 25, 9));
    expect(w.newDaily).toBe(true);
    expect(w.streak).toBe(1);
    const again = recordWin(s, { kind: 'daily', dateKey: '2026-10-25' }, clean, new Date(2026, 9, 25, 10));
    expect(again.newDaily).toBeUndefined();
    expect(again.firstClear).toBe(false);
  });
});

describe('lifetime stats', () => {
  it('track solves, clean solves and best time per size', () => {
    const s = defaultSave();
    recordWin(s, { kind: 'zen', size: 6, seed: 1 }, { ...clean, size: 6, seconds: 120 });
    recordWin(s, { kind: 'zen', size: 6, seed: 2 }, { ...clean, size: 6, seconds: 90, mistakes: 1 });
    expect(s.stats.solved).toBe(2);
    expect(s.stats.clean).toBe(1);
    expect(s.stats.bestBySize['6']).toBe(90);
    expect(s.zen.solved).toBe(2);
  });
});

describe('chapters', () => {
  it('maps levels to 20-level chapters', () => {
    expect(chapterOf(1).index).toBe(0);
    expect(chapterOf(20).index).toBe(0);
    expect(chapterOf(21).index).toBe(1);
    expect(chapterAt(2)).toMatchObject({ first: 41, last: 60 });
  });
  it('shows at least three chapters and every reached one', () => {
    expect(visibleChapters(1)).toHaveLength(3);
    expect(visibleChapters(85)).toHaveLength(5);
  });
});

import { isTutorial, levelTip } from '../../src/meta/onboarding';

describe('onboarding', () => {
  it('only the first, never-solved Journey board is the guided tutorial', () => {
    const s = defaultSave();
    expect(isTutorial({ kind: 'level', level: 1 }, s)).toBe(true);
    expect(isTutorial({ kind: 'level', level: 2 }, s)).toBe(false);
    expect(isTutorial({ kind: 'daily', dateKey: '2026-10-25' }, s)).toBe(false);
    recordWin(s, { kind: 'level', level: 1 }, clean);
    expect(isTutorial({ kind: 'level', level: 1 }, s)).toBe(false);
  });
  it('introduces one idea at a time, one sentence each', () => {
    expect(levelTip(4)).toMatch(/region/);
    expect(levelTip(7)).toMatch(/side by side/);
    expect(levelTip(3)).toBeNull();
    for (const L of [2, 4, 7, 11, 12, 19, 27, 41]) expect(levelTip(L)!.split('. ').length).toBeLessThanOrEqual(2);
  });
});
