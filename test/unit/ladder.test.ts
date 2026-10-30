import { describe, expect, it } from 'vitest';
import { MemoryKV } from '../../src/services/kv';
import { PRE_D35_BACKUP_KEY, V2_KEY, defaultSave, loadSave, upgradeLadder, type SaveV2 } from '../../src/services/storage';
import { puzzleFor } from '../../src/game/puzzles';
import { puzzleDigest } from '../../src/game/puzzleDigest';
import { Session } from '../../src/game/session';
import { captureSession, resumeSession } from '../../src/game/sessionPersistence';
import { levelRewardKey, type SpecVersion } from '../../src/game/specs';
import { grant } from '../../src/meta/ledger';
import { reconcileRewards } from '../../src/meta/rewards';
import { isPairLesson } from '../../src/meta/onboarding';
import { playsSolo } from '../../src/game/modes';
import { dailyPointsTier } from '../../src/game/specs';
import { rewardsForWin } from '../../src/meta/rewards';
import { recordWin } from '../../src/meta/progression';
import { pluralNoun } from '../../src/meta/animals';
import { difficultyReason, profileOf } from '../../src/game/grading';
import { addDaysKey } from '../../src/game/dates';

const NOW = new Date('2026-10-29T15:00:00Z');
const oldSpec = (L: number): SpecVersion => (L >= 6 ? 3 : 1);

/** A save as the app wrote it before D35: two-animal levels numbered from 1, no ladder field. */
function preD35(next: number): Record<string, unknown> {
  const s = defaultSave(NOW) as unknown as { journey: Record<string, unknown> } & Record<string, unknown>;
  const clears: Record<string, unknown> = {};
  for (let L = 1; L < next; L++)
    clears[`L${L}`] = { firstClearAt: NOW.toISOString(), bestSeconds: 60 + L, bestMistakes: 0, clean: L % 2 === 0, hintFree: true, stars: 3, ...(oldSpec(L) !== 1 ? { spec: oldSpec(L) } : {}) };
  s.journey = { nextLevel: next, bestTimes: { L10: 99 }, clears };
  const ob = s.onboarding as Record<string, unknown>;
  delete ob.soloRulesSeen;
  delete ob.pairRulesSeen;
  delete ob.pairLessonDone;
  delete ob.ladderNotice;
  Object.assign(ob, { seenRules: true, tutorialDone: true });
  return s;
}

describe('D35: saves from before the one-animal levels move up by 20', () => {
  it('level L + 20 plays exactly the board two-animal level L had', () => {
    for (const L of [1, 5, 6, 10, 20, 40, 75])
      expect(puzzleDigest(puzzleFor({ kind: 'level', level: L + 20 }, 4))).toBe(puzzleDigest(puzzleFor({ kind: 'level', level: L }, oldSpec(L))));
  });

  it('moves clears, best times, the next level and the board in progress, once, keeping a backup', () => {
    const raw = preD35(30) as Record<string, unknown> & { lastSession?: unknown; leaderboard: { pending: unknown[] } };
    const mode = { kind: 'level' as const, level: 30 };
    const session = new Session(puzzleFor(mode, 3));
    let free: [number, number] = [0, 0];
    outer: for (let r = 0; r < session.size; r++)
      for (let c = 0; c < session.size; c++)
        if (!session.givenMask[r][c]) {
          free = [r, c];
          break outer;
        }
    session.toggleMark(free[0], free[1]);
    raw.lastSession = captureSession(mode, session, NOW, 3);
    raw.leaderboard.pending = [{ key: 'L12', mode: { kind: 'level', level: 12 }, spec: 3, events: [], at: NOW.toISOString() }];
    const kv = new MemoryKV({ [V2_KEY]: JSON.stringify(raw) });

    const { save } = loadSave(kv, NOW);
    expect(save.journey.ladder).toBe(4);
    expect(save.journey.nextLevel).toBe(50);
    for (let L = 21; L < 50; L++) expect(save.journey.clears[`L${L}`]).toBeDefined();
    for (let L = 1; L <= 20; L++) expect(save.journey.clears[`L${L}`]).toBeUndefined();
    expect(save.journey.clears.L30).toMatchObject({ bestSeconds: 70, stars: 3, spec: 4 });
    expect(save.journey.bestTimes).toEqual({ L30: 99 });
    // The board in progress resumes as level 50, on the same board, with its ✕.
    expect(save.lastSession?.mode).toEqual({ kind: 'level', level: 50 });
    const r = resumeSession(save.lastSession);
    expect(r?.session.cells[free[0]][free[1]]).toBe(3);
    expect(puzzleDigest(r!.session.puzzle)).toBe(puzzleDigest(puzzleFor(mode, 3)));
    // A queued leaderboard solve moves with its board and keeps its award id.
    expect(save.leaderboard.pending[0]).toMatchObject({ key: 'L12', mode: { kind: 'level', level: 32 }, spec: 4 });
    // Two animals stay: the lesson counts as done, the Daily and the Cup are two-animal, and they hear about it once.
    expect(save.onboarding.pairLessonDone).toBe(true);
    expect(isPairLesson({ kind: 'level', level: 21 }, save)).toBe(false);
    expect(playsSolo(save.journey.nextLevel)).toBe(false);
    expect(save.onboarding.ladderNotice).toBe(true);

    expect(kv.getItem(PRE_D35_BACKUP_KEY)).toBe(JSON.stringify(raw));
    const again = loadSave(kv, NOW);
    expect(again.save).toEqual(save);
  });

  it('a player who never cleared a level starts the new ladder', () => {
    const kv = new MemoryKV({ [V2_KEY]: JSON.stringify(preD35(1)) });
    const { save } = loadSave(kv, NOW);
    expect(save.journey.nextLevel).toBe(1);
    expect(save.journey.ladder).toBe(4);
    expect(save.onboarding.ladderNotice).toBe(false);
    expect(playsSolo(1)).toBe(true);
  });

  it('a board from a retired spec is dropped rather than resumed as the wrong level', () => {
    const raw = preD35(75) as Record<string, unknown>;
    const mode = { kind: 'level' as const, level: 75 };
    raw.lastSession = captureSession(mode, new Session(puzzleFor(mode, 2)), NOW, 2);
    const { save } = loadSave(new MemoryKV({ [V2_KEY]: JSON.stringify(raw) }), NOW);
    expect(save.journey.nextLevel).toBe(95);
    expect(save.lastSession).toBeNull();
  });

  it('nothing pays twice: rewards follow the board, so moved clears earn nothing new', () => {
    const s = loadSave(new MemoryKV({ [V2_KEY]: JSON.stringify(preD35(1)) }), NOW).save as SaveV2;
    // The ledger a pre-D35 player had for levels 1–29 (ids were `L<level>` then).
    for (let L = 1; L < 30; L++) {
      grant(s, `clear:L${L}`, 35, 'journey', NOW);
      if (L % 2 === 0) grant(s, `clean:L${L}`, 10, 'journey', NOW);
    }
    const old = preD35(30) as unknown as SaveV2;
    s.journey = { ...s.journey, ...(old.journey as object), ladder: 3 } as SaveV2['journey'];
    upgradeLadder(s);
    const before = s.inventory.ledger.length;
    const got = reconcileRewards(s, NOW);
    const added = s.inventory.ledger.slice(before).map((e) => e.id);
    expect(added.filter((id) => !id.startsWith('chapter:'))).toEqual([]);
    expect(got.coins).toBeLessThanOrEqual(100);
    // The one-animal levels have their own ids, so playing them still pays.
    expect(levelRewardKey(3)).toBe('S3');
    expect(levelRewardKey(23)).toBe('L3');
  });
});

describe('D35 review fixes', () => {
  it('both Dailies of a date pay the same Paw Points, whichever board was played', () => {
    for (let i = 0; i < 14; i++) {
      const dateKey = addDaysKey('2026-11-01', i);
      const t = dailyPointsTier(dateKey, 'expert');
      expect(t).toBe(dailyPointsTier(dateKey, 'easy'));
      const pts = (rule?: 'solo') => {
        const s = defaultSave(NOW);
        const mode = { kind: 'daily' as const, dateKey, ...(rule ? { rule } : {}) };
        const win = { size: 7, seconds: 200, mistakes: 0, hintsUsed: 0, revives: 0, hearts: true, spec: rule ? 4 : 2 } as const;
        return rewardsForWin(s, mode, recordWin(s, mode, win, NOW), NOW, rule ? 'expert' : 'easy').points;
      };
      expect(pts('solo')).toBe(pts());
    }
  });

  it('plurals and the difficulty sentence read naturally on one-animal boards', () => {
    expect(['sheep', 'piglet', 'calf', 'pony', 'bunny', 'fox', 'elephant calf', 'goat kid'].map(pluralNoun)).toEqual([
      'sheep',
      'piglets',
      'calves',
      'ponies',
      'bunnies',
      'foxes',
      'elephant calves',
      'goat kids',
    ]);
    for (let L = 1; L <= 20; L++) expect(difficultyReason(profileOf(puzzleFor({ kind: 'level', level: L }, 4)))).not.toMatch(/pets|to start/);
  });
});
