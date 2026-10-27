import { describe, expect, it } from 'vitest';
import { generatePuzzle } from '../../src/engine/generator';
import { CAT, DOG, type Puzzle } from '../../src/engine/types';
import { CASUAL_HEARTS } from '../../src/game/modes';
import { Session, type HintInfo, type SessionEvent } from '../../src/game/session';
import { verifyAttempt } from '../../src/competitions/verify';
import { balance } from '../../src/meta/ledger';
import {
  ITEM_CAP,
  OVERFLOW_COINS,
  POINTS,
  STARTER_ITEMS,
  grantItem,
  grantStarterItems,
  itemBalance,
  pawPoints,
  rankFor,
  useItem,
} from '../../src/meta/items';
import { claimMission, missionStates, recordMissionEvent } from '../../src/meta/missions';
import { recordWin } from '../../src/meta/progression';
import { reconcileRewards, rewardsForWin } from '../../src/meta/rewards';
import { defaultSave, normalizeSave } from '../../src/services/storage';

const NOW = new Date('2026-10-26T15:00:00Z');

describe('item ledger', () => {
  it('grants once per id and uses never go below zero', () => {
    const s = defaultSave(NOW);
    expect(grantItem(s, 'g1', 'treat', 2, 'gift', NOW)).toMatchObject({ granted: 2, overflowCoins: 0 });
    expect(grantItem(s, 'g1', 'treat', 2, 'gift', NOW)).toBeNull();
    expect(itemBalance(s, 'treat')).toBe(2);
    expect(useItem(s, 'u1', 'treat', NOW)).toBe('ok');
    expect(useItem(s, 'u1', 'treat', NOW)).toBe('already');
    expect(useItem(s, 'u2', 'treat', NOW)).toBe('ok');
    expect(useItem(s, 'u3', 'treat', NOW)).toBe('none');
    expect(itemBalance(s, 'treat')).toBe(0);
  });

  it('stops at the cap and turns the rest into coins, once, so nothing earned is lost', () => {
    const s = defaultSave(NOW);
    grantItem(s, 'fill', 'hint', ITEM_CAP.hint - 1, 'gift', NOW);
    const g = grantItem(s, 'more', 'hint', 3, 'journey', NOW)!;
    expect(g.granted).toBe(1);
    expect(g.overflowCoins).toBe(2 * OVERFLOW_COINS);
    expect(itemBalance(s, 'hint')).toBe(ITEM_CAP.hint);
    expect(balance(s)).toBe(2 * OVERFLOW_COINS);
    expect(grantItem(s, 'more', 'hint', 3, 'journey', NOW)).toBeNull();
    expect(balance(s)).toBe(2 * OVERFLOW_COINS);
  });

  it('Paw Points have no cap and survive a save round trip with the pantry', () => {
    const s = defaultSave(NOW);
    grantItem(s, 'p', 'points', 50_000, 'journey', NOW);
    grantItem(s, 't', 'treat', 3, 'gift', NOW);
    const back = normalizeSave(JSON.parse(JSON.stringify(s)), NOW);
    expect(pawPoints(back)).toBe(50_000);
    expect(itemBalance(back, 'treat')).toBe(3);
  });

  it('drops malformed or duplicated entries when loading', () => {
    const s = JSON.parse(JSON.stringify(defaultSave(NOW)));
    s.inventory.items = [
      { id: 'a', item: 'treat', delta: 2, at: '', source: 'gift' },
      { id: 'a', item: 'treat', delta: 2, at: '', source: 'gift' },
      { id: 'b', item: 'gold', delta: 9, at: '', source: 'gift' },
      { id: 'c', item: 'hint', delta: 'x', at: '', source: 'gift' },
    ];
    expect(itemBalance(normalizeSave(s, NOW), 'treat')).toBe(2);
    expect(normalizeSave(s, NOW).inventory.items).toHaveLength(1);
  });

  it('the starter pantry (3 treats, 5 tickets) arrives once', () => {
    const s = defaultSave(NOW);
    expect(grantStarterItems(s, NOW)).toBe(true);
    expect(grantStarterItems(s, NOW)).toBe(false);
    expect(itemBalance(s, 'treat')).toBe(STARTER_ITEMS.treat);
    expect(itemBalance(s, 'hint')).toBe(STARTER_ITEMS.hint);
  });
});

describe('earning treats, tickets and points', () => {
  const win = { size: 6, seconds: 90, mistakes: 0, hintsUsed: 0, revives: 0, hearts: true };

  it('a first clear gives a treat, every second new level a ticket, and points by measured difficulty', () => {
    const s = defaultSave(NOW);
    const r1 = rewardsForWin(s, { kind: 'level', level: 13 }, recordWin(s, { kind: 'level', level: 13 }, win, NOW), NOW, 'hard');
    expect(r1).toMatchObject({ treats: 1, hints: 0, points: POINTS.journeyBase + POINTS.difficulty.hard + POINTS.clean + POINTS.hintFree });
    const r2 = rewardsForWin(s, { kind: 'level', level: 14 }, recordWin(s, { kind: 'level', level: 14 }, { ...win, mistakes: 2, hintsUsed: 1 }, NOW), NOW, 'easy');
    expect(r2).toMatchObject({ treats: 1, hints: 1, points: POINTS.journeyBase });
  });

  it('replays earn no treats, tickets or base points; a later clean solve earns its bonus once', () => {
    const s = defaultSave(NOW);
    const mode = { kind: 'level' as const, level: 14 };
    rewardsForWin(s, mode, recordWin(s, mode, { ...win, mistakes: 1, hintsUsed: 1 }, NOW), NOW, 'medium');
    const before = { t: itemBalance(s, 'treat'), h: itemBalance(s, 'hint'), p: pawPoints(s) };
    const replay = rewardsForWin(s, mode, recordWin(s, mode, win, NOW), NOW, 'medium');
    expect(replay.treats + replay.hints).toBe(0);
    expect(replay.points).toBe(POINTS.clean + POINTS.hintFree); // first clean / hint-free solve of this level
    expect(itemBalance(s, 'treat')).toBe(before.t);
    expect(itemBalance(s, 'hint')).toBe(before.h);
    const again = rewardsForWin(s, mode, recordWin(s, mode, win, NOW), NOW, 'medium');
    expect(again.points).toBe(0);
    expect(pawPoints(s)).toBe(before.p + POINTS.clean + POINTS.hintFree);
  });

  it('old clears earn back-dated Paw Points on startup, but never treats or tickets', () => {
    const s = defaultSave(NOW);
    for (let L = 1; L <= 14; L++) s.journey.clears[`L${L}`] = { firstClearAt: 'x', bestSeconds: 60, bestMistakes: 0, clean: L % 2 === 0, hintFree: false, stars: 2 };
    const g = reconcileRewards(s, NOW, () => 'easy');
    expect(g.points).toBe(14 * POINTS.journeyBase + 7 * POINTS.clean);
    expect(itemBalance(s, 'treat')).toBe(0);
    expect(itemBalance(s, 'hint')).toBe(0);
    expect(reconcileRewards(s, NOW, () => 'easy').points).toBe(0);
  });

  it('the Daily pays points once per date', () => {
    const s = defaultSave(NOW);
    const mode = { kind: 'daily' as const, dateKey: '2026-10-26' };
    const r = rewardsForWin(s, mode, recordWin(s, mode, win, NOW), NOW, 'medium');
    expect(r.points).toBe(POINTS.dailyBase + POINTS.difficulty.medium + POINTS.clean + POINTS.hintFree);
    expect(rewardsForWin(s, mode, recordWin(s, mode, win, NOW), NOW, 'medium').points).toBe(0);
  });

  it('some errands add a treat or ticket, granted once with the coins', () => {
    const s = defaultSave(NOW);
    recordMissionEvent(s, { kind: 'solved', mode: 'level', size: 8, mistakes: 0, hints: 0 }, NOW);
    for (const m of missionStates(s, NOW).filter((x) => x.done && !x.claimed)) {
      claimMission(s, m.key, NOW);
      claimMission(s, m.key, NOW);
    }
    const expected = missionStates(s, NOW)
      .filter((m) => m.claimed)
      .reduce((a, m) => ({ treat: a.treat + (m.def.items?.treat ?? 0), hint: a.hint + (m.def.items?.hint ?? 0) }), { treat: 0, hint: 0 });
    expect(itemBalance(s, 'treat')).toBe(expected.treat);
    expect(itemBalance(s, 'hint')).toBe(expected.hint);
  });

  it('Paw Rank is a simple ladder of point thresholds', () => {
    expect(rankFor(0)).toMatchObject({ name: 'Sprout', next: 1000 });
    expect(rankFor(999).name).toBe('Sprout');
    expect(rankFor(1000).name).toBe('Seedling');
    expect(rankFor(100_000)).toMatchObject({ name: 'Sanctuary Keeper', next: null });
  });
});

describe('hint tickets on a board', () => {
  const p = generatePuzzle({ size: 7, seed: 31 });
  const target = (s: Session): HintInfo => s.peekHint()!;

  it('the first look is free; the exact cell costs one ticket; placing that same cell costs nothing more', () => {
    const s = new Session(p, { maxHearts: CASUAL_HEARTS });
    const h = target(s);
    expect(s.hintCost(h, 1, false)).toBe(0);
    s.commitHint(h, 1, false);
    expect(s.freeNudgeAvailable).toBe(false);
    expect(s.hintCost(h, 2, false)).toBe(1);
    s.commitHint(h, 2, true);
    expect(s.hintCost(h, 3, false)).toBe(0);
    expect(s.hintTierReached).toBe(2);
  });

  it('a second hint target pays on its first look, then its deeper tiers are free', () => {
    const s = new Session(p, { maxHearts: CASUAL_HEARTS });
    const first = target(s);
    s.commitHint(first, 1, false);
    s.hint(); // place the first target (the player paid for tier 2/3 or not; either way the board moves on)
    const second = target(s);
    expect(`${second.r},${second.c}`).not.toBe(`${first.r},${first.c}`);
    expect(s.hintCost(second, 1, false)).toBe(1);
    s.commitHint(second, 1, true);
    expect(s.hintCost(second, 2, false)).toBe(0);
    expect(s.hintCost(second, 3, false)).toBe(0);
  });

  it('boards with free hints (Zen, the guided board) never charge', () => {
    const s = new Session(p, { hearts: false });
    const h = target(s);
    s.commitHint(h, 1, false);
    expect(s.hintCost(h, 2, true)).toBe(0);
    expect(s.hintCost(h, 3, true)).toBe(0);
  });

  it('what was paid survives saving and resuming, so nothing is charged twice', () => {
    const s = new Session(p, { maxHearts: CASUAL_HEARTS });
    const h = target(s);
    s.commitHint(h, 1, false);
    s.commitHint(h, 2, true);
    const t = Session.restore(p, JSON.parse(JSON.stringify(s.snapshot())), { maxHearts: CASUAL_HEARTS })!;
    expect(t.freeNudgeAvailable).toBe(false);
    expect(t.hintCost(h, 3, false)).toBe(0);
  });

  it('a board saved before tickets existed that already used a hint has no free look left', () => {
    const s = new Session(p, { maxHearts: CASUAL_HEARTS });
    s.noteHint(target(s));
    const snap = s.snapshot();
    delete snap.hintState;
    expect(Session.restore(p, snap, { maxHearts: CASUAL_HEARTS })!.freeNudgeAvailable).toBe(false);
  });
});

describe('a treat on a board', () => {
  const p: Puzzle = generatePuzzle({ size: 6, seed: 44 });
  const wrongCell = (s: Session): [number, number] => {
    for (let r = 0; r < p.size; r++) for (let c = 0; c < p.size; c++) if (!s.givenMask[r][c] && p.solution[r][c] === DOG) return [r, c];
    throw new Error('none');
  };

  it('gives one heart back, never above the allowance', () => {
    const s = new Session(p, { maxHearts: CASUAL_HEARTS });
    expect(s.addHeart()).toBe(false); // already full
    const [r, c] = wrongCell(s);
    s.place(r, c, CAT);
    expect(s.hearts).toBe(4);
    expect(s.addHeart()).toBe(true);
    expect(s.hearts).toBe(5);
    expect(s.revives).toBe(1);
  });

  it('after a loss it brings the board back with one heart and every placement intact', () => {
    const s = new Session(p, { maxHearts: CASUAL_HEARTS });
    const [r, c] = wrongCell(s);
    for (let i = 0; i < 5; i++) s.place(r, c, CAT);
    expect(s.claimOutcome()).toBe('lost');
    expect(s.addHeart()).toBe(true);
    expect(s.outcome).toBe('playing');
    expect(s.hearts).toBe(1);
    s.place(r, c, CAT);
    expect(s.claimOutcome()).toBe('lost'); // the next loss is reported again, exactly once
    expect(s.claimOutcome()).toBeNull();
  });

  it('Zen has no hearts to restore', () => {
    expect(new Session(p, { hearts: false }).addHeart()).toBe(false);
  });

  it('a treat in a ranked Paw Cup log voids the attempt', () => {
    const s = new Session(p);
    const [r, c] = wrongCell(s);
    const events: SessionEvent[] = [
      { t: 1000, type: 'place', r, c, s: CAT },
      { t: 2000, type: 'revive' },
    ];
    expect(verifyAttempt({ puzzle: p, events, parSeconds: 150, ranked: true }).problems).toContain('revive-in-ranked');
  });
});

describe('fixes from the independent review', () => {
  const p = generatePuzzle({ size: 7, seed: 31 });

  it('looking at the free hint again (after any move) stays free, and survives a resume', () => {
    const s = new Session(p, { maxHearts: CASUAL_HEARTS });
    const h = s.peekHint()!;
    s.commitHint(h, 1, false);
    // The player marks a tile somewhere (the hint closes), then taps Hint again: same cell.
    const again = s.peekHint()!;
    expect(`${again.r},${again.c}`).toBe(`${h.r},${h.c}`);
    expect(s.hintCost(again, 1, false)).toBe(0);
    expect(s.hintCost(again, 2, false)).toBe(1); // the exact cell still costs a ticket
    const t = Session.restore(p, JSON.parse(JSON.stringify(s.snapshot())), { maxHearts: CASUAL_HEARTS })!;
    expect(t.hintCost(again, 1, false)).toBe(0);
  });

  it('a board with a paid hint or a mistake but no placement is still resumable', async () => {
    const { captureSession, hasMeaningfulProgress } = await import('../../src/game/sessionPersistence');
    const mode = { kind: 'level' as const, level: 14 };
    const { puzzleFor } = await import('../../src/game/puzzles');
    const pz = puzzleFor(mode);
    const fresh = new Session(pz, { maxHearts: CASUAL_HEARTS });
    expect(hasMeaningfulProgress(captureSession(mode, fresh))).toBe(false);
    const paid = new Session(pz, { maxHearts: CASUAL_HEARTS });
    const h = paid.peekHint()!;
    paid.commitHint(h, 1, false);
    paid.commitHint(h, 2, true);
    expect(hasMeaningfulProgress(captureSession(mode, paid))).toBe(true);
    const oops = new Session(pz, { maxHearts: CASUAL_HEARTS });
    for (let r = 0; r < pz.size; r++)
      for (let c = 0; c < pz.size; c++)
        if (!oops.givenMask[r][c] && pz.solution[r][c] === DOG && oops.mistakes === 0) oops.place(r, c, CAT);
    expect(hasMeaningfulProgress(captureSession(mode, oops))).toBe(true);
  });

  it('an errand claimed with a full treat jar reports coins instead of a treat', async () => {
    const { claimMissionDetailed } = await import('../../src/meta/missions');
    const { localWeekStart, localDateKey } = await import('../../src/game/dates');
    const s = defaultSave(NOW);
    grantItem(s, 'fill', 'treat', ITEM_CAP.treat, 'gift', NOW);
    // The weekly errand (three sizes) comes with a treat and a ticket.
    const wk = localWeekStart(localDateKey(NOW));
    for (const n of [5, 6, 7]) s.stats.sizesThisWeek[`${wk}:${n}`] = true;
    const weekly = missionStates(s, NOW).find((m) => m.weekly)!;
    expect(weekly.done).toBe(true);
    const got = claimMissionDetailed(s, weekly.key, NOW);
    expect(got.treats).toBe(0);
    expect(got.hints).toBe(1);
    expect(got.overflowCoins).toBe(OVERFLOW_COINS);
    expect(itemBalance(s, 'treat')).toBe(ITEM_CAP.treat);
    expect(claimMissionDetailed(s, weekly.key, NOW)).toEqual({ coins: 0, treats: 0, hints: 0, overflowCoins: 0 });
  });

  it('a treat is only offered when it would really give a heart back', () => {
    const s = new Session(p, { maxHearts: CASUAL_HEARTS });
    expect(s.canAddHeart()).toBe(false);
    expect(new Session(p, { hearts: false }).canAddHeart()).toBe(false);
  });
});
